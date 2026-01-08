import os
import shutil
from uuid import uuid4
from typing import List, Optional
from dotenv import load_dotenv
import zipfile
from datetime import datetime, timedelta, date
import csv 
import codecs
import time
import pydantic

load_dotenv()

import requests
import cloudinary
import cloudinary.uploader
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr, BaseModel 

from sqlalchemy import text, func
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
    "secure": True,
}
if cloudinary_config["cloud_name"]:
    cloudinary.config(**cloudinary_config)


# --- CONFIGURATION EMAIL (BREVO - PORT DE SECOURS 2525) ---
# Le port 2525 est fait pour traverser les pare-feux comme celui de Render
pwd_brevo = os.environ.get("MAIL_PASSWORD") 

mail_conf = ConnectionConfig(
    # 👇 VOTRE LOGIN BREVO
    MAIL_USERNAME = "michelgmv7@gmail.com", 
    
    # 👇 LA CLÉ API SMTP (Dans Render)
    MAIL_PASSWORD = pwd_brevo,
    
    # 👇 L'EXPÉDITEUR
    MAIL_FROM = "contact@conformeo-app.fr", 
    
    # 👇 CONFIGURATION SPECIALE RENDER
    MAIL_PORT = 2525,                
    MAIL_SERVER = "smtp-relay.brevo.com",
    
    MAIL_STARTTLS = True,
    MAIL_SSL_TLS = False,
    
    USE_CREDENTIALS = True,
    VALIDATE_CERTS = False 
)

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

# 👇 Helper pour récupérer l'entreprise d'un chantier
def get_company_for_chantier(db: Session, chantier_id: int):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    # Check if chantier exists and has a company_id
    if chantier and hasattr(chantier, 'company_id') and chantier.company_id:
        return db.query(models.Company).filter(models.Company.id == chantier.company_id).first()
    # Fallback to the first company if no specific company is linked - be careful with this in multi-tenant envs
    return db.query(models.Company).first()

# ==========================================
# UTILITAIRES (GPS)
# ==========================================
def get_gps_from_address(address: str):
    if not address or len(address) < 5: return None, None
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {'q': address, 'format': 'json', 'limit': 1}
        # Updated User-Agent to be more descriptive
        headers = {'User-Agent': 'ConformeoApp/1.0 (contact@conformeo-app.fr)'}
        
        response = requests.get(url, params=params, headers=headers, timeout=5)
        if response.status_code == 200 and len(response.json()) > 0:
            data = response.json()[0]
            return float(data['lat']), float(data['lon'])
    except Exception as e:
        print(f"Erreur GPS pour {address}: {e}")
    return None, None

# ==========================================
# 1. UTILISATEURS
# ==========================================
@app.post("/users", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email pris")
    
    if user.company_name:
        new_company = models.Company(name=user.company_name, subscription_plan="free")
        db.add(new_company); db.commit(); db.refresh(new_company)
        company_id = new_company.id
        role = "admin"
    else:
        company_id = None 
        role = user.role

    hashed_pwd = security.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_pwd, role=role, company_id=company_id)
    db.add(new_user); db.commit(); db.refresh(new_user)
    return new_user

