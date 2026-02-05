from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, index=True)
    status = Column(String, default="TODO") 
    date_prevue = Column(DateTime, default=datetime.utcnow)
    
    chantier_id = Column(Integer, ForeignKey("chantiers.id"))
    chantier = relationship("Chantier", back_populates="tasks")