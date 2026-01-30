from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional
import csv
import codecs
from datetime import datetime, timedelta

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

# 👇 CORRECTION IMPORTANTE : "materiels" au pluriel pour correspondre à votre frontend
router = APIRouter(prefix="/materiels", tags=["Materiels"])

# --- 1. LISTER LES MATÉRIELS (Avec calcul VGP) ---
@router.get("/", response_model=List[schemas.MaterielOut])
def read_materiels(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        # On filtre par entreprise
        query = db.query(models.Materiel).filter(models.Materiel.company_id == current_user.company_id)
        raw_rows = query.offset(skip).limit(limit).all()
        
        valid_rows = []
        today = datetime.now()

        for row in raw_rows:
            try:
                # Logique de calcul du statut VGP (Récupérée de votre code)
                date_vgp = getattr(row, "date_derniere_vgp", None)
                statut = "INCONNU" 

                if date_vgp:
                    # Conversion sécurisée si c'est une string (parfois le cas en SQLite/Legacy)
                    if isinstance(date_vgp, str):
                        try: date_vgp = datetime.fromisoformat(str(date_vgp))
                        except: date_vgp = None
                    
                    if date_vgp:
                        # Si date_vgp est une date, on peut faire des maths
                        if isinstance(date_vgp, datetime):
                            prochaine = date_vgp + timedelta(days=365) 
                            delta = (prochaine - today).days
                        elif isinstance(date_vgp, (datetime.date)): # Si c'est un objet date simple
                             # On convertit en datetime pour la soustraction
                             dt_vgp = datetime(date_vgp.year, date_vgp.month, date_vgp.day)
                             prochaine = dt_vgp + timedelta(days=365)
                             delta = (prochaine - today).days
                        else:
                             delta = 999 # Fallback

                        if delta < 0: statut = "NON CONFORME"
                        elif delta < 30: statut = "A PREVOIR"
                        else: statut = "CONFORME"

                # Gestion référence (ref ou ref_interne)
                ref_value = getattr(row, "reference", getattr(row, "ref_interne", None))

                # Création manuelle de l'objet de sortie pour injecter le statut calculé
                mat_out = schemas.MaterielOut(
                    id=row.id,
                    nom=row.nom or "Sans nom",
                    reference=ref_value,
                    etat=getattr(row, "etat", "Bon"),
                    chantier_id=row.chantier_id,
                    date_derniere_vgp=date_vgp,
                    image_url=row.image_url,
                    # 👇 On injecte le statut calculé ici
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

# --- 2. CRÉER UN MATÉRIEL ---
@router.post("/", response_model=schemas.MaterielOut)
def create_materiel(mat: schemas.MaterielCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Gestion de la date VGP
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
        company_id=current_user.company_id, # Lien entreprise
        chantier_id=None
    )
    db.add(new_m)
    db.commit()
    db.refresh(new_m)
    return new_m

# --- 3. METTRE À JOUR (Gère aussi le déplacement) ---
@router.put("/{mid}", response_model=schemas.MaterielOut)
def update_materiel(mid: int, mat: schemas.MaterielUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_mat = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not db_mat: raise HTTPException(404, detail="Matériel introuvable")
    
    # Sécurité
    if db_mat.company_id != current_user.company_id: raise HTTPException(403, detail="Non autorisé")

    update_data = mat.dict(exclude_unset=True)

    for key, value in update_data.items():
        if key == "chantier_id":
            # Gestion intelligente du déplacement
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
            pass # On ignore ce champ calculé
            
        else:
            if hasattr(db_mat, key):
                setattr(db_mat, key, value)

    db.commit()
    db.refresh(db_mat)
    return db_mat

# --- 4. TRANSFERT RAPIDE (Route spécifique legacy) ---
@router.put("/{mid}/transfert")
def transfer_materiel(mid: int, chantier_id: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not m: raise HTTPException(404)
    if m.company_id != current_user.company_id: raise HTTPException(403)
    
    m.chantier_id = chantier_id if chantier_id != 0 else None
    db.commit()
    return {"status": "moved"}

# --- 5. SUPPRIMER ---
@router.delete("/{mid}")
def delete_materiel(mid: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not m: raise HTTPException(404)
    if m.company_id != current_user.company_id: raise HTTPException(403)
    
    db.delete(m)
    db.commit()
    return {"status": "success"}

# --- 6. IMPORT CSV ---
@router.post("/import")
async def import_materiels_csv(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not file.filename.lower().endswith('.csv'): raise HTTPException(400, "Fichier non CSV")
    
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
            # Nettoyage des clés/valeurs
            row = {k.strip(): v.strip() for k, v in row.items() if k}
            
            nom = row.get('Nom') or row.get('nom')
            ref = row.get('Reference') or row.get('reference')
            
            if nom:
                etat = row.get('Etat') or 'Bon'
                # Création
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
        print(f"Erreur Import: {e}")
        raise HTTPException(500, f"Erreur lors de l'import: {str(e)}")