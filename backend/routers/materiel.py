from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
import csv
import io
from datetime import datetime, timedelta

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/materiels", tags=["Materiels"])

# --- FONCTION UTILITAIRE : CALCUL STATUT VGP ---
def inject_statut(mat):
    statut = "INCONNU"
    d = getattr(mat, "date_derniere_vgp", None)
    
    if d:
        # Conversion string -> datetime si nécessaire
        if isinstance(d, str): 
            try: d = datetime.fromisoformat(d[:10])
            except: d = None
        
        # Calcul si la date est valide
        if d:
            if not isinstance(d, datetime): 
                # On s'assure d'avoir un datetime pour faire les maths
                d = datetime(d.year, d.month, d.day)
            
            # VGP valable 1 an (365 jours)
            date_expiration = d + timedelta(days=365)
            delta = (date_expiration - datetime.now()).days
            
            if delta < 0: 
                statut = "NON CONFORME" # Date passée
            elif delta < 30: 
                statut = "A PREVOIR"    # Expire dans moins d'un mois
            else: 
                statut = "CONFORME"
    
    # On injecte l'attribut calculé dans l'objet Python (sans toucher la DB)
    setattr(mat, "statut_vgp", statut)
    return mat

# ==========================
# 1. LISTE DES MATÉRIELS
# ==========================
@router.get("", response_model=List[schemas.MaterielOut])
def read_materiels(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    rows = db.query(models.Materiel).filter(models.Materiel.company_id == current_user.company_id).offset(skip).limit(limit).all()
    return [inject_statut(r) for r in rows]

# ==========================
# 2. CRÉER UN MATÉRIEL
# ==========================
@router.post("", response_model=schemas.MaterielOut)
def create_materiel(mat: schemas.MaterielCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    d_vgp = None
    if mat.date_derniere_vgp:
        try: d_vgp = datetime.fromisoformat(str(mat.date_derniere_vgp)[:10])
        except: pass

    new_m = models.Materiel(
        nom=mat.nom, 
        reference=mat.reference, 
        ref_interne=mat.ref_interne, # ✅ Ajouté
        etat=mat.etat, 
        image_url=mat.image_url, 
        date_derniere_vgp=d_vgp,
        chantier_id=mat.chantier_id, # ✅ Ajouté (si on crée directement sur site)
        company_id=current_user.company_id
    )
    db.add(new_m)
    db.commit()
    db.refresh(new_m)
    return inject_statut(new_m)

# ==========================
# 3. TRANSFERT MATÉRIEL (FIX CHANTIER INVISIBLE)
# ==========================
@router.put("/{mid}/transfert")
def transfer_materiel(mid: int, chantier_id: Optional[int] = Query(None), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 🔄 FIX : On force le rafraîchissement de la session SQLAlchemy
    # Cela permet de voir les chantiers fraîchement créés par d'autres requêtes
    db.expire_all()
    
    m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not m: raise HTTPException(404, "Matériel introuvable")
    if m.company_id != current_user.company_id: raise HTTPException(403, "Non autorisé")
    
    # Gestion du cas "Retour au dépôt" (chantier_id vide ou 0)
    if not chantier_id or chantier_id == 0:
        m.chantier_id = None
    else:
        # Vérification existence chantier
        target = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
        
        # Tentative de récupération forcée si introuvable (hack de synchro)
        if not target:
            try: db.commit() 
            except: db.rollback()
            target = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
            
            if not target:
                print(f"🛑 Chantier {chantier_id} introuvable malgré refresh.")
                raise HTTPException(status_code=404, detail="Ce chantier n'existe plus ou a été supprimé.")
        
        # Vérification appartenance entreprise
        if target.company_id != current_user.company_id:
            raise HTTPException(403, "Ce chantier ne vous appartient pas.")

        m.chantier_id = chantier_id

    try:
        db.commit()
        return {"status": "moved", "chantier_id": m.chantier_id}
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "Erreur de liaison (clé étrangère)")
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))

# ==========================
# 4. MODIFIER UN MATÉRIEL
# ==========================
@router.put("/{mid}", response_model=schemas.MaterielOut)
def update_materiel(mid: int, mat: schemas.MaterielUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_mat = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not db_mat: raise HTTPException(404, "Introuvable")
    
    data = mat.dict(exclude_unset=True)
    for k, v in data.items():
        if k == "chantier_id": 
            db_mat.chantier_id = v if v else None
        elif k != "statut_vgp": # On ne sauvegarde pas le champ calculé
            setattr(db_mat, k, v)

    db.commit()
    db.refresh(db_mat)
    return inject_statut(db_mat)

# ==========================
# 5. SUPPRIMER UN MATÉRIEL
# ==========================
@router.delete("/{mid}")
def delete_materiel(mid: int, db: Session = Depends(get_db)):
    m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not m: raise HTTPException(404, "Introuvable")
    db.delete(m)
    db.commit()
    return {"status": "deleted"}

# ==========================
# 6. IMPORT CSV
# ==========================
@router.post("/import")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not file.filename.lower().endswith('.csv'): 
        raise HTTPException(400, "Le fichier doit être un CSV")
    
    try:
        content = await file.read()
        # Gestion encodage (Excel enregistre souvent en latin-1 ou cp1252 sur Windows)
        try: text = content.decode('utf-8')
        except: text = content.decode('latin-1')
        
        reader = csv.DictReader(text.splitlines(), delimiter=';')
        count = 0
        
        for row in reader:
            # Nettoyage des clés/valeurs (espaces vides)
            row = {k.strip(): v.strip() for k, v in row.items() if k}
            
            if row.get('Nom'):
                db.add(models.Materiel(
                    nom=row.get('Nom'), 
                    reference=row.get('Reference'), 
                    ref_interne=row.get('RefInterne'), # Support Ref Interne
                    etat=row.get('Etat', 'Bon'),
                    company_id=current_user.company_id
                ))
                count += 1
        
        db.commit()
        return {"message": f"{count} matériels importés avec succès"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Erreur lors de l'import: {str(e)}")