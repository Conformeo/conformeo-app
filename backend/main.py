import os
import shutil
from uuid import uuid4
from typing import List, Optional
from dotenv import load_dotenv
import zipfile

# Chargement des variables d'environnement locales (.env) si présentes
load_dotenv()

import cloudinary
import cloudinary.uploader
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from sqlalchemy import text
from sqlalchemy.orm import Session

import models, schemas, security
import pdf_generator
from database import engine, get_db
from datetime import datetime

# Création des tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Conforméo API")

# --- CONFIGURATION CLOUDINARY ---
cloudinary_config = {
    "cloud_name": os.getenv("CLOUDINARY_CLOUD_NAME"),
    "api_key": os.getenv("CLOUDINARY_API_KEY"),
    "api_secret": os.getenv("CLOUDINARY_API_SECRET"),
    "secure": True,
}

# Vérification et application de la configuration
required_keys = ["cloud_name", "api_key", "api_secret"]
missing = [k for k in required_keys if not cloudinary_config.get(k)]

if missing:
    print(f"⚠️ Cloudinary non configuré correctement. Clés manquantes : {', '.join(missing)}")
else:
    cloudinary.config(**cloudinary_config)
    print(f"✅ Cloudinary configuré pour le cloud: {cloudinary_config['cloud_name']}")

# --- CONFIGURATION FICHIERS LOCAUX ---
os.makedirs("uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="uploads"), name="static")

# --- CORS (Autorisations larges pour le dev) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Petit endpoint de test
@app.get("/")
def root():
    return {"message": "Conformeo API is running 🚀", "cors": "enabled"}


# ==========================================
# 1. UTILISATEURS & AUTH
# ==========================================

@app.post("/users", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    hashed_pwd = security.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_pwd, role=user.role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = security.create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}


# ==========================================
# 2. CHANTIERS
# ==========================================

@app.post("/chantiers", response_model=schemas.ChantierOut)
def create_chantier(chantier: schemas.ChantierCreate, db: Session = Depends(get_db)):
    new_chantier = models.Chantier(
        nom=chantier.nom,
        adresse=chantier.adresse,
        client=chantier.client,
        cover_url=chantier.cover_url
    )
    db.add(new_chantier)
    db.commit()
    db.refresh(new_chantier)
    return new_chantier

@app.get("/chantiers", response_model=List[schemas.ChantierOut])
def read_chantiers(db: Session = Depends(get_db)):
    return db.query(models.Chantier).all()

@app.put("/chantiers/{chantier_id}/signature")
def sign_chantier(chantier_id: int, signature_url: str, db: Session = Depends(get_db)):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")
    
    chantier.signature_url = signature_url
    db.commit()
    return {"status": "signed", "url": signature_url}

# ==========================================
# 3. RAPPORTS & PHOTOS
# ==========================================

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """Envoie l'image sur Cloudinary et renvoie l'URL sécurisée."""
    try:
        result = cloudinary.uploader.upload(file.file, folder="conformeo_chantiers")
        return {"url": result.get("secure_url")}
    except Exception as e:
        print(f"Erreur Upload Cloudinary: {e}")
        raise HTTPException(status_code=500, detail=f"Cloudinary error: {str(e)}")

@app.post("/rapports", response_model=schemas.RapportOut)
def create_rapport(rapport: schemas.RapportCreate, db: Session = Depends(get_db)):
    # 1. Création du rapport parent
    new_rapport = models.Rapport(
        titre=rapport.titre,
        description=rapport.description,
        chantier_id=rapport.chantier_id,
        niveau_urgence=rapport.niveau_urgence,
        latitude=rapport.latitude,
        longitude=rapport.longitude,
        photo_url=rapport.image_urls[0] if rapport.image_urls else None
    )
    db.add(new_rapport)
    db.commit()
    db.refresh(new_rapport)

    # 2. Création des images enfants
    if rapport.image_urls:
        for url in rapport.image_urls:
            new_img = models.RapportImage(url=url, rapport_id=new_rapport.id)
            db.add(new_img)
        
        db.commit()
        db.refresh(new_rapport)
        
    return new_rapport

@app.get("/rapports", response_model=List[schemas.RapportOut])
def read_all_rapports(db: Session = Depends(get_db)):
    """Permet de voir tous les rapports via le navigateur"""
    return db.query(models.Rapport).all()

@app.get("/chantiers/{chantier_id}/rapports", response_model=List[schemas.RapportOut])
def read_rapports_chantier(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).all()

@app.get("/chantiers/{chantier_id}/pdf")
def download_pdf(chantier_id: int, db: Session = Depends(get_db)):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")

    rapports = db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).all()
    
    # On récupère les inspections pour les inclure dans le rapport
    inspections = db.query(models.Inspection).filter(models.Inspection.chantier_id == chantier_id).all()

    filename = f"Rapport_{chantier.id}.pdf"
    file_path = f"uploads/{filename}"

    # On passe 'inspections' à la fonction
    pdf_generator.generate_pdf(chantier, rapports, inspections, file_path)

    return FileResponse(path=file_path, filename=filename, media_type='application/pdf')


