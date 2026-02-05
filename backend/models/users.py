from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    subscription_plan = Column(String, default="free")
    
    logo_url = Column(String, nullable=True)
    address = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    users = relationship("User", back_populates="company")
    chantiers = relationship("Chantier", back_populates="company")
    materiels = relationship("Materiel", back_populates="company")
    duerps = relationship("DUERP", back_populates="company") 
    documents = relationship("CompanyDocument", back_populates="company")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="conducteur")
    nom = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company = relationship("Company", back_populates="users")

class CompanyDocument(Base):
    __tablename__ = "company_documents"

    id = Column(Integer, primary_key=True, index=True)
    titre = Column(String)
    url = Column(String)
    date_upload = Column(DateTime, default=datetime.utcnow)
    date_expiration = Column(DateTime, nullable=True)

    company_id = Column(Integer, ForeignKey("companies.id"))
    company = relationship("Company", back_populates="documents")