from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any, Dict
from datetime import datetime, date

# --- AUTH ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None

class UserUpdateAdmin(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None      
    is_active: Optional[bool] = None 
    company_id: Optional[int] = None 

class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    is_active: bool
    company_id: Optional[int] = None
    class Config:
        from_attributes = True

class UserInvite(BaseModel):
    email: EmailStr
    role: str = "conducteur" 

# --- COMPANY ---
class CompanyCreate(BaseModel):
    name: str
    address: Optional[str] = None

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None

class CompanyOut(BaseModel):
    id: int
    name: str
    subscription_plan: str = "free"
    logo_url: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    contact_email: Optional[str] = None 
    class Config:
        from_attributes = True

# --- MATERIEL ---
class MaterielCreate(BaseModel):
    nom: str
    reference: Optional[str] = None
    etat: str = "BON" 
    chantier_id: Optional[int] = None

# 👇 VERSION BLINDÉE
class MaterielOut(BaseModel):
    id: int
    nom: str
    reference: Optional[str] = None
    etat: Optional[str] = "BON" 
    chantier_id: Optional[int] = None
    # On accepte tout format pour éviter l'erreur 500
    date_derniere_vgp: Optional[Any] = None
    image_url: Optional[str] = None
    statut_vgp: Optional[str] = "INCONNU" 
    
    class Config:
        from_attributes = True

# --- TASKS ---
class TaskCreate(BaseModel):
    description: str
    chantier_id: int
    date_prevue: Optional[datetime] = None
    status: str = "TODO"

class TaskUpdate(BaseModel):
    description: Optional[str] = None
    status: Optional[str] = None
    date_prevue: Optional[datetime] = None

class TaskOut(BaseModel):
    id: int
    description: Optional[str] = "Tâche sans nom"
    status: Optional[str] = "TODO"
    date_prevue: Optional[datetime] = None
    chantier_id: int
    alert_message: Optional[str] = None
    alert_type: Optional[str] = None
    class Config:
        from_attributes = True

# --- DOCS INTERNES ---
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

# --- DOCS EXTERNES (DOE/GED) ---
class DocExterneOut(BaseModel):
    id: int
    titre: str
    url: str
    categorie: Optional[str] = "Autre"
    date_upload: datetime
    chantier_id: Optional[int] = None
    class Config:
        from_attributes = True

# --- COMPANY DOCS (KBIS...) ---
class CompanyDocOut(BaseModel):
    id: int
    titre: str
    url: str
    date_upload: datetime
    company_id: int
    class Config:
        from_attributes = True

# --- CHANTIER ---
class ChantierCreate(BaseModel):
    nom: str
    adresse: Optional[str] = None
    client: Optional[str] = None
    date_debut: Optional[Any] = None # <-- Modifié : Any au lieu de date
    date_fin: Optional[Any] = None   # <-- Modifié : Any au lieu de date

class ChantierUpdate(BaseModel):
    nom: Optional[str] = None
    adresse: Optional[str] = None
    est_actif: Optional[bool] = None
    client: Optional[str] = None

# --- CHANTIER ---
class ChantierOut(BaseModel):
    id: int
    nom: Optional[str] = "Chantier sans nom"
    adresse: Optional[str] = None
    client: Optional[str] = None
    # On accepte tout type de date pour éviter le crash 500
    date_debut: Optional[Any] = None 
    date_fin: Optional[Any] = None
    est_actif: bool = True 
    cover_url: Optional[str] = None
    company_id: Optional[int] = None
    signature_url: Optional[str] = None
    date_creation: Optional[Any] = None
    
    class Config:
        from_attributes = True

# --- RAPPORT ---
class RapportCreate(BaseModel):
    titre: str
    description: Optional[str] = None
    chantier_id: int
    niveau_urgence: str = "Normal"
    latitude: Optional[float] = None
    longitude: Optional[float] = None

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

# --- INSPECTION ---
class InspectionCreate(BaseModel):
    titre: str
    type: str
    data: Optional[Dict[str, Any]] = None 
    chantier_id: int
    createur: str

class InspectionOut(BaseModel):
    id: int
    titre: Optional[str] = "Inspection"
    type: Optional[str] = "Standard"
    data: Optional[Dict[str, Any]] = None 
    createur: Optional[str] = "Non renseigné"
    date_creation: Optional[datetime] = None
    chantier_id: int

    class Config:
        from_attributes = True

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

# --- PLAN DE PREVENTION (PDP) ---
class PlanPreventionCreate(BaseModel):
    chantier_id: int
    entreprise_utilisatrice: Optional[str] = None
    entreprise_exterieure: Optional[str] = None
    date_inspection_commune: Optional[datetime] = None
    consignes_securite: Optional[Dict[str, Any]] = None
    risques_interferents: Optional[List[Dict[str, Any]]] = None

class PlanPreventionOut(PlanPreventionCreate):
    id: int
    date_creation: datetime
    signature_eu: Optional[str] = None
    signature_ee: Optional[str] = None
    class Config:
        from_attributes = True

PdpCreate = PlanPreventionCreate
PdpOut = PlanPreventionOut

# --- DUERP (RENOMMÉ EN MAJUSCULES) ---
class DUERPRow(BaseModel):
    tache: str
    risque: str
    gravite: int
    mesures_realisees: Optional[str] = None
    mesures_a_realiser: Optional[str] = None

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

# Alias de compatibilité au cas où
DuerpRow = DUERPRow
DuerpCreate = DUERPCreate
DuerpOut = DUERPOut

# --- PIC (Plan Installation Chantier) ---
class PicSchema(BaseModel):
    chantier_id: int
    final_url: Optional[str] = None
    drawing_data: Optional[Dict[str, Any]] = None

class PicOut(PicSchema):
    id: int
    date_creation: datetime
    class Config:
        from_attributes = True