@app.post("/token", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Erreur login")
    token = security.create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": token, "token_type": "bearer"}

class UserUpdate(pydantic.BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    
@app.put("/users/me", response_model=schemas.UserOut)
def update_user_me(user_up: UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    if user_up.email and user_up.email != current_user.email:
        if db.query(models.User).filter(models.User.email == user_up.email).first():
            raise HTTPException(400, "Cet email est déjà utilisé.")
        current_user.email = user_up.email

    if user_up.password:
        current_user.hashed_password = security.get_password_hash(user_up.password)

    db.commit()
    db.refresh(current_user)
    return current_user


# ==========================================
# 2. DASHBOARD
# ==========================================
@app.get("/dashboard/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(models.Chantier).count()
    actifs = db.query(models.Chantier).filter(models.Chantier.est_actif == True).count()
    rap = db.query(models.Rapport).count()
    alert = db.query(models.Rapport).filter(models.Rapport.niveau_urgence.in_(['Critique', 'Moyen'])).count()

    today = datetime.now().date()
    labels, values = [], []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        labels.append(day.strftime("%d/%m"))
        start = datetime.combine(day, datetime.min.time())
        end = datetime.combine(day, datetime.max.time())
        cnt = db.query(models.Rapport).filter(models.Rapport.date_creation >= start, models.Rapport.date_creation <= end).count()
        values.append(cnt)

    recents = db.query(models.Rapport).order_by(models.Rapport.date_creation.desc()).limit(5).all()
    rec_fmt = []
    for r in recents:
        c_nom = r.chantier.nom if r.chantier else "Inconnu"
        rec_fmt.append({"titre": r.titre, "date_creation": r.date_creation, "chantier_nom": c_nom, "niveau_urgence": r.niveau_urgence})

    map_data = []
    chantiers = db.query(models.Chantier).filter(models.Chantier.est_actif == True).all()
    for c in chantiers:
        lat, lng = c.latitude, c.longitude
        if not lat:
            last_gps = db.query(models.Rapport).filter(models.Rapport.chantier_id == c.id, models.Rapport.latitude != None).first()
            if last_gps:
                lat, lng = last_gps.latitude, last_gps.longitude
        
        if lat and lng:
            map_data.append({"id": c.id, "nom": c.nom, "client": c.client, "lat": lat, "lng": lng})

    return {
        "kpis": {
            "total_chantiers": total, "actifs": actifs, 
            "rapports": rap, "alertes": alert,
            "materiel_sorti": db.query(models.Materiel).filter(models.Materiel.chantier_id != None).count()
        },
        "chart": { "labels": labels, "values": values },
        "recents": rec_fmt,
        "map": map_data
    }

# ==========================================
# 3. CHANTIERS
# ==========================================
@app.post("/chantiers", response_model=schemas.ChantierOut)
def create_chantier(chantier: schemas.ChantierCreate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    lat, lng = None, None
    if chantier.adresse:
        lat, lng = get_gps_from_address(chantier.adresse)

    new_c = models.Chantier(
        nom=chantier.nom, adresse=chantier.adresse, client=chantier.client, cover_url=chantier.cover_url,
        company_id=current_user.company_id,
        date_debut=chantier.date_debut or datetime.now(),
        date_fin=chantier.date_fin or (datetime.now() + timedelta(days=30)),
        latitude=lat, longitude=lng,
        soumis_sps=chantier.soumis_sps
    )
    db.add(new_c); db.commit(); db.refresh(new_c)
    return new_c

@app.put("/chantiers/{cid}")
def update_chantier(cid: int, up: schemas.ChantierCreate, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    
    if up.adresse and up.adresse != c.adresse:
        lat, lng = get_gps_from_address(up.adresse)
        c.latitude = lat; c.longitude = lng
    
    c.nom = up.nom; c.adresse = up.adresse; c.client = up.client
    if up.cover_url: c.cover_url = up.cover_url
    if up.date_debut: c.date_debut = up.date_debut
    if up.date_fin: c.date_fin = up.date_fin
    
    if up.est_actif is not None: c.est_actif = up.est_actif
    if up.soumis_sps is not None: c.soumis_sps = up.soumis_sps

    db.commit(); db.refresh(c)
    return c

@app.get("/chantiers", response_model=List[schemas.ChantierOut])
def read_chantiers(db: Session = Depends(get_db)):
    return db.query(models.Chantier).all()

@app.get("/chantiers/{chantier_id}", response_model=schemas.ChantierOut)
def read_chantier(chantier_id: int, db: Session = Depends(get_db)):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not chantier: raise HTTPException(status_code=404, detail="Chantier introuvable")
    return chantier

@app.post("/chantiers/import")
async def import_chantiers_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith('.csv'): raise HTTPException(400, "Non CSV")
    try:
        content = await file.read()
        try: text_content = content.decode('utf-8-sig')
        except: text_content = content.decode('latin-1')
        lines = text_content.splitlines()
        delimiter = ';' if ';' in lines[0] else ','
        reader = csv.DictReader(lines, delimiter=delimiter)
        
        company = db.query(models.Company).first()
        cid = company.id if company else None
        count = 0
        
        for row in reader:
            row = {k.strip(): v.strip() for k, v in row.items() if k}
            nom = None
            for k, v in row.items():
                if 'nom' in k.lower(): nom = v
            
            if nom:
                client = "Inconnu"; adresse = "-"
                for k, v in row.items():
                    if 'client' in k.lower(): client = v
                    if 'adresse' in k.lower(): adresse = v
                
                lat, lng = None, None
                if len(adresse) > 5:
                    lat, lng = get_gps_from_address(adresse)
                    time.sleep(1) 

                db.add(models.Chantier(
                    nom=nom, client=client, adresse=adresse, est_actif=True, company_id=cid,
                    date_creation=datetime.now(), date_debut=datetime.now(), date_fin=datetime.now()+timedelta(days=30),
                    signature_url=None, cover_url=None, latitude=lat, longitude=lng, soumis_sps=False
                ))
                count += 1
        db.commit()
        return {"status": "success", "message": f"{count} chantiers importés !"}
    except Exception as e:
        db.rollback(); raise HTTPException(500, f"Erreur: {str(e)}")

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
    if not c: raise HTTPException(404)
    db.query(models.Materiel).filter(models.Materiel.chantier_id == cid).update({"chantier_id": None})
    db.query(models.RapportImage).filter(models.RapportImage.rapport.has(chantier_id=cid)).delete(synchronize_session=False)
    db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).delete()
    db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).delete()
    db.query(models.PPSPS).filter(models.PPSPS.chantier_id == cid).delete()
    db.query(models.PIC).filter(models.PIC.chantier_id == cid).delete()
    db.query(models.PlanPrevention).filter(models.PlanPrevention.chantier_id == cid).delete()
    db.delete(c); db.commit()
    return {"status": "deleted"}

# ==========================================
# 4. MATERIEL
# ==========================================
@app.post("/materiels", response_model=schemas.MaterielOut)
def create_materiel(mat: schemas.MaterielCreate, db: Session = Depends(get_db)):
    new_m = models.Materiel(nom=mat.nom, reference=mat.reference, etat=mat.etat, image_url=mat.image_url)
    db.add(new_m); db.commit(); db.refresh(new_m)
    return new_m

@app.get("/materiels", response_model=List[schemas.MaterielOut])
def read_materiels(db: Session = Depends(get_db)):
    return db.query(models.Materiel).all()

@app.post("/materiels/import")
async def import_materiels_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith('.csv'): raise HTTPException(400, "Non CSV")
    try:
        content = await file.read()
        try: text = content.decode('utf-8')
        except: text = content.decode('latin-1')
        lines = text.splitlines()
        delimiter = ';' if ';' in lines[0] else ','
        reader = csv.DictReader(lines, delimiter=delimiter)
        company = db.query(models.Company).first()
        cid = company.id if company else None
        count = 0
        for row in reader:
            row = {k.strip(): v.strip() for k, v in row.items() if k}
            nom = row.get('Nom') or row.get('nom')
            ref = row.get('Reference') or row.get('reference')
            if nom and ref:
                etat = row.get('Etat') or 'Bon'
                db.add(models.Materiel(nom=nom, reference=ref, etat=etat, company_id=cid, chantier_id=None))
                count += 1
        db.commit()
        return {"status": "success", "message": f"{count} équipements importés !"}
    except Exception as e:
        db.rollback(); raise HTTPException(500, str(e))

@app.put("/materiels/{mid}/transfert")
def transfer_materiel(mid: int, chantier_id: Optional[int] = None, db: Session = Depends(get_db)):
    m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not m: raise HTTPException(404)
    m.chantier_id = chantier_id
    db.commit()
    return {"status": "moved"}

@app.put("/materiels/{materiel_id}")
def update_materiel(materiel_id: int, mat_update: schemas.MaterielCreate, db: Session = Depends(get_db)):
    db_mat = db.query(models.Materiel).filter(models.Materiel.id == materiel_id).first()
    if not db_mat: raise HTTPException(404)
    db_mat.nom = mat_update.nom
    db_mat.reference = mat_update.reference
    if mat_update.etat: db_mat.etat = mat_update.etat 
    if mat_update.image_url: db_mat.image_url = mat_update.image_url
    db.commit(); db.refresh(db_mat)
    return db_mat

@app.delete("/materiels/{mid}")
def delete_materiel(mid: int, db: Session = Depends(get_db)):
    m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not m: raise HTTPException(404)
    db.delete(m); db.commit()
    return {"status": "success"}

# ==========================================
# 5. DOCUMENTS & EXPORTS
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

@app.get("/inspections/{iid}/pdf")
def download_inspection_pdf(iid: int, db: Session = Depends(get_db)):
    i = db.query(models.Inspection).filter(models.Inspection.id == iid).first()
    if not i: raise HTTPException(404)
    c = db.query(models.Chantier).filter(models.Chantier.id == i.chantier_id).first()
    comp = get_company_for_chantier(db, c.id)
    path = f"uploads/Audit_{iid}.pdf"
    pdf_generator.generate_audit_pdf(c, i, path, company=comp)
    return FileResponse(path, media_type='application/pdf')

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

@app.get("/ppsps/{pid}/pdf")
def download_ppsps_pdf(pid: int, db: Session = Depends(get_db)):
    p = db.query(models.PPSPS).filter(models.PPSPS.id == pid).first()
    if not p: raise HTTPException(404)
    c = db.query(models.Chantier).filter(models.Chantier.id == p.chantier_id).first()
    comp = get_company_for_chantier(db, c.id)
    path = f"uploads/PPSPS_{pid}.pdf"
    pdf_generator.generate_ppsps_pdf(c, p, path, company=comp)
    return FileResponse(path, media_type='application/pdf')

# ==========================================
# 6. NOTICE PIC (AVEC DESSIN & 9 CHAMPS)
# ==========================================

class PicSchema(BaseModel):
    acces: str = ""
    clotures: str = ""
    base_vie: str = ""
    stockage: str = ""
    dechets: str = ""
    levage: str = ""
    reseaux: str = ""
    circulations: str = ""
    signalisation: str = ""
    
    # 🎨 Données pour le dessin
    background_url: Optional[str] = None
    final_url: Optional[str] = None
    elements_data: Optional[list] = None

@app.get("/chantiers/{cid}/pic")
def get_pic(cid: int, db: Session = Depends(get_db)):
    pic = db.query(models.PIC).filter(models.PIC.chantier_id == cid).first()
    if not pic:
        return {} 
    return pic

@app.post("/chantiers/{cid}/pic")
def save_pic(cid: int, pic_data: PicSchema, db: Session = Depends(get_db)):
    existing_pic = db.query(models.PIC).filter(models.PIC.chantier_id == cid).first()
    
    if existing_pic:
        for key, value in pic_data.dict().items():
            setattr(existing_pic, key, value)
    else:
        new_pic = models.PIC(**pic_data.dict(), chantier_id=cid)
        db.add(new_pic)
    
    db.commit()
    return {"message": "PIC sauvegardé avec succès ! 🏗️"}

# ==========================================
# 7. TELECHARGEMENT GLOBAL (DOE)
# ==========================================
@app.get("/chantiers/{cid}/pdf")
def download_pdf(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    raps = db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).all()
    inss = db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).all()
    comp = get_company_for_chantier(db, cid)
    path = f"uploads/J_{cid}.pdf"
    pdf_generator.generate_pdf(c, raps, inss, path, company=comp)
    return FileResponse(path, media_type='application/pdf')

@app.get("/chantiers/{cid}/doe")
def download_doe(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    comp = get_company_for_chantier(db, cid) 

    zip_name = f"uploads/DOE_{c.id}.zip"
    with zipfile.ZipFile(zip_name, 'w') as z:
        # Journal
        raps = db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).all()
        inss = db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).all()
        j_path = f"uploads/J_{c.id}.pdf"
        pdf_generator.generate_pdf(c, raps, inss, j_path, company=comp)
        z.write(j_path, "1_Journal_Chantier.pdf")
        
        # PPSPS
        ppsps = db.query(models.PPSPS).filter(models.PPSPS.chantier_id == cid).all()
        for idx, p in enumerate(ppsps):
            p_path = f"uploads/P_{p.id}.pdf"
            pdf_generator.generate_ppsps_pdf(c, p, p_path, company=comp)
            z.write(p_path, f"2_PPSPS_{idx+1}.pdf")

        # Audits
        for idx, i in enumerate(inss):
            a_path = f"uploads/A_{i.id}.pdf"
            pdf_generator.generate_audit_pdf(c, i, a_path, company=comp)
            z.write(a_path, f"3_Audit_{i.type}_{idx+1}.pdf")
            
        # PIC (Image)
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

# ==========================================
# 8. DOCUMENTS EXTERNES & ENTREPRISE
# ==========================================
@app.get("/migrate_documents_externes")
def migrate_docs_ext(db: Session = Depends(get_db)):
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS documents_externes (
                id SERIAL PRIMARY KEY,
                titre VARCHAR NOT NULL,
                categorie VARCHAR NOT NULL,
                url VARCHAR NOT NULL,
                chantier_id INTEGER REFERENCES chantiers(id),
                date_ajout TIMESTAMP DEFAULT NOW()
            )
        """))
        db.commit()
        return {"msg": "Table Documents Externes créée !"}
    except Exception as e: return {"error": str(e)}

class DocExterneOut(pydantic.BaseModel):
    id: int
    titre: str
    categorie: str
    url: str
    date_ajout: datetime
    class Config: from_attributes = True

@app.post("/chantiers/{cid}/documents", response_model=DocExterneOut)
def upload_external_doc(cid: int, titre: str, categorie: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        res = cloudinary.uploader.upload(file.file, folder="conformeo_docs", resource_type="auto")
        url = res.get("secure_url")
    except Exception as e: raise HTTPException(500, f"Erreur Upload: {e}")
    sql = text("INSERT INTO documents_externes (titre, categorie, url, chantier_id, date_ajout) VALUES (:t, :c, :u, :cid, :d) RETURNING id")
    result = db.execute(sql, {"t": titre, "c": categorie, "u": url, "cid": cid, "d": datetime.now()})
    new_id = result.fetchone()[0]
    db.commit()
    return {"id": new_id, "titre": titre, "categorie": categorie, "url": url, "date_ajout": datetime.now()}

@app.get("/chantiers/{cid}/documents", response_model=List[DocExterneOut])
def get_external_docs(cid: int, db: Session = Depends(get_db)):
    sql = text("SELECT id, titre, categorie, url, date_ajout FROM documents_externes WHERE chantier_id = :cid")
    result = db.execute(sql, {"cid": cid}).fetchall()
    return [{"id": r[0], "titre": r[1], "categorie": r[2], "url": r[3], "date_ajout": r[4]} for r in result]

@app.delete("/documents/{did}")
def delete_external_doc(did: int, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM documents_externes WHERE id = :did"), {"did": did})
    db.commit()
    return {"status": "deleted"}

# --- GED ENTREPRISE (DUERP / KBIS) ---

@app.get("/migrate_company_docs")
def migrate_company_docs(db: Session = Depends(get_db)):
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS company_documents (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id),
                titre VARCHAR NOT NULL,
                type_doc VARCHAR NOT NULL,
                url VARCHAR NOT NULL,
                date_expiration TIMESTAMP,
                date_upload TIMESTAMP DEFAULT NOW()
            )
        """))
        db.commit()
        return {"msg": "Table Documents Entreprise créée ! 📂"}
    except Exception as e: return {"error": str(e)}

