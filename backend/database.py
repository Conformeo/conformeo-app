import os
from dotenv import load_dotenv  # 👈 Ajout important pour le local
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 1. On charge les variables d'environnement (si fichier .env présent)
load_dotenv()

# 2. Récupération de l'URL
# - Priorité 1 : La variable Render "DATABASE_URL"
# - Priorité 2 : Votre URL locale par défaut
database_url = os.getenv("DATABASE_URL", "postgresql://admin:password123@localhost:5433/conformeo_db")

# 3. Correction spécifique pour Render/Heroku
# Ils donnent souvent une URL commençant par "postgres://" qui est obsolète pour SQLAlchemy
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

# 4. Création du moteur de base de données
engine = create_engine(database_url)

# 5. Configuration de la session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 6. Classe de base pour les modèles (à importer dans models.py)
Base = declarative_base()

# 7. Dépendance à utiliser dans vos routes (Depends(get_db))
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()