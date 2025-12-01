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
import pdf_generator  # Notre module PDF
from database import engine, get_db

# Création des tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Conforméo API")

# --- CONFIGURATION CLOUDINARY ---
# Documentation: https://cloudinary.com/documentation/django_integration#configuration
# On utilise la méthode du dictionnaire unpacking (**config) qui est standard et propre.

cloudinary_config = {
  "cloud_name": os.getenv("CLOUDINARY_CLOUD_NAME"),
  "api_key": os.getenv("CLOUDINARY_API_KEY"),
  "api_secret": os.getenv("CLOUDINARY_API_SECRET"),
  "secure": True
}

# On applique la configuration SEULEMENT si les clés sont présentes
required_keys = ["cloud_name", "api_key", "api_secret"]
missing = [k for k in required_keys if not cloudinary_config.get(k)]

if missing:
    raise RuntimeError(
        f"⚠️ Cloudinary non configuré correctement. Clés manquantes : {', '.join(missing)}"
    )

cloudinary.config(**cloudinary_config)
print(f"✅ Cloudinary configuré pour le cloud: {cloudinary_config['cloud_name']}")

# --- FIN CONFIGURATION ---

# Créer le dossier local s'il n'existe pas (pour PDF et fallback)
os.makedirs("uploads", exist_ok=True)

# Montage des fichiers statiques
app.mount("/static", StaticFiles(directory="uploads"), name="static")

# --- CORS (Autorisations) ---
origins = [
    "http://localhost:8100",           # Ionic Serve
    "http://localhost:4200",           # Angular Dev
    "https://conformeo-app.vercel.app", # Vercel
    "*"                                # Autoriser tout (temporaire pour dev)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        client=chantier.client
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
        # Upload direct vers Cloudinary
        # On spécifie le dossier dans Cloudinary pour rester organisé
        result = cloudinary.uploader.upload(file.file, folder="conformeo_chantiers")
        url_securisee = result.get("secure_url")
        return {"url": url_securisee}
    except Exception as e:
        print(f"Erreur Upload Cloudinary: {e}")
        # On renvoie une erreur 500 propre pour que le frontend comprenne
        raise HTTPException(status_code=500, detail=f"Erreur Cloudinary: {str(e)}")

@app.post("/rapports", response_model=schemas.RapportOut)
def create_rapport(rapport: schemas.RapportCreate, photo_url: Optional[str] = None, db: Session = Depends(get_db)):
    new_rapport = models.Rapport(
        titre=rapport.titre,
        description=rapport.description,
        chantier_id=rapport.chantier_id,
        photo_url=photo_url
    )
    db.add(new_rapport)
    db.commit()
    db.refresh(new_rapport)
    return new_rapport

@app.get("/chantiers/{chantier_id}/rapports", response_model=List[schemas.RapportOut])
def read_rapports_chantier(chantier_id: int, db: Session = Depends(get_db)):
    rapports = db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).all()
    return rapports

@app.get("/chantiers/{chantier_id}/pdf")
def download_pdf(chantier_id: int, db: Session = Depends(get_db)):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    rapports = db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).all()

    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")

    filename = f"Rapport_{chantier.id}.pdf"
    file_path = f"uploads/{filename}"

    # Génération du PDF via notre module
    pdf_generator.generate_pdf(chantier, rapports, file_path)

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

# Route de réparation DB (Décommentée si besoin pour ajouter colonne manquante)
@app.get("/fix_db_signature")
def fix_db_signature(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE chantiers ADD COLUMN signature_url VARCHAR"))
        db.commit()
        return {"message": "Succès ! La colonne signature_url a été ajoutée."}
    except Exception as e:
        return {"message": "Erreur ou colonne déjà présente", "details": str(e)}