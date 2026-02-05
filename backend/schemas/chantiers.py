from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date

class ChantierBase(BaseModel):
    nom: str
    adresse: Optional[str] = None
    client: Optional[str] = None
    date_debut: Optional[date] = None 
    date_fin: Optional[date] = None   
    est_actif: bool = True
    soumis_sps: bool = False

class ChantierCreate(ChantierBase):
    date_debut: Optional[str] = None
    date_fin: Optional[str] = None
    cover_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ChantierUpdate(BaseModel):
    nom: Optional[str] = None
    client: Optional[str] = None
    adresse: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date_debut: Optional[str] = None 
    date_fin: Optional[str] = None
    est_actif: Optional[bool] = None
    soumis_sps: Optional[bool] = None
    cover_url: Optional[str] = None
    class Config:
        from_attributes = True

class ChantierOut(BaseModel):
    id: int
    nom: str
    client: Optional[str] = None
    adresse: Optional[str] = None
    date_debut: Optional[datetime] = None 
    date_fin: Optional[datetime] = None
    est_actif: bool = True
    soumis_sps: bool = False
    cover_url: Optional[str] = None
    date_creation: Optional[datetime] = None
    company_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    class Config:
        from_attributes = True

class DocExterneOut(BaseModel):
    id: int
    titre: str
    url: str
    categorie: Optional[str] = "Autre"
    date_ajout: datetime 
    chantier_id: Optional[int] = None
    class Config:
        from_attributes = True