from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, database, dependencies

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    """
    Retourne les statistiques pour le tableau de bord avec plusieurs alias 
    pour être sûr que le Frontend s'y retrouve.
    """
    
    # Valeurs par défaut
    if not current_user.company_id:
        return {
            "nb_chantiers": 0, "chantiers": 0,
            "nb_materiels": 0, "materiels": 0, "equipements": 0,
            "nb_users": 1, "users": 1,
            "company_name": "Aucune"
        }

    # 1. Calcul des vrais chiffres
    count_chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == current_user.company_id).count()
    count_materiels = db.query(models.Materiel).filter(models.Materiel.company_id == current_user.company_id).count()
    count_users = db.query(models.User).filter(models.User.company_id == current_user.company_id).count()
    
    # 2. Envoi de la réponse "Universelle" (On envoie les clés en double/triple sous différents noms)
    return {
        # Format actuel (celui des logs)
        "nb_chantiers": count_chantiers,
        "nb_materiels": count_materiels,
        "nb_users": count_users,
        
        # 👇 ALIAS PROBABLES (Ce que le Frontend attend sûrement)
        "chantiers": count_chantiers,
        "materiels": count_materiels,
        "users": count_users,
        
        # Autres alias courants
        "equipements": count_materiels,
        "collaborateurs": count_users,
        
        "company_name": current_user.company.name if current_user.company else "N/A"
    }