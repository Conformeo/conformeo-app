from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import io
import requests # 👈 Ajout nécessaire pour le géocodage de secours
from datetime import datetime, timedelta

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..services.email import send_email_via_brevo
from ..services import pdf as pdf_generator 

router = APIRouter(prefix="/chantiers", tags=["Chantiers"])

# --- HELPER : GÉOCODAGE DE SECOURS ---
def get_gps_from_address(address: str):
    """Calcule les GPS via OpenStreetMap si le frontend ne les a pas fournis."""
    if not address or len(address) < 5: return None, None
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {'q': address, 'format': 'json', 'limit': 1}
        headers = {'User-Agent': 'ConformeoApp/1.0 (contact@conformeo-app.fr)'}
        response = requests.get(url, params=params, headers=headers, timeout=5)
        if response.status_code == 200 and len(response.json()) > 0:
            data = response.json()[0]
            return float(data['lat']), float(data['lon'])
    except Exception as e:
        print(f"⚠️ Erreur GPS serveur pour {address}: {e}")
    return None, None

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
    
    # 1. Gestion Intelligente des GPS 📍
    lat = chantier.latitude
    lng = chantier.longitude

    # Si le frontend n'a pas envoyé de GPS (ex: saisie manuelle sans clic), le serveur prend le relais
    if (lat is None or lng is None) and chantier.adresse:
        print(f"🌍 Création: Pas de GPS reçu, calcul serveur pour : {chantier.adresse}")
        lat, lng = get_gps_from_address(chantier.adresse)

    chantier_data = chantier.dict()
    
    # On injecte les bons GPS
    chantier_data['latitude'] = lat
    chantier_data['longitude'] = lng

    # Nettoyage des dates vides
    if chantier_data.get('date_debut') == "": chantier_data['date_debut'] = None
    if chantier_data.get('date_fin') == "": chantier_data['date_fin'] = None

    db_chantier = models.Chantier(**chantier_data, company_id=current_user.company_id)
    db.add(db_chantier)
    db.commit()
    db.refresh(db_chantier)
    return db_chantier

@router.put("/{chantier_id}", response_model=schemas.ChantierOut)
def update_chantier(chantier_id: int, chantier_update: schemas.ChantierUpdate, db: Session = Depends(get_db)):
    db_chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not db_chantier: raise HTTPException(404, "Chantier introuvable")

    update_data = chantier_update.dict(exclude_unset=True)

    # 2. Gestion Intelligente des GPS en Mise à jour 🔄
    if "adresse" in update_data:
        new_addr = update_data["adresse"]
        if new_addr != db_chantier.adresse:
            # L'adresse a changé !
            
            # Est-ce que le front a fourni les nouveaux GPS ?
            if "latitude" in update_data and "longitude" in update_data:
                # Oui, parfait, on les utilise (ils sont déjà dans update_data)
                pass 
            else:
                # Non, on recalcule côté serveur
                print(f"🌍 Update: Adresse changée sans GPS, calcul serveur pour : {new_addr}")
                lat, lng = get_gps_from_address(new_addr)
                update_data['latitude'] = lat
                update_data['longitude'] = lng

    for key, value in update_data.items():
        setattr(db_chantier, key, value)

    db.commit()
    db.refresh(db_chantier)
    return db_chantier

# --- DETAILS (Rapports, Inspections, etc.) ---

@router.get("/{chantier_id}/rapports", response_model=List[schemas.RapportOut])
def get_chantier_rapports(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).all()

@router.get("/{chantier_id}/inspections", response_model=List[schemas.InspectionOut])
def get_chantier_inspections(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.Inspection).filter(models.Inspection.chantier_id == chantier_id).all()

@router.get("/{chantier_id}/docs", response_model=List[schemas.DocExterneOut])
def get_chantier_docs(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.DocExterne).filter(models.DocExterne.chantier_id == chantier_id).all()

@router.get("/{chantier_id}/pic", response_model=Optional[schemas.PicOut])
def get_chantier_pic(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.PIC).filter(models.PIC.chantier_id == chantier_id).first()

@router.get("/{chantier_id}/permis-feu", response_model=List[schemas.PermisFeuOut])
def get_chantier_permis_feu(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.PermisFeu).filter(models.PermisFeu.chantier_id == chantier_id).all()

# --- TASKS ---

@router.get("/{chantier_id}/tasks", response_model=List[schemas.TaskOut])
def read_tasks(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.Task).filter(models.Task.chantier_id == chantier_id).all()

@router.post("/{chantier_id}/tasks", response_model=schemas.TaskOut)
def create_task(chantier_id: int, task: schemas.TaskCreate, db: Session = Depends(get_db)):
    db_task = models.Task(**task.dict()) 
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

# --- SECURITE (Plans Prevention, PPSPS) ---

@router.get("/{chantier_id}/plans-prevention", response_model=List[schemas.PlanPreventionOut])
def get_pdps(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.PlanPrevention).filter(models.PlanPrevention.chantier_id == chantier_id).all()

@router.get("/{chantier_id}/ppsps", response_model=List[schemas.PPSPSOut])
def get_ppsps(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.PPSPS).filter(models.PPSPS.chantier_id == chantier_id).all()

# --- PDF & EMAIL ---

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