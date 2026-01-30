from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional
import csv
import codecs
from datetime import datetime, timedelta

# Imports relatifs
from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

# 👇 On garde le pluriel "/materiels" pour correspondre à votre Frontend
router = APIRouter(prefix="/materiels", tags=["Materiels"])

# --- 1. LISTER (Avec votre logique de calcul VGP robuste) ---
@router.get("/", response_model=List[schemas.MaterielOut])
def read_materiels(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        # Filtrage par entreprise
        raw_rows = db.query(models.Materiel).filter(models.Materiel.company_id == current_user.company_id).offset(skip).limit(limit).all()
        valid_rows = []
        today = datetime.now()

        for row in raw_rows:
            try:
                date_vgp = getattr(row, "date_derniere_vgp", None)
                statut = "INCONNU" 

                if date_vgp:
                    # Conversion string -> datetime si nécessaire
                    if isinstance(date_vgp, str):
                        try: date_vgp = datetime.fromisoformat(str(date_vgp)[:10])
                        except: date_vgp = None
                    
                    if date_vgp:
                        # Conversion date -> datetime pour calculs
                        if not isinstance(date_vgp, datetime): 
                            date_vgp = datetime(date_vgp.year, date_vgp.month, date_vgp.day)
                        
                        prochaine = date_vgp + timedelta(days=365) 
                        delta = (prochaine - today).days
                        
                        if delta < 0: statut = "NON CONFORME"
                        elif delta < 30: statut = "A PREVOIR"
                        else: statut = "CONFORME"

                # Gestion référence (ref ou ref_interne)
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

            except Exception as e:
                print(f"⚠️ Erreur mapping matériel {row.id}: {e}")
                continue

        return valid_rows

    except Exception as e:
        print(f"❌ CRITICAL ERROR /materiels: {str(e)}")
        return []

# --- 2. CRÉER (Avec votre parsing de date) ---
@router.post("/", response_model=schemas.MaterielOut)
def create_materiel(mat: schemas.MaterielCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Gestion Date VGP
    d_vgp = mat.date_derniere_vgp
    if isinstance(d_vgp, str) and d_vgp.strip():
        try: d_vgp = datetime.fromisoformat(d_vgp[:10])
        except: d_vgp = None
    elif not d_vgp:
        d_vgp = None 

    new_m = models.Materiel(
        nom=mat.nom, 
        reference=mat.reference, 
        etat=mat.etat, 
        image_url=mat.image_url,
        date_derniere_vgp=d_vgp,
        company_id=current_user.company_id # Lien entreprise obligatoire
    )
    db.add(new_m)
    db.commit()
    db.refresh(new_m)
    return new_m

# --- 3. TRANSFERT (C'est ici que ça bloquait) ---
@router.put("/{mid}/transfert")
def transfer_materiel(mid: int, chantier_id: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
        if not m: raise HTTPException(404, "Matériel introuvable")
        
        # Sécurité
        if m.company_id != current_user.company_id: raise HTTPException(403, "Non autorisé")
        
        # Si retour stock
        if chantier_id == 0 or chantier_id is None:
            m.chantier_id = None
        else:
            # VÉRIFICATION CRITIQUE : Le chantier existe-t-il ?
            # (Évite l'erreur 500 IntegrityError si le chantier a été supprimé)
            exists = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
            if not exists:
                raise HTTPException(404, detail=f"Chantier {chantier_id} introuvable")
            m.chantier_id = chantier_id

        db.commit()
        return {"status": "moved", "chantier_id": m.chantier_id}
    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        print(f"❌ Erreur Transfert: {e}")
        raise HTTPException(500, detail="Erreur serveur lors du transfert")

# --- 4. MISE À JOUR (Votre logique complète) ---
@router.put("/{mid}", response_model=schemas.MaterielOut)
def update_materiel(mid: int, mat: schemas.MaterielUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_mat = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not db_mat: raise HTTPException(404, detail="Introuvable")
    if db_mat.company_id != current_user.company_id: raise HTTPException(403, detail="Non autorisé")

    update_data = mat.dict(exclude_unset=True)

    for key, value in update_data.items():
        if key == "reference" and value:
            # Support anciens champs
            if hasattr(db_mat, 'reference'): db_mat.reference = value
            elif hasattr(db_mat, 'ref_interne'): db_mat.ref_interne = value
            
        elif key == "chantier_id":
            if value == "" or value == 0:
                db_mat.chantier_id = None
            else:
                db_mat.chantier_id = value
        
        elif key == "date_derniere_vgp":
            if value and isinstance(value, str):
                try: setattr(db_mat, key, datetime.fromisoformat(value[:10]))
                except: pass
            else:
                setattr(db_mat, key, value)

        elif key == "statut_vgp":
            pass # Ignoré car calculé
            
        else:
            if hasattr(db_mat, key):
                setattr(db_mat, key, value)

    db.commit()
    db.refresh(db_mat)
    
    # Recalcul du statut pour le retour
    if hasattr(db_mat, 'date_derniere_vgp') and db_mat.date_derniere_vgp:
        prochaine = db_mat.date_derniere_vgp + timedelta(days=365)
        delta = (prochaine - datetime.now()).days
        statut = "CONFORME"
        if delta < 0: statut = "NON CONFORME"
        elif delta < 30: statut = "A PREVOIR"
        # On injecte l'attribut dynamique pour le schéma
        setattr(db_mat, "statut_vgp", statut)
    else:
        setattr(db_mat, "statut_vgp", "INCONNU")

    return db_mat

# --- 5. SUPPRIMER ---
@router.delete("/{mid}")
def delete_materiel(mid: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not m: raise HTTPException(404)
    if m.company_id != current_user.company_id: raise HTTPException(403)
    db.delete(m); db.commit()
    return {"status": "success"}

# --- 6. IMPORT CSV (Votre code original) ---
@router.post("/import")
async def import_materiels_csv(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not file.filename.lower().endswith('.csv'): raise HTTPException(400, "Non CSV")
    try:
        content = await file.read()
        try: text = content.decode('utf-8')
        except: text = content.decode('latin-1')
        lines = text.splitlines()
        if not lines: return {"status": "error", "message": "Fichier vide"}

        delimiter = ';' if ';' in lines[0] else ','
        reader = csv.DictReader(lines, delimiter=delimiter)
        
        count = 0
        for row in reader:
            row = {k.strip(): v.strip() for k, v in row.items() if k}
            nom = row.get('Nom') or row.get('nom')
            ref = row.get('Reference') or row.get('reference')
            if nom:
                etat = row.get('Etat') or 'Bon'
                db.add(models.Materiel(
                    nom=nom, 
                    reference=ref, 
                    etat=etat, 
                    company_id=current_user.company_id, 
                    chantier_id=None
                ))
                count += 1
        db.commit()
        return {"status": "success", "message": f"{count} équipements importés !"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))