from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

class TaskCreate(BaseModel):
    description: str
    chantier_id: int
    date_prevue: Optional[datetime] = None
    status: str = "TODO"
    titre: Optional[str] = None 

class TaskUpdate(BaseModel):
    description: Optional[str] = None
    status: Optional[str] = None
    date_prevue: Optional[Any] = None 

class TaskOut(BaseModel):
    id: int
    description: Optional[str] = "Tâche sans nom"
    titre: Optional[str] = None 
    status: Optional[str] = "TODO"
    date_prevue: Optional[datetime] = None
    chantier_id: int
    alert_message: Optional[str] = None
    alert_type: Optional[str] = None
    class Config:
        from_attributes = True