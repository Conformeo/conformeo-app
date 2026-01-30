from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import io
import requests 
from datetime import datetime, timedelta

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..services.email import send_email_via_brevo
from ..services import pdf as pdf_generator 

router = APIRouter(prefix="/chantiers", tags=["Chantiers"])

# --- HELPER : GÉOCODAGE DE SECOURS ---
def get_gps_from_address(address: str):
    """Calcule les GPS via OpenStreetMap de manière sécurisée."""
    if not address or len(address) < 3: return None, None
    try:
        clean_addr = address.replace(",", " ").strip()
        url = "https://nominatim.openstreetmap.org/search"
        params = {'q': clean_addr, 'format': 'json', 'limit': 1, 'countrycodes': 'fr'}
        headers = {'User-Agent': 'ConformeoApp/1.0'}
        
        response = requests.get(url, params=params, headers=headers, timeout=4)
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        print(f"⚠️ Erreur GPS serveur : {e}")
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
    
    # 1. Gestion GPS 📍
    lat = chantier.latitude
    lng = chantier.longitude

    # Si le frontend n'a pas envoyé de GPS, le serveur tente de le trouver
    if (lat is None or lat == 0) and chantier.adresse:
        print(f"🌍 Création: Pas de GPS reçu, calcul serveur pour : {chantier.adresse}")
        lat, lng = get_gps_from_address(chantier.adresse)

    chantier_data = chantier.dict()
    chantier_data['latitude'] = lat
    chantier_data['longitude'] = lng

    # Nettoyage des dates (évite les erreurs de format)
    if not chantier_data.get('date_debut'): chantier_data['date_debut'] = None
    if not chantier_data.get('date_fin'): chantier_data['date_fin'] = None

    try:
        db_chantier = models.Chantier(**chantier_data, company_id=current_user.company_id)
        db.add(db_chantier)
        db.commit()
        db.refresh(db_chantier)
        return db_chantier
    except Exception as e:
        db.rollback()
        print(f"❌ Erreur Création Chantier: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors de la création du chantier")

@router.put("/{chantier_id}", response_model=schemas.ChantierOut)
def update_chantier(chantier_id: int, chantier_update: schemas.ChantierUpdate, db: Session = Depends(get_db)):
    db_chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not db_chantier: raise HTTPException(404, "Chantier introuvable")

    update_data = chantier_update.dict(exclude_unset=True)

    # 2. Gestion GPS Update 🔄
    if "adresse" in update_data:
        new_addr = update_data["adresse"]
        if new_addr != db_chantier.adresse:
            # Si pas de GPS fourni, on recalcule
            if not update_data.get("latitude"):
                print(f"🌍 Update: Recalcul GPS pour : {new_addr}")
                lat, lng = get_gps_from_address(new_addr)
                update_data['latitude'] = lat
                update_data['longitude'] = lng

    for key, value in update_data.items():
        setattr(db_chantier, key, value)

    try:
        db.commit()
        db.refresh(db_chantier)
        return db_chantier
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur lors de la mise à jour")

@router.delete("/{chantier_id}")
def delete_chantier(chantier_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    c = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not c: raise HTTPException(404, "Chantier introuvable")
    
    if c.company_id != current_user.company_id:
        raise HTTPException(403, "Non autorisé")

    try:
        # Nettoyage manuel des dépendances pour éviter les erreurs de clés étrangères
        db.query(models.Rapport).filter(models.Rapport.chantier_id == chantier_id).delete()
        db.query(models.Task).filter(models.Task.chantier_id == chantier_id).delete()
        db.query(models.Inspection).filter(models.Inspection.chantier_id == chantier_id).delete()
        db.query(models.PPSPS).filter(models.PPSPS.chantier_id == chantier_id).delete()
        db.query(models.PlanPrevention).filter(models.PlanPrevention.chantier_id == chantier_id).delete()
        db.query(models.PermisFeu).filter(models.PermisFeu.chantier_id == chantier_id).delete()
        db.query(models.Materiel).filter(models.Materiel.chantier_id == chantier_id).update({"chantier_id": None})

        db.delete(c)
        db.commit()
        return {"status": "deleted", "message": f"Chantier {chantier_id} supprimé"}
    
    except Exception as e:
        db.rollback()
        print(f"❌ Erreur Suppression: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ... (Gardez les routes Details, Tasks, PDF, Email comme avant)
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

@router.get("/{chantier_id}/tasks", response_model=List[schemas.TaskOut])
def read_tasks(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.Task).filter(models.Task.chantier_id == chantier_id).all()

@router.post("/{chantier_id}/tasks", response_model=schemas.TaskOut)
def create_task(chantier_id: int, task: schemas.TaskCreate, db: Session = Depends(get_db)):
    db_task = models.Task(**task.dict()) 
    db.add(db_task); db.commit(); db.refresh(db_task)
    return db_task

@router.put("/{chantier_id}/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, task_update: schemas.TaskUpdate, db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t: raise HTTPException(404, "Tâche introuvable")
    if task_update.status: t.status = task_update.status
    if task_update.description: t.description = task_update.description
    db.commit(); db.refresh(t)
    return t

@router.get("/{chantier_id}/plans-prevention", response_model=List[schemas.PlanPreventionOut])
def get_pdps(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.PlanPrevention).filter(models.PlanPrevention.chantier_id == chantier_id).all()

@router.get("/{chantier_id}/ppsps", response_model=List[schemas.PPSPSOut])
def get_ppsps(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.PPSPS).filter(models.PPSPS.chantier_id == chantier_id).all()

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