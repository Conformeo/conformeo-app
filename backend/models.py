from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, JSON
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
    
    # Infos Branding
    logo_url = Column(String, nullable=True)
    address = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)

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
    
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company = relationship("Company", back_populates="users")

# Modèle pour inviter un membre (Validation des données reçues)
class UserInvite(BaseModel):
    email: str
    nom: str
    role: str = "Conducteur"
    password: str

# Modèle pour envoyer les infos utilisateur (Validation de la réponse)
class UserOut(BaseModel):
    id: int
    email: str
    nom: Optional[str] = None # 'Optional' nécessite : from typing import Optional
    role: str
    
    class Config:
        from_attributes = True

class UserUpdate(pydantic.BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    

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
    date_creation = Column(DateTime, default=datetime.now)
    signature_url = Column(String, nullable=True)
    cover_url = Column(String, nullable=True)

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    date_debut = Column(DateTime, nullable=True)
    date_fin = Column(DateTime, nullable=True)
    statut_planning = Column(String, default="prevu")

    # Champ ajouté pour filtrer PPSPS vs Plan de Prévention
    soumis_sps = Column(Boolean, default=False)
    
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company = relationship("Company", back_populates="chantiers")

    # Relations Documents
    rapports = relationship("Rapport", back_populates="chantier")
    materiels = relationship("Materiel", back_populates="chantier")
    inspections = relationship("Inspection", back_populates="chantier")
    
    # Relation SPS
    ppsps_docs = relationship("PPSPS", back_populates="chantier")
    
    # Relation Plan de Prévention (NOUVEAU)
    plans_prevention = relationship("PlanPrevention", back_populates="chantier")
    
    pic = relationship("PIC", uselist=False, back_populates="chantier")

# ==========================
# 3. MATERIEL
# ==========================
class Materiel(Base):
    __tablename__ = "materiels"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, index=True)
    reference = Column(String)
    etat = Column(String, default="Bon")
    image_url = Column(String, nullable=True)
    
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
    
    date_creation = Column(DateTime, default=datetime.now)

    chantier = relationship("Chantier", back_populates="ppsps_docs")

class PlanPrevention(Base):
    __tablename__ = "plans_prevention"

    id = Column(Integer, primary_key=True, index=True)
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    
    # 1. Acteurs
    entreprise_utilisatrice = Column(String) # Le client (EU)
    entreprise_exterieure = Column(String)   # Nous (EE)
    date_inspection_commune = Column(DateTime, default=datetime.now)
    
    # 2. Risques Interférents (JSON)
    # Ex: [{"tache": "Soudure", "risque": "Incendie", "mesure": "Permis de feu"}]
    risques_interferents = Column(JSON)
    
    # 3. Consignes & Secours (JSON)
    # Ex: {"point_rassemblement": "Parking Nord", "num_urgence": "18"}
    consignes_securite = Column(JSON)
    
    signature_eu = Column(String) # Signature Client (Base64 ou URL)
    signature_ee = Column(String) # Votre Signature (Base64 ou URL)

    date_creation = Column(DateTime, default=datetime.utcnow)
    
    # Relation inverse
    chantier = relationship("Chantier", back_populates="plans_prevention")

# ... (Vos autres classes)

class PIC(Base):
    __tablename__ = "pics"

    id = Column(Integer, primary_key=True, index=True)
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    
    # Les 9 Éléments du PIC
    acces = Column(String, nullable=True)          # 1. Véhicules et piétons
    clotures = Column(String, nullable=True)       # 2. Clôtures et sécurité
    base_vie = Column(String, nullable=True)       # 3. Base vie et sanitaires
    stockage = Column(String, nullable=True)       # 4. Stockage matériaux
    dechets = Column(String, nullable=True)        # 5. Tri des déchets
    levage = Column(String, nullable=True)         # 6. Engins de levage
    reseaux = Column(String, nullable=True)        # 7. Réseaux provisoires
    circulations = Column(String, nullable=True)   # 8. Voies internes
    signalisation = Column(String, nullable=True)  # 9. Espaces vie & Panneaux

    # Méta-données
    background_url = Column(String, nullable=True) # Pour l'image de fond
    final_url = Column(String, nullable=True)      # Pour l'image finale
    elements_data = Column(String, nullable=True)  # Pour stocker les icônes (JSON ou String)
    date_creation = Column(DateTime, default=datetime.now) # 👈 INDISPENSABLE
    
    # Relation
    chantier = relationship("Chantier", back_populates="pic")

# N'oubliez pas d'ajouter la relation inverse dans la classe Chantier :
# pic = relationship("PIC", uselist=False, back_populates="chantier")
class PicSchema(BaseModel):
    acces: str = ""
    clotures: str = ""
    base_vie: str = ""
    stockage: str = ""
    dechets: str = ""
    levage: str = ""
    reseaux: str = ""
    circulations: str = ""
    signalisation: str = ""
    
    # 🎨 Données pour le dessin
    background_url: Optional[str] = None
    final_url: Optional[str] = None
    elements_data: Optional[list] = None

class DocExterneOut(pydantic.BaseModel):
    id: int
    titre: str
    categorie: str
    url: str
    date_ajout: datetime
    class Config: from_attributes = True

class CompanyDocOut(pydantic.BaseModel):
    id: int
    titre: str
    type_doc: str
    url: str
    date_expiration: Optional[datetime]
    date_upload: datetime
    class Config: from_attributes = True

class EmailSchema(BaseModel):
    email: List[EmailStr]