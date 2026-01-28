from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
# 👇 Nouveaux imports nécessaires pour la génération de données
from datetime import datetime, timedelta
import random
# 👆 Fin des nouveaux imports

from .. import models, database, dependencies

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    
    # --- VOTRE CODE ACTUEL DE STATS (Inchangé) ---
    if not current_user.company_id:
        return {"nb_chantiers": 0, "map": [], "recents": []}

    cid = current_user.company_id

    count_chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).count()
    count_materiels = db.query(models.Materiel).filter(models.Materiel.company_id == cid).count()
    count_rapports = db.query(models.Rapport).join(models.Chantier).filter(models.Chantier.company_id == cid).count()

    # Alertes
    chantiers_retard = db.query(models.Chantier).filter(
        models.Chantier.company_id == cid,
        models.Chantier.est_actif == True,
        models.Chantier.date_fin < datetime.now()
    ).count()

    rapports_critiques = db.query(models.Rapport).join(models.Chantier).filter(
        models.Chantier.company_id == cid, 
        models.Rapport.niveau_urgence == "Critique"
    ).count()

    total_alertes = chantiers_retard + rapports_critiques

    # Carte
    sites_db = db.query(models.Chantier).filter(models.Chantier.company_id == cid, models.Chantier.est_actif == True).all()
    map_data = []
    for s in sites_db:
        if s.latitude and s.longitude:
            try:
                map_data.append({"nom": s.nom, "client": s.client, "lat": float(s.latitude), "lng": float(s.longitude)})
            except: pass

    # Récents
    recents_db = db.query(models.Rapport).join(models.Chantier).filter(models.Chantier.company_id == cid).order_by(desc(models.Rapport.date_creation)).limit(5).all()
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
    
    stats_data = {
        "nb_chantiers": count_chantiers,
        "nb_materiels": count_materiels,
        "nb_rapports": count_rapports,
        "alertes": total_alertes,
        "map": map_data,
        "recents": recents_formatted,
        "company_name": name,
        "nbChantiers": count_chantiers, "nbMateriels": count_materiels, "nbRapports": count_rapports, "nbAlertes": total_alertes
    }

    return {**stats_data, "data": stats_data}


# 👇👇👇 LA ROUTE MAGIQUE POUR RÉPARER LES DONNÉES 👇👇👇
@router.get("/fix-data")
def fix_dashboard_data(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    """
    Route utilitaire pour injecter des coordonnées GPS et des alertes fictives
    pour tester le tableau de bord.
    """
    if not current_user.company_id:
        return {"message": "Aucune entreprise liée"}
    
    cid = current_user.company_id
    
    # 1. Injection GPS (Villes françaises)
    coords = [
        (48.8566, 2.3522), (45.7640, 4.8357), (43.2965, 5.3698), 
        (44.8378, -0.5792), (50.6292, 3.0573), (47.2184, -1.5536)
    ]
    
    chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).all()
    count_gps = 0
    for i, c in enumerate(chantiers):
        # On ne touche que ceux qui n'ont pas de GPS
        if not c.latitude or c.latitude == 0:
            lat_base, lng_base = coords[i % len(coords)]
            # Petit décalage aléatoire pour éviter la superposition
            c.latitude = lat_base + (random.uniform(-0.05, 0.05))
            c.longitude = lng_base + (random.uniform(-0.05, 0.05))
            count_gps += 1

    # 2. Création Alerte Retard
    if chantiers:
        chantier_retard = chantiers[0]
        chantier_retard.est_actif = True
        chantier_retard.date_fin = datetime.now() - timedelta(days=2) # Fini il y a 2 jours
    
    # 3. Création Alerte Rapport Critique
    rapports = db.query(models.Rapport).join(models.Chantier).filter(models.Chantier.company_id == cid).all()
    if rapports:
        # On prend le dernier rapport et on le met en Critique
        rapport_critique = rapports[0]
        rapport_critique.niveau_urgence = "Critique"
        rapport_critique.titre = "Fuite de gaz majeure" # Un titre qui fait peur !
    
    db.commit()
    
    return {
        "status": "success", 
        "message": f"Données réparées ! {count_gps} chantiers géolocalisés, 1 retard créé, 1 rapport critique créé."
    }