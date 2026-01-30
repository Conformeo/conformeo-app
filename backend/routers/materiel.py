from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import csv
import codecs
from datetime import datetime, timedelta

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/materiels", tags=["Materiels"])

# --- 1. LISTER ---
@router.get("/", response_model=List[schemas.MaterielOut])
def read_materiels(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        raw_rows = db.query(models.Materiel).filter(models.Materiel.company_id == current_user.company_id).offset(skip).limit(limit).all()
        valid_rows = []
        today = datetime.now()

        for row in raw_rows:
            try:
                date_vgp = getattr(row, "date_derniere_vgp", None)
                statut = "INCONNU" 

                if date_vgp:
                    if isinstance(date_vgp, str):
                        try: date_vgp = datetime.fromisoformat(str(date_vgp)[:10])
                        except: date_vgp = None
                    
                    if date_vgp:
                        if not isinstance(date_vgp, datetime): 
                            date_vgp = datetime(date_vgp.year, date_vgp.month, date_vgp.day)
                        
                        prochaine = date_vgp + timedelta(days=365) 
                        delta = (prochaine - today).days
                        
                        if delta < 0: statut = "NON CONFORME"
                        elif delta < 30: statut = "A PREVOIR"
                        else: statut = "CONFORME"

                ref_value = getattr(row, "reference", getattr(row, "ref_interne", None))

                mat_out = schemas.MaterielOut(
                    id=row.id,
                    nom=row.nom or "Sans nom",
                    reference=ref_value,
                    etat=getattr(row, "etat", "Bon"),
                    chantier_id=row.chantier_id,
                    date_derniere_vgp=date_vgp,
                    image_url=row.image_url,
                    statut_vgp=statut 
                )
                valid_rows.append(mat_out)
            except:
                continue

        return valid_rows
    except Exception as e:
        print(f"❌ Erreur Lecture: {str(e)}")
        return []

# --- 2. CRÉER ---
@router.post("/", response_model=schemas.MaterielOut)
def create_materiel(mat: schemas.MaterielCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    d_vgp = mat.date_derniere_vgp
    if isinstance(d_vgp, str) and d_vgp.strip():
        try: d_vgp = datetime.fromisoformat(d_vgp[:10])
        except: d_vgp = None
    elif not d_vgp: d_vgp = None 

    new_m = models.Materiel(
        nom=mat.nom, 
        reference=mat.reference, 
        etat=mat.etat, 
        image_url=mat.image_url,
        date_derniere_vgp=d_vgp,
        company_id=current_user.company_id,
        chantier_id=None
    )
    db.add(new_m)
    db.commit()
    db.refresh(new_m)
    
    # On ajoute le champ calculé pour éviter l'erreur de validation Schema
    setattr(new_m, "statut_vgp", "INCONNU")
    return new_m

# --- 3. TRANSFERT (CORRECTION ERREUR 500) ---
@router.put("/{mid}/transfert")
def transfer_materiel(mid: int, chantier_id: Optional[int] = Query(None), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
        if not m: raise HTTPException(404, "Matériel introuvable")
        if m.company_id != current_user.company_id: raise HTTPException(403, "Non autorisé")
        
        # Si retour stock
        if not chantier_id or chantier_id == 0:
            m.chantier_id = None
        else:
            # On vérifie que le chantier existe VRAIMENT avant de l'assigner
            exists = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
            if not exists:
                # C'est ici que ça bloquait : on renvoie une 404 propre au lieu de planter
                raise HTTPException(status_code=404, detail=f"Chantier {chantier_id} introuvable")
            m.chantier_id = chantier_id

        db.commit()
        return {"status": "moved", "chantier_id": m.chantier_id}

    except HTTPException as he:
        raise he  # 👈 IMPORTANT : On laisse passer les erreurs 404/403 normales
    except Exception as e:
        db.rollback()
        print(f"❌ Erreur Serveur Transfert: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- 4. MISE À JOUR ---
@router.put("/{mid}", response_model=schemas.MaterielOut)
def update_materiel(mid: int, mat: schemas.MaterielUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_mat = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not db_mat: raise HTTPException(404, "Introuvable")
    if db_mat.company_id != current_user.company_id: raise HTTPException(403, "Non autorisé")

    update_data = mat.dict(exclude_unset=True)

    for key, value in update_data.items():
        if key == "chantier_id":
            db_mat.chantier_id = None if (value == "" or value == 0) else value
        elif key == "date_derniere_vgp":
            if value and isinstance(value, str):
                try: setattr(db_mat, key, datetime.fromisoformat(value[:10]))
                except: pass
            else: setattr(db_mat, key, value)
        elif key != "statut_vgp": 
            if hasattr(db_mat, key): setattr(db_mat, key, value)

    db.commit()
    db.refresh(db_mat)
    
    # Recalcul Statut VGP pour la réponse
    statut = "INCONNU"
    if hasattr(db_mat, 'date_derniere_vgp') and db_mat.date_derniere_vgp:
        prochaine = db_mat.date_derniere_vgp + timedelta(days=365)
        delta = (prochaine - datetime.now()).days
        if delta < 0: statut = "NON CONFORME"
        elif delta < 30: statut = "A PREVOIR"
        else: statut = "CONFORME"
    
    setattr(db_mat, "statut_vgp", statut)
    return db_mat

# --- 5. SUPPRIMER ---
@router.delete("/{mid}")
def delete_materiel(mid: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not m: raise HTTPException(404)
    if m.company_id != current_user.company_id: raise HTTPException(403)
    db.delete(m); db.commit()
    return {"status": "success"}

# --- 6. IMPORT CSV ---
@router.post("/import")
async def import_materiels_csv(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not file.filename.lower().endswith('.csv'): raise HTTPException(400, "Non CSV")
    try:
        content = await file.read()
        try: text = content.decode('utf-8')
        except: text = content.decode('latin-1')
        
        lines = text.splitlines()
        delimiter = ';' if ';' in lines[0] else ','
        reader = csv.DictReader(lines, delimiter=delimiter)
        
        count = 0
        for row in reader:
            row = {k.strip(): v.strip() for k, v in row.items() if k}
            nom = row.get('Nom') or row.get('nom')
            ref = row.get('Reference') or row.get('reference')
            if nom:
                db.add(models.Materiel(
                    nom=nom, reference=ref, etat=row.get('Etat', 'Bon'), 
                    company_id=current_user.company_id, chantier_id=None
                ))
                count += 1
        db.commit()
        return {"status": "success", "message": f"{count} importés"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))