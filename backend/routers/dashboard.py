from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta
import random
import time
import requests  # 👈 Nécessaire pour interroger OpenStreetMap

from .. import models, database, dependencies

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# --- FONCTIONS UTILITAIRES ---

def get_gps_from_address(address_query):
    """
    Interroge l'API OpenStreetMap (Nominatim) pour obtenir les coordonnées GPS
    d'une adresse ou d'une ville.
    """
    if not address_query or len(address_query) < 3:
        return None

    url = "https://nominatim.openstreetmap.org/search"
    params = {
        'q': address_query,
        'format': 'json',
        'limit': 1,
        'countrycodes': 'fr' # On limite à la France pour éviter les homonymes
    }
    # User-Agent obligatoire pour respecter la politique d'OpenStreetMap
    headers = {'User-Agent': 'ConformeoApp/1.0'} 

    try:
        response = requests.get(url, params=params, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        print(f"❌ Erreur Geocoding pour '{address_query}': {e}")
    
    return None

# --- ROUTES ---

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    
    if not current_user.company_id:
        return {"nb_chantiers": 0, "map": [], "recents": []}

    cid = current_user.company_id

    # 1. COMPTAGES
    count_chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).count()
    count_materiels = db.query(models.Materiel).filter(models.Materiel.company_id == cid).count()
    count_rapports = db.query(models.Rapport).join(models.Chantier).filter(models.Chantier.company_id == cid).count()

    # 2. ALERTES
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

    # 3. CARTE (On ne renvoie que ceux qui ont un GPS valide)
    sites_db = db.query(models.Chantier).filter(
        models.Chantier.company_id == cid,
        models.Chantier.est_actif == True
    ).all()

    map_data = []
    for s in sites_db:
        if s.latitude and s.longitude and s.latitude != 0:
            map_data.append({
                "nom": s.nom, 
                "client": s.client, 
                "lat": float(s.latitude), 
                "lng": float(s.longitude)
            })

    # 4. RÉCENTS
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


# 👇 ROUTE DE RÉPARATION INTELLIGENTE (GÉOCODAGE RÉEL) 👇
@router.get("/fix-data")
def fix_dashboard_data(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    """
    Parcourt tous les chantiers et calcule leurs coordonnées GPS réelles
    via l'API OpenStreetMap en fonction de leur adresse/ville.
    """
    if not current_user.company_id:
        return {"message": "Aucune entreprise liée"}
    
    cid = current_user.company_id
    chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).all()
    
    updated_logs = []
    
    for c in chantiers:
        c.est_actif = True
        
        # 1. Construction de la requête d'adresse
        # On essaie d'être le plus précis possible
        search_query = ""
        
        if hasattr(c, 'adresse') and c.adresse:
            search_query += f"{c.adresse} "
        if hasattr(c, 'code_postal') and c.code_postal:
            search_query += f"{c.code_postal} "
        if hasattr(c, 'ville') and c.ville:
            search_query += f"{c.ville}"
            
        # Si on n'a pas de champ adresse structuré, on cherche dans le nom/client
        # (Ex: "Collège test Mairie Carpentras")
        if len(search_query.strip()) < 5:
             # Fallback : on concatène tout ce qu'on a pour espérer trouver une ville
             search_query = f"{c.nom or ''} {c.client or ''}"

        # 2. Appel API OpenStreetMap
        print(f"🌍 Géocodage pour : {search_query}...")
        coords = get_gps_from_address(search_query)
        
        if coords:
            c.latitude = coords[0]
            c.longitude = coords[1]
            updated_logs.append(f"✅ {c.nom} -> {coords}")
        else:
            updated_logs.append(f"⚠️ {c.nom} : Adresse introuvable ({search_query})")
            # En cas d'échec total, on met Paris par défaut pour ne pas casser la carte
            if not c.latitude: 
                c.latitude, c.longitude = 48.8566, 2.3522

        # 3. Pause obligatoire (Rate Limiting OpenStreetMap 1 req/sec)
        time.sleep(1.1)

    # --- Reste du script pour les alertes (inchangé) ---
    if chantiers:
        chantiers[-1].date_fin = datetime.now() - timedelta(days=2) # 1 retard

    db.commit()
    
    return {
        "status": "success", 
        "message": "Géocodage terminé via OpenStreetMap",
        "details": updated_logs
    }