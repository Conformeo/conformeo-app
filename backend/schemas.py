from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any, Dict
from datetime import datetime

# --- USER ---
class UserBase(BaseModel):
    email: EmailStr
    role: str = "Conducteur"

class UserCreate(UserBase):
    password: str
    company_name: Optional[str] = None

class UserInvite(BaseModel):
    email: EmailStr
    nom: str
    role: str = "Conducteur"
    password: str

class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None

class UserOut(UserBase):
    id: int
    nom: Optional[str] = None
    is_active: bool
    company_id: Optional[int] = None
    class Config:
        from_attributes = True
        
class UserUpdateAdmin(BaseModel):
    nom: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None # Pour reset le mot de passe

class Token(BaseModel):
    access_token: str
    token_type: str

# --- CHANTIER ---
class ChantierBase(BaseModel):
    nom: str
    adresse: Optional[str] = None
    client: Optional[str] = None
    est_actif: bool = True
    cover_url: Optional[str] = None
    date_debut: Optional[datetime] = None
    date_fin: Optional[datetime] = None
    soumis_sps: bool = False

class ChantierCreate(ChantierBase):
    pass

class ChantierOut(ChantierBase):
    id: int
    date_creation: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    signature_url: Optional[str] = None
    company_id: Optional[int] = None
    class Config:
        from_attributes = True

# --- MATERIEL ---
class MaterielCreate(BaseModel):
    nom: str
    reference: Optional[str] = None
    etat: str = "Bon"
    image_url: Optional[str] = None

class MaterielOut(MaterielCreate):
    id: int
    chantier_id: Optional[int] = None
    class Config:
        from_attributes = True

# --- RAPPORT ---
class RapportCreate(BaseModel):
    titre: str
    description: Optional[str] = ""
    chantier_id: int
    niveau_urgence: str = "Faible"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    image_urls: Optional[List[str]] = []

class RapportOut(BaseModel):
    id: int
    titre: str
    description: Optional[str] = ""
    date_creation: datetime
    niveau_urgence: str
    photo_url: Optional[str] = None
    class Config:
        from_attributes = True

# --- INSPECTION ---
class InspectionCreate(BaseModel):
    titre: str
    type: str
    # We make data optional here too to be safe
    data: Optional[Dict[str, Any]] = None 
    chantier_id: int
    createur: str

# 👇 CRITICAL FIX: We decouple Out from Create
# We redefine InspectionOut completely with defaults for EVERYTHING.
# This ensures it never crashes even if a field is missing in the DB.
class InspectionOut(BaseModel):
    id: int
    titre: Optional[str] = "Inspection sans titre"
    type: Optional[str] = "Standard"
    data: Optional[Dict[str, Any]] = None
    chantier_id: Optional[int] = None
    createur: Optional[str] = "Non renseigné"
    date_creation: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- PPSPS ---
class PPSPSCreate(BaseModel):
    chantier_id: int
    maitre_ouvrage: Optional[str] = None
    maitre_oeuvre: Optional[str] = None
    coordonnateur_sps: Optional[str] = None
    responsable_chantier: Optional[str] = None
    nb_compagnons: Optional[int] = 0
    horaires: Optional[str] = None
    duree_travaux: Optional[str] = None
    secours_data: Optional[Dict] = None
    installations_data: Optional[Dict] = None
    taches_data: Optional[Dict] = None

class PPSPSOut(PPSPSCreate):
    id: int
    date_creation: datetime
    class Config:
        from_attributes = True

# --- PLAN PREVENTION ---
class PlanPreventionCreate(BaseModel):
    chantier_id: int
    entreprise_utilisatrice: Optional[str] = None
    entreprise_exterieure: Optional[str] = None
    date_inspection_commune: Optional[datetime] = None
    risques_interferents: Optional[List[Dict]] = None
    consignes_securite: Optional[Dict] = None

class PlanPreventionOut(PlanPreventionCreate):
    id: int
    date_creation: datetime
    class Config:
        from_attributes = True

# --- PIC ---
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
    background_url: Optional[str] = None
    final_url: Optional[str] = None
    elements_data: Optional[Any] = None 

# --- DOCS EXTERNES ---
class DocExterneOut(BaseModel):
    id: int
    titre: str
    categorie: str
    url: str
    date_ajout: datetime
    class Config:
        from_attributes = True

# --- COMPANY (CORRIGÉ) ---

# 1. Base commune pour ne pas répéter les champs
class CompanyBase(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None

# 2. Le schéma Create qui manquait !
class CompanyCreate(CompanyBase):
    name: str # Obligatoire à la création

# 3. Update (hérite de Base, donc tout est optionnel)
class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None

# 4. Out (hérite de Base pour renvoyer l'adresse, l'email, etc.)
# Dans backend/schemas.py

class CompanyOut(BaseModel):
    id: int
    name: str
    subscription_plan: str = "free"
    logo_url: Optional[str] = None
    
    address: Optional[str] = None
    phone: Optional[str] = None
    
    # 👇 On utilise Field avec alias si possible, ou on garde contact_email
    # Si ça ne marche pas, renommez simplement ceci en 'email' côté frontend aussi à terme.
    # Pour l'instant, gardons contact_email pour ne pas casser le frontend
    contact_email: Optional[str] = None 

    class Config:
        from_attributes = True
        # 👇 Cette ligne permet de mapper automatiquement company.email (DB) -> contact_email (Schema)
        # si vous utilisez des alias, mais ici le plus simple est de s'assurer que le backend renvoie bien la donnée.

class CompanyDocOut(BaseModel):
    id: int
    titre: str
    type_doc: str
    url: str
    date_expiration: Optional[datetime]
    date_upload: datetime
    class Config:
        from_attributes = True

# --- DUERP ---
class DUERPLigneBase(BaseModel):
    tache: str
    risque: str
    gravite: int = 1
    mesures_realisees: Optional[str] = ""
    mesures_a_realiser: Optional[str] = ""

class DUERPLigneCreate(DUERPLigneBase):
    pass

class DUERPLigneOut(DUERPLigneBase):
    id: int
    class Config:
        from_attributes = True

class DUERPCreate(BaseModel):
    annee: str
    lignes: List[DUERPLigneCreate]

class DUERPOut(BaseModel):
    id: int
    annee: str
    date_mise_a_jour: datetime
    lignes: List[DUERPLigneOut] = []
    class Config:
        from_attributes = True


# --- TASKS ---
class TaskCreate(BaseModel):
    description: str
    chantier_id: int
    date_prevue: Optional[datetime] = None
    status: str = "TODO"

class TaskUpdate(BaseModel):
    description: Optional[str] = None
    status: Optional[str] = None
    date_prevue: Optional[datetime] = None

class TaskOut(BaseModel):
    id: int
    description: Optional[str] = "Tâche sans nom"
    status: Optional[str] = "TODO"
    date_prevue: Optional[datetime] = None
    chantier_id: int
    
    class Config:
        from_attributes = True