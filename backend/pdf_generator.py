from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageOps
import os
import requests
from io import BytesIO
from datetime import datetime

# --- CONFIGURATION DESIGN PRO ---
COLOR_PRIMARY = (0.1, 0.2, 0.4) # Bleu Architecture
COLOR_SECONDARY = (0.4, 0.4, 0.4) # Gris Texte
COLOR_BG_LIGHT = (0.95, 0.96, 0.98) # Fond alterné très clair
FONT_TITLE = "Helvetica-Bold"
FONT_TEXT = "Helvetica"

def get_optimized_image(path_or_url):
    if not path_or_url: return None
    try:
        if path_or_url.startswith("http"):
            # Optimisation Cloudinary : 800px de large, JPG
            optimized_url = path_or_url
            if "cloudinary.com" in path_or_url and "/upload/" in path_or_url:
                optimized_url = path_or_url.replace("/upload/", "/upload/w_800,q_auto,f_jpg/")
            
            response = requests.get(optimized_url, stream=True, timeout=10)
            if response.status_code == 200:
                return Image.open(BytesIO(response.content))
        else:
            clean_path = path_or_url.replace("/static/", "")
            possible_paths = [os.path.join("uploads", clean_path), clean_path]
            for p in possible_paths:
                if os.path.exists(p):
                    return Image.open(p)
    except Exception as e:
        print(f"Warning image: {e}")
    return None

def draw_footer(c, width, height, chantier, titre_doc):
    """Pied de page professionnel sur toutes les pages"""
    c.saveState()
    c.setStrokeColorRGB(0.8, 0.8, 0.8); c.setLineWidth(0.5)
    c.line(1*cm, 1.5*cm, width-1*cm, 1.5*cm)
    
    c.setFont(FONT_TEXT, 8); c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawString(1*cm, 1*cm, f"Conforméo - {titre_doc} - {chantier.nom}")
    c.drawRightString(width-1*cm, 1*cm, f"Page {c.getPageNumber()}")
    c.restoreState()

def draw_cover_page(c, chantier, titre_principal, sous_titre):
    """Page de garde épurée"""
    width, height = A4
    
    # 1. Logo
    logo = get_optimized_image("logo.png")
    if logo:
        try:
            rl_logo = ImageReader(logo)
            c.drawImage(rl_logo, 2*cm, height-4*cm, width=5*cm, height=2.5*cm, mask='auto', preserveAspectRatio=True)
        except: pass

    # 2. Titres
    y_center = height / 2 + 2*cm
    c.setFillColorRGB(*COLOR_PRIMARY)
    c.setFont(FONT_TITLE, 32)
    c.drawCentredString(width/2, y_center, titre_principal)
    
    y_center -= 1.5*cm
    c.setFillColorRGB(*COLOR_SECONDARY)
    c.setFont(FONT_TEXT, 16)
    c.drawCentredString(width/2, y_center, sous_titre)
    
    y_center -= 2*cm
    c.setStrokeColorRGB(*COLOR_PRIMARY); c.setLineWidth(2)
    c.line(width/2-3*cm, y_center, width/2+3*cm, y_center)

    # 3. Infos Chantier
    y_center -= 3*cm
    c.setFillColorRGB(0, 0, 0)
    
    c.setFont(FONT_TITLE, 12); c.drawCentredString(width/2, y_center, "PROJET")
    y_center -= 0.6*cm
    c.setFont(FONT_TEXT, 14); c.drawCentredString(width/2, y_center, chantier.nom or "-")
    
    y_center -= 1.5*cm
    c.setFont(FONT_TITLE, 12); c.drawCentredString(width/2, y_center, "CLIENT")
    y_center -= 0.6*cm
    c.setFont(FONT_TEXT, 14); c.drawCentredString(width/2, y_center, chantier.client or "-")

    # 4. Date
    date_str = datetime.now().strftime('%d/%m/%Y')
    c.setFont("Helvetica-Oblique", 10); c.setFillColorRGB(0.6, 0.6, 0.6)
    c.drawRightString(width-2*cm, 3*cm, f"Édité le {date_str}")
    
    c.showPage()

