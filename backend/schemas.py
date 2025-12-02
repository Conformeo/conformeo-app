from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# --- UTILISATEURS ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "conducteur"

class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: str
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

class ChantierCreate(ChantierBase):
    pass

class ChantierOut(ChantierBase):
    id: int
    est_actif: bool
    signature_url: Optional[str] = None
    date_creation: datetime
    class Config:
        from_attributes = True

# --- MATERIEL ---
class MaterielBase(BaseModel):
    nom: str
    reference: str
    etat: str = "Bon"

class MaterielCreate(MaterielBase):
    pass

class MaterielOut(MaterielBase):
    id: int
    chantier_id: Optional[int] = None
    class Config:
        from_attributes = True

# --- RAPPORTS & IMAGES (LE CŒUR DU PROBLEME) ---

# 1. Structure d'une image seule dans la liste
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

# 2. Ce qu'on envoie pour CREER (Une liste de liens textes)
class RapportCreate(RapportBase):
    image_urls: List[str] = [] 

# 3. Ce que l'API RENVOIE (Une liste d'objets images)
class RapportOut(RapportBase):
    id: int
    photo_url: Optional[str] = None # On garde pour compatibilité
    images: List[RapportImageOut] = [] # La galerie
    date_creation: datetime
    class Config:
        from_attributes = True

# ...

# --- INSPECTIONS QHSE ---
class InspectionBase(BaseModel):
    titre: str
    type: str
    data: List[dict] # Liste de questions/réponses
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
    maitre_oeuvre: str
    coordonnateur_sps: str
    hopital_proche: str
    responsable_securite: str
    nb_compagnons: int
    horaires: str
    risques: dict # Le JSON des risques
    chantier_id: int

class PPSPSCreate(PPSPSBase):
    pass

class PPSPSOut(PPSPSBase):
    id: int
    date_creation: datetime
    class Config:
        from_attributes = True