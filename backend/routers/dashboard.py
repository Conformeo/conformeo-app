from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta
import time
import requests 

from .. import models, database, dependencies

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# --- GÉOCODAGE DYNAMIQUE (Sans aucune valeur par défaut) ---
def get_gps_dynamic(query):
    if not query or len(query) < 3:
        return None
    try:
        # On nettoie un peu la requête pour aider OSM
        clean_query = query.replace(",", " ").strip()
        
        url = "https://nominatim.openstreetmap.org/search"
        params = {'q': clean_query, 'format': 'json', 'limit': 1, 'countrycodes': 'fr'}
        headers = {'User-Agent': 'ConformeoApp/1.0'}
        
        res = requests.get(url, params=params, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            if data and len(data) > 0:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        print(f"❌ Erreur API OSM pour '{query}': {e}")
    return None

# --- ROUTES DASHBOARD ---

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    
    if not current_user.company_id:
        return {"nb_chantiers": 0, "map": [], "recents": []}

    cid = current_user.company_id

    count_chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).count()
    count_materiels = db.query(models.Materiel).filter(models.Materiel.company_id == cid).count()
    count_rapports = db.query(models.Rapport).join(models.Chantier).filter(models.Chantier.company_id == cid).count()

    chantiers_retard = db.query(models.Chantier).filter(
        models.Chantier.company_id == cid,
        models.Chantier.est_actif == True,
        models.Chantier.date_fin < datetime.now()
    ).count()

    rapports_critiques = db.query(models.Rapport).join(models.Chantier).filter(
        models.Chantier.company_id == cid, 
        models.Rapport.niveau_urgence == "Critique"
    ).count()

    # Carte : On filtre les coordonnées invalides (0.0 ou None)
    sites_db = db.query(models.Chantier).filter(
        models.Chantier.company_id == cid,
        models.Chantier.est_actif == True
    ).all()

    map_data = []
    for s in sites_db:
        if s.latitude and s.longitude and abs(s.latitude) > 0.1:
            map_data.append({
                "nom": s.nom, 
                "client": s.client, 
                "lat": float(s.latitude), 
                "lng": float(s.longitude)
            })

    # Récents
    recents_db = db.query(models.Rapport).join(models.Chantier).filter(models.Chantier.company_id == cid).order_by(desc(models.Rapport.date_creation)).limit(5).all()
    recents_formatted = []
    for r in recents_db:
        recents_formatted.append({
            "id": r.id,
            "date": r.date_creation.isoformat() if r.date_creation else None,
            "titre": getattr(r, "titre", None) or f"Rapport #{r.id}",
            "niveau_urgence": getattr(r, "niveau_urgence", "Normal"),
            "chantier_nom": r.chantier.nom if r.chantier else "Inconnu",
            "chantier_id": r.chantier_id
        })

    name = current_user.company.name if current_user.company else "N/A"
    
    stats_data = {
        "nb_chantiers": count_chantiers, "nb_materiels": count_materiels, "nb_rapports": count_rapports,
        "alertes": chantiers_retard + rapports_critiques,
        "map": map_data, "recents": recents_formatted, "company_name": name,
        "nbChantiers": count_chantiers, "nbMateriels": count_materiels, "nbRapports": count_rapports, 
        "nbAlertes": chantiers_retard + rapports_critiques
    }

    return {**stats_data, "data": stats_data}


# 👇 ROUTE DE RÉPARATION (Correction de la logique Adresse) 👇
@router.get("/fix-data")
def fix_dashboard_data(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    """
    Recalcule les GPS en utilisant le champ 'adresse' complet.
    """
    if not current_user.company_id:
        return {"message": "Aucune entreprise liée"}
    
    cid = current_user.company_id
    chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).all()
    
    logs = []
    success_count = 0
    
    for c in chantiers:
        c.est_actif = True
        
        # 1. On récupère l'adresse brute (ex: "60 avenue Saint Roch, 84200 Carpentras")
        addr_full = getattr(c, 'adresse', getattr(c, 'address', '')) or ""
        
        # 2. Stratégie en Cascade
        attempts = []
        
        # Tentative A : L'adresse brute complète (Meilleure chance)
        if addr_full and len(addr_full) > 5:
            attempts.append(addr_full)
            
            # Tentative A-bis : Si l'adresse contient une virgule, on essaie sans (OSM préfère parfois sans)
            if "," in addr_full:
                attempts.append(addr_full.replace(",", " "))

        # Tentative B : Si on a des champs séparés (au cas où le modèle évolue)
        ville = getattr(c, 'ville', getattr(c, 'city', '')) or ""
        cp = getattr(c, 'code_postal', getattr(c, 'zip_code', '')) or ""
        if ville:
            attempts.append(f"{ville} France")
        
        # Tentative C : Fallback sur le Client + France (Dernier recours)
        if c.client and len(c.client) > 3:
            attempts.append(f"{c.client} France")

        # Exécution des tentatives
        found_gps = None
        for query in attempts:
            print(f"🌍 Geocoding: '{query}'")
            coords = get_gps_dynamic(query)
            if coords:
                found_gps = coords
                logs.append(f"✅ {c.nom} -> Trouvé via '{query}'")
                break
            time.sleep(1.1) # Pause API
            
        if found_gps:
            c.latitude = found_gps[0]
            c.longitude = found_gps[1]
            success_count += 1
        else:
            logs.append(f"❌ {c.nom} : Adresse introuvable ({addr_full})")
            c.latitude = 0
            c.longitude = 0

    if chantiers: chantiers[-1].date_fin = datetime.now() - timedelta(days=2)
    db.commit()
    
    return {
        "status": "success", 
        "message": f"Mise à jour terminée : {success_count}/{len(chantiers)} chantiers localisés.",
        "details": logs
    }