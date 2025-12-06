import os
import shutil
from uuid import uuid4
from typing import List, Optional
from dotenv import load_dotenv
import zipfile
import csv
import codecs
from datetime import datetime, timedelta, date # <--- Ajout timedelta, date

load_dotenv()

import requests
import cloudinary
import cloudinary.uploader
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from sqlalchemy import text, func # <--- Ajout func
from sqlalchemy.orm import Session

import models, schemas, security
import pdf_generator
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Conforméo API")

# --- CONFIGURATION ---
cloudinary_config = {
    "cloud_name": os.getenv("CLOUDINARY_CLOUD_NAME"),
    "api_key": os.getenv("CLOUDINARY_API_KEY"),
    "api_secret": os.getenv("CLOUDINARY_API_SECRET"),
    "secure": True,
}
if cloudinary_config["cloud_name"]:
    cloudinary.config(**cloudinary_config)

os.makedirs("uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="uploads"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Conforméo API Ready 🚀"}

# ==========================================
# 1. UTILISATEURS
# ==========================================
@app.post("/users", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email pris")
    hashed_pwd = security.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_pwd, role=user.role)
    db.add(new_user); db.commit(); db.refresh(new_user)
    return new_user

@app.post("/token", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Erreur login")
    token = security.create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": token, "token_type": "bearer"}

# ==========================================
# 2. DASHBOARD (LA VERSION INTELLIGENTE)
# ==========================================
@app.get("/dashboard/stats")
def get_stats(db: Session = Depends(get_db)):
    # 1. KPIs
    total = db.query(models.Chantier).count()
    actifs = db.query(models.Chantier).filter(models.Chantier.est_actif == True).count()
    rap = db.query(models.Rapport).count()
    alert = db.query(models.Rapport).filter(models.Rapport.niveau_urgence.in_(['Critique', 'Moyen'])).count()
    nb_materiel_sorti = db.query(models.Materiel).filter(models.Materiel.chantier_id != None).count()
    
    # 2. GRAPHIQUE
    today = datetime.now().date()
    labels, values = [], []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        labels.append(day.strftime("%d/%m"))
        start = datetime.combine(day, datetime.min.time())
        end = datetime.combine(day, datetime.max.time())
        cnt = db.query(models.Rapport).filter(models.Rapport.date_creation >= start, models.Rapport.date_creation <= end).count()
        values.append(cnt)

    # 3. RECENTS
    recents = db.query(models.Rapport).order_by(models.Rapport.date_creation.desc()).limit(5).all()
    rec_fmt = [{"titre": r.titre, "date": r.date_creation, "chantier": r.chantier.nom if r.chantier else "-", "urgence": r.niveau_urgence} for r in recents]

    # 4. DONNÉES CARTE (NOUVEAU !)
    # On récupère tous les chantiers qui ont des rapports géolocalisés
    # (Ou on pourrait géolocaliser les chantiers eux-mêmes, mais utilisons les rapports pour l'instant)
    map_data = []
    # Pour simplifier, on prend les chantiers actifs et on simule ou on prend le dernier rapport GPS
    chantiers = db.query(models.Chantier).filter(models.Chantier.est_actif == True).all()
    for c in chantiers:
        # On cherche le dernier rapport avec GPS pour ce chantier
        last_gps = db.query(models.Rapport).filter(models.Rapport.chantier_id == c.id, models.Rapport.latitude != None).first()
        if last_gps:
            map_data.append({
                "id": c.id,
                "nom": c.nom,
                "client": c.client,
                "lat": last_gps.latitude,
                "lng": last_gps.longitude,
                "status": "OK"
            })

    return {
        "kpis": { "total_chantiers": total, "actifs": actifs, "rapports": rap, "alertes": alert, "materiel_sorti": nb_materiel_sorti },
        "chart": { "labels": labels, "values": values },
        "recents": rec_fmt,
        "map": map_data # <--- NOUVEAU
    }
    
# ==========================================
# 3. CHANTIERS
# ==========================================
@app.post("/chantiers", response_model=schemas.ChantierOut)
def create_chantier(chantier: schemas.ChantierCreate, db: Session = Depends(get_db)):
    new_c = models.Chantier(nom=chantier.nom, adresse=chantier.adresse, client=chantier.client, cover_url=chantier.cover_url)
    db.add(new_c); db.commit(); db.refresh(new_c)
    return new_c

@app.put("/chantiers/{chantier_id}")
def update_chantier(
    chantier_id: int, 
    chantier_update: schemas.ChantierCreate, 
    db: Session = Depends(get_db)
):
    # 1. On récupère le chantier
    c = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not c: raise HTTPException(status_code=404, detail="Chantier introuvable")
    
    # 2. On met à jour les infos
    c.nom = chantier_update.nom
    c.adresse = chantier_update.adresse
    c.client = chantier_update.client
    
    # 3. Si une nouvelle photo est envoyée, on remplace l'ancienne
    if chantier_update.cover_url:
        c.cover_url = chantier_update.cover_url
        
    db.commit()
    db.refresh(c)
    return c

@app.get("/chantiers", response_model=List[schemas.ChantierOut])
def read_chantiers(db: Session = Depends(get_db)):
    return db.query(models.Chantier).all()

@app.put("/chantiers/{cid}/signature")
def sign_chantier(cid: int, signature_url: str, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404, "Introuvable")
    c.signature_url = signature_url
    db.commit()
    return {"status": "signed"}

@app.delete("/chantiers/{cid}")
def delete_chantier(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404, "Introuvable")
    
    # Nettoyage en cascade
    db.query(models.Materiel).filter(models.Materiel.chantier_id == cid).update({"chantier_id": None})
    db.query(models.RapportImage).filter(models.RapportImage.rapport.has(chantier_id=cid)).delete(synchronize_session=False)
    db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).delete()
    db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).delete()
    db.query(models.PPSPS).filter(models.PPSPS.chantier_id == cid).delete()
    db.query(models.PIC).filter(models.PIC.chantier_id == cid).delete()
    
    db.delete(c)
    db.commit()
    return {"status": "deleted"}

