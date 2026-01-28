from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from .. import models, database, dependencies

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    
    # 1. Sécurité : Si pas d'entreprise, tout est à 0
    if not current_user.company_id:
        return {"nb_chantiers": 0, "nb_materiels": 0, "nb_rapports": 0, "recents": []}

    cid = current_user.company_id

    # 2. Les Calculs (COUNT)
    count_chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).count()
    count_materiels = db.query(models.Materiel).filter(models.Materiel.company_id == cid).count()
    count_users = db.query(models.User).filter(models.User.company_id == cid).count()
    
    # 👇 NOUVEAU : On compte les rapports
    # On suppose que les rapports sont liés aux chantiers de l'entreprise
    count_rapports = db.query(models.Rapport)\
        .join(models.Chantier)\
        .filter(models.Chantier.company_id == cid)\
        .count()

    # 👇 NOUVEAU : On récupère les 5 derniers rapports pour la liste "Activité récente"
    recents_db = db.query(models.Rapport)\
        .join(models.Chantier)\
        .filter(models.Chantier.company_id == cid)\
        .order_by(desc(models.Rapport.date_creation))\
        .limit(5)\
        .all()
    
    # On formate les rapports récents pour le JSON
    recents_formatted = []
    for r in recents_db:
        recents_formatted.append({
            "id": r.id,
            "date": r.date_creation.strftime("%d/%m/%Y") if r.date_creation else "N/A",
            "auteur": f"Rapport #{r.id}", # Ou le nom de l'auteur si dispo
            "chantier_nom": r.chantier.nom if r.chantier else "Inconnu",
            "chantier_id": r.chantier_id
        })

    name = current_user.company.name if current_user.company else "N/A"

    # 3. Construction de la réponse complète
    stats_data = {
        # --- Chiffres Clés ---
        "nb_chantiers": count_chantiers,
        "nb_materiels": count_materiels,
        "nb_users": count_users,
        "nb_rapports": count_rapports,  # 👈 C'est ce qui manquait !
        "recents": recents_formatted,   # 👈 C'est ce qui manquait pour la liste !
        
        "company_name": name,
        
        # --- Alias pour le Frontend (Ceinture & Bretelles) ---
        "nbChantiers": count_chantiers,
        "nbMateriels": count_materiels,
        "nbRapports": count_rapports,
        
        "chantiers": count_chantiers,
        "materiels": count_materiels,
        "rapports": count_rapports,
        
        "alertes": 0  # On laisse à 0 pour l'instant (à coder plus tard si besoin)
    }

    # 4. Technique Poupée Russe (Data dans Data)
    return {
        **stats_data,
        "data": stats_data,
        "stats": stats_data
    }