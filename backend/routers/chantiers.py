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
from ..utils import get_gps_from_address, send_email_via_brevo
from ..services import pdf as pdf_generator 

router = APIRouter(prefix="/chantiers", tags=["Chantiers"])

@router.get("", response_model=List[schemas.ChantierOut])
def read_chantiers(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Chantier).filter(models.Chantier.company_id == current_user.company_id).order_by(models.Chantier.date_creation.desc()).all()

@router.get("/{cid}", response_model=schemas.ChantierOut)
def get_chantier(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404, "Introuvable")
    return c

@router.post("", response_model=schemas.ChantierOut)
def create_chantier(chantier: schemas.ChantierCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
    for k, v in data.items():
        if k == "adresse" and v != db_c.adresse and "latitude" not in data:
            db_c.adresse = v
            lat, lng = get_gps_from_address(v)
            if lat: db_c.latitude, db_c.longitude = lat, lng
        elif k in ["date_debut", "date_fin"] and isinstance(v, datetime): setattr(db_c, k, v.date())
        else: setattr(db_c, k, v)
    db.commit(); db.refresh(db_c)
    return db_c

@router.delete("/{cid}")
def delete_chantier(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    try:
        db.query(models.Materiel).filter(models.Materiel.chantier_id == cid).update({"chantier_id": None}, synchronize_session=False)
        for m in [models.Rapport, models.Task, models.Inspection, models.DocExterne, models.PPSPS, models.PIC, models.PlanPrevention, models.PermisFeu]:
            db.query(m).filter(getattr(m, 'chantier_id') == cid).delete(synchronize_session=False)
        db.delete(c); db.commit()
        return {"status": "deleted"}
    except Exception as e:
        db.rollback(); raise HTTPException(500, str(e))

# --- SOUS-RESSOURCES (CORRECTION SLASH & AUTH) ---

@router.get("/{chantier_id}/tasks", response_model=List[schemas.TaskOut])
def get_chantier_tasks(chantier_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Task).filter(models.Task.chantier_id == chantier_id).all()

@router.get("/{chantier_id}/rapports", response_model=List[schemas.RapportOut])
def get_chantier_rapports(chantier_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).all()

@router.get("/{chantier_id}/inspections", response_model=List[schemas.InspectionOut])
def get_chantier_inspections(chantier_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Inspection).filter(models.Inspection.chantier_id == chantier_id).all()

@router.get("/{chantier_id}/docs", response_model=List[schemas.DocExterneOut])
def get_chantier_docs(chantier_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.DocExterne).filter(models.DocExterne.chantier_id == chantier_id).all()

@router.get("/{chantier_id}/pic", response_model=Optional[schemas.PicOut])
def get_chantier_pic(chantier_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.PIC).filter(models.PIC.chantier_id == chantier_id).first()

@router.get("/{chantier_id}/permis-feu", response_model=List[schemas.PermisFeuOut])
def get_chantier_permis_feu(chantier_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.PermisFeu).filter(models.PermisFeu.chantier_id == chantier_id).all()

@router.get("/{chantier_id}/plans-prevention", response_model=List[schemas.PlanPreventionOut])
def get_pdps(chantier_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.PlanPrevention).filter(models.PlanPrevention.chantier_id == chantier_id).all()

@router.get("/{chantier_id}/ppsps", response_model=List[schemas.PPSPSOut])
def get_ppsps(chantier_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.PPSPS).filter(models.PPSPS.chantier_id == chantier_id).all()

# --- FEATURES ---

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

@router.post("/{cid}/send-email")
def send_email(cid: int, email_dest: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    
    raps = db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).all()
    inss = db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).all()
    comp = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()

    pdf_buffer = BytesIO()
    pdf_generator.generate_pdf(c, raps, inss, pdf_buffer, company=comp)
    
    html = f"<html><body><h2>Suivi Chantier: {c.nom}</h2><p>Ci-joint le journal de bord.</p></body></html>"
    if send_email_via_brevo(email_dest, f"Suivi - {c.nom}", html, pdf_buffer, f"Journal_{c.nom}.pdf"):
        return {"message": "Email envoyé !"}
    raise HTTPException(500, "Erreur envoi email")