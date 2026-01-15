from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, JSON, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

# ==========================
# 1. ENTREPRISE & USERS
# ==========================
class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    subscription_plan = Column(String, default="free")
    
    logo_url = Column(String, nullable=True)
    address = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="company")
    chantiers = relationship("Chantier", back_populates="company")
    materiels = relationship("Materiel", back_populates="company")
    duerps = relationship("DUERP", back_populates="company") # Ajout relation DUERP

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="conducteur")
    nom = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company = relationship("Company", back_populates="users")

# ==========================
# 2. CHANTIERS
# ==========================
class Chantier(Base):
    __tablename__ = "chantiers"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, index=True)
    adresse = Column(String)
    client = Column(String)
    est_actif = Column(Boolean, default=True)
    date_creation = Column(DateTime, default=datetime.utcnow)
    signature_url = Column(String, nullable=True)
    cover_url = Column(String, nullable=True)

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    date_debut = Column(DateTime, nullable=True)
    date_fin = Column(DateTime, nullable=True)
    statut_planning = Column(String, default="prevu")
    soumis_sps = Column(Boolean, default=False)
    
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company = relationship("Company", back_populates="chantiers")

    # Relations
    rapports = relationship("Rapport", back_populates="chantier")
    materiels = relationship("Materiel", back_populates="chantier")
    inspections = relationship("Inspection", back_populates="chantier")
    ppsps_docs = relationship("PPSPS", back_populates="chantier")
    plans_prevention = relationship("PlanPrevention", back_populates="chantier")
    pic = relationship("PIC", uselist=False, back_populates="chantier")
    
    # Nouvelles relations
    tasks = relationship("Task", back_populates="chantier")
    permis_feu = relationship("PermisFeu", back_populates="chantier")

# ==========================
# 3. MATERIEL
# ==========================
class Materiel(Base):
    __tablename__ = "materiels"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, index=True)
    reference = Column(String) # Ref constructeur
    ref_interne = Column(String, nullable=True) # Ref interne (ex: CONFORME-51)
    
    etat = Column(String, default="Bon") # Ex: Bon, Panne, A réparer
    statut_vgp = Column(String, default="CONFORME") # CONFORME, NON CONFORME, A PREVOIR
    
    image_url = Column(String, nullable=True)
    date_derniere_vgp = Column(DateTime, nullable=True)
    
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company = relationship("Company", back_populates="materiels")
    
    chantier_id = Column(Integer, ForeignKey("chantiers.id"), nullable=True)
    chantier = relationship("Chantier", back_populates="materiels")

# ==========================
# 4. RAPPORTS & IMAGES
# ==========================
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

# ==========================
# 5. SÉCURITÉ & PREVENTION
# ==========================
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

# ==========================
# 6. DUERP (DOCUMENT UNIQUE)
# ==========================
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
    
    tache = Column(String)
    risque = Column(String)
    gravite = Column(Integer)
    mesures_realisees = Column(String)
    mesures_a_realiser = Column(String)
    
    duerp = relationship("DUERP", back_populates="lignes")

# ==========================
# 7. GESTION TÂCHES & PERMIS
# ==========================
class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, index=True)
    status = Column(String, default="TODO") # TODO, DONE, PROBLEM
    date_prevue = Column(DateTime, default=datetime.utcnow)
    
    # Liaison Chantier
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    chantier = relationship("Chantier", back_populates="tasks")

class PermisFeu(Base):
    __tablename__ = "permis_feu_v2"

    id = Column(Integer, primary_key=True, index=True)
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    date = Column(DateTime, default=datetime.utcnow)
    
    # Infos Formulaire Mobile
    lieu = Column(String)
    intervenant = Column(String)
    description = Column(String)
    
    # Mesures de sécurité (Checkboxes)
    extincteur = Column(Boolean, default=False)
    nettoyage = Column(Boolean, default=False)
    surveillance = Column(Boolean, default=False)
    
    signature = Column(Boolean, default=True) # Preuve simple
    
    chantier = relationship("Chantier", back_populates="permis_feu")