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