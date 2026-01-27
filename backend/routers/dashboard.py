from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, database, dependencies

# 👇 Le préfixe est important, c'est lui qui crée l'URL /dashboard
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    
    # Valeurs par défaut si pas d'entreprise
    if not current_user.company_id:
        return {
            "nb_chantiers": 0, 
            "nb_materiels": 0, 
            "nb_users": 1, 
            "company_name": "Aucune"
        }

    # Requêtes SQL pour compter les éléments
    nb_chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == current_user.company_id).count()
    nb_materiels = db.query(models.Materiel).filter(models.Materiel.company_id == current_user.company_id).count()
    nb_users = db.query(models.User).filter(models.User.company_id == current_user.company_id).count()
    
    return {
        "nb_chantiers": nb_chantiers,
        "nb_materiels": nb_materiels,
        "nb_users": nb_users,
        "company_name": current_user.company.name if current_user.company else "N/A"
    }