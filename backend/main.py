import os
from dotenv import load_dotenv
load_dotenv()

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

# === CORS ULTRA SIMPLE (pour être sûr que ça passe) ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # <- autorise tout le monde
    allow_credentials=False,  # <- IMPORTANT pour que "*" soit accepté par le navigateur
    allow_methods=["*"],
    allow_headers=["*"],
)

# Petit endpoint de test
@app.get("/")
def root():
    return {"message": "Conformeo API ok", "cors": "enabled"}

# --- CONFIGURATION CLOUDINARY ---
cloudinary_config = {
    "cloud_name": os.getenv("CLOUDINARY_CLOUD_NAME"),
    "api_key": os.getenv("CLOUDINARY_API_KEY"),
    "api_secret": os.getenv("CLOUDINARY_API_SECRET"),
    "secure": True,
}

required_keys = ["cloud_name", "api_key", "api_secret"]
missing = [k for k in required_keys if not cloudinary_config.get(k)]

if missing:
    raise RuntimeError(
        f"⚠️ Cloudinary non configuré correctement. Clés manquantes : {', '.join(missing)}"
    )

cloudinary.config(**cloudinary_config)
print(f"✅ Cloudinary configuré pour le cloud: {cloudinary_config['cloud_name']}")

# (et ensuite le reste de TON fichier, inchangé : uploads, routes, etc.)

# --- FIN CONFIGURATION ---

# Créer le dossier local s'il n'existe pas (pour PDF et fallback)
os.makedirs("uploads", exist_ok=True)

# Montage des fichiers statiques
app.mount("/static", StaticFiles(directory="uploads"), name="static")


# --- ROUTES AUTHENTIFICATION ---

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


# --- ROUTES CHANTIERS ---

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
    chantiers = db.query(models.Chantier).all()
    return chantiers


# --- ROUTES RAPPORTS & PHOTOS ---

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """Envoie l'image sur Cloudinary et renvoie l'URL sécurisée."""
    try:
        result = cloudinary.uploader.upload(file.file, folder="conformeo_chantiers")
        url_securisee = result.get("secure_url")
        return {"url": url_securisee}
    except Exception as e:
        import traceback
        traceback.print_exc()  # log complet dans Render
        raise HTTPException(
            status_code=500,
            detail=f"Cloudinary error: {repr(e)}"
        )


@app.post("/rapports", response_model=schemas.RapportOut)
def create_rapport(rapport: schemas.RapportCreate, db: Session = Depends(get_db)):
    
    # 1. On crée le rapport "Parent"
    new_rapport = models.Rapport(
        titre=rapport.titre,
        description=rapport.description,
        chantier_id=rapport.chantier_id,
        niveau_urgence=rapport.niveau_urgence,
        latitude=rapport.latitude,
        longitude=rapport.longitude,
        # Astuce : On met la 1ère image en "photo principale" pour que les vieux écrans marchent encore
        photo_url=rapport.image_urls[0] if rapport.image_urls else None
    )
    db.add(new_rapport)
    db.commit()
    db.refresh(new_rapport)

    # 2. On crée les images "Enfants" dans la table dédiée
    if rapport.image_urls:
        for url in rapport.image_urls:
            new_img = models.RapportImage(url=url, rapport_id=new_rapport.id)
            db.add(new_img)
        
        db.commit()
        db.refresh(new_rapport) # On rafraîchit pour récupérer la liste des images
        
    return new_rapport

# Nouvelle route GET pour vérifier que ça marche dans le navigateur
@app.get("/rapports", response_model=List[schemas.RapportOut])
def read_all_rapports(db: Session = Depends(get_db)):
    """Permet de voir tous les rapports et leurs galeries via le navigateur"""
    return db.query(models.Rapport).all()
    

@app.get("/chantiers/{chantier_id}/rapports", response_model=List[schemas.RapportOut])
def read_rapports_chantier(chantier_id: int, db: Session = Depends(get_db)):
    rapports = db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).all()
    return rapports

# ... (imports)

@app.get("/chantiers/{chantier_id}/pdf")
def download_pdf(chantier_id: int, db: Session = Depends(get_db)):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    rapports = db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).all()
    
    # 👇 NOUVEAU : On récupère aussi les inspections
    inspections = db.query(models.Inspection).filter(models.Inspection.chantier_id == chantier_id).all()

    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")

    filename = f"Rapport_{chantier.id}.pdf"
    file_path = f"uploads/{filename}"

    # 👇 ON PASSE 'inspections' A LA FONCTION
    pdf_generator.generate_pdf(chantier, rapports, inspections, file_path)

    return FileResponse(path=file_path, filename=filename, media_type='application/pdf')

# --- DASHBOARD ---

@app.get("/dashboard/stats")
def get_stats(db: Session = Depends(get_db)):
    total_chantiers = db.query(models.Chantier).count()
    chantiers_actifs = db.query(models.Chantier).filter(models.Chantier.est_actif == True).count()
    total_rapports = db.query(models.Rapport).count()
    alertes = total_rapports 

    return {
        "total_chantiers": total_chantiers,
        "actifs": chantiers_actifs,
        "rapports": total_rapports,
        "alertes": alertes
    }


