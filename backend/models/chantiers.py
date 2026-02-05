from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Date
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class Chantier(Base):
    __tablename__ = "chantiers"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, index=True)
    adresse = Column(String, nullable=True)
    client = Column(String, nullable=True)
    
    date_debut = Column(Date, nullable=True)
    date_fin = Column(Date, nullable=True)
    
    statut_planning = Column(String, default="prevu")
    est_actif = Column(Boolean, default=True)
    soumis_sps = Column(Boolean, default=False)
    
    signature_url = Column(String, nullable=True)
    cover_url = Column(String, nullable=True)

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    date_creation = Column(DateTime, default=datetime.utcnow)

    # Clé étrangère
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company = relationship("Company", back_populates="chantiers")

    # Relations (Notez l'utilisation de guillemets pour éviter les imports circulaires)
    rapports = relationship("Rapport", back_populates="chantier")
    materiels = relationship("Materiel", back_populates="chantier")
    inspections = relationship("Inspection", back_populates="chantier")
    ppsps_docs = relationship("PPSPS", back_populates="chantier")
    plans_prevention = relationship("PlanPrevention", back_populates="chantier")
    pic = relationship("PIC", uselist=False, back_populates="chantier")
    tasks = relationship("Task", back_populates="chantier")
    permis_feu = relationship("PermisFeu", back_populates="chantier")
    # docs_externes est géré via backref dans DocExterne

class DocExterne(Base):
    __tablename__ = "docs_externes"

    id = Column(Integer, primary_key=True, index=True)
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    
    titre = Column(String)
    url = Column(String)
    categorie = Column(String)
    date_ajout = Column(DateTime, default=datetime.utcnow)
    
    chantier = relationship("Chantier", backref="docs_externes")