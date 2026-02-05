from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base

class Materiel(Base):
    __tablename__ = "materiels" 

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, index=True)
    reference = Column(String) 
    ref_interne = Column(String, nullable=True) 
    
    etat = Column(String, default="Bon") 
    statut_vgp = Column(String, default="CONFORME") 
    
    image_url = Column(String, nullable=True)
    date_derniere_vgp = Column(DateTime, nullable=True)
    
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company = relationship("Company", back_populates="materiels")
    
    chantier_id = Column(Integer, ForeignKey("chantiers.id"), nullable=True) 
    chantier = relationship("Chantier", back_populates="materiels")