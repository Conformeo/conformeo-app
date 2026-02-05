from pydantic import BaseModel, EmailStr
from typing import Optional, Any
from datetime import datetime

# --- AUTH ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    nom: str
    company_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    nom: Optional[str] = None       
    full_name: Optional[str] = None

class UserUpdateAdmin(BaseModel):
    nom: Optional[str] = None       
    full_name: Optional[str] = None 
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None      
    is_active: Optional[Any] = None 
    company_id: Optional[Any] = None 

class UserOut(BaseModel):
    id: int
    email: EmailStr
    nom: Optional[str] = None
    role: str
    is_active: bool
    company_id: Optional[int] = None
    class Config:
        from_attributes = True

class UserInvite(BaseModel):
    email: EmailStr
    role: str = "conducteur"
    nom: Optional[str] = "Nouveau Membre"

# --- COMPANY ---
class CompanyCreate(BaseModel):
    name: str
    address: Optional[str] = None

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class CompanyOut(BaseModel):
    id: int
    name: str
    subscription_plan: str = "free"
    logo_url: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    contact_email: Optional[str] = None 
    email: Optional[str] = None
    class Config:
        from_attributes = True

class CompanyDocOut(BaseModel):
    id: int
    titre: str
    url: str
    date_upload: datetime
    company_id: int
    class Config:
        from_attributes = True