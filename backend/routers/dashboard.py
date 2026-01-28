from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta
import random
import time
import requests  # 👈 Nécessaire pour interroger OpenStreetMap

from .. import models, database, dependencies

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# --- FONCTION DE GÉOCODAGE ROBUSTE (Avec stratégie de repli) ---
def get_gps_robust(address, city, zip_code):
    """
    Tente de trouver les coordonnées GPS avec plusieurs niveaux de précision.
    1. Adresse complète (Ex: 60 avenue Saint Roch 84200 Carpentras)
    2. Ville + Code Postal (Ex: 84200 Carpentras) -> Si le n° de rue bloque
    3. Ville seule (Ex: Carpentras France) -> Si le code postal bloque
    """
    queries = []
    
    # Stratégie 1 : Adresse complète (Le plus précis)
    if address and city:
        queries.append(f"{address} {zip_code or ''} {city}")
    
    # Stratégie 2 : Code Postal + Ville (Précision Ville)
    if city and zip_code:
        queries.append(f"{zip_code} {city}")
        
    # Stratégie 3 : Ville seule + France
    if city:
        queries.append(f"{city} France")

    # On teste chaque stratégie l'une après l'autre
    for q in queries:
        try:
            url = "https://nominatim.openstreetmap.org/search"
            params = {
                'q': q,
                'format': 'json',
                'limit': 1,
                'countrycodes': 'fr'
            }
            # User-Agent obligatoire pour respecter la politique d'OpenStreetMap
            headers = {'User-Agent': 'ConformeoApp/1.0'}
            
            res = requests.get(url, params=params, headers=headers, timeout=5)
            if res.status_code == 200:
                data = res.json()
                if data:
                    print(f"✅ GPS trouvé pour '{q}' : {data[0]['lat']}, {data[0]['lon']}")
                    return float(data[0]['lat']), float(data[0]['lon'])
            
            # Petite pause pour ne pas se faire bannir par l'API
            time.sleep(1)
            
        except Exception as e:
            print(f"❌ Erreur API pour '{q}': {e}")

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
        # On vérifie que lat/lng existent et ne sont pas 0
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


# 👇 ROUTE DE RÉPARATION INTELLIGENTE (GÉOCODAGE AVEC FALLBACK) 👇
@router.get("/fix-data")
def fix_dashboard_data(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    """
    Parcourt les chantiers et met à jour les GPS via OpenStreetMap.
    Si l'adresse exacte est introuvable, se rabat sur la Ville pour garantir l'affichage.
    """
    if not current_user.company_id:
        return {"message": "Aucune entreprise liée"}
    
    cid = current_user.company_id
    chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).all()
    
    logs = []
    success_count = 0
    
    for c in chantiers:
        c.est_actif = True
        
        # 1. Récupération sécurisée des champs (gère les noms anglais/français ou null)
        addr = getattr(c, 'adresse', getattr(c, 'address', '')) or ""
        cp = getattr(c, 'code_postal', getattr(c, 'zip_code', '')) or ""
        ville = getattr(c, 'ville', getattr(c, 'city', '')) or ""
        
        # Si pas de ville mais une adresse longue, on tente de deviner (fallback basique)
        if not ville and len(addr) > 10:
            logs.append(f"⚠️ {c.nom} : Champs ville vide, tentative avec l'adresse brute")
        
        # 2. Appel du géocodage robuste
        print(f"🌍 Traitement de : {c.nom} ({addr} {ville})")
        coords = get_gps_robust(addr, ville, cp)
        
        if coords:
            c.latitude = coords[0]
            c.longitude = coords[1]
            success_count += 1
            logs.append(f"📍 {c.nom} -> OK ({coords})")
        else:
            # Si tout échoue, on laisse à 0 (ou on pourrait mettre une valeur par défaut, mais 0 est plus sûr pour éviter les fausses infos)
            logs.append(f"❌ {c.nom} : Géocodage échoué complet.")
            
        # Pause obligatoire pour l'API
        time.sleep(1.1)

    # --- Gestion des Alertes (Mise à jour d'un retard pour la démo) ---
    if chantiers:
        chantiers[-1].date_fin = datetime.now() - timedelta(days=2)

    db.commit()
    
    return {
        "status": "success", 
        "message": f"Mise à jour terminée : {success_count}/{len(chantiers)} chantiers localisés.",
        "details": logs
    }