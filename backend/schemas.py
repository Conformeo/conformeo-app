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

# Schéma pour les chantiers
class ChantierBase(BaseModel):
    nom: str
    adresse: str
    client: str

class ChantierCreate(ChantierBase):
    pass

class ChantierOut(ChantierBase):
    id: int
    est_actif: bool
    # date_creation: datetime  <-- Optionnel pour l'instant si tu n'as pas l'import datetime

    class Config:
        from_attributes = True


# --- Schémas Rapports ---
class RapportBase(BaseModel):
    titre: str
    description: str
    chantier_id: int

class RapportCreate(RapportBase):
    pass

class RapportOut(RapportBase):
    id: int
    photo_url: Optional[str] = None
    date_creation: datetime # Assure-toi d'avoir importé datetime from datetime en haut

    class Config:
        from_attributes = True