# ==========================================
# 4. MATERIEL
# ==========================================
@app.post("/materiels", response_model=schemas.MaterielOut)
def create_materiel(mat: schemas.MaterielCreate, db: Session = Depends(get_db)):
    new_m = models.Materiel(
        nom=mat.nom, reference=mat.reference, etat=mat.etat, 
        image_url=mat.image_url # Avec Image !
    )
    db.add(new_m); db.commit(); db.refresh(new_m)
    return new_m

@app.get("/materiels", response_model=List[schemas.MaterielOut])
def read_materiels(db: Session = Depends(get_db)):
    return db.query(models.Materiel).all()


@app.post("/materiels/import")
async def import_materiels_csv(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
    # On a retiré 'current_user' pour l'instant pour éviter l'erreur 401
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "Le fichier doit être un CSV")

    try:
        content = await file.read()
        
        # Décodage robuste (UTF-8 ou Latin-1 pour Excel)
        try:
            text_content = content.decode('utf-8')
        except UnicodeDecodeError:
            text_content = content.decode('latin-1')
            
        lines = text_content.splitlines()
        if not lines: raise HTTPException(400, "Fichier vide")
        
        # Détection du séparateur (; ou ,)
        delimiter = ';' if ';' in lines[0] else ','
        reader = csv.DictReader(lines, delimiter=delimiter)

        # On cherche une entreprise par défaut (ou null)
        # Idéalement, on prendrait celle du user, mais ici on fait simple
        default_company = db.query(models.Company).first()
        cid = default_company.id if default_company else None

        count = 0
        for row in reader:
            # Nettoyage des clés (espaces, majuscules...)
            row_clean = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            
            # Recherche des colonnes (tolérant)
            nom = row_clean.get('nom') or row_clean.get('name')
            ref = row_clean.get('reference') or row_clean.get('ref')
            etat = row_clean.get('etat') or 'Bon'
            
            if nom and ref:
                # Vérifier doublon (optionnel)
                existing = db.query(models.Materiel).filter(models.Materiel.reference == ref).first()
                if not existing:
                    new_mat = models.Materiel(
                        nom=nom,
                        reference=ref,
                        etat=etat,
                        company_id=cid, # On rattache à la boite par défaut
                        chantier_id=None
                    )
                    db.add(new_mat)
                    count += 1
        
        db.commit()
        return {"status": "success", "message": f"{count} équipements importés !"}

    except Exception as e:
        print(f"Erreur CSV : {e}")
        db.rollback()
        raise HTTPException(500, f"Erreur technique : {str(e)}")

@app.put("/materiels/{mid}/transfert")
def transfer_materiel(mid: int, chantier_id: Optional[int] = None, db: Session = Depends(get_db)):
    m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not m: raise HTTPException(404)
    m.chantier_id = chantier_id
    db.commit()
    return {"status": "moved"}

@app.put("/materiels/{materiel_id}")
def update_materiel(
    materiel_id: int, 
    mat_update: schemas.MaterielCreate, 
    db: Session = Depends(get_db)
):
    # 1. On cherche l'objet
    db_mat = db.query(models.Materiel).filter(models.Materiel.id == materiel_id).first()
    if not db_mat:
        raise HTTPException(status_code=404, detail="Matériel introuvable")
    
    # 2. On met à jour les champs
    db_mat.nom = mat_update.nom
    db_mat.reference = mat_update.reference
    # On met à jour l'image SEULEMENT si une nouvelle URL est envoyée
    if mat_update.image_url:
        db_mat.image_url = mat_update.image_url
        
    db.commit()
    db.refresh(db_mat)
    return db_mat

