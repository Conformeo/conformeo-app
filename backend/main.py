import os
import shutil
import zipfile
from datetime import datetime, timedelta
import csv 
import time
import random
import base64
import json
from typing import List, Optional, Any

from dotenv import load_dotenv
load_dotenv()

import requests
import cloudinary
import cloudinary.uploader
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

from sqlalchemy import text
from sqlalchemy.orm import Session

# 👇 IMPORTATION DES MODULES LOCAUX
import models
import schemas 
import security
import pdf_generator
from pdf_generator import generate_permis_pdf
from database import engine, get_db

# Création des tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Conforméo API")

# --- CONFIGURATION CLOUDINARY ---
cloudinary_config = {
    "cloud_name": os.getenv("CLOUDINARY_CLOUD_NAME"),
    "api_key": os.getenv("CLOUDINARY_API_KEY"),
    "api_secret": os.getenv("CLOUDINARY_API_SECRET"),
    "secure": True,
}
if cloudinary_config["cloud_name"]:
    cloudinary.config(**cloudinary_config)

# --- CONFIGURATION EMAIL ---
mail_conf = ConnectionConfig(
    MAIL_USERNAME = "michelgmv7@gmail.com",
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD"),
    MAIL_FROM = "contact@conformeo-app.fr",
    MAIL_PORT = 2525,
    MAIL_SERVER = "smtp-relay.brevo.com",
    MAIL_STARTTLS = True,
    MAIL_SSL_TLS = False,
    USE_CREDENTIALS = True,
    VALIDATE_CERTS = False 
)

