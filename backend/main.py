from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.staticfiles import StaticFiles # <--- Important
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import cloudinary
import cloudinary.uploader

from sqlalchemy import text
from sqlalchemy.orm import Session
import models, schemas, security
from database import engine, get_db
from typing import List, Optional
import shutil
import os
from uuid import uuid4


import pdf_generator # Notre nouveau fichier

# Création des tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Conforméo API")

# --- CONFIGURATION CLOUDINARY ---
# Remplace par TON url, ou mieux, utilise os.getenv("CLOUDINARY_URL")
# Pour l'instant on va utiliser une variable d'environnement
cloudinary.config(
  cloud_name = os.getenv("mediaflows_e8ee5dac-d32a-42cd-bc02-c20df96c7aba"),
  api_key = os.getenv("333761364629922"),
  api_secret = os.getenv("Kol6EichzIOtzcDVWz3-xgxtdb4"),
  secure = True
)

# Créer le dossier s'il n'existe pas (sécurité)
os.makedirs("uploads", exist_ok=True)

# On dit à l'API : "Quand on demande une URL commençant par /static, va chercher dans le dossier uploads"
app.mount("/static", StaticFiles(directory="uploads"), name="static")

# --- AJOUT CORS (Début) ---
origins = ["*"] # En prod, on mettra l'URL spécifique, mais pour le dev "*" autorise tout le monde.

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- AJOUT CORS (Fin) ---

# Route pour créer un compte (Inscription)
@app.post("/users", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Vérifier si l'email existe déjà
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    # Hacher le mot de passe et sauvegarder
    hashed_pwd = security.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_pwd, role=user.role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# Route pour se connecter (Login) -> Renvoie un Token
@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Vérifier l'utilisateur
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Créer le token
    access_token = security.create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}


# --- Routes Chantiers ---

# 1. Créer un chantier
@app.post("/chantiers", response_model=schemas.ChantierOut)
def create_chantier(chantier: schemas.ChantierCreate, db: Session = Depends(get_db)):
    # On crée l'objet Chantier à partir des données reçues
    new_chantier = models.Chantier(
        nom=chantier.nom,
        adresse=chantier.adresse,
        client=chantier.client
    )
    db.add(new_chantier)
    db.commit()
    db.refresh(new_chantier)
    return new_chantier

# 2. Lister tous les chantiers
@app.get("/chantiers", response_model=List[schemas.ChantierOut])
def read_chantiers(db: Session = Depends(get_db)):
    chantiers = db.query(models.Chantier).all()
    return chantiers

# --- Routes Rapports & Photos ---

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """Envoie l'image sur Cloudinary et renvoie l'URL sécurisée."""
    
    # 1. On envoie directement le fichier à Cloudinary
    # (Cloudinary est magique, il lit directement le fichier temporaire)
    result = cloudinary.uploader.upload(file.file, folder="conformeo_chantiers")
    
    # 2. On récupère l'URL sécurisée (https)
    url_securisee = result.get("secure_url")
    
    return {"url": url_securisee}

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
    """Récupère tous les rapports d'un chantier spécifique."""
    rapports = db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).all()
    return rapports


@app.get("/chantiers/{chantier_id}/pdf")
def download_pdf(chantier_id: int, db: Session = Depends(get_db)):
    # 1. Récupérer les données
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    rapports = db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).all()

    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")

    # 2. Générer le fichier PDF
    filename = f"Rapport_{chantier.id}.pdf"
    file_path = f"uploads/{filename}"

    pdf_generator.generate_pdf(chantier, rapports, file_path)

    # 3. Renvoyer le fichier au navigateur
    return FileResponse(path=file_path, filename=filename, media_type='application/pdf')


@app.get("/dashboard/stats")
def get_stats(db: Session = Depends(get_db)):
    """Renvoie les chiffres clés pour le tableau de bord direction."""
    total_chantiers = db.query(models.Chantier).count()
    chantiers_actifs = db.query(models.Chantier).filter(models.Chantier.est_actif == True).count()
    total_rapports = db.query(models.Rapport).count()
    
    # Simulation d'un calcul de "Non-Conformités" (ici on compte juste les rapports pour l'exemple)
    alertes = total_rapports 

    return {
        "total_chantiers": total_chantiers,
        "actifs": chantiers_actifs,
        "rapports": total_rapports,
        "alertes": alertes
    }


# ... (tout le reste au-dessus)

# --- Routes Matériel ---

# 1. Créer un outil
@app.post("/materiels", response_model=schemas.MaterielOut)
def create_materiel(mat: schemas.MaterielCreate, db: Session = Depends(get_db)):
    # Par défaut, un nouveau matériel est au dépôt (chantier_id = None)
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

# 2. Lister tout le matériel
@app.get("/materiels", response_model=List[schemas.MaterielOut])
def read_materiels(db: Session = Depends(get_db)):
    return db.query(models.Materiel).all()

# 3. Déplacer un outil (Assignation)
# Si chantier_id est 0 ou absent, on considère que c'est retour au dépôt
@app.put("/materiels/{materiel_id}/transfert")
def transfer_materiel(materiel_id: int, chantier_id: Optional[int] = None, db: Session = Depends(get_db)):
    mat = db.query(models.Materiel).filter(models.Materiel.id == materiel_id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Matériel introuvable")
    
    # Mise à jour du lieu
    mat.chantier_id = chantier_id
    db.commit()
    db.refresh(mat)
    return {"status": "success", "nouveau_lieu": chantier_id if chantier_id else "Dépôt"}


# Route pour assigner une signature à un chantier
@app.put("/chantiers/{chantier_id}/signature")
def sign_chantier(chantier_id: int, signature_url: str, db: Session = Depends(get_db)):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")
    
    chantier.signature_url = signature_url
    db.commit()
    return {"status": "signed", "url": signature_url}
    

# --- ROUTE DE RESET (NETTOYAGE) ---
@app.get("/reset_data")
def reset_data(db: Session = Depends(get_db)):
    try:
        # 1. On supprime d'abord les enfants (Rapports et Matériels) pour éviter les conflits de clé étrangère
        num_rapports = db.query(models.Rapport).delete()
        num_materiels = db.query(models.Materiel).delete()
        
        # 2. On supprime les parents (Chantiers)
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
        db.rollback() # En cas d'erreur, on annule tout
        return {"status": "Erreur", "details": str(e)}


# --- ROUTE DE RÉPARATION (A supprimer plus tard) ---
# @app.get("/fix_db_signature")
# def fix_db_signature(db: Session = Depends(get_db)):
#     try:
#         # On exécute la commande SQL pour ajouter la colonne manquant
#         db.execute(text("ALTER TABLE chantiers ADD COLUMN signature_url VARCHAR"))
#         db.commit()
#         return {"message": "Succès ! La colonne signature_url a été ajoutée."}
#     except Exception as e:
#         return {"message": "Erreur ou colonne déjà présente", "details": str(e)}