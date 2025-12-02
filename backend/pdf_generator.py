from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageOps
import os
import requests
from io import BytesIO
from datetime import datetime  # <--- L'IMPORT QUI MANQUAIT !

def get_optimized_image(path_or_url):
    """
    Télécharge une image optimisée (redimensionnée) pour économiser la RAM.
    """
    try:
        # CAS 1 : URL Cloudinary (Optimisation Serveur)
        if path_or_url.startswith("http"):
            # Si c'est du Cloudinary, on injecte des paramètres de redimensionnement
            optimized_url = path_or_url
            if "cloudinary.com" in path_or_url and "/upload/" in path_or_url:
                optimized_url = path_or_url.replace("/upload/", "/upload/w_800,q_auto,f_jpg/")
            
            # On télécharge l'image légère
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
    """Génère le rapport de chantier classique (Journal de bord)"""
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    
    # --- CONSTANTES ---
    MARGE_X = 2 * cm
    MARGE_BAS = 3 * cm
    DEPART_HAUT = height - 3 * cm
    HAUTEUR_IMAGE = 6 * cm
    
    # --- EN-TÊTE ---
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
    
    # --- RAPPORTS ---
    for rapport in rapports:
        hauteur_texte = 2 * cm
        liste_images = []
        
        # Gestion V2 (Liste) et V1 (Unique)
        if hasattr(rapport, 'images') and rapport.images:
            for img_obj in rapport.images:
                liste_images.append(img_obj.url)
        elif hasattr(rapport, 'photo_url') and rapport.photo_url:
            liste_images.append(rapport.photo_url)

        if y_position - hauteur_texte < MARGE_BAS:
            c.showPage()
            y_position = DEPART_HAUT

        c.setFont("Helvetica-Bold", 12)
        c.drawString(MARGE_X, y_position, f"• {rapport.titre}")
        y_position -= 0.6 * cm
        
        c.setFont("Helvetica", 10)
        desc = (rapport.description[:90] + '...') if len(rapport.description) > 90 else rapport.description
        c.drawString(MARGE_X + 0.5*cm, y_position, f"Note: {desc}")
        y_position -= 1 * cm 

        for img_url in liste_images:
            if y_position - HAUTEUR_IMAGE < MARGE_BAS:
                c.showPage()
                y_position = DEPART_HAUT
            
            pil_image = get_optimized_image(img_url)
            if pil_image:
                try:
                    pil_image = ImageOps.exif_transpose(pil_image)
                    rl_image = ImageReader(pil_image)
                    c.drawImage(rl_image, MARGE_X + 0.5*cm, y_position - HAUTEUR_IMAGE, width=8*cm, height=HAUTEUR_IMAGE, preserveAspectRatio=True)
                    pil_image.close()
                except:
                    c.drawString(MARGE_X, y_position - 2*cm, "[Erreur Image]")
            
            y_position -= (HAUTEUR_IMAGE + 0.5*cm)

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

