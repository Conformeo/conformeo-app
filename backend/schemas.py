from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any, Dict, Union
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
    nom: str  # On utilise nom ici
    company_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    nom: Optional[str] = None        # Priorité à nom
    full_name: Optional[str] = None  # On garde pour compatibilité

class UserUpdateAdmin(BaseModel):
    nom: Optional[str] = None       # Priorité à nom
    full_name: Optional[str] = None 
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None      
    is_active: Optional[Any] = None 
    company_id: Optional[Any] = None 

class UserOut(BaseModel):
    id: int
    email: EmailStr
    nom: Optional[str] = None # C'est ce champ que le front va lire
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

# --- MATERIEL ---
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

# --- TASKS ---
class TaskCreate(BaseModel):
    description: str
    chantier_id: int
    date_prevue: Optional[datetime] = None
    status: str = "TODO"

class TaskUpdate(BaseModel):
    description: Optional[str] = None
    status: Optional[str] = None
    date_prevue: Optional[Any] = None 

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

# --- DOCS ---
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

class DocExterneOut(BaseModel):
    id: int
    titre: str
    url: str
    categorie: Optional[str] = "Autre"
    date_ajout: datetime 
    chantier_id: Optional[int] = None
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

# --- CHANTIER ---
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
        from_attributes = True # ✅ CORRECTION WARNING

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

# --- AUTRES ---
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

class PicSchema(BaseModel):
    chantier_id: int
    final_url: Optional[str] = None
    drawing_data: Optional[Dict[str, Any]] = None

class PicOut(PicSchema):
    id: int
    date_creation: datetime
    class Config:
        from_attributes = True

class PermisFeuCreate(BaseModel):
    chantier_id: int
    lieu: str
    intervenant: str
    description: str
    extincteur: bool
    nettoyage: bool
    surveillance: bool

class PermisFeuOut(PermisFeuCreate):
    id: int
    date: datetime
    class Config:
        from_attributes = True











# Dans backend/schemas.py

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    nom: str
    company_name: Optional[str] = None # 👈 Ajoutez cette ligne si elle manque