@app.delete("/materiels/{mid}")
def delete_materiel(mid: int, db: Session = Depends(get_db)):
    m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not m: raise HTTPException(404)
    db.delete(m); db.commit()
    return {"status": "deleted"}

    

# ==========================================
# 5. DOCS (Rapports, Audit, PPSPS, PIC)
# ==========================================
@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        res = cloudinary.uploader.upload(file.file, folder="conformeo_chantiers")
        return {"url": res.get("secure_url")}
    except Exception as e: raise HTTPException(500, str(e))

@app.post("/rapports", response_model=schemas.RapportOut)
def create_rapport(r: schemas.RapportCreate, db: Session = Depends(get_db)):
    new_r = models.Rapport(
        titre=r.titre, description=r.description, chantier_id=r.chantier_id,
        niveau_urgence=r.niveau_urgence, latitude=r.latitude, longitude=r.longitude,
        photo_url=r.image_urls[0] if r.image_urls else None
    )
    db.add(new_r); db.commit(); db.refresh(new_r)
    if r.image_urls:
        for u in r.image_urls: db.add(models.RapportImage(url=u, rapport_id=new_r.id))
        db.commit(); db.refresh(new_r)
    return new_r

@app.get("/chantiers/{cid}/rapports", response_model=List[schemas.RapportOut])
def read_rapports_chantier(cid: int, db: Session = Depends(get_db)):
    return db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).all()

@app.post("/inspections", response_model=schemas.InspectionOut)
def create_inspection(i: schemas.InspectionCreate, db: Session = Depends(get_db)):
    new_i = models.Inspection(
        titre=i.titre, type=i.type, data=i.data, chantier_id=i.chantier_id, createur=i.createur
    )
    db.add(new_i); db.commit(); db.refresh(new_i)
    return new_i

@app.get("/chantiers/{cid}/inspections", response_model=List[schemas.InspectionOut])
def read_inspections(cid: int, db: Session = Depends(get_db)):
    return db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).all()

@app.post("/ppsps", response_model=schemas.PPSPSOut)
def create_ppsps(p: schemas.PPSPSCreate, db: Session = Depends(get_db)):
    new_p = models.PPSPS(
        chantier_id=p.chantier_id, maitre_ouvrage=p.maitre_ouvrage, maitre_oeuvre=p.maitre_oeuvre,
        coordonnateur_sps=p.coordonnateur_sps, responsable_chantier=p.responsable_chantier,
        nb_compagnons=p.nb_compagnons, horaires=p.horaires, duree_travaux=p.duree_travaux,
        secours_data=p.secours_data, installations_data=p.installations_data, taches_data=p.taches_data
    )
    db.add(new_p); db.commit(); db.refresh(new_p)
    return new_p

@app.get("/chantiers/{cid}/ppsps", response_model=List[schemas.PPSPSOut])
def read_ppsps(cid: int, db: Session = Depends(get_db)):
    return db.query(models.PPSPS).filter(models.PPSPS.chantier_id == cid).all()

@app.post("/pics", response_model=schemas.PICOut)
def create_pic(p: schemas.PICCreate, db: Session = Depends(get_db)):
    ex = db.query(models.PIC).filter(models.PIC.chantier_id == p.chantier_id).first()
    if ex:
        ex.background_url = p.background_url; ex.final_url = p.final_url
        ex.elements_data = p.elements_data; ex.date_update = datetime.now()
        db.commit(); db.refresh(ex); return ex
    else:
        new_pic = models.PIC(chantier_id=p.chantier_id, background_url=p.background_url, final_url=p.final_url, elements_data=p.elements_data)
        db.add(new_pic); db.commit(); db.refresh(new_pic); return new_pic

@app.get("/chantiers/{cid}/pic", response_model=Optional[schemas.PICOut])
def read_pic(cid: int, db: Session = Depends(get_db)):
    return db.query(models.PIC).filter(models.PIC.chantier_id == cid).first()

# ==========================================
# 6. PDF & DOWNLOADS
# ==========================================

@app.get("/chantiers/{cid}/pdf")
def download_pdf(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    raps = db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).all()
    inss = db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).all()
    path = f"uploads/Rapport_{cid}.pdf"
    pdf_generator.generate_pdf(c, raps, inss, path)
    return FileResponse(path, filename=f"Journal_{c.nom}.pdf", media_type='application/pdf')

@app.get("/inspections/{iid}/pdf")
def download_audit_pdf(iid: int, db: Session = Depends(get_db)):
    i = db.query(models.Inspection).filter(models.Inspection.id == iid).first()
    if not i: raise HTTPException(404)
    c = db.query(models.Chantier).filter(models.Chantier.id == i.chantier_id).first()
    path = f"uploads/Audit_{iid}.pdf"
    pdf_generator.generate_audit_pdf(c, i, path)
    return FileResponse(path, filename=f"Audit_{i.type}.pdf", media_type='application/pdf')