def generate_ppsps_pdf(chantier, ppsps, output_path):
    """Génère le PPSPS avec la nouvelle page de garde Design"""
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    
    # --- PAGE DE GARDE IMMERSIVE ---
    
    # 1. Image de fond (Cover du chantier)
    cover_img = None
    if chantier.cover_url:
        cover_img = get_optimized_image(chantier.cover_url)
    
    if cover_img:
        try:
            img_w, img_h = cover_img.size
            aspect = img_h / float(img_w)
            c.drawImage(ImageReader(cover_img), 0, 0, width=width, height=width*aspect, preserveAspectRatio=True)
            
            # Voile noir semi-transparent
            c.setFillColorRGB(0, 0, 0, 0.6)
            c.rect(0, 0, width, height, fill=1, stroke=0)
        except: pass
    else:
        # Fond bleu par défaut
        c.setFillColorRGB(0.1, 0.2, 0.4) 
        c.rect(0, 0, width, height, fill=1, stroke=0)

    # 2. Logo Conforméo
    logo_img = get_optimized_image("logo.png")
    if logo_img:
        try:
            rl_logo = ImageReader(logo_img)
            c.setFillColorRGB(1, 1, 1)
            c.roundRect(width/2 - 3*cm, height - 4*cm, 6*cm, 3*cm, 10, fill=1, stroke=0)
            c.drawImage(rl_logo, width/2 - 2.5*cm, height - 3.8*cm, width=5*cm, height=2.5*cm, preserveAspectRatio=True, mask='auto')
        except: pass

    # 3. Titre Principal
    c.setFillColorRGB(1, 1, 1) # Blanc
    c.setFont("Helvetica-Bold", 40)
    c.drawCentredString(width / 2, height / 2 + 2*cm, "P.P.S.P.S")
    
    c.setFont("Helvetica", 16)
    c.drawCentredString(width / 2, height / 2 + 0.5*cm, "Plan Particulier de Sécurité")
    c.drawCentredString(width / 2, height / 2 - 0.5*cm, "et de Protection de la Santé")
    
    c.setLineWidth(2)
    c.setStrokeColorRGB(1, 1, 1)
    c.line(width/2 - 4*cm, height/2 - 1.5*cm, width/2 + 4*cm, height/2 - 1.5*cm)

    # 4. Infos Chantier
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(width / 2, height / 2 - 3*cm, chantier.nom)
    
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height / 2 - 4*cm, chantier.adresse)

    # 5. Pied de page avec DATE (C'est ici que ça plantait)
    c.setFont("Helvetica-Oblique", 10)
    date_str = datetime.now().strftime('%d/%m/%Y')
    c.drawCentredString(width / 2, 2*cm, f"Document généré le {date_str}")
    
    c.showPage() # FIN PAGE DE GARDE

    # --- PAGES SUIVANTES ---
    margin = 2 * cm
    y = height - 3 * cm

    def check_page():
        nonlocal y
        if y < 3 * cm:
            c.showPage()
            y = height - 3 * cm

    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin, height - 1.5*cm, f"PPSPS - {chantier.nom}")
    c.line(margin, height - 1.8*cm, width - margin, height - 1.8*cm)

    # 1. INTERVENANTS
    c.setFont("Helvetica-Bold", 16)
    c.setFillColorRGB(0, 0.2, 0.5)
    c.drawString(margin, y, "1. RENSEIGNEMENTS GÉNÉRAUX")
    c.setFillColorRGB(0, 0, 0)
    y -= 1*cm
    
    c.setFont("Helvetica", 11)
    c.drawString(margin, y, f"Responsable Chantier : {ppsps.responsable_chantier}")
    y -= 0.6*cm
    c.drawString(margin, y, f"Effectif : {ppsps.nb_compagnons} compagnons - Horaires : {ppsps.horaires}")
    y -= 0.6*cm
    c.drawString(margin, y, f"Durée : {ppsps.duree_travaux}")
    y -= 0.6*cm
    c.drawString(margin, y, f"CSPS : {ppsps.coordonnateur_sps} | MOA : {ppsps.maitre_ouvrage}")
    y -= 1.5*cm

    # 2. SECOURS
    c.setFont("Helvetica-Bold", 16)
    c.setFillColorRGB(0, 0.2, 0.5)
    c.drawString(margin, y, "2. ORGANISATION DES SECOURS")
    c.setFillColorRGB(0, 0, 0)
    y -= 1*cm
    
    secours = ppsps.secours_data if ppsps.secours_data else {}
    c.setFont("Helvetica", 11)
    c.drawString(margin, y, f"🏥 Hôpital : {secours.get('hopital', 'Non défini')}")
    y -= 0.6*cm
    c.drawString(margin, y, f"📞 Urgences : {secours.get('num_urgence', '15 / 18')}")
    y -= 0.6*cm
    c.drawString(margin, y, f"💊 Trousse Secours : {secours.get('trousse_loc', 'Véhicule')}")
    y -= 0.6*cm
    c.drawString(margin, y, f"⛑️ Sauveteurs (SST) : {secours.get('sst_noms', 'Aucun')}")
    y -= 1.5*cm

    # 3. HYGIENE
    c.setFont("Helvetica-Bold", 16)
    c.setFillColorRGB(0, 0.2, 0.5)
    c.drawString(margin, y, "3. HYGIÈNE & VIE DE CHANTIER")
    c.setFillColorRGB(0, 0, 0)
    y -= 1*cm
    
    inst = ppsps.installations_data if ppsps.installations_data else {}
    c.setFont("Helvetica", 11)
    c.drawString(margin, y, f"Base vie : {inst.get('type_base', '-')}")
    y -= 0.6*cm
    c.drawString(margin, y, f"Eau potable : {inst.get('eau', '-')}")
    y -= 0.6*cm
    c.drawString(margin, y, f"Repas : {inst.get('repas', '-')}")
    y -= 1.5*cm

    # 4. RISQUES
    check_page()
    c.setFont("Helvetica-Bold", 16)
    c.setFillColorRGB(0, 0.2, 0.5)
    c.drawString(margin, y, "4. ANALYSE DES TÂCHES & PRÉVENTION")
    c.setFillColorRGB(0, 0, 0)
    y -= 1*cm

    taches = ppsps.taches_data if ppsps.taches_data else []
    
    if not taches:
        c.drawString(margin, y, "Aucune tâche spécifique renseignée.")
    
    for t in taches:
        check_page()
        c.setFillColorRGB(0.95, 0.95, 0.95)
        c.rect(margin - 0.2*cm, y - 1.8*cm, width - 2*margin + 0.4*cm, 2.2*cm, fill=1, stroke=0)
        c.setFillColorRGB(0, 0, 0)

        c.setFont("Helvetica-Bold", 11)
        c.drawString(margin, y, f"📌 Tâche : {t.get('tache')}")
        y -= 0.6*cm
        c.setFont("Helvetica", 10)
        c.setFillColorRGB(0.8, 0, 0)
        c.drawString(margin + 0.5*cm, y, f"⚠️ Risque : {t.get('risque')}")
        y -= 0.6*cm
        c.setFillColorRGB(0, 0.5, 0)
        c.drawString(margin + 0.5*cm, y, f"🛡️ Mesures : {t.get('prevention')}")
        c.setFillColorRGB(0, 0, 0)
        y -= 1.2*cm 

    c.save()