# Fichier: backend/pdf_generator.py
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
import os

def generate_pdf(chantier, rapports, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    
    # 1. En-tête (Logo + Titre)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(2 * cm, height - 3 * cm, f"Rapport de Chantier: {chantier.nom}")
    
    c.setFont("Helvetica", 12)
    c.drawString(2 * cm, height - 4 * cm, f"Client: {chantier.client}")
    c.drawString(2 * cm, height - 4.5 * cm, f"Adresse: {chantier.adresse}")
    
    # Ligne de séparation
    c.line(2 * cm, height - 5 * cm, width - 2 * cm, height - 5 * cm)
    
    # 2. Liste des Rapports
    y_position = height - 7 * cm
    
    for rapport in rapports:
        # Vérifier si on a de la place sur la page, sinon nouvelle page
        if y_position < 5 * cm:
            c.showPage()
            y_position = height - 3 * cm
            
        # Titre du rapport
        c.setFont("Helvetica-Bold", 14)
        c.drawString(2 * cm, y_position, f"• {rapport.titre}")
        y_position -= 1 * cm
        
        # Description
        c.setFont("Helvetica", 10)
        c.drawString(2.5 * cm, y_position, f"Note: {rapport.description}")
        y_position -= 1 * cm
        
        # Photo (si elle existe)
        if rapport.photo_url:
            # On nettoie l'URL pour avoir le chemin fichier (ex: /static/xxx.jpg -> uploads/xxx.jpg)
            filename = rapport.photo_url.replace("/static/", "")
            image_path = os.path.join("uploads", filename)
            
            if os.path.exists(image_path):
                # Dessiner l'image (redimensionnée à 6cm de haut)
                try:
                    c.drawImage(image_path, 2.5 * cm, y_position - 6 * cm, width=8*cm, height=6*cm, preserveAspectRatio=True)
                    y_position -= 7 * cm # On descend pour la prochaine
                except:
                    c.drawString(2.5 * cm, y_position, "[Erreur image]")
                    y_position -= 1 * cm
            else:
                y_position -= 1 * cm
        else:
            y_position -= 1 * cm

        # Espacement entre les items
        y_position -= 1 * cm

    c.save()
    return output_path