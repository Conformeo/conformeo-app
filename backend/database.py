# Fichier: backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# URL de connexion (correspond aux infos du docker-compose)
SQLALCHEMY_DATABASE_URL = "postgresql://admin:password123@localhost:5433/conformeo_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Fonction utilitaire pour récupérer la session DB dans chaque requête
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()