# ==========================================
# 4. DASHBOARD & MATERIEL
# ==========================================

@app.get("/dashboard/stats")
def get_stats(db: Session = Depends(get_db)):
    return {
        "total_chantiers": db.query(models.Chantier).count(),
        "actifs": db.query(models.Chantier).filter(models.Chantier.est_actif == True).count(),
        "rapports": db.query(models.Rapport).count(),
        "alertes": db.query(models.Rapport).count()
    }

@app.post("/materiels", response_model=schemas.MaterielOut)
def create_materiel(mat: schemas.MaterielCreate, db: Session = Depends(get_db)):
    new_mat = models.Materiel(
        nom=mat.nom,
        reference=mat.reference,
        etat=mat.etat,
        # 👇 C'EST ICI LE CORRECTIF : ON SAUVEGARDE L'IMAGE
        image_url=mat.image_url,
        chantier_id=None 
    )
    db.add(new_mat)
    db.commit()
    db.refresh(new_mat)
    return new_mat

@app.get("/materiels", response_model=List[schemas.MaterielOut])
def read_materiels(db: Session = Depends(get_db)):
    return db.query(models.Materiel).all()

@app.put("/materiels/{materiel_id}/transfert")
def transfer_materiel(materiel_id: int, chantier_id: Optional[int] = None, db: Session = Depends(get_db)):
    mat = db.query(models.Materiel).filter(models.Materiel.id == materiel_id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Matériel introuvable")
    mat.chantier_id = chantier_id
    db.commit()
    return {"status": "success"}

# ==========================================
# 6. QHSE (INSPECTIONS)
# ==========================================

@app.post("/inspections", response_model=schemas.InspectionOut)
def create_inspection(inspection: schemas.InspectionCreate, db: Session = Depends(get_db)):
    new_insp = models.Inspection(
        titre=inspection.titre,
        type=inspection.type,
        data=inspection.data,
        chantier_id=inspection.chantier_id,
        createur=inspection.createur
    )
    db.add(new_insp)
    db.commit()
    db.refresh(new_insp)
    return new_insp

@app.get("/chantiers/{chantier_id}/inspections", response_model=List[schemas.InspectionOut])
def read_inspections(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.Inspection).filter(models.Inspection.chantier_id == chantier_id).all()

@app.get("/inspections/{inspection_id}/pdf")
def download_inspection_pdf(inspection_id: int, db: Session = Depends(get_db)):
    inspection = db.query(models.Inspection).filter(models.Inspection.id == inspection_id).first()
    if not inspection: raise HTTPException(status_code=404, detail="Audit introuvable")
    
    chantier = db.query(models.Chantier).filter(models.Chantier.id == inspection.chantier_id).first()
    
    date_str = inspection.date_creation.strftime('%Y-%m-%d')
    filename = f"Audit_{inspection.type}_{date_str}.pdf"
    file_path = f"uploads/{filename}"
    
    pdf_generator.generate_audit_pdf(chantier, inspection, file_path)
    return FileResponse(path=file_path, filename=filename, media_type='application/pdf')


# ==========================================
# 7. PPSPS
# ==========================================

@app.post("/ppsps", response_model=schemas.PPSPSOut)
def create_ppsps(ppsps: schemas.PPSPSCreate, db: Session = Depends(get_db)):
    new_ppsps = models.PPSPS(
        chantier_id=ppsps.chantier_id,
        maitre_ouvrage=ppsps.maitre_ouvrage,
        maitre_oeuvre=ppsps.maitre_oeuvre,
        coordonnateur_sps=ppsps.coordonnateur_sps,
        responsable_chantier=ppsps.responsable_chantier,
        nb_compagnons=ppsps.nb_compagnons,
        horaires=ppsps.horaires,
        duree_travaux=ppsps.duree_travaux,
        secours_data=ppsps.secours_data,
        installations_data=ppsps.installations_data,
        taches_data=ppsps.taches_data
    )
    db.add(new_ppsps)
    db.commit()
    db.refresh(new_ppsps)
    return new_ppsps

@app.get("/chantiers/{chantier_id}/ppsps", response_model=List[schemas.PPSPSOut])
def read_ppsps_chantier(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.PPSPS).filter(models.PPSPS.chantier_id == chantier_id).all()

@app.get("/ppsps/{ppsps_id}/pdf")
def download_ppsps_pdf(ppsps_id: int, db: Session = Depends(get_db)):
    ppsps = db.query(models.PPSPS).filter(models.PPSPS.id == ppsps_id).first()
    if not ppsps: raise HTTPException(status_code=404, detail="PPSPS introuvable")
    
    chantier = db.query(models.Chantier).filter(models.Chantier.id == ppsps.chantier_id).first()
    filename = f"PPSPS_{chantier.nom}.pdf"
    file_path = f"uploads/{filename}"
    
    pdf_generator.generate_ppsps_pdf(chantier, ppsps, file_path)
    return FileResponse(path=file_path, filename=filename, media_type='application/pdf')

# ==========================================
# 8. DOE & PIC
# ==========================================

@app.post("/pics", response_model=schemas.PICOut)
def create_or_update_pic(pic: schemas.PICCreate, db: Session = Depends(get_db)):
    existing_pic = db.query(models.PIC).filter(models.PIC.chantier_id == pic.chantier_id).first()
    
    if existing_pic:
        existing_pic.background_url = pic.background_url
        existing_pic.final_url = pic.final_url
        existing_pic.elements_data = pic.elements_data
        existing_pic.date_update = datetime.now()
        db.commit()
        db.refresh(existing_pic)
        return existing_pic
    else:
        new_pic = models.PIC(
            chantier_id=pic.chantier_id,
            background_url=pic.background_url,
            final_url=pic.final_url,
            elements_data=pic.elements_data
        )
        db.add(new_pic)
        db.commit()
        db.refresh(new_pic)
        return new_pic

@app.get("/chantiers/{chantier_id}/pic", response_model=Optional[schemas.PICOut])
def read_pic_chantier(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.PIC).filter(models.PIC.chantier_id == chantier_id).first()

@app.get("/chantiers/{chantier_id}/doe")
def download_doe(chantier_id: int, db: Session = Depends(get_db)):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not chantier: raise HTTPException(status_code=404, detail="Chantier introuvable")

    zip_filename = f"DOE_{chantier.nom.replace(' ', '_')}.zip"
    zip_path = f"uploads/{zip_filename}"

    with zipfile.ZipFile(zip_path, 'w') as zipf:
        # A. Journal
        rapports = db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).all()
        inspections = db.query(models.Inspection).filter(models.Inspection.chantier_id == chantier_id).all()
        journal_name = f"1_Journal_Suivi.pdf"
        journal_path = f"uploads/{journal_name}"
        pdf_generator.generate_pdf(chantier, rapports, inspections, journal_path)
        zipf.write(journal_path, journal_name)

        # B. PPSPS
        ppsps_list = db.query(models.PPSPS).filter(models.PPSPS.chantier_id == chantier_id).all()
        for index, doc in enumerate(ppsps_list):
            ppsps_name = f"2_PPSPS_{index+1}.pdf"
            ppsps_path = f"uploads/{ppsps_name}"
            pdf_generator.generate_ppsps_pdf(chantier, doc, ppsps_path)
            zipf.write(ppsps_path, ppsps_name)

        # C. Audits
        for index, insp in enumerate(inspections):
            audit_name = f"3_Audit_{insp.type}_{index+1}.pdf"
            audit_path = f"uploads/{audit_name}"
            pdf_generator.generate_audit_pdf(chantier, insp, audit_path)
            zipf.write(audit_path, audit_name)

        # D. PIC
        pic = db.query(models.PIC).filter(models.PIC.chantier_id == chantier_id).first()
        if pic and pic.final_url:
            try:
                response = requests.get(pic.final_url)
                if response.status_code == 200:
                    ext = "jpg" if "jpeg" in response.headers.get("content-type", "") else "png"
                    pic_name = f"4_Plan_Installation_PIC.{ext}"
                    pic_path = f"uploads/{pic_name}"
                    with open(pic_path, "wb") as f: f.write(response.content)
                    zipf.write(pic_path, pic_name)
            except: pass

    return FileResponse(path=zip_path, filename=zip_filename, media_type='application/zip')