@app.get("/ppsps/{pid}/pdf")
def download_ppsps_pdf(pid: int, db: Session = Depends(get_db)):
    p = db.query(models.PPSPS).filter(models.PPSPS.id == pid).first()
    if not p: raise HTTPException(404)
    c = db.query(models.Chantier).filter(models.Chantier.id == p.chantier_id).first()
    path = f"uploads/PPSPS_{pid}.pdf"
    pdf_generator.generate_ppsps_pdf(c, p, path)
    return FileResponse(path, filename=f"PPSPS_{c.nom}.pdf", media_type='application/pdf')

@app.get("/chantiers/{cid}/doe")
def download_doe(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    
    zip_name = f"uploads/DOE_{c.id}.zip"
    with zipfile.ZipFile(zip_name, 'w') as z:
        # Journal
        raps = db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).all()
        inss = db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).all()
        j_path = f"uploads/J_{c.id}.pdf"
        pdf_generator.generate_pdf(c, raps, inss, j_path)
        z.write(j_path, "1_Journal_Chantier.pdf")
        
        # PPSPS
        ppsps = db.query(models.PPSPS).filter(models.PPSPS.chantier_id == cid).all()
        for idx, p in enumerate(ppsps):
            p_path = f"uploads/P_{p.id}.pdf"
            pdf_generator.generate_ppsps_pdf(c, p, p_path)
            z.write(p_path, f"2_PPSPS_{idx+1}.pdf")

        # Audits
        for idx, i in enumerate(inss):
            a_path = f"uploads/A_{i.id}.pdf"
            pdf_generator.generate_audit_pdf(c, i, a_path)
            z.write(a_path, f"3_Audit_{i.type}_{idx+1}.pdf")
            
        # PIC
        pic = db.query(models.PIC).filter(models.PIC.chantier_id == cid).first()
        if pic and pic.final_url:
            try:
                r = requests.get(pic.final_url)
                if r.status_code == 200:
                    pic_path = f"uploads/PIC_{cid}.jpg"
                    with open(pic_path, "wb") as f: f.write(r.content)
                    z.write(pic_path, "4_Plan_Installation.jpg")
            except: pass
            
    return FileResponse(zip_name, filename=f"DOE_{c.nom}.zip", media_type='application/zip')

# --- MIGRATIONS ---
@app.get("/migrate_multi_tenant")
def migrate_multi_tenant(db: Session = Depends(get_db)):
    try:
        models.Base.metadata.create_all(bind=engine)
        tables = ["users", "chantiers", "materiels"]
        for t in tables:
            try: db.execute(text(f"ALTER TABLE {t} ADD COLUMN company_id INTEGER"))
            except: pass
        db.commit()
        return {"msg": "Migration Multi-Tenant OK"}
    except Exception as e: return {"error": str(e)}

@app.get("/migrate_db_v5")
def migrate_v5(db: Session = Depends(get_db)):
    try:
        cols = [
            "secours_data JSON", "installations_data JSON", 
            "taches_data JSON", "duree_travaux VARCHAR"
        ]
        for col in cols:
            try: db.execute(text(f"ALTER TABLE ppsps ADD COLUMN {col}"))
            except: pass
        db.commit()
        return {"msg": "Migration V5 OK"}
    except Exception as e: return {"error": str(e)}

@app.get("/migrate_db_v7")
def migrate_v7(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE materiels ADD COLUMN image_url VARCHAR"))
        db.commit()
        return {"msg": "Migration V7 OK"}
    except: return {"msg": "Déjà fait"}

# ==========================================
# 10. GESTION D'ÉQUIPE (SaaS)
# ==========================================

@app.get("/team", response_model=List[schemas.UserOut])
def read_team(db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    # On renvoie tous les utilisateurs qui ont le même company_id que moi
    return db.query(models.User).filter(models.User.company_id == current_user.company_id).all()

@app.post("/team", response_model=schemas.UserOut)
def add_team_member(
    user: schemas.UserCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(security.get_current_user)
):
    # 1. Vérif droits (Seul un admin peut ajouter ?) - On laisse ouvert pour l'instant
    
    # 2. Vérif Email
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    # 3. Création du membre rattaché à l'entreprise
    hashed_pwd = security.get_password_hash(user.password)
    new_member = models.User(
        email=user.email,
        hashed_password=hashed_pwd,
        role=user.role, # 'conducteur', 'ouvrier', etc.
        company_id=current_user.company_id # <--- C'EST ICI QUE LA MAGIE OPERE
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    return new_member