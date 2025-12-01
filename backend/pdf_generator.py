from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
import requests
from io import BytesIO
from PIL import Image, ImageOps
import os

def generate_pdf(chantier, rapports, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    
    # --- CONSTANTES DE MISE EN PAGE ---
    MARGE_BAS = 2 * cm
    DEPART_HAUT = height - 3 * cm
    
    # --- 0. LE LOGO (En haut à droite) ---
    # On cherche le fichier dans le dossier courant
    logo_path = "logo.png" 
    
    if os.path.exists(logo_path):
        try:
            # On dessine le logo (Largeur max 5cm, Hauteur max 2.5cm)
            # mask='auto' permet de gérer la transparence des PNG
            c.drawImage(logo_path, width - 7 * cm, height - 3.5 * cm, width=5*cm, height=2.5*cm, preserveAspectRatio=True, mask='auto')
        except Exception as e:
            print(f"Erreur logo: {e}")

    # --- 1. En-tête (Texte à gauche) ---
    c.setFont("Helvetica-Bold", 24)
    c.drawString(2 * cm, height - 3 * cm, f"Rapport de Chantier")
    
    c.setFont("Helvetica-Bold", 16)
    c.setFillColorRGB(0.2, 0.2, 0.2) # Gris foncé
    c.drawString(2 * cm, height - 4 * cm, f"{chantier.nom}")
    c.setFillColorRGB(0, 0, 0) # Retour au noir
    
    c.setFont("Helvetica", 12)
    c.drawString(2 * cm, height - 5 * cm, f"Client: {chantier.client}")
    c.drawString(2 * cm, height - 5.5 * cm, f"Adresse: {chantier.adresse}")
    
    # Ligne de séparation
    c.setLineWidth(1)
    c.line(2 * cm, height - 6.5 * cm, width - 2 * cm, height - 6.5 * cm)
    
    # Position de départ pour les rapports (on descend un peu plus bas qu'avant)
    y_position = height - 8 * cm
    
    for rapport in rapports:
        # --- CALCUL DE HAUTEUR DU BLOC ---
        hauteur_requise = 2.5 * cm 
        
        image_path = None
        if rapport.photo_url:
            try:
                img_data = None
                
                # CAS 1 : Image locale (ex: Signature ancienne ou test)
                if rapport.photo_url.startswith("/static/"):
                    filename = rapport.photo_url.replace("/static/", "")
                    local_path = os.path.join("uploads", filename)
                    if os.path.exists(local_path):
                        img = Image.open(local_path)
                        img_data = img

                # CAS 2 : Image Cloudinary (Commence par http)
                elif rapport.photo_url.startswith("http"):
                    response = requests.get(rapport.photo_url)
                    if response.status_code == 200:
                        img = Image.open(BytesIO(response.content))
                        img_data = img

                # TRAITEMENT COMMUN (Rotation + Dessin)
                if img_data:
                    # Correction Rotation EXIF
                    transposed_img = ImageOps.exif_transpose(img_data)
                    
                    # On convertit en ImageReader pour ReportLab
                    rl_image = ImageReader(transposed_img)
                    
                    # Dessin
                    c.drawImage(rl_image, 2.5 * cm, y_position - 6 * cm, width=8*cm, height=6*cm, preserveAspectRatio=True)
                    y_position -= 7 * cm
                    
            except Exception as e:
                print(f"Erreur image: {e}")
                c.drawString(2.5 * cm, y_position, "[Erreur chargement image]")
                y_position -= 1 * cm
        else:
            y_position -= 1 * cm

        # --- SAUT DE PAGE SI NECESSAIRE ---
        if (y_position - hauteur_requise) < MARGE_BAS:
            c.showPage()
            y_position = DEPART_HAUT
            
        # --- DESSIN DU CONTENU ---
        c.setFont("Helvetica-Bold", 14)
        c.drawString(2 * cm, y_position, f"• {rapport.titre}")
        y_position -= 1 * cm
        
        c.setFont("Helvetica", 10)
        c.drawString(2.5 * cm, y_position, f"Note: {rapport.description}")
        y_position -= 1 * cm
        
        if image_path:
            try:
                # Correction Rotation
                img = Image.open(image_path)
                transposed_img = ImageOps.exif_transpose(img)
                transposed_img.save(image_path)
                img.close()
                
                c.drawImage(image_path, 2.5 * cm, y_position - 6 * cm, width=8*cm, height=6*cm, preserveAspectRatio=True)
                y_position -= 7 * cm 
            except:
                c.drawString(2.5 * cm, y_position, "[Erreur image]")
                y_position -= 1 * cm
        
        y_position -= 0.5 * cm

    # --- SIGNATURE (FIN DE DOCUMENT) ---
    if y_position < 5 * cm:
        c.showPage()
        y_position = height - 3 * cm

    y_position -= 2 * cm
    c.line(2 * cm, y_position, width - 2 * cm, y_position)
    y_position -= 1 * cm
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(width - 8 * cm, y_position, "Validation :")
    
    if chantier.signature_url:
        sig_filename = chantier.signature_url.replace("/static/", "")
        sig_path = os.path.join("uploads", sig_filename)
        if os.path.exists(sig_path):
            try:
                c.drawImage(sig_path, width - 8 * cm, y_position - 4 * cm, width=5*cm, height=3*cm, preserveAspectRatio=True, mask='auto')
            except: pass

    c.save()
    return output_path