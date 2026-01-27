from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, database, dependencies

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    
    # Valeurs par défaut
    if not current_user.company_id:
        return {
            "nbChantiers": 0, "nb_chantiers": 0,
            "nbMateriels": 0, "nb_materiels": 0,
            "nbUsers": 0, "nb_users": 0,
            "companyName": "N/A", "company_name": "N/A"
        }

    # 1. Calcul des vrais chiffres
    count_chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == current_user.company_id).count()
    count_materiels = db.query(models.Materiel).filter(models.Materiel.company_id == current_user.company_id).count()
    count_users = db.query(models.User).filter(models.User.company_id == current_user.company_id).count()
    
    name = current_user.company.name if current_user.company else "N/A"

    # 2. Envoi de TOUTES les variantes possibles (SnakeCase et CamelCase)
    return {
        # --- Python Style (Snake Case) ---
        "nb_chantiers": count_chantiers,
        "nb_materiels": count_materiels,
        "nb_users": count_users,
        "company_name": name,
        
        # --- Javascript/Angular Style (Camel Case) 👈 C'est SÛREMENT ça qui manque ! ---
        "nbChantiers": count_chantiers,
        "nbMateriels": count_materiels,
        "nbUsers": count_users,
        "companyName": name,

        # --- Variantes "Nom court" ---
        "chantiers": count_chantiers,
        "materiels": count_materiels,
        "users": count_users,
        
        # --- Variantes spécifiques possibles ---
        "chantiersActifs": count_chantiers,
        "totalChantiers": count_chantiers
    }