# --- ROUTES SUPPRESSION ---

@app.delete("/chantiers/{chantier_id}")
def delete_chantier(chantier_id: int, db: Session = Depends(get_db)):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")

    # 1. Supprimer les dépendances (Enfants)
    # On met à jour le matériel pour qu'il retourne au dépôt (id=None) au lieu de le supprimer
    db.query(models.Materiel).filter(models.Materiel.chantier_id == chantier_id).update({"chantier_id": None})
    
    # On supprime les documents liés
    db.query(models.RapportImage).filter(models.RapportImage.rapport.has(chantier_id=chantier_id)).delete(synchronize_session=False)
    db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).delete()
    db.query(models.Inspection).filter(models.Inspection.chantier_id == chantier_id).delete()
    db.query(models.PPSPS).filter(models.PPSPS.chantier_id == chantier_id).delete()
    db.query(models.PIC).filter(models.PIC.chantier_id == chantier_id).delete()

    # 2. Supprimer le chantier (Parent)
    db.delete(chantier)
    db.commit()
    return {"status": "success", "message": "Chantier et ses données supprimés"}

@app.delete("/materiels/{materiel_id}")
def delete_materiel(materiel_id: int, db: Session = Depends(get_db)):
    item = db.query(models.Materiel).filter(models.Materiel.id == materiel_id).first()
    if not item: raise HTTPException(status_code=404, detail="Matériel introuvable")
    
    db.delete(item)
    db.commit()
    return {"status": "success"}

