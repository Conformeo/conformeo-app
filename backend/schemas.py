# Fichier: backend/schemas.py
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# Schéma pour créer un utilisateur (ce que l'app envoie)
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "conducteur"

# Schéma pour afficher un utilisateur (ce que l'API répond)
class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: str
    is_active: bool

    class Config:
        from_attributes = True

# Schéma pour le Token (réponse du login)
class Token(BaseModel):
    access_token: str
    token_type: str

# ...

# --- CHANTIER ---
class ChantierBase(BaseModel):
    nom: str
    adresse: str
    client: str
    cover_url: Optional[str] = None # <--- Ajout

class ChantierCreate(ChantierBase):
    pass

class ChantierOut(ChantierBase):
    id: int
    est_actif: bool
    signature_url: Optional[str] = None
    class Config:
        from_attributes = True

# --- RAPPORT ---
class RapportBase(BaseModel):
    titre: str
    description: str
    chantier_id: int
    niveau_urgence: str = "Faible" # <--- Ajout
    latitude: Optional[float] = None # <--- Ajout
    longitude: Optional[float] = None # <--- Ajout

class RapportCreate(RapportBase):
    pass

class RapportOut(RapportBase):
    id: int
    photo_url: Optional[str] = None
    date_creation: datetime
    class Config:
        from_attributes = True


# --- Schémas Matériel ---
class MaterielBase(BaseModel):
    nom: str
    reference: str
    etat: str = "Bon"

class MaterielCreate(MaterielBase):
    pass

class MaterielOut(MaterielBase):
    id: int
    chantier_id: Optional[int] = None # Peut être null (Dépôt)

    class Config:
        from_attributes = True # (Rappel: on a changé orm_mode en from_attributes)