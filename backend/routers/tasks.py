from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, database

router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"]
)

@router.get("", response_model=List[schemas.TaskOut])
def read_tasks(db: Session = Depends(database.get_db)):
    return db.query(models.Task).all()

@router.post("", response_model=schemas.TaskOut)
def create_task(task: schemas.TaskCreate, db: Session = Depends(database.get_db)):
    # 🧹 NETTOYAGE PRÉVENTIF
    # On convertit les données reçues en dictionnaire
    task_data = task.dict()
    
    # 🛡️ FIX CRITIQUE : On vérifie si 'titre' est dans les données
    # et on le retire car votre modèle 'models.Task' ne semble pas avoir cette colonne.
    # Cela évite le crash "TypeError: 'titre' is an invalid keyword argument"
    if 'titre' in task_data:
        # Sécurité : Si la description est vide, on sauve le titre dedans
        if not task_data.get('description'):
             task_data['description'] = task_data['titre']
        
        # On supprime 'titre' du paquet à envoyer à la base de données
        del task_data['titre']

    # Maintenant task_data est propre et ne contient que ce que la DB connait
    new_task = models.Task(**task_data)
    
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@router.put("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, task: schemas.TaskUpdate, db: Session = Depends(database.get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # On met à jour seulement les champs envoyés
    for key, value in task.dict(exclude_unset=True).items():
        # On ignore 'titre' s'il n'existe pas dans le modèle DB pour éviter le crash
        if key == 'titre' and not hasattr(models.Task, 'titre'):
            continue
        setattr(db_task, key, value)
    
    db.commit()
    db.refresh(db_task)
    return db_task

@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(database.get_db)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(db_task)
    db.commit()
    return {"message": "Task deleted"}