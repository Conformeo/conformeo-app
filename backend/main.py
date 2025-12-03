import os
import shutil
from uuid import uuid4
from typing import List, Optional

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

# Création des tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Conforméo API")

# --- CONFIGURATION CLOUDINARY ---
cloudinary_config = {
  "cloud_name": os.getenv("CLOUDINARY_CLOUD_NAME"),
  "api_key": os.getenv("CLOUDINARY_API_KEY"),
  "api_secret": os.getenv("CLOUDINARY_API_SECRET"),
  "secure": True
}

if cloudinary_config["cloud_name"] and cloudinary_config["api_key"]:
    cloudinary.config(**cloudinary_config)
    print(f"✅ Cloudinary connecté sur le cloud: {cloudinary_config['cloud_name']}")
else:
    print("⚠️ ATTENTION : Clés Cloudinary manquantes !")

# Dossier uploads local
os.makedirs("uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="uploads"), name="static")

# --- CORS ---
origins = [
    "http://localhost:8100",
    "http://localhost:4200",
    "https://conformeo-app.vercel.app",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. UTILISATEURS & AUTH
# ==========================================

@app.post("/users", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    
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
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    
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
    try:
        result = cloudinary.uploader.upload(file.file, folder="conformeo_chantiers")
        return {"url": result.get("secure_url")}
    except Exception as e:
        print(f"Erreur Upload: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur Cloudinary: {str(e)}")

@app.post("/rapports", response_model=schemas.RapportOut)
def create_rapport(rapport: schemas.RapportCreate, db: Session = Depends(get_db)):
    # Création du rapport parent
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

    # Création des images liées (Table rapport_images)
    if rapport.image_urls:
        for url in rapport.image_urls:
            new_img = models.RapportImage(url=url, rapport_id=new_rapport.id)
            db.add(new_img)
        
        db.commit()
        db.refresh(new_rapport)
        
    return new_rapport

@app.get("/chantiers/{chantier_id}/rapports", response_model=List[schemas.RapportOut])
def read_rapports_chantier(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).all()

@app.get("/chantiers/{chantier_id}/pdf")
def download_pdf(chantier_id: int, db: Session = Depends(get_db)):
    # 1. Récupérer le chantier
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")

    # 2. Récupérer les données liées
    rapports = db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).all()
    
    # 👇 C'EST ICI QUE CA MANQUAIT : On récupère les inspections
    inspections = db.query(models.Inspection).filter(models.Inspection.chantier_id == chantier_id).all()

    # 3. Préparer le fichier
    filename = f"Rapport_{chantier.id}.pdf"
    file_path = f"uploads/{filename}"

    # 4. Générer le PDF (Avec les 4 arguments !)
    # 👇 AJOUT DE 'inspections'
    pdf_generator.generate_pdf(chantier, rapports, inspections, file_path)

    return FileResponse(path=file_path, filename=filename, media_type='application/pdf')
    
# ==========================================
# 4. MATÉRIEL
# ==========================================

@app.post("/materiels", response_model=schemas.MaterielOut)
def create_materiel(mat: schemas.MaterielCreate, db: Session = Depends(get_db)):
    new_mat = models.Materiel(
        nom=mat.nom,
        reference=mat.reference,
        etat=mat.etat,
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
# 5. QHSE (INSPECTIONS)
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

# ==========================================
# 6. PPSPS (NOUVEAU MODULE COMPLET)
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
# 7. ROUTES DE MIGRATION & MAINTENANCE
# ==========================================

@app.get("/dashboard/stats")
def get_stats(db: Session = Depends(get_db)):
    return {
        "total_chantiers": db.query(models.Chantier).count(),
        "actifs": db.query(models.Chantier).filter(models.Chantier.est_actif == True).count(),
        "rapports": db.query(models.Rapport).count(),
        "alertes": db.query(models.Rapport).count()
    }

@app.get("/reset_data")
def reset_data(db: Session = Depends(get_db)):
    try:
        db.query(models.Rapport).delete()
        db.query(models.Materiel).delete()
        db.query(models.Chantier).delete()
        db.commit()
        return {"message": "Base nettoyée"}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}

@app.get("/migrate_db_v5")
def migrate_db_v5(db: Session = Depends(get_db)):
    try:
        # Création des nouvelles colonnes pour le PPSPS
        db.execute(text("ALTER TABLE ppsps ADD COLUMN IF NOT EXISTS secours_data JSON"))
        db.execute(text("ALTER TABLE ppsps ADD COLUMN IF NOT EXISTS installations_data JSON"))
        db.execute(text("ALTER TABLE ppsps ADD COLUMN IF NOT EXISTS taches_data JSON"))
        db.execute(text("ALTER TABLE ppsps ADD COLUMN IF NOT EXISTS duree_travaux VARCHAR"))
        db.commit()
        return {"message": "Migration V5 (PPSPS OPPBTP) réussie !"}
    except Exception as e:
        return {"status": "Erreur", "details": str(e)}

# --- ROUTE DE RÉPARATION FORCEE ---
@app.get("/force_fix_ppsps")
def force_fix_ppsps(db: Session = Depends(get_db)):
    try:
        # On tente d'ajouter les colonnes manquantes une par une
        # Si une colonne existe déjà, PostgreSQL renverra une erreur qu'on attrape,
        # mais on continue pour les autres.
        
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
                results.append(f"Ignoré (existe déjà ?): {cmd} -> {str(e)}")
                
        return {"status": "Terminé", "details": results}

    except Exception as e:
        return {"status": "Erreur critique", "details": str(e)}