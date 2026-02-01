from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

# Préfixe /tasks défini ici
router = APIRouter(prefix="/tasks", tags=["Tasks"])

# 👇 CORRECTION IMPORTANTE : "" au lieu de "/"
# Cela permet d'accepter POST /tasks sans redirection (et donc sans perdre le token)
@router.post("", response_model=schemas.TaskOut)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if task.chantier_id:
        c = db.query(models.Chantier).filter(models.Chantier.id == task.chantier_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Chantier introuvable")
        if c.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Non autorisé")

    new_task = models.Task(**task.dict())
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    
    if task.chantier:
        if task.chantier.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Non autorisé")
            
    db.delete(task)
    db.commit()
    return {"status": "deleted"}

@router.put("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, task_update: schemas.TaskUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tâche introuvable")

    if task.chantier and task.chantier.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Non autorisé")

    for key, value in task_update.dict(exclude_unset=True).items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return task