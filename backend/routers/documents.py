from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO

from .. import models
from ..database import get_db
from ..services import pdf as pdf_service

router = APIRouter(tags=["Documents PDF"])

# 1. PDF JOURNAL DE BORD (Global Chantier)
@router.get("/chantiers/{cid}/pdf")
def download_journal_pdf(cid: int, db: Session = Depends(get_db)):
    chantier = db.query(models.Chantier).filter(models.Chantier.id == cid).first()
    if not chantier: raise HTTPException(404, "Chantier introuvable")
    
    rapports = db.query(models.Rapport).filter(models.Rapport.chantier_id == cid).order_by(models.Rapport.date_creation.desc()).all()
    
    buffer = BytesIO()
    pdf_service.generate_journal_pdf(buffer, chantier, rapports)
    buffer.seek(0)
    
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename=Journal_{cid}.pdf"})

# 2. PDF PPSPS
@router.get("/ppsps/{doc_id}/pdf")
def download_ppsps_pdf(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.PPSPS).filter(models.PPSPS.id == doc_id).first()
    if not doc: raise HTTPException(404, "PPSPS introuvable")
    
    chantier = db.query(models.Chantier).filter(models.Chantier.id == doc.chantier_id).first()
    
    buffer = BytesIO()
    pdf_service.generate_ppsps_pdf(buffer, doc, chantier)
    buffer.seek(0)
    
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename=PPSPS_{doc_id}.pdf"})

# 3. PDF PLAN DE PREVENTION
@router.get("/plans-prevention/{pdp_id}/pdf")
def download_pdp_pdf(pdp_id: int, db: Session = Depends(get_db)):
    pdp = db.query(models.PlanPrevention).filter(models.PlanPrevention.id == pdp_id).first()
    if not pdp: raise HTTPException(404, "Plan introuvable")
    
    chantier = db.query(models.Chantier).filter(models.Chantier.id == pdp.chantier_id).first()
    
    buffer = BytesIO()
    pdf_service.generate_pdp_pdf(buffer, pdp, chantier)
    buffer.seek(0)
    
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename=PDP_{pdp_id}.pdf"})

# 4. PDF INSPECTIONS / AUDITS
@router.get("/inspections/{insp_id}/pdf")
def download_inspection_pdf(insp_id: int, db: Session = Depends(get_db)):
    # Pour l'instant on renvoie le journal global car la structure inspection est complexe
    # À affiner plus tard si vous voulez un PDF spécifique audit
    insp = db.query(models.Inspection).filter(models.Inspection.id == insp_id).first()
    if not insp: raise HTTPException(404)
    return download_journal_pdf(insp.chantier_id, db)