from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageOps
import os
import requests
from io import BytesIO

def get_image_from_url_or_path(path_or_url):
    """Récupère une image (Pillow) depuis un fichier local ou une URL."""
    try:
        # CAS 1 : URL Cloudinary (commence par http)
        if path_or_url.startswith("http"):
            response = requests.get(path_or_url)
            if response.status_code == 200:
                return Image.open(BytesIO(response.content))
        
        # CAS 2 : Fichier Local (commence par /static/ ou chemin relatif)
        else:
            # Nettoyage du chemin si c'est une URL relative de l'ancienne version
            clean_path = path_or_url.replace("/static/", "")
            # On cherche dans uploads ou à la racine
            possible_paths = [
                os.path.join("uploads", clean_path),
                clean_path # Pour logo.png
            ]
            
            for p in possible_paths:
                if os.path.exists(p):
                    return Image.open(p)
                    
    except Exception as e:
        print(f"Erreur chargement image ({path_or_url}): {e}")
    
    return None

def generate_pdf(chantier, rapports, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    
    # --- CONSTANTES ---
    MARGE_BAS = 2 * cm
    DEPART_HAUT = height - 3 * cm
    
    # --- 0. LE LOGO (Local) ---
    logo_img = get_image_from_url_or_path("logo.png")
    if logo_img:
        try:
            # On utilise ImageReader pour la compatibilité ReportLab
            rl_logo = ImageReader(logo_img)
            c.drawImage(rl_logo, width - 7 * cm, height - 3.5 * cm, width=5*cm, height=2.5*cm, preserveAspectRatio=True, mask='auto')
        except: pass

    # --- 1. EN-TÊTE ---
    c.setFont("Helvetica-Bold", 24)
    c.drawString(2 * cm, height - 3 * cm, f"Rapport de Chantier")
    
    c.setFont("Helvetica-Bold", 16)
    c.setFillColorRGB(0.2, 0.2, 0.2)
    c.drawString(2 * cm, height - 4 * cm, f"{chantier.nom}")
    c.setFillColorRGB(0, 0, 0)
    
    c.setFont("Helvetica", 12)
    c.drawString(2 * cm, height - 5 * cm, f"Client: {chantier.client}")
    c.drawString(2 * cm, height - 5.5 * cm, f"Adresse: {chantier.adresse}")
    
    c.setLineWidth(1)
    c.line(2 * cm, height - 6.5 * cm, width - 2 * cm, height - 6.5 * cm)
    
    y_position = height - 8 * cm
    
    # --- 2. RAPPORTS ---
    for rapport in rapports:
        hauteur_requise = 2.5 * cm 
        pil_image = None
        
        if rapport.photo_url:
            pil_image = get_image_from_url_or_path(rapport.photo_url)
            if pil_image:
                hauteur_requise += 7 * cm 

        # Saut de page
        if (y_position - hauteur_requise) < MARGE_BAS:
            c.showPage()
            y_position = DEPART_HAUT
            
        # Textes
        c.setFont("Helvetica-Bold", 14)
        c.drawString(2 * cm, y_position, f"• {rapport.titre}")
        y_position -= 1 * cm
        
        c.setFont("Helvetica", 10)
        c.drawString(2.5 * cm, y_position, f"Note: {rapport.description}")
        y_position -= 1 * cm
        
        # Image (Rotation + Affichage)
        if pil_image:
            try:
                # Correction rotation
                pil_image = ImageOps.exif_transpose(pil_image)
                rl_image = ImageReader(pil_image)
                
                c.drawImage(rl_image, 2.5 * cm, y_position - 6 * cm, width=8*cm, height=6*cm, preserveAspectRatio=True)
                y_position -= 7 * cm 
            except:
                c.drawString(2.5 * cm, y_position, "[Erreur affichage image]")
                y_position -= 1 * cm
        
        y_position -= 0.5 * cm

    # --- 3. SIGNATURE ---
    if y_position < 5 * cm:
        c.showPage()
        y_position = height - 3 * cm

    y_position -= 2 * cm
    c.line(2 * cm, y_position, width - 2 * cm, y_position)
    y_position -= 1 * cm
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(width - 8 * cm, y_position, "Validation :")
    
    if chantier.signature_url:
        sig_img = get_image_from_url_or_path(chantier.signature_url)
        if sig_img:
            try:
                rl_sig = ImageReader(sig_img)
                c.drawImage(rl_sig, width - 8 * cm, y_position - 4 * cm, width=5*cm, height=3*cm, preserveAspectRatio=True, mask='auto')
            except: pass

    c.save()
    return output_path