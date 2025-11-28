from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader # Pour lire l'image modifiée
from PIL import Image, ImageOps # <--- NOUVEAUX IMPORTS
import os

def generate_pdf(chantier, rapports, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    
    # 1. En-tête
    c.setFont("Helvetica-Bold", 24)
    c.drawString(2 * cm, height - 3 * cm, f"Rapport de Chantier: {chantier.nom}")
    
    c.setFont("Helvetica", 12)
    c.drawString(2 * cm, height - 4 * cm, f"Client: {chantier.client}")
    c.drawString(2 * cm, height - 4.5 * cm, f"Adresse: {chantier.adresse}")
    
    c.line(2 * cm, height - 5 * cm, width - 2 * cm, height - 5 * cm)
    
    # 2. Liste des Rapports
    y_position = height - 7 * cm
    
    for rapport in rapports:
        if y_position < 8 * cm: # Marge de sécurité pour image + texte
            c.showPage()
            y_position = height - 3 * cm
            
        c.setFont("Helvetica-Bold", 14)
        c.drawString(2 * cm, y_position, f"• {rapport.titre}")
        y_position -= 1 * cm
        
        c.setFont("Helvetica", 10)
        c.drawString(2.5 * cm, y_position, f"Note: {rapport.description}")
        y_position -= 1 * cm
        
        if rapport.photo_url:
            filename = rapport.photo_url.replace("/static/", "")
            image_path = os.path.join("uploads", filename)
            
            if os.path.exists(image_path):
                try:
                    # --- CORRECTION ROTATION ---
                    # 1. On ouvre l'image avec Pillow
                    pil_image = Image.open(image_path)
                    
                    # 2. On applique la rotation selon les données EXIF (magie !)
                    pil_image = ImageOps.exif_transpose(pil_image)
                    
                    # 3. On convertit pour ReportLab
                    rl_image = ImageReader(pil_image)
                    
                    # 4. On dessine
                    c.drawImage(rl_image, 2.5 * cm, y_position - 6 * cm, width=8*cm, height=6*cm, preserveAspectRatio=True)
                    y_position -= 7 * cm
                except Exception as e:
                    print(f"Erreur image: {e}")
                    c.drawString(2.5 * cm, y_position, "[Erreur image]")
                    y_position -= 1 * cm
            else:
                y_position -= 1 * cm

        y_position -= 1 * cm

    c.save()
    return output_path