# --- ROUTES MATERIEL ---

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
    db.refresh(mat)
    return {"status": "success", "nouveau_lieu": chantier_id if chantier_id else "Dépôt"}


# --- SIGNATURE ---

@app.put("/chantiers/{chantier_id}/signature")
def sign_chantier(chantier_id: int, signature_url: str, db: Session = Depends(get_db)):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")
    
    chantier.signature_url = signature_url
    db.commit()
    return {"status": "signed", "url": signature_url}
    

# --- MAINTENANCE ---

@app.get("/reset_data")
def reset_data(db: Session = Depends(get_db)):
    try:
        num_rapports = db.query(models.Rapport).delete()
        num_materiels = db.query(models.Materiel).delete()
        num_chantiers = db.query(models.Chantier).delete()
        
        db.commit()
        
        return {
            "status": "Succès", 
            "message": "La base de données a été nettoyée.",
            "details": {
                "rapports_supprimes": num_rapports,
                "materiels_supprimes": num_materiels,
                "chantiers_supprimes": num_chantiers
            }
        }
    except Exception as e:
        db.rollback()
        return {"status": "Erreur", "details": str(e)}


@app.get("/fix_db_signature")
def fix_db_signature(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE chantiers ADD COLUMN signature_url VARCHAR"))
        db.commit()
        return {"message": "Succès ! La colonne signature_url a été ajoutée."}
    except Exception as e:
        return {"message": "Erreur ou colonne déjà présente", "details": str(e)}


@app.get("/migrate_db_v1_5")
def migrate_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS cover_url VARCHAR"))
        db.execute(text("ALTER TABLE rapports ADD COLUMN IF NOT EXISTS niveau_urgence VARCHAR DEFAULT 'Faible'"))
        db.execute(text("ALTER TABLE rapports ADD COLUMN IF NOT EXISTS latitude FLOAT"))
        db.execute(text("ALTER TABLE rapports ADD COLUMN IF NOT EXISTS longitude FLOAT"))
        
        db.commit()
        return {"message": "Migration V1.5 réussie ! Colonnes ajoutées."}
    except Exception as e:
        db.rollback()
        return {"status": "Erreur migration", "details": str(e)}


@app.get("/migrate_db_v2")
def migrate_db_v2(db: Session = Depends(get_db)):
    try:
        models.Base.metadata.create_all(bind=engine)
        return {"message": "Migration V2 réussie ! Table images créée."}
    except Exception as e:
        return {"status": "Erreur", "details": str(e)}

# --- MIGRATION V3 (QHSE) ---
@app.get("/migrate_db_v3")
def migrate_db_v3(db: Session = Depends(get_db)):
    try:
        models.Base.metadata.create_all(bind=engine) # Crée la table inspections
        return {"message": "Migration V3 (QHSE) réussie !"}
    except Exception as e:
        return {"status": "Erreur", "details": str(e)}

# --- ROUTES INSPECTIONS ---
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


# ...

# --- MIGRATION V4 (PPSPS) ---
@app.get("/migrate_db_v4")
def migrate_db_v4(db: Session = Depends(get_db)):
    try:
        models.Base.metadata.create_all(bind=engine)
        return {"message": "Migration V4 (PPSPS) réussie !"}
    except Exception as e:
        return {"status": "Erreur", "details": str(e)}

# --- ROUTES PPSPS ---
@app.post("/ppsps", response_model=schemas.PPSPSOut)
def create_ppsps(ppsps: schemas.PPSPSCreate, db: Session = Depends(get_db)):
    new_ppsps = models.PPSPS(
        maitre_oeuvre=ppsps.maitre_oeuvre,
        coordonnateur_sps=ppsps.coordonnateur_sps,
        hopital_proche=ppsps.hopital_proche,
        responsable_securite=ppsps.responsable_securite,
        nb_compagnons=ppsps.nb_compagnons,
        horaires=ppsps.horaires,
        risques=ppsps.risques,
        chantier_id=ppsps.chantier_id
    )
    db.add(new_ppsps)
    db.commit()
    db.refresh(new_ppsps)
    return new_ppsps

@app.get("/chantiers/{chantier_id}/ppsps", response_model=List[schemas.PPSPSOut])
def read_ppsps_chantier(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.PPSPS).filter(models.PPSPS.chantier_id == chantier_id).all()

# --- PDF PPSPS SPECIFIQUE ---
@app.get("/ppsps/{ppsps_id}/pdf")
def download_ppsps_pdf(ppsps_id: int, db: Session = Depends(get_db)):
    ppsps = db.query(models.PPSPS).filter(models.PPSPS.id == ppsps_id).first()
    if not ppsps: raise HTTPException(status_code=404, detail="PPSPS introuvable")
    
    chantier = db.query(models.Chantier).filter(models.Chantier.id == ppsps.chantier_id).first()
    
    filename = f"PPSPS_{chantier.nom}.pdf"
    file_path = f"uploads/{filename}"
    
    # On appelle une nouvelle fonction dédiée dans pdf_generator
    pdf_generator.generate_ppsps_pdf(chantier, ppsps, file_path)
    
    return FileResponse(path=file_path, filename=filename, media_type='application/pdf')