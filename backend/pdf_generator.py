from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from PIL import Image, ImageOps
import os

def generate_pdf(chantier, rapports, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    
    # --- CONSTANTES DE MISE EN PAGE ---
    MARGE_BAS = 2 * cm
    DEPART_HAUT = height - 3 * cm
    
    # 1. En-tête (Première page uniquement)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(2 * cm, height - 3 * cm, f"Rapport de Chantier: {chantier.nom}")
    
    c.setFont("Helvetica", 12)
    c.drawString(2 * cm, height - 4 * cm, f"Client: {chantier.client}")
    c.drawString(2 * cm, height - 4.5 * cm, f"Adresse: {chantier.adresse}")
    
    c.line(2 * cm, height - 5 * cm, width - 2 * cm, height - 5 * cm)
    
    # Position de départ pour les rapports
    y_position = height - 7 * cm
    
    for rapport in rapports:
        # --- CALCUL DE LA HAUTEUR NÉCESSAIRE ---
        # Hauteur de base (Titre + Desc + Espaces)
        hauteur_requise = 2.5 * cm 
        
        # Vérification si image existe
        image_path = None
        if rapport.photo_url:
            filename = rapport.photo_url.replace("/static/", "")
            potential_path = os.path.join("uploads", filename)
            if os.path.exists(potential_path):
                image_path = potential_path
                hauteur_requise += 7 * cm # Image (6cm) + Marge (1cm)

        # --- DÉCISION SAUT DE PAGE ---
        # Si la position actuelle moins la hauteur requise est trop basse...
        if (y_position - hauteur_requise) < MARGE_BAS:
            c.showPage() # Hop, nouvelle page
            y_position = DEPART_HAUT # On repart d'en haut
            
        # --- DESSIN DU CONTENU ---
        # 1. Titre
        c.setFont("Helvetica-Bold", 14)
        c.drawString(2 * cm, y_position, f"• {rapport.titre}")
        y_position -= 1 * cm
        
        # 2. Description
        c.setFont("Helvetica", 10)
        c.drawString(2.5 * cm, y_position, f"Note: {rapport.description}")
        y_position -= 1 * cm
        
        # 3. Image (si elle existe et a été trouvée)
        if image_path:
            try:
                # Correction Rotation (Ton code qui marche)
                img = Image.open(image_path)
                transposed_img = ImageOps.exif_transpose(img)
                transposed_img.save(image_path)
                img.close()
                
                # Dessin
                c.drawImage(image_path, 2.5 * cm, y_position - 6 * cm, width=8*cm, height=6*cm, preserveAspectRatio=True)
                y_position -= 7 * cm # On descend de la hauteur de l'image + marge
            except Exception as e:
                print(f"Erreur image: {e}")
                c.drawString(2.5 * cm, y_position, "[Erreur affichage image]")
                y_position -= 1 * cm
        
        # Petit espace avant le prochain rapport
        y_position -= 0.5 * cm
    
    # 3. Zone de Signature (Pied de page de la dernière page)
    # On vérifie s'il reste de la place, sinon nouvelle page
    if y_position < 5 * cm:
        c.showPage()
        y_position = height - 3 * cm

    y_position -= 2 * cm
    c.line(2 * cm, y_position, width - 2 * cm, y_position) # Ligne de séparation
    y_position -= 1 * cm
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(width - 8 * cm, y_position, "Signature Client / Conducteur :")
    
    if chantier.signature_url:
        sig_filename = chantier.signature_url.replace("/static/", "")
        sig_path = os.path.join("uploads", sig_filename)
        
        if os.path.exists(sig_path):
            try:
                # Signature souvent petite, on la met en bas à droite
                c.drawImage(sig_path, width - 8 * cm, y_position - 4 * cm, width=5*cm, height=3*cm, preserveAspectRatio=True, mask='auto')
            except:
                pass

    c.save()
    return output_path