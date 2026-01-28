from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from datetime import datetime
from .. import models, database, dependencies

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    
    if not current_user.company_id:
        return {"nb_chantiers": 0, "map": [], "recents": []}

    cid = current_user.company_id

    # 1. CHIFFRES CLÉS
    count_chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).count()
    count_materiels = db.query(models.Materiel).filter(models.Materiel.company_id == cid).count()
    
    # Rapports sur le mois en cours (Optionnel, ici on compte tout pour l'instant)
    count_rapports = db.query(models.Rapport)\
        .join(models.Chantier)\
        .filter(models.Chantier.company_id == cid)\
        .count()

    # 2. CALCUL ALERTES SÉCURITÉ 🚨
    # A = Chantiers en retard
    chantiers_retard = db.query(models.Chantier).filter(
        models.Chantier.company_id == cid,
        models.Chantier.est_actif == True,
        models.Chantier.date_fin < datetime.now()
    ).count()

    # B = Rapports Critiques
    rapports_critiques = db.query(models.Rapport)\
        .join(models.Chantier)\
        .filter(models.Chantier.company_id == cid, models.Rapport.niveau_urgence == "Critique")\
        .count()

    total_alertes = chantiers_retard + rapports_critiques

    # 3. DONNÉES POUR LA CARTE (MAP) 🗺️
    # On récupère tous les chantiers actifs qui ont des coordonnées
    sites_db = db.query(models.Chantier).filter(
        models.Chantier.company_id == cid,
        models.Chantier.est_actif == True
    ).all()

    map_data = []
    for s in sites_db:
        # On vérifie qu'on a bien des coordonnées valides
        if s.latitude and s.longitude:
            try:
                map_data.append({
                    "nom": s.nom,
                    "client": s.client,
                    "lat": float(s.latitude),
                    "lng": float(s.longitude)
                })
            except:
                pass # Ignore si latitude mal formatée

    # 4. DERNIERS RAPPORTS
    recents_db = db.query(models.Rapport)\
        .join(models.Chantier)\
        .filter(models.Chantier.company_id == cid)\
        .order_by(desc(models.Rapport.date_creation))\
        .limit(5)\
        .all()
    
    recents_formatted = []
    for r in recents_db:
        real_titre = getattr(r, "titre", None) or f"Rapport #{r.id}"
        urgence = getattr(r, "niveau_urgence", "Normal")

        recents_formatted.append({
            "id": r.id,
            "date": r.date_creation.isoformat() if r.date_creation else None,
            "titre": real_titre,
            "niveau_urgence": urgence,
            "chantier_nom": r.chantier.nom if r.chantier else "Inconnu",
            "chantier_id": r.chantier_id
        })

    name = current_user.company.name if current_user.company else "N/A"

    # 5. RÉPONSE FINALE
    stats_data = {
        "nb_chantiers": count_chantiers,
        "nb_materiels": count_materiels,
        "nb_rapports": count_rapports,
        "alertes": total_alertes,      # Maintenant inclut retards + critiques
        "map": map_data,               # 👇 LA CARTE VA ENFIN S'AFFICHER
        "recents": recents_formatted,
        "company_name": name,
        
        # Alias
        "nbChantiers": count_chantiers,
        "nbMateriels": count_materiels,
        "nbRapports": count_rapports,
        "nbAlertes": total_alertes
    }

    return {
        **stats_data,
        "data": stats_data
    }