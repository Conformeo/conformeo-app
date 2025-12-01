from pydantic import BaseModel, EmailStr
from typing import Optional, List  # <--- C'EST ICI QU'IL MANQUAIT 'List'
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

# --- RAPPORTS & IMAGES ---

# Schéma pour une image seule
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
    # Liste d'URLs (Maintenant 'List' est reconnu)
    image_urls: List[str] = [] 

class RapportOut(RapportBase):
    id: int
    photo_url: Optional[str] = None
    images: List[RapportImageOut] = [] # Liste des images
    date_creation: datetime

    class Config:
        from_attributes = True