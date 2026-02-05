from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

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
    date_creation = Column(DateTime, default=datetime.utcnow)

    chantier = relationship("Chantier", back_populates="ppsps_docs")

class PlanPrevention(Base):
    __tablename__ = "plans_prevention"

    id = Column(Integer, primary_key=True, index=True)
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    
    entreprise_utilisatrice = Column(String) 
    entreprise_exterieure = Column(String)   
    date_inspection_commune = Column(DateTime, default=datetime.utcnow)
    risques_interferents = Column(JSON)
    consignes_securite = Column(JSON)
    signature_eu = Column(String) 
    signature_ee = Column(String) 
    date_creation = Column(DateTime, default=datetime.utcnow)
    
    chantier = relationship("Chantier", back_populates="plans_prevention")

class PIC(Base):
    __tablename__ = "pics"

    id = Column(Integer, primary_key=True, index=True)
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    
    acces = Column(String, nullable=True)          
    clotures = Column(String, nullable=True)       
    base_vie = Column(String, nullable=True)       
    stockage = Column(String, nullable=True)       
    dechets = Column(String, nullable=True)        
    levage = Column(String, nullable=True)         
    reseaux = Column(String, nullable=True)        
    circulations = Column(String, nullable=True)   
    signalisation = Column(String, nullable=True)  

    background_url = Column(String, nullable=True) 
    final_url = Column(String, nullable=True)      
    elements_data = Column(String, nullable=True)  
    date_creation = Column(DateTime, default=datetime.utcnow)
    
    chantier = relationship("Chantier", back_populates="pic")

class PermisFeu(Base):
    __tablename__ = "permis_feu"

    id = Column(Integer, primary_key=True, index=True)
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    
    date = Column(DateTime, default=datetime.utcnow)
    lieu = Column(String)
    intervenant = Column(String)
    description = Column(String)
    
    extincteur = Column(Boolean, default=False)
    nettoyage = Column(Boolean, default=False)
    surveillance = Column(Boolean, default=False)
    
    signature = Column(Boolean, default=True) 
    
    chantier = relationship("Chantier", back_populates="permis_feu")

class DUERP(Base):
    __tablename__ = "duerps"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_mise_a_jour = Column(DateTime, default=datetime.utcnow)
    annee = Column(String) 
    
    company = relationship("Company", back_populates="duerps")
    lignes = relationship("DUERPLigne", back_populates="duerp", cascade="all, delete-orphan")

class DUERPLigne(Base):
    __tablename__ = "duerp_lignes"
    
    id = Column(Integer, primary_key=True, index=True)
    duerp_id = Column(Integer, ForeignKey("duerps.id"))
    
    unite_travail = Column(String, default="Général") 
    statut = Column(String, default="EN COURS")
    
    tache = Column(String)
    risque = Column(String)
    gravite = Column(Integer)
    mesures_realisees = Column(String)
    mesures_a_realiser = Column(String)
    
    duerp = relationship("DUERP", back_populates="lignes")