class CompanyDocOut(pydantic.BaseModel):
    id: int
    titre: str
    type_doc: str
    url: str
    date_expiration: Optional[datetime]
    date_upload: datetime
    class Config: from_attributes = True

@app.post("/companies/me/documents", response_model=CompanyDocOut)
def upload_company_doc(
    titre: str, type_doc: str, date_expiration: Optional[str] = None, 
    file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)
):
    if not current_user.company_id: raise HTTPException(400, "Pas d'entreprise")
    try:
        res = cloudinary.uploader.upload(file.file, folder="conformeo_company_docs", resource_type="auto")
        url = res.get("secure_url")
    except Exception as e: raise HTTPException(500, f"Erreur Upload: {e}")
    exp_date = None
    if date_expiration and date_expiration != "undefined" and date_expiration != "null":
        try: exp_date = datetime.strptime(date_expiration, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")
    sql = text("INSERT INTO company_documents (company_id, titre, type_doc, url, date_expiration, date_upload) VALUES (:cid, :t, :type, :u, :exp, :now) RETURNING id, date_upload")
    res = db.execute(sql, {"cid": current_user.company_id, "t": titre, "type": type_doc, "u": url, "exp": exp_date, "now": datetime.now()}).fetchone()
    db.commit()
    return {"id": res[0], "titre": titre, "type_doc": type_doc, "url": url, "date_expiration": exp_date, "date_upload": res[1]}

@app.get("/companies/me/documents", response_model=List[CompanyDocOut])
def get_company_docs(db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    if not current_user.company_id: return []
    sql = text("SELECT id, titre, type_doc, url, date_expiration, date_upload FROM company_documents WHERE company_id = :cid ORDER BY type_doc")
    results = db.execute(sql, {"cid": current_user.company_id}).fetchall()
    return [{"id": r[0], "titre": r[1], "type_doc": r[2], "url": r[3], "date_expiration": r[4], "date_upload": r[5]} for r in results]

@app.delete("/companies/me/documents/{doc_id}")
def delete_company_doc(doc_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    check = text("SELECT id FROM company_documents WHERE id = :did AND company_id = :cid")
    if not db.execute(check, {"did": doc_id, "cid": current_user.company_id}).first(): raise HTTPException(404, "Introuvable")
    db.execute(text("DELETE FROM company_documents WHERE id = :did"), {"did": doc_id})
    db.commit()
    return {"status": "deleted"}

# ==========================================
# 9. PLAN DE PREVENTION (PdP)
# ==========================================
@app.get("/migrate_pdp")
def migrate_pdp(db: Session = Depends(get_db)):
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS plans_prevention (
                id SERIAL PRIMARY KEY,
                chantier_id INTEGER REFERENCES chantiers(id),
                entreprise_utilisatrice VARCHAR,
                entreprise_exterieure VARCHAR,
                date_inspection_commune TIMESTAMP,
                risques_interferents JSON,
                consignes_securite JSON,
                date_creation TIMESTAMP DEFAULT NOW()
            )
        """))
        db.commit()
        return {"msg": "Table Plans de Prévention créée ! 🤝"}
    except Exception as e: return {"error": str(e)}

@app.post("/plans-prevention", response_model=schemas.PlanPreventionOut)
def create_pdp(p: schemas.PlanPreventionCreate, db: Session = Depends(get_db)):
    new_p = models.PlanPrevention(
        chantier_id=p.chantier_id,
        entreprise_utilisatrice=p.entreprise_utilisatrice,
        entreprise_exterieure=p.entreprise_exterieure,
        date_inspection_commune=p.date_inspection_commune,
        risques_interferents=p.risques_interferents,
        consignes_securite=p.consignes_securite
    )
    db.add(new_p); db.commit(); db.refresh(new_p)
    return new_p

@app.get("/chantiers/{cid}/plans-prevention", response_model=List[schemas.PlanPreventionOut])
def read_pdps(cid: int, db: Session = Depends(get_db)):
    return db.query(models.PlanPrevention).filter(models.PlanPrevention.chantier_id == cid).all()

@app.get("/plans-prevention/{pid}/pdf")
def download_pdp_pdf(pid: int, db: Session = Depends(get_db)):
    p = db.query(models.PlanPrevention).filter(models.PlanPrevention.id == pid).first()
    if not p: raise HTTPException(404)
    c = db.query(models.Chantier).filter(models.Chantier.id == p.chantier_id).first()
    comp = get_company_for_chantier(db, c.id)
    path = f"uploads/PdP_{pid}.pdf"
    pdf_generator.generate_pdp_pdf(c, p, path, company=comp)
    return FileResponse(path, media_type='application/pdf')

# ==========================================
# 10. ENVOI EMAIL
# ==========================================

class EmailSchema(BaseModel):
    email: List[EmailStr]

@app.post("/plans-prevention/{pid}/send-email")
async def send_pdp_email(pid: int, email_dest: str, db: Session = Depends(get_db)):
    p = db.query(models.PlanPrevention).filter(models.PlanPrevention.id == pid).first()
    if not p: raise HTTPException(404, "PdP introuvable")
    c = db.query(models.Chantier).filter(models.Chantier.id == p.chantier_id).first()
    comp = get_company_for_chantier(db, c.id)

    filename = f"PdP_{c.nom}_{datetime.now().strftime('%Y%m%d')}.pdf"
    filename = "".join([c for c in filename if c.isalpha() or c.isdigit() or c in (' ', '.', '_')]).strip()
    path = f"uploads/{filename}"
    pdf_generator.generate_pdp_pdf(c, p, path, company=comp)

    html = f"""
    <p>Bonjour,</p>
    <p>Veuillez trouver ci-joint le <b>Plan de Prévention</b> concernant le chantier <b>{c.nom}</b>.</p>
    <p>Cordialement,<br>{comp.name if comp else "L'équipe"}</p>
    """
    message = MessageSchema(subject=f"Plan de Prévention - {c.nom}", recipients=[email_dest], body=html, subtype=MessageType.html, attachments=[path])
    fm = FastMail(mail_conf)
    try:
        await fm.send_message(message)
        return {"message": "Email envoyé avec succès ! 📧"}
    except Exception as e:
        print(e); raise HTTPException(500, "Erreur lors de l'envoi de l'email")

@app.post("/chantiers/{cid}/send-email")
async def send_journal_email(cid: int, email_dest: str, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404, "Chantier introuvable")
    raps = db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).all()
    inss = db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).all()
    comp = get_company_for_chantier(db, c.id)

    filename = f"Journal_{c.nom}_{datetime.now().strftime('%Y%m%d')}.pdf"
    filename = "".join([x for x in filename if x.isalpha() or x.isdigit() or x in (' ', '.', '_')]).strip()
    path = f"uploads/{filename}"
    pdf_generator.generate_pdf(c, raps, inss, path, company=comp)

    html = f"""
    <p>Bonjour,</p>
    <p>Veuillez trouver ci-joint le <b>Journal de Bord</b> et le suivi d'avancement pour le chantier <b>{c.nom}</b>.</p>
    <p>Cordialement,<br>{comp.name if comp else "L'équipe"}</p>
    """
    message = MessageSchema(subject=f"Suivi Chantier - {c.nom}", recipients=[email_dest], body=html, subtype=MessageType.html, attachments=[path])
    fm = FastMail(mail_conf)
    try:
        await fm.send_message(message)
        return {"message": "Journal envoyé au client ! 🚀"}
    except Exception as e:
        print(e); raise HTTPException(500, "Erreur envoi email")

# ==========================================
# 11. GESTION EQUIPE
# ==========================================
@app.get("/companies/me", response_model=schemas.CompanyOut)
def read_my_company(db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    if not current_user.company_id: raise HTTPException(400)
    return db.query(models.Company).filter(models.Company.id == current_user.company_id).first()

@app.put("/companies/me", response_model=schemas.CompanyOut)
def update_my_company(up: schemas.CompanyUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    if not current_user.company_id: raise HTTPException(400)
    c = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    if up.name: c.name = up.name
    if up.address: c.address = up.address
    if up.contact_email: c.contact_email = up.contact_email
    if up.phone: c.phone = up.phone
    if up.logo_url: c.logo_url = up.logo_url
    db.commit(); db.refresh(c)
    return c

@app.get("/team", response_model=List[schemas.UserOut])
def read_team(db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    return db.query(models.User).filter(models.User.company_id == current_user.company_id).all()

@app.post("/team", response_model=schemas.UserOut)
def add_team_member(u: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    if db.query(models.User).filter(models.User.email == u.email).first(): raise HTTPException(400, "Email pris")
    new_u = models.User(email=u.email, hashed_password=security.get_password_hash(u.password), role=u.role, company_id=current_user.company_id)
    db.add(new_u); db.commit(); db.refresh(new_u)
    return new_u

# ==========================================
# 12. MIGRATIONS & FIX
# ==========================================

@app.get("/migrate_multi_tenant")
def migrate_mt(db: Session = Depends(get_db)):
    try:
        models.Base.metadata.create_all(bind=engine)
        for t in ["users", "chantiers", "materiels"]:
            try: db.execute(text(f"ALTER TABLE {t} ADD COLUMN company_id INTEGER"))
            except: pass
        demo = db.query(models.Company).filter(models.Company.id == 1).first()
        if not demo:
            demo = models.Company(name="Demo BTP", subscription_plan="pro")
            db.add(demo); db.commit(); db.refresh(demo)
        cid = demo.id
        db.execute(text(f"UPDATE users SET company_id = {cid} WHERE company_id IS NULL"))
        db.execute(text(f"UPDATE chantiers SET company_id = {cid} WHERE company_id IS NULL"))
        db.execute(text(f"UPDATE materiels SET company_id = {cid} WHERE company_id IS NULL"))
        db.commit()
        return {"msg": "Migration MT OK"}
    except Exception as e: return {"error": str(e)}

@app.get("/migrate_db_v9")
def migrate_v9(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS date_debut TIMESTAMP"))
        db.execute(text("ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS date_fin TIMESTAMP"))
        db.execute(text("ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS statut_planning VARCHAR DEFAULT 'prevu'"))
        db.commit()
        return {"msg": "Migration V9 OK"}
    except Exception as e: return {"error": str(e)}

@app.get("/migrate_db_v10")
def migrate_v10(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS latitude FLOAT"))
        db.execute(text("ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS longitude FLOAT"))
        db.commit()
        return {"msg": "Migration V10 (GPS) OK"}
    except Exception as e: return {"error": str(e)}

@app.get("/migrate_v11_sps")
def migrate_v11_sps(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS soumis_sps BOOLEAN DEFAULT FALSE"))
        db.commit()
        return {"msg": "Migration V11 (SPS) OK"}
    except Exception as e: return {"error": str(e)}

@app.get("/fix_geocoding")
def fix_geocoding(db: Session = Depends(get_db)):
    chantiers = db.query(models.Chantier).filter(models.Chantier.adresse != None, models.Chantier.latitude == None).all()
    count = 0
    for c in chantiers:
        if len(c.adresse) > 5:
            lat, lng = get_gps_from_address(c.adresse)
            if lat:
                c.latitude = lat; c.longitude = lng
                count += 1; time.sleep(1)
    db.commit()
    return {"msg": f"{count} chantiers géolocalisés"}

@app.get("/create_admin")
def create_admin(db: Session = Depends(get_db)):
    email = "admin@conformeo.com"
    if db.query(models.User).filter(models.User.email == email).first(): return {"msg": "Existe déjà"}
    comp = db.query(models.Company).first()
    if not comp:
        comp = models.Company(name="Admin Corp", subscription_plan="pro")
        db.add(comp); db.commit(); db.refresh(comp)
    u = models.User(email=email, hashed_password=security.get_password_hash("admin"), role="admin", company_id=comp.id)
    db.add(u); db.commit()
    return {"msg": "Admin créé", "login": email, "pass": "admin"}

@app.get("/fix_database_columns")
def fix_database_columns(db: Session = Depends(get_db)):
    messages = []
    columns_to_check = [
        ("signature_url", "VARCHAR"), ("cover_url", "VARCHAR"),
        ("date_debut", "TIMESTAMP"), ("date_fin", "TIMESTAMP"),
        ("statut_planning", "VARCHAR DEFAULT 'prevu'"), ("company_id", "INTEGER"),
        ("latitude", "FLOAT"), ("longitude", "FLOAT"), ("soumis_sps", "BOOLEAN DEFAULT FALSE")
    ]
    for col_name, col_type in columns_to_check:
        try:
            db.execute(text(f"ALTER TABLE chantiers ADD COLUMN {col_name} {col_type}"))
            db.commit(); messages.append(f"✅ Colonne '{col_name}' ajoutée.")
        except Exception as e:
            # We don't want to rollback successful operations if one fails because the column already exists.
            # However, with raw SQL transactions, this rollback might affect previous successful operations within this request.
            # A more granular approach would be checking existence first or committing after each success.
            # Since this is a fix script, we'll proceed but note this limitation.
            db.rollback(); messages.append(f"ℹ️ Colonne '{col_name}' existe déjà.")
    return {"status": "Terminé", "details": messages}

@app.get("/fix_pic_v2")
def fix_pic_v2(db: Session = Depends(get_db)):
    """Ajoute les 9 colonnes spécifiques pour la Notice PIC V2"""
    colonnes = [
        "acces", "clotures", "base_vie", "stockage", 
        "dechets", "levage", "reseaux", "circulations", "signalisation"
    ]
    logs = []
    for col in colonnes:
        try:
            db.execute(text(f"ALTER TABLE pics ADD COLUMN {col} VARCHAR DEFAULT ''"))
            db.commit() # Commit after each successful alteration
            logs.append(f"✅ Colonne {col} ajoutée")
        except Exception:
            db.rollback() # Rollback only the failed alteration
            logs.append(f"ℹ️ Colonne {col} existe déjà")
    return {"status": "Migration PIC V2 Terminée", "details": logs}

@app.get("/fix_everything")
def fix_everything(db: Session = Depends(get_db)):
    logs = []
    # 1. MIGRATION TABLES & COLONNES
    corrections = [
        ("chantiers", "signature_url", "VARCHAR"),
        ("chantiers", "cover_url", "VARCHAR"),
        ("chantiers", "latitude", "FLOAT"), ("chantiers", "longitude", "FLOAT"),
        ("chantiers", "soumis_sps", "BOOLEAN DEFAULT FALSE"),
        ("plans_prevention", "signature_eu", "VARCHAR"), ("plans_prevention", "signature_ee", "VARCHAR"),
        # PIC V2
        ("pics", "acces", "VARCHAR DEFAULT ''"), ("pics", "clotures", "VARCHAR DEFAULT ''"),
        ("pics", "base_vie", "VARCHAR DEFAULT ''"), ("pics", "stockage", "VARCHAR DEFAULT ''"),
        ("pics", "dechets", "VARCHAR DEFAULT ''"), ("pics", "levage", "VARCHAR DEFAULT ''"),
        ("pics", "reseaux", "VARCHAR DEFAULT ''"), ("pics", "circulations", "VARCHAR DEFAULT ''"),
        ("pics", "signalisation", "VARCHAR DEFAULT ''"),
        # PIC DESSIN
        ("pics", "background_url", "VARCHAR"), ("pics", "final_url", "VARCHAR"), ("pics", "elements_data", "JSON")
    ]
    for table, col, type_col in corrections:
        try:
            db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {type_col}"))
            db.commit(); logs.append(f"✅ {col} ajouté à {table}")
        except Exception:
            db.rollback(); logs.append(f"ℹ️ {col} existe déjà")

    # 2. CREATION TABLE COMPANY_DOCUMENTS (GED)
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS company_documents (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id),
                titre VARCHAR NOT NULL,
                type_doc VARCHAR NOT NULL,
                url VARCHAR NOT NULL,
                date_expiration TIMESTAMP,
                date_upload TIMESTAMP DEFAULT NOW()
            )
        """))
        db.commit()
        logs.append("✅ Table company_documents vérifiée")
    except Exception as e:
        logs.append(f"⚠️ Erreur company_documents: {str(e)}")

    return {"status": "Terminé", "details": logs}

@app.get("/force_delete_all_chantiers")
def force_delete_all_chantiers(db: Session = Depends(get_db)):
    try:
        db.execute(text("UPDATE materiels SET chantier_id = NULL"))
        db.execute(text("DELETE FROM rapport_images WHERE rapport_id IN (SELECT id FROM rapports)"))
        db.execute(text("DELETE FROM rapports"))
        db.execute(text("DELETE FROM inspections"))
        db.execute(text("DELETE FROM ppsps"))
        db.execute(text("DELETE FROM pics"))
        db.execute(text("DELETE FROM chantiers"))
        db.commit()
        return {"status": "Succès 🧹", "message": "Tous les chantiers et documents ont été supprimés."}
    except Exception as e:
        db.rollback()
        return {"status": "Erreur", "details": str(e)}

@app.get("/fix_pdp_signatures")
def fix_pdp_signatures(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE plans_prevention ADD COLUMN IF NOT EXISTS signature_eu VARCHAR;"))
        db.execute(text("ALTER TABLE plans_prevention ADD COLUMN IF NOT EXISTS signature_ee VARCHAR;"))
        db.commit()
        return {"message": "Colonnes signatures ajoutées avec succès ! ✍️✅"}
    except Exception as e:
        return {"error": str(e)}