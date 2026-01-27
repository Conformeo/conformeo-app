from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user
from typing import List
import datetime


router = APIRouter(prefix="/companies", tags=["Entreprise"])

@router.get("/me", response_model=schemas.CompanyOut)
def read_own_company(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.company_id:
        raise HTTPException(status_code=404, detail="Aucune entreprise liée")
        
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise introuvable")
    
    # Lecture sécurisée de l'email
    real_email = getattr(company, "contact_email", getattr(company, "email", None))

    return {
        "id": company.id,
        "name": company.name,
        "address": company.address,
        "phone": company.phone,
        "logo_url": company.logo_url,
        "subscription_plan": company.subscription_plan or "free",
        "contact_email": real_email, 
        "email": real_email           
    }

@router.put("/me", response_model=schemas.CompanyOut)
def update_company(
    comp_update: schemas.CompanyUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.company_id: 
        raise HTTPException(400, "Utilisateur sans entreprise")
    
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    if not company: raise HTTPException(404, "Entreprise introuvable")

    if comp_update.name: company.name = comp_update.name
    if comp_update.address: company.address = comp_update.address
    if comp_update.phone: company.phone = comp_update.phone
    if comp_update.logo_url: company.logo_url = comp_update.logo_url
    
    # Logique Email blindée (gère les deux noms de colonnes possibles)
    new_email = comp_update.contact_email or comp_update.email
    if new_email:
        if hasattr(company, "contact_email"): company.contact_email = new_email
        if hasattr(company, "email"): company.email = new_email

    try:
        db.commit()
        db.refresh(company)
        
        real_email = getattr(company, "contact_email", getattr(company, "email", None))
        return {
            "id": company.id,
            "name": company.name,
            "address": company.address,
            "phone": company.phone,
            "logo_url": company.logo_url,
            "subscription_plan": company.subscription_plan,
            "contact_email": real_email,
            "email": real_email
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur SQL: {e}")
    

# ✅ LA ROUTE QUI MANQUAIT (Fix Erreur 404)
@router.get("/me/documents", response_model=List[schemas.CompanyDocOut])
def get_company_documents(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.company_id:
        return []
    return db.query(models.CompanyDocument).filter(models.CompanyDocument.company_id == current_user.company_id).all()

# ✅ ROUTE POUR AJOUTER UN DOCUMENT (Si besoin)
@router.post("/me/documents", response_model=schemas.CompanyDocOut)
def add_company_document(
    titre: str, 
    url: str, 
    date_expiration: str = None, # Reçu en string, à convertir
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.company_id: raise HTTPException(400, "Pas d'entreprise")
    
    # Conversion date si présente
    expiration = None
    if date_expiration:
        try:
            expiration = datetime.fromisoformat(date_expiration.replace('Z', '+00:00'))
        except:
            pass

    new_doc = models.CompanyDocument(
        titre=titre,
        url=url,
        company_id=current_user.company_id,
        date_expiration=expiration
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    return new_doc