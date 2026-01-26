from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["Utilisateurs"])

@router.get("/me", response_model=schemas.UserOut)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    """Retourne les infos de l'utilisateur connecté."""
    return current_user

@router.get("/", response_model=List[schemas.UserOut])
def read_team(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Retourne tous les membres de la même entreprise."""
    if not current_user.company_id:
        return [current_user]
    return db.query(models.User).filter(models.User.company_id == current_user.company_id).all()







# Dans backend/routers/users.py

from fastapi import HTTPException # Assurez-vous d'avoir cet import

@router.post("/", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # 1. Vérifier si l'email existe déjà
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    # 2. Gestion de l'entreprise (Simplifiée pour le premier utilisateur)
    # Si l'utilisateur envoie un nom d'entreprise, on la crée ou on la récupère
    company_id = None
    if user.company_name:
        # On regarde si l'entreprise existe déjà (optionnel)
        db_company = db.query(models.Company).filter(models.Company.name == user.company_name).first()
        if not db_company:
            # Création de l'entreprise
            db_company = models.Company(name=user.company_name)
            db.add(db_company)
            db.commit()
            db.refresh(db_company)
        company_id = db_company.id

    # 3. Création de l'utilisateur
    # ATTENTION : Pour l'instant on stocke le mot de passe en clair pour que ça marche avec votre auth.py actuel
    new_user = models.User(
        email=user.email,
        hashed_password=user.password, # ⚠️ À hasher plus tard avec bcrypt
        nom=user.nom,
        role="admin", # On force le rôle admin pour le premier
        company_id=company_id
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user