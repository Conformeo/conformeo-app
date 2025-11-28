import os # <--- On importe le module système
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# URL par défaut (Local) vs URL Cloud (Récupérée via os.getenv)
# Render nous donnera une URL qui commence par "postgres://", mais SQLAlchemy veut "postgresql://"
database_url = os.getenv("DATABASE_URL", "postgresql://admin:password123@localhost:5433/conformeo_db")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

SQLALCHEMY_DATABASE_URL = database_url

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()