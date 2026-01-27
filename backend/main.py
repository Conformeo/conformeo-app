import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Imports de la configuration BDD
from .database import engine, Base

# Imports des routeurs
from .routers import auth, companies, chantiers, users, materiel, duerp, dashboard

# Chargement des variables d'environnement
load_dotenv()

# Création des tables en BDD
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Conforméo API")

# --- 0. MIDDLEWARE DE SÉCURITÉ (VERSION BLINDÉE) ---
# 👇 C'est ici que nous avons renforcé la permission pour 'eval'
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    
    # On définit une politique ultra-permissive pour éviter tout blocage Frontend
    # On autorise spécifiquement 'script-src' avec 'unsafe-eval'
    csp_policy = (
        "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; "
        "script-src * data: blob: 'unsafe-inline' 'unsafe-eval'; "
        "connect-src * data: blob: 'unsafe-inline'; "
        "img-src * data: blob: 'unsafe-inline'; "
        "style-src * data: blob: 'unsafe-inline';"
    )
    
    response.headers["Content-Security-Policy"] = csp_policy
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