os.makedirs("uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="uploads"), name="static")


# 👇 MIDDLEWARE CORS (CRUCIAL POUR LE MOBILE)
origins = [
    "http://localhost:8100",
    "http://localhost:4200",
    "http://localhost",
    "capacitor://localhost",
    "https://conformeo-app.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # ← évite "*" si allow_credentials=True
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Conforméo API Ready 🚀"}

# --- HELPER FUNCTIONS ---
def get_company_for_chantier(db: Session, chantier_id: int):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if chantier and chantier.company_id:
        return db.query(models.Company).filter(models.Company.id == chantier.company_id).first()
    return db.query(models.Company).first()

def get_gps_from_address(address: str):
    if not address or len(address) < 5: return None, None
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {'q': address, 'format': 'json', 'limit': 1}
        headers = {'User-Agent': 'ConformeoApp/1.0 (contact@conformeo-app.fr)'}
        response = requests.get(url, params=params, headers=headers, timeout=5)
        if response.status_code == 200 and len(response.json()) > 0:
            data = response.json()[0]
            return float(data['lat']), float(data['lon'])
    except Exception as e:
        print(f"Erreur GPS pour {address}: {e}")
    return None, None

# ==========================================
# 1. UTILISATEURS / AUTH
# ==========================================

@app.post("/users", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email pris")
    
    company_id = None
    role = user.role
    
    if user.company_name:
        new_company = models.Company(name=user.company_name, subscription_plan="free")
        db.add(new_company); db.commit(); db.refresh(new_company)
        company_id = new_company.id
        role = "admin" 

    hashed_pwd = security.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_pwd, role=role, company_id=company_id)
    db.add(new_user); db.commit(); db.refresh(new_user)
    return new_user

@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # FastAPI s'attend à recevoir 'username' et 'password' dans un FORMULAIRE
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Identifiants incorrects")
    
    token = security.create_access_token(data={"sub": user.email, "role": user.role})
    
    # ⚠️ TRÈS IMPORTANT : Le nom de la clé est "access_token"
    return {"access_token": token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserOut)
def read_users_me(current_user: models.User = Depends(security.get_current_user)):
    return current_user

# --- UPDATE USER ME (ROBUSTE) ---
@app.put("/users/me", response_model=schemas.UserOut)
def update_user_me(user_up: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    if user_up.email and user_up.email != current_user.email:
        if db.query(models.User).filter(models.User.email == user_up.email).first():
            raise HTTPException(400, "Cet email est déjà utilisé.")
        current_user.email = user_up.email

    if user_up.full_name:
        current_user.full_name = user_up.full_name

    if user_up.password:
        current_user.hashed_password = security.get_password_hash(user_up.password)

    db.commit()
    db.refresh(current_user)
    return current_user

# ==========================================
# 2. GESTION EQUIPE
# ==========================================

@app.get("/team", response_model=List[schemas.UserOut])
def get_my_team(db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    if not current_user.company_id:
        return [current_user]
    return db.query(models.User).filter(models.User.company_id == current_user.company_id).all()

@app.post("/team/invite")
def invite_member(invite: schemas.UserInvite, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="Vous devez avoir une entreprise pour inviter.")
    
    if db.query(models.User).filter(models.User.email == invite.email).first():
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé.")

    hashed_pw = security.get_password_hash(invite.password)
    # Note: 'nom' n'est pas dans UserInvite, on suppose 'full_name' ou on adapte
    # Si le schéma UserInvite a 'nom' ou 'full_name', utilisez-le. 
    # Ici je mets une valeur par défaut safe.
    new_user = models.User(
        email=invite.email,
        full_name= getattr(invite, 'full_name', 'Nouveau Membre'), # Adaptation
        hashed_password=hashed_pw,
        company_id=current_user.company_id,
        role=invite.role
    )
    db.add(new_user)
    db.commit()
    return {"message": "Membre ajouté"}

@app.delete("/team/{user_id}")
def remove_member(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    user = db.query(models.User).filter(models.User.id == user_id, models.User.company_id == current_user.company_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Impossible de se supprimer soi-même")
    db.delete(user)
    db.commit()
    return {"message": "Supprimé"}

# --- UPDATE TEAM MEMBER (ROBUSTE) ---
@app.put("/team/{user_id}")
def update_team_member(
    user_id: int, 
    user_up: schemas.UserUpdateAdmin, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(security.get_current_user)
):
    if not current_user.company_id:
        raise HTTPException(400, "Pas d'entreprise")
    
    user_to_edit = db.query(models.User).filter(
        models.User.id == user_id, 
        models.User.company_id == current_user.company_id
    ).first()
    
    if not user_to_edit:
        raise HTTPException(404, "Utilisateur introuvable")

    # On utilise exclude_unset pour ne modifier que ce qui est envoyé
    update_data = user_up.dict(exclude_unset=True)

    if "full_name" in update_data: user_to_edit.full_name = update_data["full_name"]
    # Compatibilité 'nom' si votre modèle utilise 'nom' au lieu de 'full_name'
    if hasattr(user_to_edit, 'nom') and "full_name" in update_data: user_to_edit.nom = update_data["full_name"]
    
    if "email" in update_data and update_data["email"]: user_to_edit.email = update_data["email"]
    if "role" in update_data and update_data["role"]: user_to_edit.role = update_data["role"]
    
    if "password" in update_data and update_data["password"]:
        user_to_edit.hashed_password = security.get_password_hash(update_data["password"])

    db.commit()
    return {"message": "Profil mis à jour avec succès ✅"}

# ==========================================
# 3. DASHBOARD
# ==========================================
from datetime import datetime, timedelta # Assurez-vous d'avoir ces imports

# ...

@app.get("/dashboard/stats")
def get_stats(db: Session = Depends(get_db)):
    try:
        # --- 1. KPIs GÉNÉRAUX ---
        total = db.query(models.Chantier).count()
        actifs = db.query(models.Chantier).filter(models.Chantier.est_actif == True).count()
        rap = db.query(models.Rapport).count()
        alert = db.query(models.Rapport).filter(models.Rapport.niveau_urgence.in_(['Critique', 'Moyen'])).count()
        mat_sorti = db.query(models.Materiel).filter(models.Materiel.chantier_id != None).count()

        # --- 2. NOUVEAUX KPIs (Avec sécurité si table inexistante) ---
        try:
            # Compte les permis (si vous avez renommé la table en _v2, assurez-vous que le modèle pointe dessus)
            nb_permis = db.query(models.PermisFeu).count()
        except:
            nb_permis = 0

        try:
            # Compte les tâches à faire
            nb_tasks = db.query(models.Task).filter(models.Task.status == 'TODO').count()
        except:
            nb_tasks = 0

        # --- 3. GRAPHIQUE (7 derniers jours) ---
        today = datetime.now().date()
        labels, values = [], []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            labels.append(day.strftime("%d/%m"))
            start = datetime.combine(day, datetime.min.time())
            end = datetime.combine(day, datetime.max.time())
            cnt = db.query(models.Rapport).filter(models.Rapport.date_creation >= start, models.Rapport.date_creation <= end).count()
            values.append(cnt)

        # --- 4. ACTIVITÉ RÉCENTE ---
        recents = db.query(models.Rapport).order_by(models.Rapport.date_creation.desc()).limit(5).all()
        rec_fmt = []
        for r in recents:
            c_nom = r.chantier.nom if r.chantier else "Chantier Inconnu"
            rec_fmt.append({
                "titre": r.titre, 
                "date_creation": r.date_creation, 
                "chantier_nom": c_nom, 
                "niveau_urgence": r.niveau_urgence
            })

        # --- 5. CARTE (Géolocalisation) ---
        map_data = []
        chantiers = db.query(models.Chantier).filter(models.Chantier.est_actif == True).all()
        for c in chantiers:
            lat, lng = c.latitude, c.longitude
            # Si pas de GPS sur le chantier, on prend le dernier rapport géolocalisé
            if not lat:
                last_gps = db.query(models.Rapport).filter(models.Rapport.chantier_id == c.id, models.Rapport.latitude != None).first()
                if last_gps:
                    lat, lng = last_gps.latitude, last_gps.longitude
            
            if lat and lng:
                map_data.append({"id": c.id, "nom": c.nom, "client": c.client, "lat": lat, "lng": lng})

        return {
            "kpis": {
                "total_chantiers": total, 
                "actifs": actifs, 
                "rapports": rap, 
                "alertes": alert,
                "materiel_sorti": mat_sorti,
                "permis_feu": nb_permis, # 👈 Nouveau
                "taches_todo": nb_tasks  # 👈 Nouveau
            },
            "chart": { "labels": labels, "values": values },
            "recents": rec_fmt,
            "map": map_data
        }

    except Exception as e:
        print(f"❌ Erreur Dashboard Stats: {str(e)}")
        # On retourne une structure vide pour ne pas faire planter le front
        return {
            "kpis": {"total_chantiers": 0, "actifs": 0, "rapports": 0, "alertes": 0, "materiel_sorti": 0},
            "chart": {"labels": [], "values": []},
            "recents": [],
            "map": []
        }

# ==========================================
# 4. CHANTIERS
# ==========================================
@app.post("/chantiers", response_model=schemas.ChantierOut)
def create_chantier(chantier: schemas.ChantierCreate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    lat, lng = None, None
    if chantier.adresse:
        lat, lng = get_gps_from_address(chantier.adresse)
    
    # Gestion des dates (parfois reçues en string vide ou mal formatée)
    d_debut = chantier.date_debut
    d_fin = chantier.date_fin
    
    # Si c'est None ou vide, on met une date par défaut
    if not d_debut: d_debut = datetime.now()
    if not d_fin: d_fin = datetime.now() + timedelta(days=30)
    
    # Si c'est une string, on essaie de parser
    if isinstance(d_debut, str):
         try: d_debut = datetime.fromisoformat(d_debut[:10])
         except: d_debut = datetime.now()
    
    if isinstance(d_fin, str):
         try: d_fin = datetime.fromisoformat(d_fin[:10])
         except: d_fin = datetime.now() + timedelta(days=30)

    new_c = models.Chantier(
        nom=chantier.nom, adresse=chantier.adresse, client=chantier.client, cover_url=None, # Cover URL non présent dans create
        company_id=current_user.company_id,
        date_debut=d_debut,
        date_fin=d_fin,
        latitude=lat, longitude=lng,
        soumis_sps=False # Valeur par défaut
    )
    db.add(new_c); db.commit(); db.refresh(new_c)
    return new_c

# --- ROUTE CHANTIERS (ROBUST VERSION) ---
@app.get("/chantiers", response_model=List[schemas.ChantierOut])
def read_chantiers(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    try:
        # On récupère tout sans filtrer d'abord pour éviter les erreurs de requête
        query = db.query(models.Chantier)
        if current_user.company_id:
            query = query.filter(models.Chantier.company_id == current_user.company_id)
            
        raw_rows = query.offset(skip).limit(limit).all()
        valid_rows = []

        for row in raw_rows:
            try:
                # Construction manuelle sécurisée
                # On utilise 'or' pour fournir des valeurs par défaut si None
                valid_rows.append(schemas.ChantierOut(
                    id=row.id,
                    nom=row.nom or "Sans nom",
                    adresse=row.adresse,
                    client=row.client,
                    date_debut=row.date_debut, # Le schéma accepte Any
                    date_fin=row.date_fin,     # Le schéma accepte Any
                    est_actif=True if row.est_actif is None else row.est_actif,
                    cover_url=row.cover_url,
                    company_id=row.company_id,
                    signature_url=row.signature_url,
                    date_creation=row.date_creation
                ))
            except Exception as e:
                print(f"⚠️ Chantier {row.id} ignoré (donnée corrompue): {e}")
                continue # On passe au suivant sans planter
                
        return valid_rows

    except Exception as e:
        print(f"❌ CRITICAL ERROR /chantiers: {str(e)}")
        return [] # On renvoie une liste vide au pire, pas une erreur 500

@app.get("/chantiers/{chantier_id}", response_model=schemas.ChantierOut)
def read_chantier(chantier_id: int, db: Session = Depends(get_db)):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not chantier: raise HTTPException(status_code=404, detail="Chantier introuvable")
    return chantier

# --- UPDATE CHANTIER (ROBUSTE) ---
@app.put("/chantiers/{cid}", response_model=schemas.ChantierOut)
def update_chantier(cid: int, chantier: schemas.ChantierUpdate, db: Session = Depends(get_db)):
    db_chantier = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not db_chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")

    # On convertit le modèle Pydantic en dictionnaire en excluant les valeurs nulles
    update_data = chantier.dict(exclude_unset=True)

    for key, value in update_data.items():
        # Gestion spécifique des dates
        if key in ["date_debut", "date_fin"]:
            if value == "" or value is None:
                setattr(db_chantier, key, None)
            elif isinstance(value, str):
                try:
                    # On essaie de convertir la string ISO en date Python
                    # On coupe à 10 chars pour garder YYYY-MM-DD si c'est un datetime complet
                    setattr(db_chantier, key, datetime.fromisoformat(value[:10]).date())
                except:
                    # Si ça échoue, on ignore ou on met None
                    pass
            else:
                setattr(db_chantier, key, value)
        
        # Gestion spécifique de 'est_actif'
        elif key == "est_actif":
            if isinstance(value, str):
                setattr(db_chantier, key, value.lower() == 'true')
            else:
                setattr(db_chantier, key, bool(value))
                
        # Gestion GPS auto si adresse change
        elif key == "adresse" and value != db_chantier.adresse:
            db_chantier.adresse = value
            lat, lng = get_gps_from_address(value)
            db_chantier.latitude = lat
            db_chantier.longitude = lng
            
        # Cas général (Texte)
        else:
            setattr(db_chantier, key, value)

    db.commit()
    db.refresh(db_chantier)
    return db_chantier

@app.delete("/chantiers/{cid}")
def delete_chantier(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    db.query(models.Materiel).filter(models.Materiel.chantier_id == cid).update({"chantier_id": None})
    db.query(models.RapportImage).filter(models.RapportImage.rapport.has(chantier_id=cid)).delete(synchronize_session=False)
    db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).delete()
    db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).delete()
    db.query(models.PPSPS).filter(models.PPSPS.chantier_id == cid).delete()
    db.query(models.PIC).filter(models.PIC.chantier_id == cid).delete()
    db.query(models.PlanPrevention).filter(models.PlanPrevention.chantier_id == cid).delete()
    db.delete(c); db.commit()
    return {"status": "deleted"}

@app.put("/chantiers/{cid}/signature")
def sign_chantier(cid: int, signature_url: str, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404, "Introuvable")
    c.signature_url = signature_url
    db.commit()
    return {"status": "signed"}

@app.post("/chantiers/import")
async def import_chantiers_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith('.csv'): raise HTTPException(400, "Non CSV")
    try:
        content = await file.read()
        try: text_content = content.decode('utf-8-sig')
        except: text_content = content.decode('latin-1')
        lines = text_content.splitlines()
        delimiter = ';' if ';' in lines[0] else ','
        reader = csv.DictReader(lines, delimiter=delimiter)
        
        company = db.query(models.Company).first()
        cid = company.id if company else None
        count = 0
        
        for row in reader:
            row = {k.strip(): v.strip() for k, v in row.items() if k}
            nom = None
            for k, v in row.items():
                if 'nom' in k.lower(): nom = v
            
            if nom:
                client = "Inconnu"; adresse = "-"
                for k, v in row.items():
                    if 'client' in k.lower(): client = v
                    if 'adresse' in k.lower(): adresse = v
                
                lat, lng = None, None
                if len(adresse) > 5:
                    lat, lng = get_gps_from_address(adresse)
                    time.sleep(1) 

                db.add(models.Chantier(
                    nom=nom, client=client, adresse=adresse, est_actif=True, company_id=cid,
                    date_creation=datetime.now(), date_debut=datetime.now(), date_fin=datetime.now()+timedelta(days=30),
                    signature_url=None, cover_url=None, latitude=lat, longitude=lng, soumis_sps=False
                ))
                count += 1
        db.commit()
        return {"status": "success", "message": f"{count} chantiers importés !"}
    except Exception as e:
        db.rollback(); raise HTTPException(500, f"Erreur: {str(e)}")

# ==========================================
# 5. MATERIEL
# ==========================================
@app.post("/materiels", response_model=schemas.MaterielOut)
def create_materiel(mat: schemas.MaterielCreate, db: Session = Depends(get_db)):
    # Gestion de la date reçue
    d_vgp = mat.date_derniere_vgp
    if isinstance(d_vgp, str) and d_vgp.strip():
        try: d_vgp = datetime.fromisoformat(d_vgp[:10])
        except: d_vgp = None
    else:
        d_vgp = None # Pas de date par défaut si rien n'est envoyé

    new_m = models.Materiel(
        nom=mat.nom, 
        reference=mat.reference, 
        etat=mat.etat, 
        image_url=mat.image_url,
        date_derniere_vgp=d_vgp # 👈 On enregistre la vraie date
    )
    db.add(new_m); db.commit(); db.refresh(new_m)
    return new_m

# --- ROUTE MATERIELS (VERSION RÉELLE - SANS SIMULATION) ---
@app.get("/materiels", response_model=List[schemas.MaterielOut])
def read_materiels(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    try:
        raw_rows = db.query(models.Materiel).offset(skip).limit(limit).all()
        valid_rows = []
        today = datetime.now()

        for row in raw_rows:
            try:
                # 1. Récupération de la VRAIE date (pas de simulation)
                date_vgp = getattr(row, "date_derniere_vgp", None)
                statut = "INCONNU" # Par défaut, c'est gris

                # 2. Si une date existe, on calcule le vrai statut
                if date_vgp:
                    # Sécurisation format
                    if isinstance(date_vgp, str):
                        try: date_vgp = datetime.fromisoformat(str(date_vgp))
                        except: date_vgp = None
                    
                    if date_vgp:
                        prochaine = date_vgp + timedelta(days=365) # Règle 1 an
                        delta = (prochaine - today).days
                        
                        if delta < 0: statut = "NON CONFORME"
                        elif delta < 30: statut = "A PREVOIR"
                        else: statut = "CONFORME"

                # 3. Construction objet
                ref_value = getattr(row, "reference", getattr(row, "ref_interne", None))

                mat_out = schemas.MaterielOut(
                    id=row.id,
                    nom=row.nom or "Sans nom",
                    reference=ref_value,
                    etat=getattr(row, "etat", "Bon"),
                    chantier_id=row.chantier_id,
                    date_derniere_vgp=date_vgp,
                    image_url=row.image_url,
                    statut_vgp=statut # Le vrai statut calculé
                )
                valid_rows.append(mat_out)

            except Exception as e:
                print(f"⚠️ Erreur mapping matériel {row.id}: {e}")
                continue

        return valid_rows

    except Exception as e:
        print(f"❌ CRITICAL ERROR /materiels: {str(e)}")
        return []

@app.put("/materiels/{mid}/transfert")
def transfer_materiel(mid: int, chantier_id: Optional[int] = None, db: Session = Depends(get_db)):
    m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not m: raise HTTPException(404)
    m.chantier_id = chantier_id
    db.commit()
    return {"status": "moved"}

# --- UPDATE MATERIEL (ROBUSTE) ---
@app.put("/materiels/{mid}", response_model=schemas.MaterielOut)
def update_materiel(mid: int, mat: schemas.MaterielUpdate, db: Session = Depends(get_db)):
    db_mat = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not db_mat:
        raise HTTPException(status_code=404, detail="Matériel introuvable")

    update_data = mat.dict(exclude_unset=True)

    for key, value in update_data.items():
        # Gestion de la confusion reference/ref_interne
        if key == "reference" and value:
            # On vérifie quel champ existe en BDD (sqlite vs pg)
            if hasattr(db_mat, 'reference'): db_mat.reference = value
            elif hasattr(db_mat, 'ref_interne'): db_mat.ref_interne = value
            
        elif key == "chantier_id":
            # Si on reçoit une chaine vide ou 0, on met NULL (retour dépôt)
            if value == "" or value == 0:
                db_mat.chantier_id = None
            else:
                db_mat.chantier_id = value
        
        # 👇 AJOUTEZ CECI : Gestion de la date VGP
        elif key == "date_derniere_vgp":
            if value and isinstance(value, str):
                try: setattr(db_mat, key, datetime.fromisoformat(value[:10]))
                except: pass
            else:
                setattr(db_mat, key, value)

        # On ignore 'statut_vgp' car c'est calculé
        elif key == "statut_vgp":
            pass
            
        else:
            if hasattr(db_mat, key):
                setattr(db_mat, key, value)

    db.commit()
    db.refresh(db_mat)
    
    # On recalcule le statut VGP à la volée pour le renvoyer correct
    # (Copie simplifiée de la logique de lecture)
    if hasattr(db_mat, 'date_derniere_vgp') and db_mat.date_derniere_vgp:
        prochaine = db_mat.date_derniere_vgp + timedelta(days=365)
        delta = (prochaine - datetime.now()).days
        statut = "CONFORME"
        if delta < 0: statut = "NON CONFORME"
        elif delta < 30: statut = "A PREVOIR"
        setattr(db_mat, "statut_vgp", statut)
    else:
        setattr(db_mat, "statut_vgp", "INCONNU")

    return db_mat

@app.delete("/materiels/{mid}")
def delete_materiel(mid: int, db: Session = Depends(get_db)):
    m = db.query(models.Materiel).filter(models.Materiel.id == mid).first()
    if not m: raise HTTPException(404)
    db.delete(m); db.commit()
    return {"status": "success"}

@app.post("/materiels/import")
async def import_materiels_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith('.csv'): raise HTTPException(400, "Non CSV")
    try:
        content = await file.read()
        try: text = content.decode('utf-8')
        except: text = content.decode('latin-1')
        lines = text.splitlines()
        delimiter = ';' if ';' in lines[0] else ','
        reader = csv.DictReader(lines, delimiter=delimiter)
        company = db.query(models.Company).first()
        cid = company.id if company else None
        count = 0
        for row in reader:
            row = {k.strip(): v.strip() for k, v in row.items() if k}
            nom = row.get('Nom') or row.get('nom')
            ref = row.get('Reference') or row.get('reference')
            if nom and ref:
                etat = row.get('Etat') or 'Bon'
                db.add(models.Materiel(nom=nom, reference=ref, etat=etat, company_id=cid, chantier_id=None))
                count += 1
        db.commit()
        return {"status": "success", "message": f"{count} équipements importés !"}
    except Exception as e:
        db.rollback(); raise HTTPException(500, str(e))

# ==========================================
# 6. RAPPORTS & IMAGES
# ==========================================
@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        res = cloudinary.uploader.upload(file.file, folder="conformeo_chantiers")
        return {"url": res.get("secure_url")}
    except Exception as e: raise HTTPException(500, str(e))

@app.post("/rapports", response_model=schemas.RapportOut)
def create_rapport(r: schemas.RapportCreate, db: Session = Depends(get_db)):
    new_r = models.Rapport(
        titre=r.titre, description=r.description, chantier_id=r.chantier_id,
        niveau_urgence=r.niveau_urgence, latitude=r.latitude, longitude=r.longitude,
        photo_url=r.photo_url # Ajusté car schema utilise photo_url
    )
    db.add(new_r); db.commit(); db.refresh(new_r)
    # Gestion images multiples si supporté
    if hasattr(r, 'image_urls') and r.image_urls:
         for u in r.image_urls: db.add(models.RapportImage(url=u, rapport_id=new_r.id))
         db.commit(); db.refresh(new_r)
    return new_r

@app.get("/chantiers/{cid}/rapports", response_model=List[schemas.RapportOut])
def read_rapports_chantier(cid: int, db: Session = Depends(get_db)):
    return db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).all()

# ==========================================
# 7. INSPECTIONS / PPSPS / PDP / PIC
# ==========================================
@app.post("/inspections", response_model=schemas.InspectionOut)
def create_inspection(i: schemas.InspectionCreate, db: Session = Depends(get_db)):
    new_i = models.Inspection(
        titre=i.titre, type=i.type, data=i.data, chantier_id=i.chantier_id, createur=i.createur
    )
    db.add(new_i); db.commit(); db.refresh(new_i)
    return new_i

@app.get("/chantiers/{chantier_id}/inspections", response_model=List[schemas.InspectionOut])
def read_inspections(
    chantier_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    # 1. Check if chantier exists
    chantier = db.query(models.Chantier).filter(models.Chantier.id == chantier_id).first()
    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")

    # 2. Retrieve inspections
    inspections = db.query(models.Inspection).filter(models.Inspection.chantier_id == chantier_id).all()
    
    return inspections

@app.get("/inspections/{iid}/pdf")
def download_inspection_pdf(iid: int, db: Session = Depends(get_db)):
    i = db.query(models.Inspection).filter(models.Inspection.id == iid).first()
    if not i: raise HTTPException(404)
    c = db.query(models.Chantier).filter(models.Chantier.id == i.chantier_id).first()
    comp = get_company_for_chantier(db, c.id)
    path = f"uploads/Audit_{iid}.pdf"
    pdf_generator.generate_audit_pdf(c, i, path, company=comp)
    return FileResponse(path, media_type='application/pdf')

@app.post("/ppsps", response_model=schemas.PPSPSOut)
def create_ppsps(p: schemas.PPSPSCreate, db: Session = Depends(get_db)):
    new_p = models.PPSPS(
        chantier_id=p.chantier_id, maitre_ouvrage=p.maitre_ouvrage,
        coordonnateur_sps=p.coordonnateur_sps, responsable_chantier=p.responsable_chantier,
        nb_compagnons=p.nb_compagnons, horaires=p.horaires,
        secours_data=p.secours_data, taches_data=p.taches_data
    )
    db.add(new_p); db.commit(); db.refresh(new_p)
    return new_p

@app.get("/chantiers/{cid}/ppsps", response_model=List[schemas.PPSPSOut])
def read_ppsps(cid: int, db: Session = Depends(get_db)):
    return db.query(models.PPSPS).filter(models.PPSPS.chantier_id == cid).all()

@app.get("/ppsps/{pid}/pdf")
def download_ppsps_pdf(pid: int, db: Session = Depends(get_db)):
    p = db.query(models.PPSPS).filter(models.PPSPS.id == pid).first()
    if not p: raise HTTPException(404)
    c = db.query(models.Chantier).filter(models.Chantier.id == p.chantier_id).first()
    comp = get_company_for_chantier(db, c.id)
    path = f"uploads/PPSPS_{pid}.pdf"
    pdf_generator.generate_ppsps_pdf(c, p, path, company=comp)
    return FileResponse(path, media_type='application/pdf')

@app.get("/chantiers/{cid}/plans-prevention", response_model=List[schemas.PlanPreventionOut])
def read_pdps(cid: int, db: Session = Depends(get_db)):
    return db.query(models.PlanPrevention).filter(models.PlanPrevention.chantier_id == cid).all()

@app.post("/plans-prevention", response_model=schemas.PlanPreventionOut)
def create_pdp(p: schemas.PlanPreventionCreate, db: Session = Depends(get_db)):
    new_p = models.PlanPrevention(
        chantier_id=p.chantier_id,
        entreprise_utilisatrice=p.entreprise_utilisatrice,
        entreprise_exterieure=p.entreprise_exterieure,
        date_inspection_commune=p.date_inspection_commune,
        risques_interferents=p.risques_interferents,
        consignes_securite=p.consignes_securite
    )
    db.add(new_p); db.commit(); db.refresh(new_p)
    return new_p

@app.get("/plans-prevention/{pid}/pdf")
def download_pdp_pdf(pid: int, db: Session = Depends(get_db)):
    p = db.query(models.PlanPrevention).filter(models.PlanPrevention.id == pid).first()
    if not p: raise HTTPException(404)
    c = db.query(models.Chantier).filter(models.Chantier.id == p.chantier_id).first()
    comp = get_company_for_chantier(db, c.id)
    path = f"uploads/PdP_{pid}.pdf"
    pdf_generator.generate_pdp_pdf(c, p, path, company=comp)
    return FileResponse(path, media_type='application/pdf')

# PIC
@app.get("/chantiers/{cid}/pic")
def get_pic(cid: int, db: Session = Depends(get_db)):
    pic = db.query(models.PIC).filter(models.PIC.chantier_id == cid).first()
    if not pic: return {} 
    return pic

@app.post("/chantiers/{cid}/pic")
def save_pic(cid: int, pic: schemas.PicSchema, db: Session = Depends(get_db)):
    existing_pic = db.query(models.PIC).filter(models.PIC.chantier_id == cid).first()
    # Gestion elements_data qui peut être dict/list ou str
    elements_str = None
    # Si le modèle attend 'drawing_data' (comme dans le schéma PicSchema), adaptez ici
    data_source = getattr(pic, 'drawing_data', getattr(pic, 'elements_data', None))
    
    if data_source is not None:
        if isinstance(data_source, (list, dict)):
            elements_str = json.dumps(data_source)
        else:
            elements_str = str(data_source)

    if existing_pic:
        # Adaptation selon modèle DB
        if hasattr(existing_pic, 'background_url'): existing_pic.background_url = pic.final_url # Ou autre champ
        if hasattr(existing_pic, 'final_url'): existing_pic.final_url = pic.final_url
        if hasattr(existing_pic, 'elements_data'): existing_pic.elements_data = elements_str
        # Pas de champs détaillés (acces, clotures...) dans le schema PicSchema fourni
        # On les ignore ou on adapte si le modèle DB les a
    else:
        new_pic = models.PIC(
            chantier_id=cid,
            final_url=pic.final_url,
            elements_data=elements_str,
            date_creation=datetime.now()
        )
        db.add(new_pic)
    
    db.commit()
    return {"message": "PIC sauvegardé avec succès !"}

# ==========================================
# 8. DOCUMENTS EXTERNES, ENTREPRISE & DOE
# ==========================================
@app.post("/chantiers/{cid}/documents", response_model=schemas.DocExterneOut)
def upload_external_doc(cid: int, titre: str, categorie: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        res = cloudinary.uploader.upload(file.file, folder="conformeo_docs", resource_type="auto")
        url = res.get("secure_url")
    except Exception as e: raise HTTPException(500, f"Erreur Upload: {e}")
    sql = text("INSERT INTO documents_externes (titre, categorie, url, chantier_id, date_ajout) VALUES (:t, :c, :u, :cid, :d) RETURNING id")
    result = db.execute(sql, {"t": titre, "c": categorie, "u": url, "cid": cid, "d": datetime.now()})
    new_id = result.fetchone()[0]
    db.commit()
    return {"id": new_id, "titre": titre, "categorie": categorie, "url": url, "date_ajout": datetime.now()}

@app.get("/chantiers/{cid}/documents", response_model=List[schemas.DocExterneOut])
def get_external_docs(cid: int, db: Session = Depends(get_db)):
    sql = text("SELECT id, titre, categorie, url, date_ajout FROM documents_externes WHERE chantier_id = :cid")
    result = db.execute(sql, {"cid": cid}).fetchall()
    return [{"id": r[0], "titre": r[1], "categorie": r[2], "url": r[3], "date_ajout": r[4]} for r in result]

@app.delete("/documents/{did}")
def delete_external_doc(did: int, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM documents_externes WHERE id = :did"), {"did": did})
    db.commit()
    return {"status": "deleted"}

from fastapi.staticfiles import StaticFiles # <--- Important pour voir le logo

# Ajoutez ceci si ce n'est pas déjà fait pour lire les images stockées
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# 1. Route pour mettre à jour les infos (Texte uniquement)
# --- UPDATE COMPANY (ROBUSTE) ---
@app.put("/companies/me", response_model=schemas.CompanyOut)
def update_company(
    comp_update: schemas.CompanyUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(security.get_current_user)
):
    if not current_user.company_id: 
        raise HTTPException(400, "Utilisateur sans entreprise")
    
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    if not company: raise HTTPException(404, "Entreprise introuvable")

    # On vérifie chaque champ. Si le frontend envoie 'null', on l'ignore pour ne pas écraser la DB avec du vide.
    if comp_update.name: company.name = comp_update.name
    if comp_update.address: company.address = comp_update.address
    if comp_update.phone: company.phone = comp_update.phone
    
    # Mapping spécial : contact_email (JSON) -> email (DB)
    if comp_update.contact_email: 
        company.email = comp_update.contact_email
    
    try:
        db.commit()
        db.refresh(company)
        return company
    except Exception as e:
        db.rollback()
        print(f"❌ ERREUR SQL: {e}") 
        raise HTTPException(status_code=500, detail="Erreur serveur lors de la sauvegarde")

# 2. Route SPÉCIALE pour le logo (Upload)
@app.post("/companies/me/logo")
def upload_logo(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(security.get_current_user)
):
    if not current_user.company_id: raise HTTPException(400, "Pas d'entreprise")
    
    # 1. Création du dossier uploads s'il n'existe pas
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
    
    # 2. Nom de fichier propre et unique (force l'extension .png pour simplifier)
    # On ajoute un timestamp pour éviter que le navigateur garde l'ancien logo en cache
    import time
    timestamp = int(time.time())
    filename = f"logo_{current_user.company_id}_{timestamp}.png"
    file_location = f"uploads/{filename}"
    
    # 3. Sauvegarde physique
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
    
    # 4. Mise à jour Base de données
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    
    # Si on avait un ancien logo, on pourrait le supprimer ici pour nettoyer, mais gardons simple
    company.logo_url = file_location 
    db.commit()
    db.refresh(company)
    
    # Retourne l'URL relative que le frontend pourra utiliser
    return {"url": file_location}

@app.post("/companies/me/documents", response_model=schemas.CompanyDocOut)
def upload_company_doc(
    titre: str, type_doc: str, date_expiration: Optional[str] = None, 
    file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)
):
    if not current_user.company_id: raise HTTPException(400, "Pas d'entreprise")
    try:
        res = cloudinary.uploader.upload(file.file, folder="conformeo_company_docs", resource_type="auto")
        url = res.get("secure_url")
    except Exception as e: raise HTTPException(500, f"Erreur Upload: {e}")
    exp_date = None
    if date_expiration and date_expiration != "undefined" and date_expiration != "null":
        try: exp_date = datetime.strptime(date_expiration, "%Y-%m-%d")
        except ValueError: raise HTTPException(400, "Invalid date format")
    
    sql = text("INSERT INTO company_documents (company_id, titre, type_doc, url, date_expiration, date_upload) VALUES (:cid, :t, :type, :u, :exp, :now) RETURNING id, date_upload")
    res = db.execute(sql, {"cid": current_user.company_id, "t": titre, "type": type_doc, "u": url, "exp": exp_date, "now": datetime.now()}).fetchone()
    db.commit()
    return {"id": res[0], "titre": titre, "type_doc": type_doc, "url": url, "date_expiration": exp_date, "date_upload": res[1]}

@app.get("/companies/me/documents", response_model=List[schemas.CompanyDocOut])
def get_company_docs(db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    if not current_user.company_id: return []
    sql = text("SELECT id, titre, type_doc, url, date_expiration, date_upload FROM company_documents WHERE company_id = :cid ORDER BY type_doc")
    results = db.execute(sql, {"cid": current_user.company_id}).fetchall()
    return [{"id": r[0], "titre": r[1], "type_doc": r[2], "url": r[3], "date_expiration": r[4], "date_upload": r[5]} for r in results]

@app.delete("/companies/me/documents/{doc_id}")
def delete_company_doc(doc_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    check = text("SELECT id FROM company_documents WHERE id = :did AND company_id = :cid")
    if not db.execute(check, {"did": doc_id, "cid": current_user.company_id}).first(): raise HTTPException(404, "Introuvable")
    db.execute(text("DELETE FROM company_documents WHERE id = :did"), {"did": doc_id})
    db.commit()
    return {"status": "deleted"}

@app.get("/chantiers/{cid}/pdf")
def download_pdf(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404)
    raps = db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).all()
    inss = db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).all()
    comp = get_company_for_chantier(db, cid)
    path = f"uploads/J_{cid}.pdf"
    pdf_generator.generate_pdf(c, raps, inss, path, company=comp)
    return FileResponse(path, media_type='application/pdf')

@app.get("/chantiers/{cid}/doe")
def download_doe(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404, "Chantier introuvable")
    comp = get_company_for_chantier(db, cid)
    
    os.makedirs("uploads", exist_ok=True)
    zip_name = f"uploads/DOE_{c.nom.replace(' ', '_')}.zip"
    
    with zipfile.ZipFile(zip_name, 'w') as z:
        folder_suivi = "01_Suivi_Conformeo/"
        try:
            raps = db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).all()
            inss = db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).all()
            j_path = f"uploads/Journal_{c.id}.pdf"
            pdf_generator.generate_pdf(c, raps, inss, j_path, company=comp)
            z.write(j_path, f"{folder_suivi}Journal.pdf")
        except Exception as e: print(f"Erreur Journal: {e}")

        docs_externes = db.execute(text("SELECT titre, categorie, url FROM documents_externes WHERE chantier_id = :cid"), {"cid": cid}).fetchall()
        map_dossiers = {
            'PLANS': "02_Plans", 'NOTICES': "03_Notices", 
            'MAINTENANCE': "04_Maintenance", 'GARANTIES': "05_Garanties", 
            'DECHETS': "06_Dechets", 'AUTRE': "07_Divers"
        }
        for doc in docs_externes:
            try:
                titre, cat, url = doc[0], doc[1], doc[2]
                folder = map_dossiers.get(cat, "07_Divers")
                safe_titre = "".join([x for x in titre if x.isalnum() or x in (' ', '-', '_')]).strip()
                ext = url.split('.')[-1]
                if len(ext) > 4: ext = "pdf"
                r = requests.get(url, timeout=10)
                if r.status_code == 200:
                    tmp = f"uploads/tmp_{safe_titre}.{ext}"
                    with open(tmp, "wb") as f: f.write(r.content)
                    z.write(tmp, f"{folder}/{safe_titre}.{ext}")
                    os.remove(tmp)
            except Exception as e: print(f"Erreur doc {titre}: {e}")

    return FileResponse(zip_name, filename=f"DOE_{c.nom}.zip", media_type='application/zip')

@app.post("/chantiers/{cid}/send-email")
async def send_journal_email(cid: int, email_dest: str, db: Session = Depends(get_db)):
    c = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not c: raise HTTPException(404, "Chantier introuvable")
    raps = db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).all()
    inss = db.query(models.Inspection).filter(models.Inspection.chantier_id == cid).all()
    comp = get_company_for_chantier(db, c.id)

    filename = f"Journal_{c.nom}_{datetime.now().strftime('%Y%m%d')}.pdf"
    filename = "".join([x for x in filename if x.isalpha() or x.isdigit() or x in (' ', '.', '_')]).strip()
    path = f"uploads/{filename}"
    pdf_generator.generate_pdf(c, raps, inss, path, company=comp)

    html = f"""
    <p>Bonjour,</p>
    <p>Veuillez trouver ci-joint le <b>Journal de Bord</b> et le suivi d'avancement pour le chantier <b>{c.nom}</b>.</p>
    <p>Cordialement,<br>{comp.name if comp else "L'équipe"}</p>
    """
    message = MessageSchema(subject=f"Suivi Chantier - {c.nom}", recipients=[email_dest], body=html, subtype=MessageType.html, attachments=[path])
    fm = FastMail(mail_conf)
    try:
        await fm.send_message(message)
        return {"message": "Journal envoyé au client ! 🚀"}
    except Exception as e:
        print(e); raise HTTPException(500, "Erreur envoi email")

@app.post("/plans-prevention/{pid}/send-email")
async def send_pdp_email(pid: int, email_dest: str, db: Session = Depends(get_db)):
    p = db.query(models.PlanPrevention).filter(models.PlanPrevention.id == pid).first()
    if not p: raise HTTPException(404, "PdP introuvable")
    c = db.query(models.Chantier).filter(models.Chantier.id == p.chantier_id).first()
    comp = get_company_for_chantier(db, c.id)

    filename = f"PdP_{c.nom}_{datetime.now().strftime('%Y%m%d')}.pdf"
    filename = "".join([c for c in filename if c.isalpha() or c.isdigit() or c in (' ', '.', '_')]).strip()
    path = f"uploads/{filename}"
    pdf_generator.generate_pdp_pdf(c, p, path, company=comp)

    html = f"""
    <p>Bonjour,</p>
    <p>Veuillez trouver ci-joint le <b>Plan de Prévention</b> concernant le chantier <b>{c.nom}</b>.</p>
    <p>Cordialement,<br>{comp.name if comp else "L'équipe"}</p>
    """
    message = MessageSchema(subject=f"Plan de Prévention - {c.nom}", recipients=[email_dest], body=html, subtype=MessageType.html, attachments=[path])
    fm = FastMail(mail_conf)
    try:
        await fm.send_message(message)
        return {"message": "Email envoyé avec succès ! 📧"}
    except Exception as e:
        print(e); raise HTTPException(500, "Erreur lors de l'envoi de l'email")

@app.get("/companies/me", response_model=schemas.CompanyOut)
def read_own_company(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(security.get_current_user)
):
    if not current_user.company_id:
        # Si l'utilisateur n'a pas d'entreprise, on renvoie une 404 que le frontend gérera
        raise HTTPException(status_code=404, detail="Aucune entreprise liée")
        
    company = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise introuvable")
        
    return company

@app.post("/companies/me/duerp", response_model=schemas.DUERPOut)
def create_or_update_duerp(duerp_data: schemas.DUERPCreate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    if not current_user.company_id: raise HTTPException(400, "Pas d'entreprise")
    
    # On cherche s'il existe déjà un DUERP pour cette année
    existing = db.query(models.DUERP).filter(
        models.DUERP.company_id == current_user.company_id, 
        models.DUERP.annee == duerp_data.annee
    ).first()

    if existing:
        # On supprime les anciennes lignes pour remettre les nouvelles (Mise à jour simple)
        db.query(models.DUERPLigne).filter(models.DUERPLigne.duerp_id == existing.id).delete()
        existing.date_mise_a_jour = datetime.now()
        db_duerp = existing
    else:
        db_duerp = models.DUERP(company_id=current_user.company_id, annee=duerp_data.annee)
        db.add(db_duerp)
        db.commit()
        db.refresh(db_duerp)

    # Ajout des lignes
    for l in duerp_data.lignes:
        new_line = models.DUERPLigne(
            duerp_id=db_duerp.id,
            tache=l.tache, risque=l.risque, gravite=l.gravite,
            mesures_realisees=l.mesures_realisees, mesures_a_realiser=l.mesures_a_realiser
        )
        db.add(new_line)
    
    db.commit()
    return db_duerp

@app.get("/companies/me/duerp/{annee}", response_model=schemas.DUERPOut)
def get_duerp(annee: str, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    d = db.query(models.DUERP).filter(models.DUERP.company_id == current_user.company_id, models.DUERP.annee == annee).first()
    if not d: return {"id": 0, "annee": annee, "date_mise_a_jour": datetime.now(), "lignes": []}
    return d

@app.get("/companies/me/duerp/{annee}/pdf")
def download_duerp_pdf(annee: str, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    # 1. Récupération des données
    d = db.query(models.DUERP).filter(models.DUERP.company_id == current_user.company_id, models.DUERP.annee == annee).first()
    if not d: raise HTTPException(404, "DUERP introuvable")
    
    comp = db.query(models.Company).filter(models.Company.id == current_user.company_id).first()
    
    # 2. Création du dossier uploads s'il n'existe pas (Important sur Render)
    if not os.path.exists("uploads"):
        os.makedirs("uploads")

    # 3. Génération
    filename = f"DUERP_{comp.name.replace(' ', '_')}_{annee}.pdf"
    path = f"uploads/{filename}"
    
    pdf_generator.generate_duerp_pdf(comp, d, path)
    
    # 4. Envoi
    return FileResponse(path, media_type='application/pdf', filename=filename)

# --- ROUTES TÂCHES ---

@app.get("/chantiers/{chantier_id}/tasks", response_model=List[schemas.TaskOut])
def read_tasks(chantier_id: int, db: Session = Depends(get_db)):
    return db.query(models.Task).filter(models.Task.chantier_id == chantier_id).all()

# --- MOTEUR D'INTELLIGENCE (RISQUES) ---
# N'oubliez pas d'importer datetime si ce n'est pas fait
from datetime import datetime

# --- MOTEUR D'INTELLIGENCE DUERP & ALERTES ---
def get_risk_analysis(description: str):
    desc = description.lower()
    
    # Règle 1 : Hauteur (Déclenche DUERP)
    if any(x in desc for x in ["toiture", "charpente", "échelle", "échafaudage", "nacelle", "hauteur", "bardage"]):
        return {
            "type_alert": "DUERP",
            "msg": "🪜 Travail en hauteur détecté. Ligne ajoutée au DUERP.",
            "data": {
                "risque": "Chute de hauteur",
                "gravite": 4,
                "mesures_a_realiser": "Installation garde-corps, Vérification échafaudage, Port du harnais",
                "mesures_realisees": "Formation travail en hauteur"
            }
        }

    # Règle 2 : Feu (Déclenche Permis Feu + DUERP)
    if any(x in desc for x in ["soudure", "meuleuse", "chalumeau", "étincelle", "feu", "découpe"]):
        return {
            "type_alert": "PERMIS_FEU",
            "msg": "🔥 Risque Incendie. Permis de feu requis + DUERP mis à jour.",
            "data": {
                "risque": "Incendie / Brûlures",
                "gravite": 4,
                "mesures_a_realiser": "Permis de feu obligatoire, Extincteur à proximité, Éloignement combustibles",
                "mesures_realisees": "Extincteurs vérifiés"
            }
        }
        
    # Règle 3 : Poussières / Amiante / Chimique
    if any(x in desc for x in ["amiante", "démolition", "perçage", "ponçage", "béton", "silice", "chimique"]):
        return {
            "type_alert": "EPI",
            "msg": "😷 Risque Inhalation. Port du masque FFP3 ajouté au DUERP.",
            "data": {
                "risque": "Inhalation poussières nocives",
                "gravite": 3,
                "mesures_a_realiser": "Port masque FFP3, Arrosage pour abattre poussières",
                "mesures_realisees": "Fourniture EPI"
            }
        }
    
    # Règle 4 : Électricité
    if any(x in desc for x in ["câblage", "tableau", "électrique", "tension", "raccordement"]):
        return {
            "type_alert": "EPI",
            "msg": "⚡ Risque Électrique. Habilitation requise.",
            "data": {
                "risque": "Électrisation / Électrocution",
                "gravite": 4,
                "mesures_a_realiser": "Consignation, Port visière anti-UV, Tapis isolant",
                "mesures_realisees": "Habilitation électrique à jour"
            }
        }

    return None

# --- ROUTE CRÉATION TÂCHE (INTELLIGENTE + ÉCRITURE BDD) ---
@app.post("/tasks", response_model=schemas.TaskOut)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    # 1. Création standard de la tâche
    db_task = models.Task(**task.dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # 2. Analyse Intelligence
    analysis = get_risk_analysis(db_task.description)
    
    if analysis:
        # A. On prépare la réponse pour le Mobile (Toast/Popup)
        setattr(db_task, "alert_message", analysis["msg"])
        setattr(db_task, "alert_type", analysis["type_alert"])
        
        # B. AUTOMATISATION DUERP : On écrit dans la base de données !
        # On récupère le chantier pour trouver l'entreprise
        chantier = db.query(models.Chantier).filter(models.Chantier.id == task.chantier_id).first()
        
        if chantier and chantier.company_id:
            # Chercher le DUERP de l'année en cours
            annee_courante = str(datetime.now().year)
            duerp = db.query(models.DUERP).filter(
                models.DUERP.company_id == chantier.company_id,
                models.DUERP.annee == annee_courante
            ).first()
            
            # Si pas de DUERP pour cette année, on le crée
            if not duerp:
                duerp = models.DUERP(company_id=chantier.company_id, annee=annee_courante)
                db.add(duerp)
                db.commit()
                db.refresh(duerp)
            
            # C. Éviter les doublons : On vérifie si ce risque existe déjà pour cette tâche exacte
            risk_data = analysis["data"]
            existing_line = db.query(models.DUERPLigne).filter(
                models.DUERPLigne.duerp_id == duerp.id,
                models.DUERPLigne.tache == db_task.description
            ).first()
            
            if not existing_line:
                # Ajout de la ligne automatique
                ligne = models.DUERPLigne(
                    duerp_id=duerp.id,
                    tache=db_task.description,     # Ex: "Pose toiture"
                    risque=risk_data["risque"],    # Ex: "Chute de hauteur"
                    gravite=risk_data["gravite"],  # Ex: 4
                    mesures_a_realiser=risk_data["mesures_a_realiser"],
                    mesures_realisees=risk_data["mesures_realisees"]
                )
                db.add(ligne)
                db.commit()
                print(f"✅ DUERP Mis à jour : {risk_data['risque']} ajouté.")

    return db_task
        

# --- UPDATE TASK (ROBUSTE) ---
@app.put("/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, task_update: schemas.TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task: raise HTTPException(404, "Tâche introuvable")
    
    # Nettoyage des données reçues (au cas où "null", "", etc)
    update_data = task_update.dict(exclude_unset=True)

    if "description" in update_data and update_data["description"]: 
        task.description = update_data["description"]
        
    if "status" in update_data and update_data["status"]: 
        task.status = update_data["status"]
        
    if "date_prevue" in update_data:
        val = update_data["date_prevue"]
        if not val or val == "":
            task.date_prevue = None
        elif isinstance(val, str):
            try:
                task.date_prevue = datetime.fromisoformat(val[:10])
            except:
                pass # On laisse l'ancienne ou None
        else:
            task.date_prevue = val
    
    db.commit()
    db.refresh(task)
    return task

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task:
        db.delete(task)
        db.commit()
    return {"ok": True}

# --- ROUTE PERMIS DE FEU ---
@app.post("/permis-feu", response_model=schemas.PermisFeuOut)
def create_permis_feu(permis: schemas.PermisFeuCreate, db: Session = Depends(get_db)):
    # 1. Création en BDD
    db_permis = models.PermisFeu(**permis.dict())
    db.add(db_permis)
    db.commit()
    db.refresh(db_permis)
    
    return db_permis

# --- ROUTE POUR RÉCUPÉRER LES PERMIS D'UN CHANTIER ---
@app.get("/chantiers/{chantier_id}/permis-feu", response_model=List[schemas.PermisFeuOut])
def read_permis_feu(chantier_id: int, db: Session = Depends(get_db)):
    permis = db.query(models.PermisFeu).filter(models.PermisFeu.chantier_id == chantier_id).all()
    return permis

@app.get("/permis-feu/{permis_id}/pdf")
def get_permis_pdf_route(permis_id: int, db: Session = Depends(get_db)):
    # 1. Récupération des données
    permis = db.query(models.PermisFeu).filter(models.PermisFeu.id == permis_id).first()
    if not permis:
        raise HTTPException(status_code=404, detail="Permis introuvable")
    
    chantier = db.query(models.Chantier).filter(models.Chantier.id == permis.chantier_id).first()
    
    # 2. Appel du générateur externe (Code propre !)
    pdf_buffer = generate_permis_pdf(permis, chantier)
    
    # 3. Envoi du fichier
    filename = f"Permis_Feu_{permis_id}.pdf"
    return StreamingResponse(
        pdf_buffer, 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )

# ==========================================
# 9. FIX & MIGRATIONS
# ==========================================
@app.get("/force_add_pic_date")
def force_add_pic_date(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE pics ADD COLUMN IF NOT EXISTS date_creation TIMESTAMP DEFAULT NOW()"))
        db.commit()
        return {"msg": "✅ Colonne date_creation ajoutée avec succès !"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/migrate_documents_externes")
def migrate_docs_ext(db: Session = Depends(get_db)):
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS documents_externes (
                id SERIAL PRIMARY KEY,
                titre VARCHAR NOT NULL,
                categorie VARCHAR NOT NULL,
                url VARCHAR NOT NULL,
                chantier_id INTEGER REFERENCES chantiers(id),
                date_ajout TIMESTAMP DEFAULT NOW()
            )
        """))
        db.commit()
        return {"msg": "Table Documents Externes créée !"}
    except Exception as e: return {"error": str(e)}

@app.get("/migrate_company_docs")
def migrate_company_docs(db: Session = Depends(get_db)):
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS company_documents (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id),
                titre VARCHAR NOT NULL,
                type_doc VARCHAR NOT NULL,
                url VARCHAR NOT NULL,
                date_expiration TIMESTAMP,
                date_upload TIMESTAMP DEFAULT NOW()
            )
        """))
        db.commit()
        return {"msg": "Table Documents Entreprise créée !"}
    except Exception as e: return {"error": str(e)}

@app.get("/debug_fix_pic")
def debug_fix_pic(db: Session = Depends(get_db)):
    status = []
    try:
        db.execute(text("SELECT 1 FROM pics LIMIT 1"))
        status.append("✅ Table 'pics' trouvée.")
    except Exception:
        return {"error": "La table 'pics' n'existe pas ! Lancez /fix_everything d'abord."}
    
    # Check date_creation
    try:
        db.execute(text("SELECT date_creation FROM pics LIMIT 1"))
        status.append("✅ Colonne 'date_creation' existe déjà.")
    except Exception:
        db.rollback()
        try:
            db.execute(text("ALTER TABLE pics ADD COLUMN date_creation TIMESTAMP DEFAULT NOW()"))
            db.commit()
            status.append("🎉 SUCCÈS : Colonne 'date_creation' ajoutée !")
        except Exception as e:
            status.append(f"❌ ÉCHEC création : {str(e)}")
            
    return {"rapport": status}

@app.get("/fix_everything")
def fix_everything(db: Session = Depends(get_db)):
    logs = []
    corrections = [
        ("chantiers", "signature_url", "VARCHAR"),
        ("chantiers", "cover_url", "VARCHAR"),
        ("chantiers", "latitude", "FLOAT"), ("chantiers", "longitude", "FLOAT"),
        ("chantiers", "soumis_sps", "BOOLEAN DEFAULT FALSE"),
        ("pics", "acces", "VARCHAR DEFAULT ''"), ("pics", "clotures", "VARCHAR DEFAULT ''"),
        ("pics", "base_vie", "VARCHAR DEFAULT ''"), ("pics", "stockage", "VARCHAR DEFAULT ''"),
        ("pics", "dechets", "VARCHAR DEFAULT ''"), ("pics", "levage", "VARCHAR DEFAULT ''"),
        ("pics", "reseaux", "VARCHAR DEFAULT ''"), ("pics", "circulations", "VARCHAR DEFAULT ''"),
        ("pics", "signalisation", "VARCHAR DEFAULT ''"),
        ("pics", "background_url", "VARCHAR"), ("pics", "final_url", "VARCHAR"), ("pics", "elements_data", "JSON")
    ]
    for table, col, type_col in corrections:
        try:
            db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {type_col}"))
            db.commit(); logs.append(f"✅ {col} ajouté à {table}")
        except Exception:
            db.rollback(); logs.append(f"ℹ️ {col} existe déjà")
            
    return {"status": "Terminé", "details": logs}

@app.get("/fix_users_table")
def fix_users_table(db: Session = Depends(get_db)):
    try:
        # Ajoute la colonne 'nom' si elle n'existe pas
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS nom VARCHAR"))
        db.commit()
        return {"message": "✅ Colonne 'nom' ajoutée à la table Users !"}
    except Exception as e:
        return {"error": str(e)}

# N'oubliez pas de lancer /fix_everything pour créer la table si vous n'avez pas Alembic
@app.get("/fix_permis_feu_table")
def fix_permis_table(db: Session = Depends(get_db)):
    models.Base.metadata.create_all(bind=engine)
    return {"msg": "Table Permis Feu créée !"}

@app.get("/fix_company_docs_signature")
def fix_company_docs_signature(db: Session = Depends(get_db)):
    try:
        # Ajout des colonnes pour la signature
        db.execute(text("ALTER TABLE company_documents ADD COLUMN IF NOT EXISTS signature_url VARCHAR"))
        db.execute(text("ALTER TABLE company_documents ADD COLUMN IF NOT EXISTS nom_signataire VARCHAR"))
        db.commit()
        return {"msg": "✅ Colonnes signature ajoutées aux documents entreprise !"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/companies/documents/{doc_id}/sign")
def sign_company_doc(
    doc_id: int, 
    payload: dict, # On attend { "signature_url": "...", "nom_signataire": "..." }
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    if not current_user.company_id:
        raise HTTPException(400, "Pas d'entreprise")
    
    # On cherche le document
    # Note: On vérifie que le document appartient bien à l'entreprise de l'utilisateur
    sql = text("SELECT id FROM company_documents WHERE id = :did AND company_id = :cid")
    doc = db.execute(sql, {"did": doc_id, "cid": current_user.company_id}).first()
    
    if not doc:
        raise HTTPException(404, "Document introuvable")

    # Mise à jour
    update_sql = text("""
        UPDATE company_documents 
        SET signature_url = :url, nom_signataire = :nom 
        WHERE id = :did
    """)
    db.execute(update_sql, {
        "url": payload.get("signature_url"),
        "nom": payload.get("nom_signataire"),
        "did": doc_id
    })
    db.commit()
    return {"message": "Document signé avec succès"}

@app.get("/fix_vgp_database")
def fix_vgp_database(db: Session = Depends(get_db)):
    try:
        # Cette commande SQL force l'ajout de la colonne dans la vraie table
        # On utilise TIMESTAMP pour être compatible avec le format datetime de Python
        db.execute(text("ALTER TABLE materiels ADD COLUMN IF NOT EXISTS date_derniere_vgp TIMESTAMP"))
        db.commit()
        return {"message": "✅ SUCCÈS : Colonne date_derniere_vgp ajoutée à la base de données !"}
    except Exception as e:
        return {"error": f"Erreur lors de la migration : {str(e)}"}