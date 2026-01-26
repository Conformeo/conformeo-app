from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import io
from datetime import datetime

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..services.email import send_email_via_brevo
from ..services import pdf as pdf_generator 

router = APIRouter(prefix="/chantiers", tags=["Chantiers"])
router_docs = APIRouter(tags=["Documents Sécurité"]) # Pour les routes orphelines

# --- CRUD CHANTIER ---

@router.get("/", response_model=List[schemas.ChantierOut])
def read_chantiers(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Chantier).filter(models.Chantier.company_id == current_user.company_id).all()

@router.get("/{chantier_id}", response_model=schemas.ChantierOut)
def read_one_chantier(chantier_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    c = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not c: raise HTTPException(404, "Chantier introuvable")
    return c

@router.post("/", response_model=schemas.ChantierOut)
def create_chantier(chantier: schemas.ChantierCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.company_id: raise HTTPException(400, "Utilisateur sans entreprise")
    
    # Conversion Pydantic -> Dict pour SQLAlchemy
    chantier_data = chantier.dict()
    
    # Gestion des dates si envoyées en string vide
    if chantier_data.get('date_debut') == "": chantier_data['date_debut'] = None
    if chantier_data.get('date_fin') == "": chantier_data['date_fin'] = None

    db_chantier = models.Chantier(**chantier_data, company_id=current_user.company_id)
    db.add(db_chantier)
    db.commit()
    db.refresh(db_chantier)
    return db_chantier

@router.put("/{chantier_id}", response_model=schemas.ChantierOut)
def update_chantier(chantier_id: int, chantier_update: schemas.ChantierUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not db_chantier: raise HTTPException(404, "Chantier introuvable")

    update_data = chantier_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_chantier, key, value)

    db.commit()
    db.refresh(db_chantier)
    return db_chantier

# --- TASKS (Tâches) ---

@router.get("/{chantier_id}/tasks", response_model=List[schemas.TaskOut])
def read_tasks(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.Task).filter(models.Task.chantier_id == chantier_id).all()

@router.post("/{chantier_id}/tasks", response_model=schemas.TaskOut)
def create_task(chantier_id: int, task: schemas.TaskCreate, db: Session = Depends(get_db)):
    db_task = models.Task(**task.dict()) # chantier_id est déjà dans le schema task
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.put("/{chantier_id}/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, task_update: schemas.TaskUpdate, db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t: raise HTTPException(404, "Tâche introuvable")
    
    if task_update.status: t.status = task_update.status
    if task_update.description: t.description = task_update.description
    
    db.commit()
    db.refresh(t)
    return t

# --- PDF & EMAIL (Journal de bord) ---

@router.post("/{chantier_id}/send-email")
def send_journal_email(chantier_id: int, email_dest: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not chantier: raise HTTPException(404, "Chantier inconnu")
    
    rapports = db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).all()
    inspections = db.query(models.Inspection).filter(models.Inspection.chantier_id == chantier_id).all()
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()

    pdf_buffer = io.BytesIO()
    pdf_generator.generate_pdf(chantier, rapports, inspections, pdf_buffer, company=company)
    
    html_content = f"<html><body><h2>Journal de Bord : {chantier.nom}</h2><p>Veuillez trouver ci-joint le PDF du journal de bord.</p></body></html>"
    
    success = send_email_via_brevo(email_dest, f"Journal - {chantier.nom}", html_content, pdf_buffer, f"Journal_{chantier.nom}.pdf")
    if success: return {"message": "Email envoyé ! 🚀"}
    raise HTTPException(500, "Erreur envoi Brevo")

# --- DOCUMENTS SECURITE (Lecture seule pour l'exemple, création possible) ---

@router.get("/{chantier_id}/plans-prevention", response_model=List[schemas.PlanPreventionOut])
def get_pdps(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.PlanPrevention).filter(models.PlanPrevention.chantier_id == chantier_id).all()

@router.get("/{chantier_id}/ppsps", response_model=List[schemas.PPSPSOut])
def get_ppsps(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.PPSPS).filter(models.PPSPS.chantier_id == chantier_id).all()

# --- ROUTEUR SECONDAIRE (Orphelin) ---
@router_docs.post("/plans-prevention/{pid}/email")
def send_pdp_email_route(pid: int, email_dest: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    pdp = db.query(models.PlanPrevention).filter(models.PlanPrevention.id == pid).first()
    if not pdp: raise HTTPException(404, "Plan introuvable")
    
    chantier = db.query(models.Chantier).filter(models.Chantier.id == pdp.chantier_id).first()
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()

    pdf_buffer = io.BytesIO()
    pdf_generator.generate_pdp_pdf(chantier, pdp, pdf_buffer, company=company)

    success = send_email_via_brevo(email_dest, f"PDP - {chantier.nom}", "<p>Ci-joint le Plan de Prévention.</p>", pdf_buffer, "PDP.pdf")
    if success: return {"message": "Envoyé !"}
    raise HTTPException(500, "Echec envoi")