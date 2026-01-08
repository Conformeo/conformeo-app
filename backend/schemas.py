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
    data: Dict[str, Any]
    chantier_id: int
    createur: str

class InspectionOut(InspectionCreate):
    id: int
    date_creation: datetime
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
    elements_data: Optional[Any] = None # Can be list or string

# --- DOCS EXTERNES ---
class DocExterneOut(BaseModel):
    id: int
    titre: str
    categorie: str
    url: str
    date_ajout: datetime
    class Config:
        from_attributes = True

# --- COMPANY ---
class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    logo_url: Optional[str] = None

class CompanyOut(BaseModel):
    id: int
    name: str
    subscription_plan: str
    logo_url: Optional[str] = None
    class Config:
        from_attributes = True

class CompanyDocOut(BaseModel):
    id: int
    titre: str
    type_doc: str
    url: str
    date_expiration: Optional[datetime]
    date_upload: datetime
    class Config:
        from_attributes = True