# ==========================================
# 9. MIGRATIONS & MAINTENANCE
# ==========================================

@app.get("/reset_data")
def reset_data(db: Session = Depends(get_db)):
    try:
        db.query(models.RapportImage).delete()
        db.query(models.Rapport).delete()
        db.query(models.Materiel).delete()
        db.query(models.Inspection).delete()
        db.query(models.PPSPS).delete()
        db.query(models.PIC).delete()
        db.query(models.Chantier).delete()
        db.commit()
        return {"message": "Base nettoyée"}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}

@app.get("/migrate_db_v5")
def migrate_db_v5(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE ppsps ADD COLUMN IF NOT EXISTS secours_data JSON"))
        db.execute(text("ALTER TABLE ppsps ADD COLUMN IF NOT EXISTS installations_data JSON"))
        db.execute(text("ALTER TABLE ppsps ADD COLUMN IF NOT EXISTS taches_data JSON"))
        db.execute(text("ALTER TABLE ppsps ADD COLUMN IF NOT EXISTS duree_travaux VARCHAR"))
        db.commit()
        return {"message": "Migration V5 (PPSPS OPPBTP) réussie !"}
    except Exception as e:
        return {"status": "Erreur", "details": str(e)}

@app.get("/migrate_db_v6")
def migrate_db_v6(db: Session = Depends(get_db)):
    try:
        models.Base.metadata.create_all(bind=engine)
        return {"message": "Migration V6 (PIC) réussie !"}
    except Exception as e:
        return {"status": "Erreur", "details": str(e)}

@app.get("/migrate_db_v7")
def migrate_db_v7(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE materiels ADD COLUMN IF NOT EXISTS image_url VARCHAR"))
        db.commit()
        return {"message": "Migration V7 (Images Matériel) réussie !"}
    except Exception as e:
        return {"status": "Erreur", "details": str(e)}

@app.get("/force_fix_materiel")
def force_fix_materiel(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE materiels ADD COLUMN image_url VARCHAR"))
        db.commit()
        return {"message": "✅ Succès : Colonne image_url ajoutée !"}
    except Exception as e:
        db.rollback()
        return {"message": f"Info (Déjà fait ?) : {str(e)}"}

@app.get("/force_fix_ppsps")
def force_fix_ppsps(db: Session = Depends(get_db)):
    try:
        commands = [
            "ALTER TABLE ppsps ADD COLUMN responsable_chantier VARCHAR",
            "ALTER TABLE ppsps ADD COLUMN duree_travaux VARCHAR",
            "ALTER TABLE ppsps ADD COLUMN secours_data JSON",
            "ALTER TABLE ppsps ADD COLUMN installations_data JSON",
            "ALTER TABLE ppsps ADD COLUMN taches_data JSON"
        ]
        results = []
        for cmd in commands:
            try:
                db.execute(text(cmd))
                db.commit()
                results.append(f"Succès: {cmd}")
            except Exception as e:
                db.rollback()
                results.append(f"Ignoré: {str(e)}")
        return {"status": "Terminé", "details": results}
    except Exception as e:
        return {"status": "Erreur critique", "details": str(e)}


@app.get("/migrate_multi_tenant")
def migrate_multi_tenant(db: Session = Depends(get_db)):
    try:
        # 1. Créer la table companies
        models.Base.metadata.create_all(bind=engine)
        
        # 2. Ajouter les colonnes company_id (si elles n'existent pas)
        # Note : SQLite ne supporte pas bien ADD COLUMN avec ForeignKey en une ligne, 
        # mais Postgres (Render) le gère très bien.
        tables = ["users", "chantiers", "materiels"]
        for t in tables:
            try:
                db.execute(text(f"ALTER TABLE {t} ADD COLUMN company_id INTEGER"))
            except:
                print(f"Colonne company_id existe déjà pour {t}")

        db.commit()

        # 3. Créer l'entreprise par défaut si elle n'existe pas
        demo_company = db.query(models.Company).filter(models.Company.id == 1).first()
        if not demo_company:
            demo_company = models.Company(name="Ma Société BTP (Démo)", subscription_plan="enterprise")
            db.add(demo_company)
            db.commit()
            db.refresh(demo_company)
        
        cid = demo_company.id

        # 4. Rattacher toutes les données orphelines à cette entreprise
        db.execute(text(f"UPDATE users SET company_id = {cid} WHERE company_id IS NULL"))
        db.execute(text(f"UPDATE chantiers SET company_id = {cid} WHERE company_id IS NULL"))
        db.execute(text(f"UPDATE materiels SET company_id = {cid} WHERE company_id IS NULL"))
        
        db.commit()

        return {"message": "Migration Multi-Tenant réussie ! Toutes les données sont rattachées à 'Ma Société BTP'."}

    except Exception as e:
        db.rollback()
        return {"status": "Erreur", "details": str(e)}