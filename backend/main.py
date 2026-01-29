import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import requests

# Imports de la configuration BDD
from .database import engine, Base

# Imports des routeurs
from .routers import auth, companies, chantiers, users, materiel, duerp, dashboard

# Chargement des variables d'environnement
load_dotenv()

# Création des tables en BDD
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Conforméo API")

# --- 0. MIDDLEWARE DE SÉCURITÉ (VERSION ULTRA-PERMISSIVE) ---
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    
    # On autorise explicitement TOUT pour éviter les blocages Frontend
    # L'important est 'unsafe-eval' dans script-src
    csp_policy = (
        "default-src * data: blob: filesystem: about: ws: wss: 'unsafe-inline' 'unsafe-eval'; "
        "script-src * data: blob: 'unsafe-inline' 'unsafe-eval'; "
        "connect-src * data: blob: 'unsafe-inline'; "
        "img-src * data: blob: 'unsafe-inline'; "
        "style-src * data: blob: 'unsafe-inline'; "
        "frame-src * data: blob: ; "
        "font-src * data: blob: 'unsafe-inline';"
    )
    
    response.headers["Content-Security-Policy"] = csp_policy
    # On ajoute aussi ces headers pour être sûr
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

# --- 1. CONFIGURATION CORS ---
origins = [
    "http://localhost:8100",
    "http://localhost:4200",
    "capacitor://localhost",
    "https://conformeo-app.vercel.app",
    "https://conformeo-app.vercel.app/",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. GESTION DES FICHIERS (UPLOADS) ---
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# --- 3. INCLUSION DES ROUTEURS ---
app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(users.router)
app.include_router(materiel.router)
app.include_router(duerp.router)
app.include_router(chantiers.router)
app.include_router(dashboard.router)

@app.get("/")
def read_root():
    return {
        "message": "API Conforméo en ligne 🚀",
        "doc": "/docs",
        "status": "active"
    }

# ... (Vos imports existants)

# 👇 NOUVELLE ROUTE POUR L'AUTOCOMPLÉTION (A ajouter dans main.py)
@app.get("/tools/search-address")
def search_address_autocomplete(q: str):
    """
    Appelle l'API Adresse (Data.gouv.fr) pour proposer des suggestions
    en temps réel à l'utilisateur.
    """
    if not q or len(q) < 3:
        return []

    try:
        # L'API Adresse est optimisée pour la France et tolère les erreurs
        url = "https://api-adresse.data.gouv.fr/search/"
        params = {
            'q': q,
            'limit': 5,        # On récupère 5 suggestions max
            'autocomplete': 1  # Active le mode "je suis en train d'écrire"
        }
        
        response = requests.get(url, params=params, timeout=3)
        
        if response.status_code == 200:
            results = response.json().get('features', [])
            suggestions = []
            
            for item in results:
                props = item.get('properties', {})
                geom = item.get('geometry', {}).get('coordinates', [0, 0])
                
                suggestions.append({
                    "label": props.get('label'),       # Ex: "12 Rue de la République 84000 Avignon"
                    "nom_rue": props.get('name'),      # Ex: "12 Rue de la République"
                    "ville": props.get('city'),        # Ex: "Avignon"
                    "code_postal": props.get('postcode'), # Ex: "84000"
                    "latitude": geom[1],               # GPS Latitude
                    "longitude": geom[0]               # GPS Longitude
                })
            
            return suggestions

    except Exception as e:
        print(f"❌ Erreur API Adresse : {e}")
        return []
    
    return []