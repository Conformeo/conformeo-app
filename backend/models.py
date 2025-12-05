from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

# 👇 NOUVELLE TABLE : L'ENTREPRISE (Le "Tenant")
class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    subscription_plan = Column(String, default="free") # free, pro, enterprise
    created_at = Column(DateTime, default=datetime.now)

    # Relations Parents (Une entreprise a plusieurs...)
    users = relationship("User", back_populates="company")
    chantiers = relationship("Chantier", back_populates="company")
    materiels = relationship("Materiel", back_populates="company")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="conducteur")
    is_active = Column(Boolean, default=True)
    
    # 👇 LIEN VERS L'ENTREPRISE
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company = relationship("Company", back_populates="users")

class Chantier(Base):
    __tablename__ = "chantiers"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, index=True)
    adresse = Column(String)
    client = Column(String)
    est_actif = Column(Boolean, default=True)
    date_creation = Column(DateTime, default=datetime.now)
    signature_url = Column(String, nullable=True)
    cover_url = Column(String, nullable=True)

    # 👇 LIEN VERS L'ENTREPRISE
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company = relationship("Company", back_populates="chantiers")

    rapports = relationship("Rapport", back_populates="chantier")
    materiels = relationship("Materiel", back_populates="chantier")
    inspections = relationship("Inspection", back_populates="chantier")
    ppsps_docs = relationship("PPSPS", back_populates="chantier")
    pic = relationship("PIC", uselist=False, back_populates="chantier")

class Materiel(Base):
    __tablename__ = "materiels"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, index=True)
    reference = Column(String)
    etat = Column(String, default="Bon")
    image_url = Column(String, nullable=True)
    
    # 👇 LIEN VERS L'ENTREPRISE (Le stock appartient à la boîte)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company = relationship("Company", back_populates="materiels")
    
    chantier_id = Column(Integer, ForeignKey("chantiers.id"), nullable=True)
    chantier = relationship("Chantier", back_populates="materiels")

class RapportImage(Base):
    __tablename__ = "rapport_images"
    
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String)
    rapport_id = Column(Integer, ForeignKey("rapports.id"))
    
    rapport = relationship("Rapport", back_populates="images")

class Rapport(Base):
    __tablename__ = "rapports"

    id = Column(Integer, primary_key=True, index=True)
    titre = Column(String)
    description = Column(String)
    
    photo_url = Column(String, nullable=True) 
    
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    date_creation = Column(DateTime, default=datetime.now)
    
    niveau_urgence = Column(String, default="Faible")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    chantier = relationship("Chantier", back_populates="rapports")
    images = relationship("RapportImage", back_populates="rapport")

class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    titre = Column(String)
    type = Column(String)
    data = Column(JSON) 
    
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    date_creation = Column(DateTime, default=datetime.now)
    createur = Column(String)

    chantier = relationship("Chantier", back_populates="inspections")

class PPSPS(Base):
    __tablename__ = "ppsps"

    id = Column(Integer, primary_key=True, index=True)
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    
    maitre_ouvrage = Column(String)
    maitre_oeuvre = Column(String)
    coordonnateur_sps = Column(String)
    responsable_chantier = Column(String)
    nb_compagnons = Column(Integer)
    horaires = Column(String)
    duree_travaux = Column(String)

    secours_data = Column(JSON)
    installations_data = Column(JSON)
    taches_data = Column(JSON)
    
    date_creation = Column(DateTime, default=datetime.now)

    chantier = relationship("Chantier", back_populates="ppsps_docs")

class PIC(Base):
    __tablename__ = "pics"

    id = Column(Integer, primary_key=True, index=True)
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    
    background_url = Column(String)
    final_url = Column(String)
    elements_data = Column(JSON)
    
    date_update = Column(DateTime, default=datetime.now)

    chantier = relationship("Chantier", back_populates="pic")