# ==========================================
# 1. JOURNAL DE BORD (PHOTOS EN GRILLE)
# ==========================================
def generate_pdf(chantier, rapports, inspections, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    
    draw_cover_page(c, chantier, "JOURNAL DE BORD", "Suivi d'exécution & Contrôles")
    
    y = height - 3 * cm
    def check_space(needed):
        nonlocal y
        if y < needed:
            draw_footer(c, width, height, chantier, "Journal de Bord")
            c.showPage()
            y = height - 3 * cm

    # --- PHOTOS ---
    if rapports:
        c.setFillColorRGB(*COLOR_PRIMARY); c.setFont(FONT_TITLE, 14)
        c.drawString(margin, y, "1. RELEVÉS PHOTOS")
        y -= 0.2*cm; c.setLineWidth(1); c.setStrokeColorRGB(*COLOR_PRIMARY)
        c.line(margin, y, width-margin, y)
        y -= 1.5 * cm

        for rap in rapports:
            # En-tête du rapport (Gris clair)
            check_space(3*cm)
            c.setFillColorRGB(*COLOR_BG_LIGHT)
            c.rect(margin, y-1.2*cm, width-2*margin, 1.2*cm, fill=1, stroke=0)
            
            c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 11)
            date_rap = rap.date_creation.strftime('%d/%m %H:%M') if isinstance(rap.date_creation, datetime) else ""
            c.drawString(margin+0.5*cm, y-0.4*cm, f"{date_rap} | {rap.titre or 'Observation'}")
            
            if rap.description:
                c.setFont(FONT_TEXT, 10); c.setFillColorRGB(0.3, 0.3, 0.3)
                c.drawString(margin+0.5*cm, y-0.9*cm, rap.description[:110])
            
            y -= 1.8*cm # Espace après le titre

            # Images (Grille 2 colonnes)
            imgs = []
            if hasattr(rap, 'images') and rap.images: imgs = [i.url for i in rap.images]
            elif hasattr(rap, 'photo_url') and rap.photo_url: imgs = [rap.photo_url]

            # Dimensions pour 2 colonnes : (17cm total) -> 8cm + 1cm (gap) + 8cm
            img_w = 8.25*cm
            img_h = 6.2*cm
            
            for i in range(0, len(imgs), 2):
                check_space(img_h + 0.5*cm)
                
                # Image 1 (Gauche)
                url1 = imgs[i]
                pil1 = get_optimized_image(url1)
                if pil1:
                    try:
                        pil1 = ImageOps.exif_transpose(pil1)
                        c.drawImage(ImageReader(pil1), margin, y-img_h, width=img_w, height=img_h, preserveAspectRatio=True)
                    except: pass
                
                # Image 2 (Droite)
                if i+1 < len(imgs):
                    url2 = imgs[i+1]
                    pil2 = get_optimized_image(url2)
                    if pil2:
                        try:
                            pil2 = ImageOps.exif_transpose(pil2)
                            c.drawImage(ImageReader(pil2), width-margin-img_w, y-img_h, width=img_w, height=img_h, preserveAspectRatio=True)
                        except: pass
                
                y -= (img_h + 0.5*cm) # On descend d'une ligne
            
            y -= 1*cm # Espace entre rapports

    # --- QHSE (TABLEAU PROPRE) ---
    if inspections:
        check_space(4*cm)
        c.setFillColorRGB(*COLOR_PRIMARY); c.setFont(FONT_TITLE, 14)
        c.drawString(margin, y, "2. CONTRÔLES QHSE")
        y -= 0.2*cm; c.setLineWidth(1); c.setStrokeColorRGB(*COLOR_PRIMARY)
        c.line(margin, y, width-margin, y); y -= 1.5 * cm

        for insp in inspections:
            check_space(3*cm)
            
            # En-tête Audit
            c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 12)
            date_audit = insp.date_creation.strftime('%d/%m/%Y') if isinstance(insp.date_creation, datetime) else ""
            c.drawString(margin, y, f"📋 {insp.titre or 'Audit'} ({date_audit})")
            y -= 0.8*cm
            
            # Ligne d'en-tête tableau
            c.setFillColorRGB(0.9, 0.9, 0.9)
            c.rect(margin, y-0.5*cm, width-2*margin, 0.5*cm, fill=1, stroke=0)
            c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 8)
            c.drawString(margin+0.2*cm, y-0.35*cm, "POINTS DE CONTRÔLE")
            c.drawRightString(width-margin-0.2*cm, y-0.35*cm, "STATUT")
            y -= 0.8*cm

            questions = insp.data if isinstance(insp.data, list) else []
            for q in questions:
                check_space(0.8*cm)
                
                # Ligne séparation fine
                c.setStrokeColorRGB(0.9, 0.9, 0.9); c.setLineWidth(0.5)
                c.line(margin, y-0.1*cm, width-margin, y-0.1*cm)
                
                q_text = q.get('q') or "Point de contrôle"
                status = q.get('status', 'NA')
                
                # Statut et Couleur
                txt, color = "N/A", (0.5,0.5,0.5)
                bg_color = None
                
                if status == 'OK': 
                    txt, color = "CONFORME", (0, 0.6, 0)
                elif status == 'NOK': 
                    txt, color = "NON CONFORME", (0.8, 0, 0)
                    bg_color = (1, 0.95, 0.95) # Fond rouge très pâle pour NOK
                
                # Fond si NOK
                if bg_color:
                    c.setFillColorRGB(*bg_color)
                    # Rectangle ajusté (hauteur 0.6cm, centré sur la ligne)
                    c.rect(margin, y-0.2*cm, width-2*margin, 0.6*cm, fill=1, stroke=0)

                # Texte Question
                c.setFillColorRGB(0,0,0); c.setFont(FONT_TEXT, 9)
                c.drawString(margin+0.2*cm, y+0.1*cm, q_text)
                
                # Texte Statut (Aligné droite)
                c.setFont(FONT_TITLE, 8); c.setFillColorRGB(*color)
                c.drawRightString(width-margin-0.2*cm, y+0.1*cm, txt)
                
                y -= 0.7*cm
            y -= 1*cm

    # --- SIGNATURE ---
    check_space(5*cm)
    y -= 1*cm
    c.setStrokeColorRGB(0,0,0); c.setLineWidth(1)
    c.line(margin, y, width-margin, y)
    y -= 1*cm
    c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 12)
    c.drawString(width-8*cm, y, "Validation :")
    
    if chantier.signature_url:
        sig = get_optimized_image(chantier.signature_url)
        if sig:
            try: c.drawImage(ImageReader(sig), width-8*cm, y-4*cm, 5*cm, 3*cm, mask='auto', preserveAspectRatio=True)
            except: pass
            
    draw_footer(c, width, height, chantier, "Journal de Bord")
    c.save()
    return output_path

