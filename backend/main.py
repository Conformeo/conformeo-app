import os
import shutil
from uuid import uuid4
from typing import List, Optional
from dotenv import load_dotenv
import zipfile
from datetime import datetime, timedelta, date
import csv 
import codecs

load_dotenv()

import requests
import cloudinary
import cloudinary.uploader
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from sqlalchemy import text, func
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
    
    # Création Entreprise si demandée (Signup)
    if user.company_name:
        new_company = models.Company(name=user.company_name, subscription_plan="free")
        db.add(new_company); db.commit(); db.refresh(new_company)
        company_id = new_company.id
        role = "admin"
    else:
        # Sinon (Invitation), on verra plus tard, ici on met null ou on gère dans /team
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

@app.get("/users/me", response_model=schemas.UserOut)
def read_users_me(current_user: models.User = Depends(security.get_current_user)):
    return current_user

# ==========================================
# 2. DASHBOARD
# ==========================================
@app.get("/dashboard/stats")
def get_stats(db: Session = Depends(get_db)):
    # Note: Pour le multi-tenant, il faudrait filtrer par company_id ici aussi
    # Mais pour l'instant on garde global pour la démo
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
        last_gps = db.query(models.Rapport).filter(models.Rapport.chantier_id == c.id, models.Rapport.latitude != None).first()
        if last_gps:
            map_data.append({"id": c.id, "nom": c.nom, "client": c.client, "lat": last_gps.latitude, "lng": last_gps.longitude})

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
    new_c = models.Chantier(
        nom=chantier.nom, adresse=chantier.adresse, client=chantier.client, cover_url=chantier.cover_url,
        company_id=current_user.company_id,
        # Dates pour le planning (défaut +30j)
        date_debut=chantier.date_debut or datetime.now(),
        date_fin=chantier.date_fin or (datetime.now() + timedelta(days=30))
    )
    db.add(new_c); db.commit(); db.refresh(new_c)
    return new_c

@app.put("/chantiers/{cid}")
def update_chantier(cid: int, up: schemas.ChantierCreate, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    c.nom = up.nom; c.adresse = up.adresse; c.client = up.client
    if up.cover_url: c.cover_url = up.cover_url
    if up.date_debut: c.date_debut = up.date_debut
    if up.date_fin: c.date_fin = up.date_fin

    # 👇 AJOUT DE LA MISE A JOUR DU STATUT
    if up.est_actif is not None: 
        c.est_actif = up.est_actif

    db.commit(); db.refresh(c)
    return c

@app.get("/chantiers", response_model=List[schemas.ChantierOut])
def read_chantiers(db: Session = Depends(get_db)):
    # Pour l'instant on retourne tout, en V2 on filtrera par current_user.company_id
    return db.query(models.Chantier).all()

# 👇 LA ROUTE QUI MANQUAIT !
@app.get("/chantiers/{chantier_id}", response_model=schemas.ChantierOut)
def read_chantier(chantier_id: int, db: Session = Depends(get_db)):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")
    return chantier

@app.post("/chantiers/import")
async def import_chantiers_csv(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db) 
    # ⚠️ ATTENTION : Pas de 'current_user' ici !
):
    # Tolérance majuscule/minuscule pour l'extension
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(400, "Le fichier doit être un CSV")

    try:
        content = await file.read()
        
        # Décodage robuste
        try:
            text_content = content.decode('utf-8-sig')
        except:
            text_content = content.decode('latin-1')
            
        lines = text_content.splitlines()
        if not lines: raise HTTPException(400, "Fichier vide")
        
        # Détection séparateur
        delimiter = ';' if ';' in lines[0] else ','
        reader = csv.DictReader(lines, delimiter=delimiter)

        # On prend une entreprise par défaut pour éviter le plantage
        # Si la table companies est vide, on met None (le chantier sera orphelin mais créé)
        default_company = db.query(models.Company).first()
        cid = default_company.id if default_company else None

        count = 0
        for row in reader:
            # Nettoyage des clés (enlève espaces et met en minuscule pour être sûr)
            # Ex: "Nom " devient "nom"
            row = {k.strip(): v.strip() for k, v in row.items() if k}
            
            # Recherche des colonnes (tolérant)
            # On cherche 'Nom', 'nom', 'NOM'...
            keys_nom = [k for k in row.keys() if k.lower() == 'nom']
            keys_client = [k for k in row.keys() if k.lower() == 'client']
            keys_adresse = [k for k in row.keys() if k.lower() == 'adresse']

            nom = row[keys_nom[0]] if keys_nom else None
            
            if nom:
                client = row[keys_client[0]] if keys_client else "Client Inconnu"
                adresse = row[keys_adresse[0]] if keys_adresse else "Adresse Inconnue"
                
                # On utilise None pour les champs optionnels pour éviter les bugs
                db.add(models.Chantier(
                    nom=nom,
                    client=client,
                    adresse=adresse,
                    est_actif=True,
                    company_id=cid,
                    date_creation=datetime.now(),
                    date_debut=datetime.now(), 
                    date_fin=datetime.now() + timedelta(days=30),
                    signature_url=None, 
                    cover_url=None
                ))
                count += 1
        
        db.commit()
        return {"status": "success", "message": f"{count} chantiers importés !"}

    except Exception as e:
        db.rollback()
        # On renvoie l'erreur précise au frontend
        raise HTTPException(500, f"Erreur Python : {str(e)}")

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
    db.delete(c); db.commit()
    return {"status": "deleted"}

