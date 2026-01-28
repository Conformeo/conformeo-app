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
    Script de réparation intelligent : 
    - Assigne les vraies coordonnées pour Avignon.
    - Distribue les autres chantiers aléatoirement en France.
    """
    if not current_user.company_id:
        return {"message": "Aucune entreprise liée"}
    
    cid = current_user.company_id
    
    # Coordonnées exactes pour Avignon (25 rue de la république)
    GPS_AVIGNON = (43.949317, 4.805528)

    # Liste de villes par défaut pour les autres chantiers
    coords_random = [
        (48.8566, 2.3522),  # Paris
        (45.7640, 4.8357),  # Lyon
        (43.2965, 5.3698),  # Marseille
        (44.8378, -0.5792), # Bordeaux
        (50.6292, 3.0573),  # Lille
        (47.2184, -1.5536)  # Nantes
    ]
    
    chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).all()
    
    updated_count = 0
    for i, c in enumerate(chantiers):
        c.est_actif = True # On s'assure qu'ils sont visibles
        
        # 👇 DÉTECTION SPÉCIFIQUE POUR VOTRE CHANTIER AVIGNON
        # On vérifie si "Avignon" est dans l'adresse (si le champ existe) ou si c'est le client Supabase
        is_avignon = False
        
        # Vérification par le nom ou le client (basé sur votre capture d'écran)
        if "Supabase" in (c.client or "") or "database" in (c.nom or ""):
            is_avignon = True
        
        # Si vous avez un champ 'ville' ou 'adresse' dans votre modèle, on peut aussi tester :
        # if hasattr(c, 'adresse') and "Avignon" in (c.adresse or ""): is_avignon = True
        # if hasattr(c, 'ville') and "Avignon" in (c.ville or ""): is_avignon = True

        if is_avignon:
            c.latitude = GPS_AVIGNON[0]
            c.longitude = GPS_AVIGNON[1]
            print(f"📍 Chantier '{c.nom}' localisé à Avignon !")
        else:
            # Pour les autres, on garde l'aléatoire pour peupler la carte
            lat_base, lng_base = coords_random[i % len(coords_random)]
            c.latitude = lat_base + (random.uniform(-0.05, 0.05))
            c.longitude = lng_base + (random.uniform(-0.05, 0.05))
            
        updated_count += 1

    # --- On garde la création d'alertes pour la démo ---
    if chantiers:
        # On force un chantier en retard (le premier qui n'est PAS Avignon pour éviter de polluer votre test)
        other_chantiers = [ch for ch in chantiers if ch.latitude != GPS_AVIGNON[0]]
        if other_chantiers:
            other_chantiers[0].date_fin = datetime.now() - timedelta(days=2)

    # Réparation Rapport Critique
    rapports = db.query(models.Rapport).join(models.Chantier).filter(models.Chantier.company_id == cid).all()
    if rapports:
        rapport_critique = rapports[0]
        rapport_critique.niveau_urgence = "Critique"
        rapport_critique.titre = "Fissure structurelle majeure"
    
    db.commit()
    
    return {
        "status": "success", 
        "message": f"Correction effectuée : {updated_count} chantiers mis à jour (dont Avignon)."
    }