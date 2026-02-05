from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests

# ✅ Imports directs des routeurs (Évite les erreurs d'import circulaire)
from .routers import users
from .routers import companies
from .routers import chantiers
from .routers import materiels 
from .routers import tasks
from .routers import dashboard

# ✅ Import des modèles (Via le nouveau dossier models/)
# Le fichier models/__init__.py expose "Base" et charge toutes les tables
from . import models
from .database import engine

# Création des tables dans la base de données
# Cela fonctionne car models.Base est défini dans models/__init__.py
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Conformeo API")

# ==========================================
# 🛡️ CONFIGURATION CORS
# ==========================================
# On autorise tout le monde pour éviter les blocages Mobile/Web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       
    allow_credentials=True,
    allow_methods=["*"],       
    allow_headers=["*"],       
)

# ==========================================
# 🛣️ ROUTEURS
# ==========================================
app.include_router(users.router)
app.include_router(companies.router)
app.include_router(chantiers.router)
app.include_router(materiels.router)
app.include_router(tasks.router)
app.include_router(dashboard.router)

# ==========================================
# 🏠 ROUTES GLOBALES & OUTILS
# ==========================================

@app.get("/")
def read_root():
    return {"message": "API Conformeo en ligne 🚀"}

# 👇 Route pour l'autocomplétion d'adresse (Data Gouv)
@app.get("/tools/search-address")
def search_address_autocomplete(q: str):
    if not q or len(q) < 3: return []
    try:
        url = "https://api-adresse.data.gouv.fr/search/"
        params = {'q': q, 'limit': 5, 'autocomplete': 1}
        response = requests.get(url, params=params, timeout=3)
        if response.status_code == 200:
            results = response.json().get('features', [])
            # On retourne un format simple pour le frontend
            return [{
                "label": item['properties'].get('label'),
                "nom_rue": item['properties'].get('name'),
                "ville": item['properties'].get('city'),
                "code_postal": item['properties'].get('postcode'),
                "latitude": item['geometry']['coordinates'][1],
                "longitude": item['geometry']['coordinates'][0]
            } for item in results]
    except Exception as e:
        print(f"❌ Erreur API Adresse : {e}")
    return []