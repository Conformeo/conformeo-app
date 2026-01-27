from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, database, dependencies

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    
    # 1. Calculs
    if not current_user.company_id:
        count_chantiers = 0
        count_materiels = 0
        count_users = 1
        name = "N/A"
    else:
        count_chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == current_user.company_id).count()
        count_materiels = db.query(models.Materiel).filter(models.Materiel.company_id == current_user.company_id).count()
        count_users = db.query(models.User).filter(models.User.company_id == current_user.company_id).count()
        name = current_user.company.name if current_user.company else "N/A"

    # 2. Création de l'objet de données "pur"
    stats_data = {
        "nb_chantiers": count_chantiers,
        "nb_materiels": count_materiels,
        "nb_users": count_users,
        "company_name": name,
        
        # CamelCase
        "nbChantiers": count_chantiers,
        "nbMateriels": count_materiels,
        "nbUsers": count_users,
        "companyName": name,

        # Alias courts
        "chantiers": count_chantiers,
        "materiels": count_materiels,
        "users": count_users,
        
        # Alias spécifiques
        "chantiersActifs": count_chantiers,
        "totalChantiers": count_chantiers
    }

    # 3. On retourne l'objet pur + on le met DANS des boîtes courantes
    # C'est la technique de la "Poupée Russe"
    return {
        **stats_data,          # Les données à la racine
        "data": stats_data,    # Les données dans "data"
        "stats": stats_data,   # Les données dans "stats"
        "result": stats_data   # Les données dans "result"
    }