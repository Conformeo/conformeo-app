from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/materiels", tags=["Matériel"]) 

@router.get("/", response_model=List[schemas.MaterielOut])
def get_materiels(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.company_id: return []
    return db.query(models.Materiel).filter(models.Materiel.company_id == current_user.company_id).all()

@router.post("/", response_model=schemas.MaterielOut)
def create_materiel(
    mat_in: schemas.MaterielCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.company_id: raise HTTPException(400, "Pas d'entreprise")
    
    mat = models.Materiel(**mat_in.dict(), company_id=current_user.company_id)
    db.add(mat)
    db.commit()
    db.refresh(mat)
    return mat

@router.put("/{mat_id}", response_model=schemas.MaterielOut)
def update_materiel(
    mat_id: int,
    mat_update: schemas.MaterielUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    mat = db.query(models.Materiel).filter(models.Materiel.id == mat_id).first()
    if not mat: raise HTTPException(404, "Matériel introuvable")
    
    update_data = mat_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(mat, key, value)
        
    db.commit()
    db.refresh(mat)
    return mat

@router.delete("/{mat_id}")
def delete_materiel(mat_id: int, db: Session = Depends(get_db)):
    mat = db.query(models.Materiel).filter(models.Materiel.id == mat_id).first()
    if not mat: raise HTTPException(404, "Introuvable")
    db.delete(mat)
    db.commit()
    return {"message": "Matériel supprimé"}