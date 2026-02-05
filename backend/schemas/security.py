from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date

# --- PPSPS ---
class PPSPSCreate(BaseModel):
    chantier_id: int
    responsable_chantier: Optional[str] = None
    nb_compagnons: int = 0
    horaires: Optional[str] = None
    coordonnateur_sps: Optional[str] = None
    maitre_ouvrage: Optional[str] = None
    secours_data: Optional[Dict[str, Any]] = None
    taches_data: Optional[List[Dict[str, Any]]] = None

class PPSPSOut(PPSPSCreate):
    id: int
    date_creation: datetime
    class Config:
        from_attributes = True

# --- PLAN DE PREVENTION ---
class PlanPreventionCreate(BaseModel):
    chantier_id: int
    entreprise_utilisatrice: Optional[str] = None
    entreprise_exterieure: Optional[str] = None
    date_inspection_commune: Optional[datetime] = None
    consignes_securite: Optional[Dict[str, Any]] = None
    risques_interferents: Optional[List[Dict[str, Any]]] = None
    signature_eu: Optional[str] = None
    signature_ee: Optional[str] = None

class PlanPreventionOut(PlanPreventionCreate):
    id: int
    date_creation: datetime
    class Config:
        from_attributes = True

PdpCreate = PlanPreventionCreate
PdpOut = PlanPreventionOut

# --- PIC ---
class PicSchema(BaseModel):
    chantier_id: int
    final_url: Optional[str] = None
    drawing_data: Optional[Dict[str, Any]] = None

class PicOut(PicSchema):
    id: int
    date_creation: datetime
    class Config:
        from_attributes = True

# --- DUERP ---
class DUERPRow(BaseModel):
    unite_travail: str = "Chantier Général"
    statut: str = "EN COURS"
    tache: str
    risque: str
    gravite: int
    mesures_realisees: Optional[str] = None
    mesures_a_realiser: Optional[str] = None
    class Config:
        from_attributes = True

class DUERPCreate(BaseModel):
    annee: int
    lignes: List[DUERPRow]

class DUERPOut(BaseModel):
    id: int
    annee: int
    date_mise_a_jour: datetime
    lignes: List[DUERPRow]
    class Config:
        from_attributes = True

DuerpRow = DUERPRow
DuerpCreate = DUERPCreate
DuerpOut = DUERPOut

# --- PERMIS FEU ---
class PermisFeuCreate(BaseModel):
    chantier_id: int
    lieu: str
    intervenant: str
    description: str
    extincteur: bool
    nettoyage: bool
    surveillance: bool
    signature: bool = True

class PermisFeuOut(PermisFeuCreate):
    id: int
    date: datetime
    class Config:
        from_attributes = True

class DocumentCreate(BaseModel):
    titre: str
    type_doc: str 
    date_expiration: Optional[date] = None

class DocumentOut(DocumentCreate):
    id: int
    url: str
    date_upload: datetime
    company_id: int
    is_signed: bool = False
    signed_by: Optional[str] = None
    date_signature: Optional[datetime] = None
    class Config:
        from_attributes = True

class DocSign(BaseModel):
    signature_base64: str
    nom_signataire: str