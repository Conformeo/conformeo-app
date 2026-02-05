from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 👇 MODIFIEZ CETTE PARTIE (On importe chaque fichier séparément)
from .routers import users
from .routers import companies
from .routers import chantiers
from .routers import materiels  # C'est lui qui posait problème via __init__
from .routers import tasks
from .routers import dashboard

from . import models
from .database import engine

# Création des tables (si pas fait via migration)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Conformeo API")

# ==========================================
# 🛡️ FIX CRITIQUE : CONFIGURATION CORS
# ==========================================
origins = [
    "http://localhost",
    "http://localhost:8100",
    "http://localhost:4200",
    "capacitor://localhost",   # Pour iOS
    "http://10.0.2.2:8000",    # Pour Android Emulator
    "*"                        # ⚠️ Autoriser tout le monde (Solution radicale pour test)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # On met "*" pour être sûr que ça passe partout
    allow_credentials=True,
    allow_methods=["*"],       # Autorise GET, POST, PUT, DELETE, OPTIONS
    allow_headers=["*"],       # Autorise tous les headers (Authorization, etc.)
)

# ==========================================
# 🛣️ ROUTEURS
# ==========================================
app.include_router(users.router)
app.include_router(companies.router)
app.include_router(chantiers.router) # Vérifiez que le permis feu est bien dedans
app.include_router(materiels.router)
app.include_router(tasks.router)
app.include_router(dashboard.router)

@app.get("/")
def read_root():
    return {"message": "API Conformeo en ligne 🚀"}

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