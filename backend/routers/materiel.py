from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/materiel", tags=["Materiel"])

# 1. LISTER TOUT LE MATÉRIEL
@router.get("/", response_model=List[schemas.MaterielOut])
def get_all_materiel(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Materiel).filter(models.Materiel.company_id == current_user.company_id).all()

# 2. CRÉER DU MATÉRIEL
@router.post("/", response_model=schemas.MaterielOut)
def create_materiel(materiel: schemas.MaterielCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    new_mat = models.Materiel(**materiel.dict(), company_id=current_user.company_id)
    db.add(new_mat)
    db.commit()
    db.refresh(new_mat)
    return new_mat

# 3. METTRE À JOUR (C'est cette route qui permet le déplacement !)
@router.put("/{materiel_id}", response_model=schemas.MaterielOut)
def update_materiel(materiel_id: int, materiel_update: schemas.MaterielUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # On cherche l'équipement
    mat = db.query(models.Materiel).filter(models.Materiel.id == materiel_id).first()
    if not mat: 
        raise HTTPException(status_code=404, detail="Matériel introuvable")
    
    # Sécurité
    if mat.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Non autorisé")

    # Mise à jour des champs (dont chantier_id pour le déplacement)
    update_data = materiel_update.dict(exclude_unset=True)
    
    # Si on déplace vers l'entrepôt (chantier_id = null ou 0), on nettoie
    if "chantier_id" in update_data:
        if update_data["chantier_id"] == 0:
            update_data["chantier_id"] = None

    for key, value in update_data.items():
        setattr(mat, key, value)

    db.commit()
    db.refresh(mat)
    return mat

# 4. SUPPRIMER
@router.delete("/{materiel_id}")
def delete_materiel(materiel_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    mat = db.query(models.Materiel).filter(models.Materiel.id == materiel_id).first()
    if not mat: raise HTTPException(404, "Introuvable")
    
    if mat.company_id != current_user.company_id:
        raise HTTPException(403, "Non autorisé")
        
    db.delete(mat)
    db.commit()
    return {"status": "deleted"}