# ==========================================
# 4. MATERIEL
# ==========================================
@app.post("/materiels", response_model=schemas.MaterielOut)
def create_materiel(mat: schemas.MaterielCreate, db: Session = Depends(get_db)):
    new_m = models.Materiel(
        nom=mat.nom, reference=mat.reference, etat=mat.etat, image_url=mat.image_url
    )
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
# 5. DOCS & EXPORTS
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
    path = f"uploads/Audit_{iid}.pdf"
    pdf_generator.generate_audit_pdf(c, i, path)
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
    path = f"uploads/PPSPS_{pid}.pdf"
    pdf_generator.generate_ppsps_pdf(c, p, path)
    return FileResponse(path, media_type='application/pdf')

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

@app.get("/chantiers/{cid}/pdf")
def download_pdf(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    raps = db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).all()
    inss = db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).all()
    path = f"uploads/J_{cid}.pdf"
    pdf_generator.generate_pdf(c, raps, inss, path)
    return FileResponse(path, media_type='application/pdf')

@app.get("/chantiers/{cid}/doe")
def download_doe(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    
    zip_name = f"uploads/DOE_{c.id}.zip"
    with zipfile.ZipFile(zip_name, 'w') as z:
        raps = db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).all()
        inss = db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).all()
        j_path = f"uploads/J_{c.id}.pdf"
        pdf_generator.generate_pdf(c, raps, inss, j_path)
        z.write(j_path, "1_Journal_Chantier.pdf")
        
        ppsps = db.query(models.PPSPS).filter(models.PPSPS.chantier_id == cid).all()
        for idx, p in enumerate(ppsps):
            p_path = f"uploads/P_{p.id}.pdf"
            pdf_generator.generate_ppsps_pdf(c, p, p_path)
            z.write(p_path, f"2_PPSPS_{idx+1}.pdf")

        for idx, i in enumerate(inss):
            a_path = f"uploads/A_{i.id}.pdf"
            pdf_generator.generate_audit_pdf(c, i, a_path)
            z.write(a_path, f"3_Audit_{i.type}_{idx+1}.pdf")
            
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
# 10. GESTION EQUIPE & ENTREPRISE
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
# 11. MIGRATIONS
# ==========================================
@app.get("/migrate_multi_tenant")
def migrate_mt(db: Session = Depends(get_db)):
    try:
        models.Base.metadata.create_all(bind=engine)
        for t in ["users", "chantiers", "materiels"]:
            try: db.execute(text(f"ALTER TABLE {t} ADD COLUMN company_id INTEGER"))
            except: pass
        
        # Création Entreprise Démo
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
    
    # Liste des colonnes à vérifier pour la table 'chantiers'
    columns_to_check = [
        ("signature_url", "VARCHAR"),
        ("cover_url", "VARCHAR"),
        ("date_debut", "TIMESTAMP"),
        ("date_fin", "TIMESTAMP"),
        ("statut_planning", "VARCHAR DEFAULT 'prevu'"),
        ("company_id", "INTEGER")
    ]
    
    for col_name, col_type in columns_to_check:
        try:
            # On tente d'ajouter la colonne
            db.execute(text(f"ALTER TABLE chantiers ADD COLUMN {col_name} {col_type}"))
            db.commit()
            messages.append(f"✅ Colonne '{col_name}' ajoutée.")
        except Exception as e:
            db.rollback()
            # Si erreur, c'est qu'elle existe probablement déjà
            messages.append(f"ℹ️ Colonne '{col_name}' existe déjà (ou erreur: {e}).")
            
    return {"status": "Terminé", "details": messages}

