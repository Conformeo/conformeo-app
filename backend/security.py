from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import models
from database import get_db
import os

# --- CONFIGURATION ---
SECRET_KEY = os.getenv("SECRET_KEY", "votre_super_secret_key_changez_moi")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 semaine

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 1. Schéma Standard (Bloquant) : Renvoie 401 si pas de token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# 2. Schéma Optionnel (Non bloquant) : Renvoie None si pas de token (Pour le PDF)
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

# --- UTILITAIRES ---

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- NOUVELLE FONCTION (Pour main.py) ---
def decode_access_token(token: str):
    """
    Tente de décoder un token manuellement.
    Retourne le payload (dict) si valide, ou None si invalide.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

# --- AUTHENTIFICATION ---

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    Authentification standard stricte.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Impossible de valider les identifiants",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # On utilise notre nouvelle fonction interne
    payload = decode_access_token(token)
    
    if payload is None:
        raise credentials_exception

    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    
    return user

async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme_optional), 
    db: Session = Depends(get_db)
):
    """
    Authentification "douce".
    Si le header est présent, on vérifie.
    Si le header est absent, on renvoie None (au lieu de planter).
    Cela permet à la route PDF de vérifier ensuite le paramètre ?token=...
    """
    if not token:
        return None
    
    try:
        # On réutilise la logique standard
        return await get_current_user(token, db)
    except HTTPException:
        # Si le token du header est invalide, on renvoie None 
        # (peut-être que le token URL sera valide, lui)
        return None