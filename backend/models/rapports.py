from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

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
    
    date_creation = Column(DateTime, default=datetime.utcnow)
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
    
    date_creation = Column(DateTime, default=datetime.utcnow)
    createur = Column(String)

    chantier = relationship("Chantier", back_populates="inspections")