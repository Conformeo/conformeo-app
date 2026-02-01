import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import engine, Base
# Import ALL routers here
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
    return {"status": "API Active 🚀", "version": "2.2 Complete Fix"}