@app.get("/fix_everything")
def fix_everything(db: Session = Depends(get_db)):
    logs = []
    
    # Liste de TOUTES les colonnes susceptibles de manquer
    corrections = [
        # Table CHANTIERS
        ("chantiers", "signature_url", "VARCHAR"),
        ("chantiers", "cover_url", "VARCHAR"),
        ("chantiers", "date_debut", "TIMESTAMP"),
        ("chantiers", "date_fin", "TIMESTAMP"),
        ("chantiers", "statut_planning", "VARCHAR DEFAULT 'prevu'"),
        ("chantiers", "company_id", "INTEGER"),
        
        # Table MATERIELS
        ("materiels", "image_url", "VARCHAR"),
        ("materiels", "company_id", "INTEGER"),
        
        # Table USERS
        ("users", "company_id", "INTEGER"),
        
        # Table COMPANIES (Branding)
        ("companies", "logo_url", "VARCHAR"),
        ("companies", "address", "VARCHAR"),
        ("companies", "contact_email", "VARCHAR"),
        ("companies", "phone", "VARCHAR"),

        # Table PPSPS
        ("ppsps", "secours_data", "JSON"),
        ("ppsps", "installations_data", "JSON"),
        ("ppsps", "taches_data", "JSON"),
        ("ppsps", "duree_travaux", "VARCHAR"),
    ]
    
    for table, col, type_col in corrections:
        try:
            db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {type_col}"))
            db.commit()
            logs.append(f"✅ Ajout de {col} dans {table}")
        except Exception as e:
            db.rollback()
            # L'erreur est normale si la colonne existe déjà
            logs.append(f"ℹ️ {col} existe déjà dans {table}")

    return {"status": "Terminé", "details": logs}

@app.get("/force_delete_all_chantiers")
def force_delete_all_chantiers(db: Session = Depends(get_db)):
    try:
        # 1. On rapatrie tout le matériel au dépôt (Sécurité)
        db.execute(text("UPDATE materiels SET chantier_id = NULL"))
        
        # 2. On supprime les dépendances en SQL pur (Plus robuste que l'ORM)
        # Supprime les images des rapports liés à des chantiers
        db.execute(text("DELETE FROM rapport_images WHERE rapport_id IN (SELECT id FROM rapports)"))
        
        # Supprime les documents
        db.execute(text("DELETE FROM rapports"))
        db.execute(text("DELETE FROM inspections"))
        db.execute(text("DELETE FROM ppsps"))
        db.execute(text("DELETE FROM pics"))
        
        # 3. Enfin, on supprime TOUS les chantiers
        db.execute(text("DELETE FROM chantiers"))
        
        db.commit()
        return {"status": "Succès 🧹", "message": "Tous les chantiers et documents ont été supprimés. Le matériel est conservé."}

    except Exception as e:
        db.rollback()
        return {"status": "Erreur", "details": str(e)}

# ... (Imports identiques, ajoutez juste 'time' si besoin pour des pauses)
import time 

# ... (Configuration Cloudinary, Models...)

# 👇 1. FONCTION DE GÉOCODAGE (OPENSTREETMAP)
def get_gps_from_address(address: str):
    if not address or len(address) < 5: return None, None
    try:
        # On interroge l'API gratuite de Nominatim
        url = "https://nominatim.openstreetmap.org/search"
        params = {'q': address, 'format': 'json', 'limit': 1}
        # Il faut un User-Agent pour être poli avec l'API
        headers = {'User-Agent': 'ConformeoApp/1.0'}
        
        response = requests.get(url, params=params, headers=headers, timeout=5)
        if response.status_code == 200 and len(response.json()) > 0:
            data = response.json()[0]
            return float(data['lat']), float(data['lon'])
    except Exception as e:
        print(f"Erreur GPS pour {address}: {e}")
    return None, None

# ... (Routes Users, Login... inchangées) ...

