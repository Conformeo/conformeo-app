from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float
from datetime import datetime
from database import Base
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

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

    rapports = relationship("Rapport", back_populates="chantier")
    materiels = relationship("Materiel", back_populates="chantier")

class RapportImage(Base):
    __tablename__ = "rapport_images"
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String)
    rapport_id = Column(Integer, ForeignKey("rapports.id"))
    
    # Lien inverse
    rapport = relationship("Rapport", back_populates="images")

class Rapport(Base):
    __tablename__ = "rapports"
    id = Column(Integer, primary_key=True, index=True)
    titre = Column(String)
    description = Column(String)
    # photo_url = Column(String)  <-- ON N'UTILISE PLUS CELLE-LA (mais on la garde pour pas casser les vieux)
    
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    date_creation = Column(DateTime, default=datetime.now)
    niveau_urgence = Column(String, default="Faible")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    chantier = relationship("Chantier", back_populates="rapports")
    
    # 👇 NOUVEAU LIEN (Une liste d'images)
    images = relationship("RapportImage", back_populates="rapport")

class Materiel(Base):
    __tablename__ = "materiels"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, index=True)      # Ex: "Perceuse Hilti"
    reference = Column(String)            # Ex: "HIL-2023-01" (Sera le contenu du QR Code)
    etat = Column(String, default="Bon")  # "Bon", "Réparation", "HS"
    
    # Si c'est NULL, le matériel est au Dépôt.
    # Si c'est rempli, le matériel est sur ce chantier.
    chantier_id = Column(Integer, ForeignKey("chantiers.id"), nullable=True)
    
    # Relation pour savoir où il est facilement
    chantier = relationship("Chantier", back_populates="materiels")