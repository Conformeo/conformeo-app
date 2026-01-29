from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta
import time
import requests 

from .. import models, database, dependencies

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# --- FONCTION DE GÉOCODAGE DYNAMIQUE (Aucune donnée en dur) ---
def get_gps_dynamic(query):
    """
    Interroge l'API OpenStreetMap avec une requête textuelle.
    Retourne (lat, lon) si trouvé, sinon None.
    """
    if not query or len(query) < 3:
        return None

    try:
        # URL officielle de Nominatim (OpenStreetMap)
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            'q': query,
            'format': 'json',
            'limit': 1,
            'countrycodes': 'fr' # On limite à la France pour la précision
        }
        # User-Agent obligatoire pour ne pas être bloqué par OSM
        headers = {'User-Agent': 'ConformeoApp/1.0'}
        
        res = requests.get(url, params=params, headers=headers, timeout=5)
        
        if res.status_code == 200:
            data = res.json()
            if data and len(data) > 0:
                lat = float(data[0]['lat'])
                lon = float(data[0]['lon'])
                return lat, lon
    except Exception as e:
        print(f"❌ Erreur API pour '{query}': {e}")

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

    # 3. CARTE (On ne renvoie QUE les chantiers géolocalisés)
    sites_db = db.query(models.Chantier).filter(
        models.Chantier.company_id == cid,
        models.Chantier.est_actif == True
    ).all()

    map_data = []
    for s in sites_db:
        # Sécurité : on n'affiche le point que s'il a de vraies coordonnées
        if s.latitude and s.longitude and (s.latitude != 0.0):
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


# 👇 ROUTE DE RÉPARATION INTELLIGENTE 👇
@router.get("/fix-data")
def fix_dashboard_data(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    """
    Parcourt les chantiers et met à jour les GPS via OpenStreetMap de façon purement dynamique.
    Aucune valeur par défaut n'est utilisée.
    """
    if not current_user.company_id:
        return {"message": "Aucune entreprise liée"}
    
    cid = current_user.company_id
    chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).all()
    
    logs = []
    success_count = 0
    
    for c in chantiers:
        c.est_actif = True
        
        # Récupération sécurisée des données existantes
        addr = getattr(c, 'adresse', getattr(c, 'address', '')) or ""
        cp = getattr(c, 'code_postal', getattr(c, 'zip_code', '')) or ""
        ville = getattr(c, 'ville', getattr(c, 'city', '')) or ""
        client = c.client or ""
        
        found_gps = None
        
        # --- STRATÉGIE EN CASCADE ---
        # On essaie plusieurs requêtes, de la plus précise à la plus large.
        # Dès qu'une marche, on s'arrête.
        
        attempts = []
        
        # 1. Adresse complète (Idéal)
        if addr and ville:
            attempts.append(f"{addr} {cp} {ville}")
            
        # 2. Ville + Code Postal (Si l'adresse est mal écrite ou n° inconnu)
        if ville and cp:
            attempts.append(f"{cp} {ville}")
            
        # 3. Ville seule (Si pas de CP)
        if ville:
            attempts.append(f"{ville} France")
            
        # 4. Fallback : Nom du Client + Ville (Ex: "Mairie Carpentras")
        # Utile si l'adresse est vide mais que le client contient le lieu
        if not ville and len(client) > 3:
             attempts.append(f"{client} France")

        # Exécution des tentatives
        for query in attempts:
            print(f"🌍 Tentative géocodage : '{query}'")
            coords = get_gps_dynamic(query)
            if coords:
                found_gps = coords
                logs.append(f"✅ {c.nom} -> Trouvé via '{query}'")
                break # On a trouvé, on sort de la boucle attempts
            
            # Petite pause pour l'API
            time.sleep(1.1)
            
        # Mise à jour BDD
        if found_gps:
            c.latitude = found_gps[0]
            c.longitude = found_gps[1]
            success_count += 1
        else:
            # IMPORTANT : Si non trouvé, on laisse vide ou on met 0.
            # On ne met SURTOUT PAS Paris par défaut.
            logs.append(f"❌ {c.nom} : Impossible de localiser (Données: {addr} {ville})")
            c.latitude = 0
            c.longitude = 0

    # --- (Optionnel) Mise à jour des alertes pour la démo ---
    if chantiers:
        chantiers[-1].date_fin = datetime.now() - timedelta(days=2)

    db.commit()
    
    return {
        "status": "success", 
        "message": f"Géocodage terminé : {success_count}/{len(chantiers)} chantiers localisés.",
        "details": logs
    }