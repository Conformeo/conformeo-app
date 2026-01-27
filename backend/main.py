import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Imports de la configuration BDD
from .database import engine, Base

# Imports des routeurs
from .routers import auth, companies, chantiers, users, materiel, duerp, dashboard

# Chargement des variables d'environnement
load_dotenv()

# Création des tables en BDD (si elles n'existent pas)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Conforméo API")

# --- 1. CONFIGURATION CORS (CRITIQUE POUR VERCEL) ---
origins = [
    "http://localhost:8100",
    "http://localhost:4200",
    "capacitor://localhost",
    "https://conformeo-app.vercel.app",   # Sans slash
    "https://conformeo-app.vercel.app/",  # Avec slash (important !)
    "*" # A retirer en prod stricte, mais utile pour le debug
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. GESTION DES FICHIERS (UPLOADS) ---
# On s'assure que le dossier existe pour éviter les erreurs 500
os.makedirs("uploads", exist_ok=True)
# On rend ce dossier accessible via URL (ex: http://api.../uploads/logo.png)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# --- 3. INCLUSION DES ROUTEURS ---
app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(users.router)
app.include_router(materiel.router)
app.include_router(duerp.router)

# Chantiers contient 2 routeurs (le principal et celui des docs orphelines)
app.include_router(chantiers.router)
# app.include_router(chantiers.router_docs)
app.include_router(dashboard.router)

@app.get("/")
def read_root():
    return {
        "message": "API Conforméo en ligne 🚀",
        "doc": "/docs",
        "status": "active"
    }