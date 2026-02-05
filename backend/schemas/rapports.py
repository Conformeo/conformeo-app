from pydantic import BaseModel
from typing import List, Optional, Union, Dict, Any
from datetime import datetime

class RapportCreate(BaseModel):
    titre: str
    description: Optional[str] = None
    chantier_id: int
    niveau_urgence: str = "Normal"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photo_url: Optional[str] = None

class ImageOut(BaseModel):
    id: int
    url: str
    class Config:
        from_attributes = True

class RapportOut(RapportCreate):
    id: int
    date_creation: datetime
    images: List[ImageOut] = []
    photo_url: Optional[str] = None 
    class Config:
        from_attributes = True

class InspectionCreate(BaseModel):
    titre: str
    type: str
    data: Union[List[Any], Dict[str, Any], Any] = None
    chantier_id: int
    createur: str

class InspectionOut(BaseModel):
    id: int
    titre: Optional[str] = "Inspection"
    type: Optional[str] = "Standard"
    data: Union[List[Any], Dict[str, Any], Any] = None
    createur: Optional[str] = "Non renseigné"
    date_creation: Optional[datetime] = None
    chantier_id: int
    class Config:
        from_attributes = True