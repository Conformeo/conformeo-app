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
# ⚠️ TRES IMPORTANT : Sur Render, assurez-vous que la variable d'environnement SECRET_KEY 
# est définie. Si elle n'est pas définie, ce code utilisera la valeur par défaut.
# Si vous redémarrez le serveur et que cette clé change, tous les anciens tokens deviennent invalides.
SECRET_KEY = os.getenv("SECRET_KEY", "votre_super_secret_key_changez_moi")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 semaine

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# C'est ce schéma qui permet à FastAPI de savoir où chercher le token (Header Authorization: Bearer ...)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

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

# --- AUTHENTIFICATION & DEBUG ---

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # On prépare l'exception standard
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Impossible de valider les identifiants",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # 🔍 DEBUG : On loggue le début de la vérification
        # print(f"🔒 AUTH DEBUG: Token reçu (début) : {token[:10]}...")

        # Tentative de décodage avec la SECRET_KEY actuelle
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # 🔍 DEBUG : Si on arrive ici, la signature est valide
        # print(f"🔓 AUTH DEBUG: Payload décodé avec succès : {payload}")

        email: str = payload.get("sub")
        
        if email is None:
            print("❌ AUTH ERROR: Le token ne contient pas de champ 'sub' (email).")
            raise credentials_exception
            
    except JWTError as e:
        # C'est souvent ici que ça casse si la SECRET_KEY a changé ou si le token est mal formé
        print(f"❌ AUTH ERROR: Erreur de décodage JWT : {e}")
        raise credentials_exception
    
    # Vérification en base de données
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        print(f"❌ AUTH ERROR: Utilisateur '{email}' introuvable dans la base de données.")
        raise credentials_exception
    
    # print(f"✅ AUTH SUCCESS: Utilisateur authentifié : {user.email}")
    return user