from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, date
import cloudinary
import cloudinary.uploader
from io import BytesIO

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user
# Assurez-vous que le fichier backend/utils.py existe bien (voir étape précédente)
from ..utils import get_gps_from_address, send_email_via_brevo
from ..services import pdf as pdf_generator 

router = APIRouter(prefix="/chantiers", tags=["Chantiers"])

# --- CRUD ---

@router.get("/", response_model=List[schemas.ChantierOut])
def read_chantiers(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == current_user.company_id).order_by(models.Chantier.date_creation.desc()).all()
    for c in chantiers:
        if isinstance(c.date_debut, datetime): c.date_debut = c.date_debut.date()
        if isinstance(c.date_fin, datetime): c.date_fin = c.date_fin.date()
    return chantiers

@router.get("/{cid}", response_model=schemas.ChantierOut)
def get_chantier(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404, "Introuvable")
    if isinstance(c.date_debut, datetime): c.date_debut = c.date_debut.date()
    if isinstance(c.date_fin, datetime): c.date_fin = c.date_fin.date()
    return c

@router.post("/", response_model=schemas.ChantierOut)
def create_chantier(chantier: schemas.ChantierCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.company_id: raise HTTPException(400, "Entreprise requise")
    
    lat, lng = chantier.latitude, chantier.longitude
    if (not lat or lat == 0) and chantier.adresse:
        lat, lng = get_gps_from_address(chantier.adresse)

    d_debut = chantier.date_debut or datetime.now().date()
    d_fin = chantier.date_fin or (datetime.now() + timedelta(days=30)).date()

    new_c = models.Chantier(
        nom=chantier.nom, adresse=chantier.adresse, client=chantier.client,
        company_id=current_user.company_id, date_debut=d_debut, date_fin=d_fin,
        latitude=lat, longitude=lng, soumis_sps=False
    )
    db.add(new_c); db.commit(); db.refresh(new_c)
    return new_c

@router.put("/{cid}", response_model=schemas.ChantierOut)
def update_chantier(cid: int, chantier: schemas.ChantierUpdate, db: Session = Depends(get_db)):
    db_c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not db_c: raise HTTPException(404, "Introuvable")

    data = chantier.dict(exclude_unset=True)
    for key, value in data.items():
        if key == "adresse" and value != db_c.adresse and "latitude" not in data:
            db_c.adresse = value
            lat, lng = get_gps_from_address(value)
            if lat: 
                db_c.latitude = lat
                db_c.longitude = lng
        elif key in ["date_debut", "date_fin"] and isinstance(value, datetime):
            setattr(db_c, key, value.date())
        else:
            setattr(db_c, key, value)

    db.commit(); db.refresh(db_c)
    return db_c

@router.delete("/{cid}")
def delete_chantier(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    
    try:
        # Nettoyage complet
        db.query(models.Materiel).filter(models.Materiel.chantier_id == cid).update({"chantier_id": None}, synchronize_session=False)
        for model in [models.Rapport, models.Task, models.Inspection, models.DocExterne, models.PPSPS, models.PIC, models.PlanPrevention, models.PermisFeu]:
            db.query(model).filter(getattr(model, 'chantier_id') == cid).delete(synchronize_session=False)
        
        db.delete(c)
        db.commit()
        return {"status": "deleted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Erreur suppression: {e}")

# --- FEATURES ---

# 👇 C'est ici que l'erreur se produisait. J'ai remplacé @app par @router
@router.post("/{cid}/cover")
def upload_cover(cid: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    try:
        res = cloudinary.uploader.upload(file.file, folder="conformeo_covers", resource_type="image")
        c.cover_url = res.get("secure_url")
        db.commit()
        return {"url": c.cover_url}
    except Exception as e: raise HTTPException(500, str(e))

# 👇 Ici aussi : @router au lieu de @app
@router.post("/{cid}/send-email")
def send_email(cid: int, email_dest: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    
    # Récupération données pour le PDF
    raps = db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).all()
    inss = db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).all()
    comp = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()

    pdf_buffer = BytesIO()
    pdf_generator.generate_pdf(c, raps, inss, pdf_buffer, company=comp)
    
    html = f"<html><body><h2>Suivi Chantier: {c.nom}</h2><p>Ci-joint le journal de bord.</p></body></html>"
    
    if send_email_via_brevo(email_dest, f"Suivi - {c.nom}", html, pdf_buffer, f"Journal_{c.nom}.pdf"):
        return {"message": "Email envoyé !"}
    raise HTTPException(500, "Erreur envoi email")