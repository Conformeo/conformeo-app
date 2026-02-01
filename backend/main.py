import os
import requests
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import engine, Base
# Importation de TOUS les routeurs
from .routers import auth, companies, chantiers, users, materiel, duerp, dashboard, tasks 

load_dotenv()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Conforméo API")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- STATIC FILES ---
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# --- ROUTEURS ---
app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(users.router)
app.include_router(chantiers.router)
app.include_router(materiel.router)
app.include_router(duerp.router)
app.include_router(dashboard.router)
app.include_router(tasks.router)

@app.get("/")
def read_root():
    return {"status": "API Active 🚀", "version": "2.4 Final"}

# 👇 ROUTE ADRESSE (CORRECTION 404)
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