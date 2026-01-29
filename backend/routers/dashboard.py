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
    """
    Interroge OpenStreetMap. 
    Retourne les coordonnées réelles ou None si introuvable.
    """
    if not query or len(query) < 3:
        return None

    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {'q': query, 'format': 'json', 'limit': 1, 'countrycodes': 'fr'}
        headers = {'User-Agent': 'ConformeoApp/1.0'} # Obligatoire pour OSM
        
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

    # 1. Chiffres Clés
    count_chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).count()
    count_materiels = db.query(models.Materiel).filter(models.Materiel.company_id == cid).count()
    count_rapports = db.query(models.Rapport).join(models.Chantier).filter(models.Chantier.company_id == cid).count()

    # 2. Alertes (Calcul dynamique)
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

    # 3. Carte (On filtre les coordonnées invalides ou nulles)
    sites_db = db.query(models.Chantier).filter(
        models.Chantier.company_id == cid,
        models.Chantier.est_actif == True
    ).all()

    map_data = []
    for s in sites_db:
        # On n'ajoute le point QUE si les coordonnées sont valides (différentes de 0 et de None)
        if s.latitude and s.longitude and abs(s.latitude) > 0.1:
            map_data.append({
                "nom": s.nom, 
                "client": s.client, 
                "lat": float(s.latitude), 
                "lng": float(s.longitude)
            })

    # 4. Récents
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
        "alertes": total_alertes, "map": map_data, "recents": recents_formatted, "company_name": name,
        # Alias Frontend
        "nbChantiers": count_chantiers, "nbMateriels": count_materiels, "nbRapports": count_rapports, "nbAlertes": total_alertes
    }

    return {**stats_data, "data": stats_data}


# 👇 ROUTE DE RÉPARATION OBLIGATOIRE POUR METTRE À JOUR LA BDD 👇
@router.get("/fix-data")
def fix_dashboard_data(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    """
    Force le recalcul des coordonnées GPS pour TOUS les chantiers via OpenStreetMap.
    Écrase les anciennes valeurs incorrectes (comme celles de Paris).
    """
    if not current_user.company_id:
        return {"message": "Aucune entreprise liée"}
    
    cid = current_user.company_id
    chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).all()
    
    logs = []
    success_count = 0
    
    for c in chantiers:
        c.est_actif = True
        
        # Données du chantier
        addr = getattr(c, 'adresse', getattr(c, 'address', '')) or ""
        cp = getattr(c, 'code_postal', getattr(c, 'zip_code', '')) or ""
        ville = getattr(c, 'ville', getattr(c, 'city', '')) or ""
        client = c.client or ""
        
        # --- Stratégie en Cascade (Try Hard) ---
        # On essaie plusieurs recherches du plus précis au plus large
        attempts = []
        
        # 1. Adresse exacte
        if addr and ville: attempts.append(f"{addr} {cp} {ville}")
        
        # 2. Ville + Code Postal (C'est souvent celle-ci qui sauve Carpentras)
        if ville and cp: attempts.append(f"{cp} {ville}")
        
        # 3. Ville seule
        if ville: attempts.append(f"{ville} France")
        
        # 4. Fallback Client (ex: "Mairie Carpentras")
        if not ville and len(client) > 3: attempts.append(f"{client} France")

        # Exécution
        found_gps = None
        for query in attempts:
            print(f"🌍 Recherche GPS pour : '{query}'")
            coords = get_gps_dynamic(query)
            if coords:
                found_gps = coords
                logs.append(f"✅ {c.nom} -> Trouvé à {coords} (via '{query}')")
                break # On a trouvé, on arrête de chercher
            time.sleep(1.1) # Pause API respectueuse
            
        # Mise à jour BDD
        if found_gps:
            c.latitude = found_gps[0]
            c.longitude = found_gps[1]
            success_count += 1
        else:
            # SI PAS TROUVÉ : On met 0 pour faire disparaître le point
            # (Au moins il ne sera pas faussement à Paris)
            logs.append(f"❌ {c.nom} : Adresse introuvable. GPS mis à 0.")
            c.latitude = 0
            c.longitude = 0

    # Optionnel : Mise à jour d'un retard pour la démo
    if chantiers: chantiers[-1].date_fin = datetime.now() - timedelta(days=2)

    db.commit()
    
    return {
        "status": "success", 
        "message": f"Géocodage terminé : {success_count}/{len(chantiers)} chantiers mis à jour.",
        "details": logs
    }