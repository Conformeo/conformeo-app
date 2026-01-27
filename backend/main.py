import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request  # 👈 AJOUT IMPORTANT : Request
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

# --- 0. MIDDLEWARE DE SÉCURITÉ (CSP) ---
# 👇 C'EST CE BLOC QUI VA DÉBLOQUER L'AFFICHAGE DU DASHBOARD
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # On autorise tout (*) y compris 'unsafe-eval' pour que les scripts Angular/Ionic fonctionnent
    response.headers["Content-Security-Policy"] = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;"
    return response

# --- 1. CONFIGURATION CORS ---
origins = [
    "http://localhost:8100",
    "http://localhost:4200",
    "capacitor://localhost",
    "https://conformeo-app.vercel.app",
    "https://conformeo-app.vercel.app/",
    "*"  # Utile pour le debug, à restreindre plus tard si besoin
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
# app.include_router(chantiers.router_docs) # Désactivé car fusionné
app.include_router(dashboard.router)

@app.get("/")
def read_root():
    return {
        "message": "API Conforméo en ligne 🚀",
        "doc": "/docs",
        "status": "active"
    }