# ==========================================
# 2. DASHBOARD (Mise à jour CARTE)
# ==========================================
@app.get("/dashboard/stats")
def get_stats(db: Session = Depends(get_db)):
    # ... (KPIs et Graphiques inchangés) ...
    # (Je remets le début pour contexte, gardez votre logique KPI/Chart)
    total = db.query(models.Chantier).count()
    actifs = db.query(models.Chantier).filter(models.Chantier.est_actif == True).count()
    rap = db.query(models.Rapport).count()
    alert = db.query(models.Rapport).filter(models.Rapport.niveau_urgence.in_(['Critique', 'Moyen'])).count()
    
    # ... (Graphique & Récents inchangés) ...
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
    rec_fmt = [{"titre": r.titre, "date": r.date_creation, "chantier": r.chantier.nom if r.chantier else "-", "urgence": r.niveau_urgence} for r in recents]

    # 👇 NOUVELLE LOGIQUE CARTE : On prend le GPS du chantier !
    map_data = []
    chantiers = db.query(models.Chantier).filter(models.Chantier.est_actif == True).all()
    
    for c in chantiers:
        # Priorité 1 : Le GPS de l'adresse du chantier (si dispo)
        lat, lng = c.latitude, c.longitude
        
        # Priorité 2 : Si pas d'adresse GPS, on cherche dans les rapports (fallback)
        if not lat:
            last_gps = db.query(models.Rapport).filter(models.Rapport.chantier_id == c.id, models.Rapport.latitude != None).first()
            if last_gps:
                lat, lng = last_gps.latitude, last_gps.longitude
        
        if lat and lng:
            map_data.append({
                "id": c.id, "nom": c.nom, "client": c.client, 
                "lat": lat, "lng": lng
            })

    return {
        "kpis": { "total_chantiers": total, "actifs": actifs, "rapports": rap, "alertes": alert, "materiel_sorti": 0 },
        "chart": { "labels": labels, "values": values },
        "recents": rec_fmt,
        "map": map_data
    }

# ==========================================
# 3. CHANTIERS & IMPORT INTELLIGENT
# ==========================================

# (Ajoutez lat/lon dans create_chantier si vous voulez, mais c'est surtout l'import qui compte)

@app.post("/chantiers/import")
async def import_chantiers_csv(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    # ... (Début identique : vérif extension, lecture contenu...)
    if not file.filename.lower().endswith('.csv'): raise HTTPException(400, "Non CSV")
    try:
        content = await file.read()
        try: text = content.decode('utf-8-sig')
        except: text = content.decode('latin-1')
        lines = text.splitlines()
        delimiter = ';' if ';' in lines[0] else ','
        reader = csv.DictReader(lines, delimiter=delimiter)
        
        company = db.query(models.Company).first()
        cid = company.id if company else None

        count = 0
        for row in reader:
            row = {k.strip(): v.strip() for k, v in row.items() if k}
            nom = None
            client = "-"
            adresse = "-"
            
            for k, v in row.items():
                if 'nom' in k.lower(): nom = v
                if 'client' in k.lower(): client = v
                if 'adresse' in k.lower(): adresse = v

            if nom:
                # 👇 C'EST ICI LA MAGIE : ON CALCULE LE GPS
                lat, lng = None, None
                if adresse and len(adresse) > 5:
                    lat, lng = get_gps_from_address(adresse)
                    # Petite pause pour ne pas spammer l'API gratuite (1 req/sec max conseillé)
                    time.sleep(1) 

                db.add(models.Chantier(
                    nom=nom, client=client, adresse=adresse,
                    est_actif=True, company_id=cid, date_creation=datetime.now(),
                    date_debut=datetime.now(), date_fin=datetime.now()+timedelta(days=30),
                    # On stocke le GPS trouvé !
                    latitude=lat, longitude=lng 
                ))
                count += 1
        
        db.commit()
        return {"status": "success", "message": f"{count} chantiers importés et géolocalisés !"}

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Erreur: {str(e)}")

# ... (Le reste du fichier reste identique) ...

# --- MIGRATION V10 (GPS CHANTIER) ---
@app.get("/migrate_db_v10")
def migrate_v10(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS latitude FLOAT"))
        db.execute(text("ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS longitude FLOAT"))
        db.commit()
        re@turn {"msg": "Migration V10 (GPS) OK"}
    except Exception as e: return {"error": str(e)}

# --- ROUTE DE RATTRAPAGE (Pour géolocaliser les anciens chantiers) ---
@app.get("/fix_geocoding")
def fix_geocoding(db: Session = Depends(get_db)):
    # On prend les chantiers qui ont une adresse mais pas de GPS
    chantiers = db.query(models.Chantier).filter(
        models.Chantier.adresse != None,
        models.Chantier.latitude == None
    ).all()
    
    count = 0
    for c in chantiers:
        if len(c.adresse) > 5:
            lat, lng = get_gps_from_address(c.adresse)
            if lat:
                c.latitude = lat
                c.longitude = lng
                count += 1
                time.sleep(1) # Pause politesse API
    
    db.commit()
    return {"msg": f"{count} anciens chantiers ont été géolocalisés !"}