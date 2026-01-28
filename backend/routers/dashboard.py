from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from .. import models, database, dependencies

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    
    if not current_user.company_id:
        return {"nb_chantiers": 0, "nb_materiels": 0, "nb_rapports": 0, "recents": []}

    cid = current_user.company_id

    # --- 1. COMPTAGES ---
    count_chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).count()
    count_materiels = db.query(models.Materiel).filter(models.Materiel.company_id == cid).count()
    count_users = db.query(models.User).filter(models.User.company_id == cid).count()
    
    count_rapports = db.query(models.Rapport)\
        .join(models.Chantier)\
        .filter(models.Chantier.company_id == cid)\
        .count()

    # Calcul Alertes (Chantiers actifs mais date fin dépassée)
    count_alertes = db.query(models.Chantier).filter(
        models.Chantier.company_id == cid,
        models.Chantier.est_actif == True,
        models.Chantier.date_fin < datetime.now()
    ).count()

    # --- 2. DERNIERS RAPPORTS (CORRIGÉ) ---
    recents_db = db.query(models.Rapport)\
        .join(models.Chantier)\
        .filter(models.Chantier.company_id == cid)\
        .order_by(desc(models.Rapport.date_creation))\
        .limit(5)\
        .all()
    
    recents_formatted = []
    for r in recents_db:
        # 👇 RÉCUPÉRATION DU VRAI TITRE ET URGENCE
        # On vérifie si le champ existe, sinon on met une valeur par défaut
        
        real_titre = getattr(r, "titre", None) or f"Rapport #{r.id}"
        urgence = getattr(r, "niveau_urgence", "Normal")  # Par défaut "Normal" si vide

        recents_formatted.append({
            "id": r.id,
            # On envoie la date au format ISO pour que le pipe Angular | date fonctionne bien
            "date": r.date_creation.isoformat() if r.date_creation else None,
            "titre": real_titre,
            "niveau_urgence": urgence,
            "chantier_nom": r.chantier.nom if r.chantier else "Chantier inconnu",
            "chantier_id": r.chantier_id
        })

    name = current_user.company.name if current_user.company else "N/A"

    # --- 3. RÉPONSE ---
    stats_data = {
        "nb_chantiers": count_chantiers,
        "nb_materiels": count_materiels,
        "nb_users": count_users,
        "nb_rapports": count_rapports,
        "alertes": count_alertes,
        "recents": recents_formatted, # La liste contient maintenant titre + urgence
        "company_name": name,
        
        # Alias pour le frontend
        "nbChantiers": count_chantiers,
        "nbMateriels": count_materiels,
        "nbRapports": count_rapports,
        "nbAlertes": count_alertes
    }

    return {
        **stats_data,
        "data": stats_data
    }