# ==========================================
# 2. GENERATEUR PPSPS
# ==========================================
def generate_ppsps_pdf(chantier, ppsps, output_path):
    """Génère le PPSPS avec style pro"""
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    
    draw_cover_page(c, chantier, "P.P.S.P.S", "Plan Particulier de Sécurité")
    y = height - 3 * cm
    
    def check_space(needed):
        nonlocal y
        if y < needed:
            draw_footer(c, width, height, chantier, "PPSPS")
            c.showPage()
            y = height - 3 * cm

    def draw_section(title):
        nonlocal y
        check_space(2*cm)
        c.setFillColorRGB(*COLOR_PRIMARY); c.setFont(FONT_TITLE, 14)
        c.drawString(margin, y, title)
        y -= 0.2*cm; c.setLineWidth(1); c.setStrokeColorRGB(*COLOR_PRIMARY)
        c.line(margin, y, width-margin, y); c.setFillColorRGB(0,0,0); y -= 0.8*cm

    draw_section("1. RENSEIGNEMENTS GÉNÉRAUX")
    c.setFont(FONT_TEXT, 10)
    lines = [
        f"Responsable : {ppsps.responsable_chantier or ''}", 
        f"Effectif : {ppsps.nb_compagnons} pers. | Horaires : {ppsps.horaires}", 
        f"CSPS : {ppsps.coordonnateur_sps or ''} | MOA : {ppsps.maitre_ouvrage or ''}"
    ]
    for l in lines: c.drawString(margin, y, l); y -= 0.6*cm
    y -= 0.5*cm

    draw_section("2. SECOURS & URGENCES")
    sec = ppsps.secours_data or {}
    c.setFont(FONT_TITLE, 11); c.setFillColorRGB(0.8, 0, 0)
    c.drawString(margin, y, f"📞 URGENCES : {sec.get('num_urgence','15')}")
    c.setFillColorRGB(0,0,0); c.setFont(FONT_TEXT, 10); y -= 0.8*cm
    c.drawString(margin, y, f"Hôpital : {sec.get('hopital','-')}"); y -= 0.6*cm
    c.drawString(margin, y, f"SST : {sec.get('sst_noms','-')}"); y -= 1*cm

    draw_section("3. HYGIÈNE & VIE DE CHANTIER")
    inst = ppsps.installations_data or {}
    c.drawString(margin, y, f"• Base vie : {inst.get('type_base', '-')}"); y -= 0.6*cm
    c.drawString(margin, y, f"• Eau potable : {inst.get('eau', '-')}"); y -= 0.6*cm
    c.drawString(margin, y, f"• Repas : {inst.get('repas', '-')}"); y -= 1.5*cm

    draw_section("4. ANALYSE DES RISQUES")
    taches = ppsps.taches_data or []
    if not taches: c.drawString(margin, y, "Aucun risque spécifique."); y -= 1*cm

    for t in taches:
        check_space(2.5*cm)
        c.setFillColorRGB(0.96, 0.96, 0.96) # Fond gris très clair
        c.rect(margin, y-1.8*cm, width-2*margin, 1.8*cm, fill=1, stroke=0)
        
        c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 10)
        c.drawString(margin+0.3*cm, y-0.5*cm, f"📌 {t.get('tache','Action')}")
        
        c.setFont(FONT_TEXT, 9); c.setFillColorRGB(0.8, 0, 0)
        c.drawString(margin+0.5*cm, y-1.0*cm, f"⚠️ {t.get('risque','')}")
        
        c.setFillColorRGB(0, 0.4, 0)
        c.drawString(margin+0.5*cm, y-1.5*cm, f"🛡️ {t.get('prevention','')}")
        
        c.setFillColorRGB(0,0,0); y -= 2.2*cm

    draw_footer(c, width, height, chantier, "PPSPS")
    c.save()
    return output_path