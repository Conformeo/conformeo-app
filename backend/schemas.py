from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# --- ENTREPRISE (NOUVEAU) ---
class CompanyCreate(BaseModel):
    name: str

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    logo_url: Optional[str] = None

# Mettez aussi à jour CompanyOut pour renvoyer ces infos
class CompanyOut(BaseModel):
    id: int
    name: str
    logo_url: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    subscription_plan: str
    class Config:
        from_attributes = True

# --- UTILISATEURS ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "conducteur"
    # 👇 AJOUT : Pour créer sa boite à l'inscription
    company_name: Optional[str] = None 

class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: str
    # 👇 AJOUT : L'utilisateur appartient à une entreprise
    company_id: Optional[int] = None 
    is_active: bool
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# --- CHANTIERS ---
class ChantierBase(BaseModel):
    nom: str
    adresse: str
    client: str
    cover_url: Optional[str] = None
    date_debut: Optional[datetime] = None
    date_fin: Optional[datetime] = None
    statut_planning: Optional[str] = "prevu"

class ChantierCreate(ChantierBase):
    pass

class ChantierOut(ChantierBase):
    id: int
    est_actif: bool
    signature_url: Optional[str] = None
    date_creation: datetime
    
    # 👇 CES LIGNES SONT INDISPENSABLES POUR L'AFFICHAGE !
    date_debut: Optional[datetime] = None
    date_fin: Optional[datetime] = None
    statut_planning: Optional[str] = "prevu"
    
    class Config:
        from_attributes = True

# --- MATERIEL ---
class MaterielBase(BaseModel):
    nom: str
    reference: str
    etat: str = "Bon"
    image_url: Optional[str] = None 

class MaterielCreate(MaterielBase):
    pass

class MaterielOut(MaterielBase):
    id: int
    chantier_id: Optional[int] = None
    class Config:
        from_attributes = True

# --- RAPPORTS & IMAGES ---

class RapportImageOut(BaseModel):
    url: str
    class Config:
        from_attributes = True

class RapportBase(BaseModel):
    titre: str
    description: str
    chantier_id: int
    niveau_urgence: str = "Faible"
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class RapportCreate(RapportBase):
    image_urls: List[str] = [] 

class RapportOut(RapportBase):
    id: int
    photo_url: Optional[str] = None 
    images: List[RapportImageOut] = [] 
    date_creation: datetime
    class Config:
        from_attributes = True

# --- INSPECTIONS QHSE ---
class InspectionBase(BaseModel):
    titre: str
    type: str
    data: List[dict] 
    chantier_id: int
    createur: str

class InspectionCreate(InspectionBase):
    pass

class InspectionOut(InspectionBase):
    id: int
    date_creation: datetime
    class Config:
        from_attributes = True

# --- PPSPS DOCUMENTS ---
class PPSPSBase(BaseModel):
    maitre_ouvrage: Optional[str] = ""
    maitre_oeuvre: Optional[str] = ""
    coordonnateur_sps: Optional[str] = ""
    responsable_chantier: str
    nb_compagnons: int = 1
    horaires: str = "8h-17h"
    duree_travaux: str = "Non définie"
    
    secours_data: dict = {}
    installations_data: dict = {}
    taches_data: List[dict] = []
    
    chantier_id: int

class PPSPSCreate(PPSPSBase):
    pass

class PPSPSOut(PPSPSBase):
    id: int
    date_creation: datetime
    class Config:
        from_attributes = True

# --- PIC (Plan Installation Chantier) ---
class PICBase(BaseModel):
    background_url: str
    final_url: Optional[str] = None
    elements_data: List[dict] = []
    chantier_id: int

class PICCreate(PICBase):
    pass

class PICOut(PICBase):
    id: int
    date_update: datetime
    class Config:
        from_attributes = True