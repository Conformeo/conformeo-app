from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
import csv
from datetime import datetime, timedelta

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/materiels", tags=["Materiels"])

def inject_statut(mat):
    statut = "INCONNU"
    d = getattr(mat, "date_derniere_vgp", None)
    if d:
        if isinstance(d, str): 
            try: d = datetime.fromisoformat(d[:10])
            except: d = None
        if d:
            if not isinstance(d, datetime): d = datetime(d.year, d.month, d.day)
            delta = (d + timedelta(days=365) - datetime.now()).days
            if delta < 0: statut = "NON CONFORME"
            elif delta < 30: statut = "A PREVOIR"
            else: statut = "CONFORME"
    setattr(mat, "statut_vgp", statut)
    return mat

@router.get("", response_model=List[schemas.MaterielOut])
def read_materiels(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    rows = db.query(models.Materiel).filter(models.Materiel.company_id == current_user.company_id).offset(skip).limit(limit).all()
    return [inject_statut(r) for r in rows]

@router.post("", response_model=schemas.MaterielOut)
def create_materiel(mat: schemas.MaterielCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    d_vgp = None
    if mat.date_derniere_vgp:
        try: d_vgp = datetime.fromisoformat(str(mat.date_derniere_vgp)[:10])
        except: pass

    new_m = models.Materiel(
        nom=mat.nom, reference=mat.reference, etat=mat.etat, 
        image_url=mat.image_url, date_derniere_vgp=d_vgp,
        company_id=current_user.company_id
    )
    db.add(new_m); db.commit(); db.refresh(new_m)
    return inject_statut(new_m)

# 👇 FIX CRITIQUE POUR LE 404 SUR NOUVEAU CHANTIER
@router.put("/{mid}/transfert")
def transfer_materiel(mid: int, chantier_id: Optional[int] = Query(None), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. On force la session à se rafraîchir complètement
    db.expire_all()
    
    m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not m: raise HTTPException(404, "Matériel introuvable")
    if m.company_id != current_user.company_id: raise HTTPException(403, "Non autorisé")
    
    if not chantier_id or chantier_id == 0:
        m.chantier_id = None
    else:
        # 2. On cherche le chantier. S'il n'est pas trouvé, c'est que la transaction précédente n'est pas visible
        target = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
        
        if not target:
            # TENTATIVE ULTIME : Commit vide pour synchroniser la transaction si nécessaire
            try:
                db.commit() 
            except:
                db.rollback()
            
            # Re-tentative après synchro
            target = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
            
            if not target:
                print(f"🛑 CRITIQUE: Chantier {chantier_id} toujours invisible après refresh.")
                raise HTTPException(status_code=404, detail="Ce chantier n'est pas encore accessible. Veuillez rafraîchir la page.")
        
        if target.company_id != current_user.company_id:
            raise HTTPException(403, "Chantier non autorisé")

        m.chantier_id = chantier_id

    try:
        db.commit()
        return {"status": "moved", "chantier_id": m.chantier_id}
    except IntegrityError:
        db.rollback()
        raise HTTPException(404, "Erreur intégrité")
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))

@router.put("/{mid}", response_model=schemas.MaterielOut)
def update_materiel(mid: int, mat: schemas.MaterielUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_mat = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not db_mat: raise HTTPException(404, "Introuvable")
    
    data = mat.dict(exclude_unset=True)
    for k, v in data.items():
        if k == "chantier_id": db_mat.chantier_id = v if v else None
        elif k != "statut_vgp": setattr(db_mat, k, v)

    db.commit(); db.refresh(db_mat)
    return inject_statut(db_mat)

@router.delete("/{mid}")
def delete_materiel(mid: int, db: Session = Depends(get_db)):
    m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not m: raise HTTPException(404)
    db.delete(m); db.commit()
    return {"status": "deleted"}

@router.post("/import")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # ... (Code inchangé pour l'import)
    return {"message": "Importé"}