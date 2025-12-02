from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageOps
import os
import requests
from io import BytesIO

def get_optimized_image(path_or_url):
    """
    Télécharge une image optimisée (redimensionnée) pour économiser la RAM.
    """
    try:
        # CAS 1 : URL Cloudinary (Optimisation Serveur)
        if path_or_url.startswith("http"):
            # Si c'est du Cloudinary, on injecte des paramètres de redimensionnement
            # w_800 : Largeur 800px (suffisant pour PDF)
            # q_auto : Qualité auto
            # f_jpg : Force le format JPG (plus léger que PNG)
            optimized_url = path_or_url
            if "cloudinary.com" in path_or_url and "/upload/" in path_or_url:
                optimized_url = path_or_url.replace("/upload/", "/upload/w_800,q_auto,f_jpg/")
            
            # On télécharge l'image légère (flux streaming pour ne pas saturer la RAM)
            response = requests.get(optimized_url, stream=True)
            if response.status_code == 200:
                img = Image.open(BytesIO(response.content))
                return img
        
        # CAS 2 : Fichier Local (Logo, etc.)
        else:
            clean_path = path_or_url.replace("/static/", "")
            possible_paths = [os.path.join("uploads", clean_path), clean_path]
            
            for p in possible_paths:
                if os.path.exists(p):
                    return Image.open(p)
                    
    except Exception as e:
        print(f"Erreur chargement image optimisée ({path_or_url}): {e}")
    
    return None

def generate_pdf(chantier, rapports, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    
    # --- CONSTANTES ---
    MARGE_X = 2 * cm
    MARGE_BAS = 3 * cm
    DEPART_HAUT = height - 3 * cm
    ESPACE_LIGNE = 0.5 * cm
    HAUTEUR_IMAGE = 6 * cm # Hauteur fixe pour les photos
    
    # --- EN-TÊTE (LOGO + INFOS) ---
    logo_img = get_optimized_image("logo.png")
    if logo_img:
        try:
            rl_logo = ImageReader(logo_img)
            c.drawImage(rl_logo, width - 7 * cm, height - 3.5 * cm, width=5*cm, height=2.5*cm, preserveAspectRatio=True, mask='auto')
        except: pass

    c.setFont("Helvetica-Bold", 22)
    c.drawString(MARGE_X, height - 3 * cm, f"Rapport de Chantier")
    
    c.setFont("Helvetica-Bold", 14)
    c.setFillColorRGB(0.2, 0.2, 0.2)
    c.drawString(MARGE_X, height - 4 * cm, f"{chantier.nom}")
    c.setFillColorRGB(0, 0, 0)
    
    c.setFont("Helvetica", 11)
    c.drawString(MARGE_X, height - 5 * cm, f"Client: {chantier.client}")
    c.drawString(MARGE_X, height - 5.5 * cm, f"Adresse: {chantier.adresse}")
    
    c.setLineWidth(1)
    c.line(MARGE_X, height - 6.5 * cm, width - MARGE_X, height - 6.5 * cm)
    
    y_position = height - 8 * cm
    
    # --- BOUCLE SUR LES RAPPORTS ---
    for rapport in rapports:
        
        # 1. Calcul hauteur nécessaire pour le TEXTE
        hauteur_texte = 2 * cm
        
        # 2. Récupération de la liste des images (V2 ou V1)
        liste_images = []
        
        # Si c'est la V2 (liste d'objets images)
        if hasattr(rapport, 'images') and rapport.images:
            for img_obj in rapport.images:
                liste_images.append(img_obj.url)
        # Fallback V1 (si pas de liste, on regarde photo_url)
        elif rapport.photo_url:
            liste_images.append(rapport.photo_url)

        # 3. Saut de page préventif pour le TITRE
        if y_position - hauteur_texte < MARGE_BAS:
            c.showPage()
            y_position = DEPART_HAUT

        # 4. Dessin du TITRE et DESCRIPTION
        c.setFont("Helvetica-Bold", 12)
        c.drawString(MARGE_X, y_position, f"• {rapport.titre}")
        y_position -= 0.6 * cm
        
        c.setFont("Helvetica", 10)
        # Petit hack pour éviter que la description sorte de la page (tronquer si trop long pour ce MVP)
        desc = (rapport.description[:90] + '...') if len(rapport.description) > 90 else rapport.description
        c.drawString(MARGE_X + 0.5*cm, y_position, f"Note: {desc}")
        y_position -= 1 * cm # Espace après le texte

        # 5. BOUCLE SUR LES IMAGES DU RAPPORT
        for img_url in liste_images:
            # Saut de page si pas assez de place pour UNE image
            if y_position - HAUTEUR_IMAGE < MARGE_BAS:
                c.showPage()
                y_position = DEPART_HAUT
            
            # Téléchargement et traitement image
            pil_image = get_optimized_image(img_url)
            
            if pil_image:
                try:
                    pil_image = ImageOps.exif_transpose(pil_image)
                    rl_image = ImageReader(pil_image)
                    
                    # On dessine
                    c.drawImage(rl_image, MARGE_X + 0.5*cm, y_position - HAUTEUR_IMAGE, width=8*cm, height=HAUTEUR_IMAGE, preserveAspectRatio=True)
                    
                    # On libère la mémoire immédiatement (Important pour Render !)
                    pil_image.close()
                    del pil_image
                    
                except:
                    c.drawString(MARGE_X, y_position - 2*cm, "[Erreur Image]")
            
            y_position -= (HAUTEUR_IMAGE + 0.5*cm) # On descend pour la prochaine image ou rapport

        # Espace entre deux rapports
        y_position -= 0.5 * cm

    # --- SIGNATURE ---
    if y_position < 4 * cm:
        c.showPage()
        y_position = DEPART_HAUT

    y_position -= 1 * cm
    c.line(MARGE_X, y_position, width - MARGE_X, y_position)
    y_position -= 1 * cm
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(width - 8 * cm, y_position, "Validation :")
    
    if chantier.signature_url:
        sig_img = get_optimized_image(chantier.signature_url)
        if sig_img:
            try:
                rl_sig = ImageReader(sig_img)
                c.drawImage(rl_sig, width - 8 * cm, y_position - 4 * cm, width=5*cm, height=3*cm, preserveAspectRatio=True, mask='auto')
            except: pass

    c.save()
    return output_path