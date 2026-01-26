from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/duerp", tags=["DUERP"])

@router.get("/", response_model=List[schemas.DUERPOut])
def get_duerps(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.DUERP).filter(models.DUERP.company_id == current_user.company_id).all()

@router.post("/", response_model=schemas.DUERPOut)
def create_duerp(duerp_in: schemas.DUERPCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Créer le DUERP parent
    db_duerp = models.DUERP(
        company_id=current_user.company_id,
        annee=str(duerp_in.annee)
    )
    db.add(db_duerp)
    db.commit()
    db.refresh(db_duerp)
    
    # 2. Ajouter les lignes
    for ligne in duerp_in.lignes:
        db_ligne = models.DUERPLigne(
            duerp_id=db_duerp.id,
            **ligne.dict()
        )
        db.add(db_ligne)
    
    db.commit()
    db.refresh(db_duerp)
    return db_duerp