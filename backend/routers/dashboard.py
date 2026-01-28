from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from .. import models, database, dependencies

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    
    # 1. Sécurité
    if not current_user.company_id:
        return {"nb_chantiers": 0, "nb_materiels": 0, "nb_rapports": 0, "recents": []}

    cid = current_user.company_id

    # 2. Les Calculs de base
    count_chantiers = db.query(models.Chantier).filter(models.Chantier.company_id == cid).count()
    count_materiels = db.query(models.Materiel).filter(models.Materiel.company_id == cid).count()
    count_users = db.query(models.User).filter(models.User.company_id == cid).count()
    
    # Compte des rapports
    count_rapports = db.query(models.Rapport)\
        .join(models.Chantier)\
        .filter(models.Chantier.company_id == cid)\
        .count()

    # 👇 NOUVEAU : Calcul des Alertes Sécurité
    # Règle : Chantiers actifs dont la date de fin est passée (En retard)
    count_alertes = db.query(models.Chantier).filter(
        models.Chantier.company_id == cid,
        models.Chantier.est_actif == True,
        models.Chantier.date_fin < datetime.now()
    ).count()

    # 3. Récupération des Derniers Rapports (Corrigé pour le Titre)
    recents_db = db.query(models.Rapport)\
        .join(models.Chantier)\
        .filter(models.Chantier.company_id == cid)\
        .order_by(desc(models.Rapport.date_creation))\
        .limit(5)\
        .all()
    
    recents_formatted = []
    for r in recents_db:
        # On essaie de trouver un titre intelligent
        titre_rapport = f"Rapport #{r.id}"
        if hasattr(r, "nom") and r.nom:
            titre_rapport = r.nom
        elif hasattr(r, "type") and r.type:
            titre_rapport = f"Rapport {r.type}"
            
        recents_formatted.append({
            "id": r.id,
            "date": r.date_creation.strftime("%d/%m/%Y") if r.date_creation else "N/A",
            
            # 👇 C'est ICI qu'on fixe le "Rapport sans titre"
            # On envoie explicitement 'titre' et 'nom' pour être sûr que le Frontend le capte
            "titre": titre_rapport,
            "nom": titre_rapport, 
            
            "auteur": "Admin", # Vous pourrez mettre current_user.nom plus tard
            "chantier_nom": r.chantier.nom if r.chantier else "Inconnu",
            "chantier_id": r.chantier_id
        })

    name = current_user.company.name if current_user.company else "N/A"

    # 4. Construction de la réponse
    stats_data = {
        "nb_chantiers": count_chantiers,
        "nb_materiels": count_materiels,
        "nb_users": count_users,
        "nb_rapports": count_rapports,
        
        "alertes": count_alertes,       # 👇 Le chiffre des alertes
        "nbAlertes": count_alertes,
        
        "recents": recents_formatted,   # 👇 La liste corrigée
        "company_name": name,
        
        # Alias pour compatibilité maximale
        "nbChantiers": count_chantiers,
        "nbMateriels": count_materiels,
        "nbRapports": count_rapports,
        "chantiers": count_chantiers,
        "materiels": count_materiels,
        "rapports": count_rapports
    }

    return {
        **stats_data,
        "data": stats_data,
        "stats": stats_data
    }