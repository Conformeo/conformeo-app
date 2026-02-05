from pydantic import BaseModel
from typing import Optional, Any

class MaterielCreate(BaseModel):
    nom: str
    reference: Optional[str] = None
    ref_interne: Optional[str] = None 
    etat: str = "BON" 
    chantier_id: Optional[int] = None
    date_derniere_vgp: Optional[Any] = None 
    image_url: Optional[str] = None

class MaterielUpdate(BaseModel):
    nom: Optional[str] = None
    reference: Optional[str] = None
    ref_interne: Optional[str] = None 
    etat: Optional[str] = None
    chantier_id: Optional[Any] = None
    statut_vgp: Optional[str] = None 
    image_url: Optional[str] = None
    date_derniere_vgp: Optional[Any] = None

class MaterielOut(BaseModel):
    id: int
    nom: str
    reference: Optional[str] = None
    ref_interne: Optional[str] = None 
    etat: Optional[str] = "BON" 
    chantier_id: Optional[int] = None
    date_derniere_vgp: Optional[Any] = None
    image_url: Optional[str] = None
    statut_vgp: Optional[str] = "INCONNU" 
    class Config:
        from_attributes = True