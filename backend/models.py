from sqlalchemy import Column, Integer, String, Boolean, DateTime
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
    
    # Lien vers les rapports
    rapports = relationship("Rapport", back_populates="chantier")

class Rapport(Base):
    __tablename__ = "rapports"

    id = Column(Integer, primary_key=True, index=True)
    titre = Column(String)                # Ex: "Fissure Mur Nord"
    description = Column(String)          # Ex: "Fissure de 2mm constatée..."
    photo_url = Column(String, nullable=True) # Ex: "/static/image123.jpg"
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    date_creation = Column(DateTime, default=datetime.now)

    # Lien inverse
    chantier = relationship("Chantier", back_populates="rapports")