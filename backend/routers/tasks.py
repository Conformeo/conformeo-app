from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])

# --- GET (Lecture) ---
# Double définition pour accepter "/tasks" ET "/tasks/"
@router.get("", response_model=List[schemas.TaskOut])
@router.get("/", response_model=List[schemas.TaskOut], include_in_schema=False)
def read_all_tasks(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Retourne toutes les tâches de l'entreprise (pour une vue globale)
    return db.query(models.Task).join(models.Chantier).filter(models.Chantier.company_id == current_user.company_id).all()

# --- POST (Création) ---
@router.post("", response_model=schemas.TaskOut)
@router.post("/", response_model=schemas.TaskOut, include_in_schema=False)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if task.chantier_id:
        c = db.query(models.Chantier).filter(models.Chantier.id == task.chantier_id).first()
        if not c: raise HTTPException(404, "Chantier introuvable")
        if c.company_id != current_user.company_id: raise HTTPException(403, "Non autorisé")

    new_task = models.Task(**task.dict())
    db.add(new_task); db.commit(); db.refresh(new_task)
    return new_task

@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t: raise HTTPException(404)
    if t.chantier and t.chantier.company_id != current_user.company_id: raise HTTPException(403)
    db.delete(t); db.commit()
    return {"status": "deleted"}

@router.put("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, u: schemas.TaskUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t: raise HTTPException(404)
    if t.chantier and t.chantier.company_id != current_user.company_id: raise HTTPException(403)
    for k, v in u.dict(exclude_unset=True).items(): setattr(t, k, v)
    db.commit(); db.refresh(t)
    return t