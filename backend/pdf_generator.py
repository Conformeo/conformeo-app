from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageOps
import os
import requests
from io import BytesIO
from datetime import datetime

# --- CONFIGURATION DESIGN ---
COLOR_PRIMARY = (0, 0.2, 0.5) # Bleu Pro
COLOR_SECONDARY = (0.1, 0.1, 0.1) # Gris fonce
COLOR_BG_HEADER = (0.92, 0.94, 0.97) # Gris/Bleu très clair pour les fonds
FONT_TITLE = "Helvetica-Bold"
FONT_TEXT = "Helvetica"

def get_optimized_image(path_or_url):
    """Télécharge et optimise une image (800px max)."""
    if not path_or_url: return None
    try:
        if path_or_url.startswith("http"):
            optimized_url = path_or_url
            if "cloudinary.com" in path_or_url and "/upload/" in path_or_url:
                # Optimisation WebP ou JPG, largeur 800
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

def draw_footer(c, width, height, chantier):
    """Dessine le pied de page sur toutes les pages (sauf couverture)"""
    c.saveState()
    c.setStrokeColorRGB(0.8, 0.8, 0.8)
    c.setLineWidth(0.5)
    c.line(1*cm, 1.5*cm, width-1*cm, 1.5*cm)
    
    c.setFont(FONT_TEXT, 8)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    
    # Gauche : Nom du chantier
    c.drawString(1*cm, 1*cm, f"Conforméo - {chantier.nom}")
    
    # Droite : Numéro de page
    page_num = c.getPageNumber()
    c.drawRightString(width-1*cm, 1*cm, f"Page {page_num}")
    c.restoreState()

def draw_cover_page(c, chantier, titre, sous_titre):
    """Page de garde immersive"""
    width, height = A4
    
    # Fond
    if chantier.cover_url:
        cover = get_optimized_image(chantier.cover_url)
        if cover:
            try:
                w, h = cover.size
                aspect = h / float(w)
                c.drawImage(ImageReader(cover), 0, 0, width=width, height=width*aspect, preserveAspectRatio=True)
                c.setFillColorRGB(0, 0, 0, 0.6) # Voile noir
                c.rect(0, 0, width, height, fill=1, stroke=0)
            except: pass
    else:
        c.setFillColorRGB(*COLOR_PRIMARY)
        c.rect(0, 0, width, height, fill=1, stroke=0)

    # Logo
    logo = get_optimized_image("logo.png")
    if logo:
        try:
            rl_logo = ImageReader(logo)
            c.setFillColorRGB(1, 1, 1)
            c.roundRect(width/2-3*cm, height-4*cm, 6*cm, 3*cm, 10, fill=1, stroke=0)
            c.drawImage(rl_logo, width/2-2.5*cm, height-3.8*cm, 5*cm, 2.5*cm, mask='auto', preserveAspectRatio=True)
        except: pass

    # Titres
    c.setFillColorRGB(1, 1, 1)
    c.setFont(FONT_TITLE, 36)
    c.drawCentredString(width/2, height/2+2*cm, titre)
    
    c.setFont(FONT_TEXT, 18)
    c.drawCentredString(width/2, height/2, sous_titre)
    
    c.setStrokeColorRGB(1, 1, 1); c.setLineWidth(2)
    c.line(width/2-4*cm, height/2-1.5*cm, width/2+4*cm, height/2-1.5*cm)

    c.setFont(FONT_TITLE, 24)
    c.drawCentredString(width/2, height/2-3*cm, chantier.nom or "")
    c.setFont(FONT_TEXT, 14)
    c.drawCentredString(width/2, height/2-4*cm, chantier.adresse or "")
    
    c.setFont("Helvetica-Oblique", 10)
    c.drawCentredString(width/2, 2*cm, f"Document généré le {datetime.now().strftime('%d/%m/%Y')}")
    
    c.showPage()

# ==========================================
# 1. GENERATEUR JOURNAL DE BORD
# ==========================================
def generate_pdf(chantier, rapports, inspections, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    
    draw_cover_page(c, chantier, "JOURNAL DE BORD", "Suivi & Avancement")

    y = height - 3 * cm

    def check_space(needed):
        nonlocal y
        if y < needed:
            draw_footer(c, width, height, chantier)
            c.showPage()
            y = height - 3 * cm

    # --- SECTION 1 : PHOTOS (GRILLE 2 COLONNES) ---
    if rapports:
        c.setFillColorRGB(*COLOR_PRIMARY); c.setFont(FONT_TITLE, 18)
        c.drawString(margin, y, "1. RELEVÉS PHOTOS")
        y -= 0.2*cm; c.setLineWidth(2); c.setStrokeColorRGB(*COLOR_PRIMARY)
        c.line(margin, y, width-margin, y)
        y -= 1.5 * cm

        for rap in rapports:
            check_space(4*cm)
            
            # Header Rapport
            c.setFillColorRGB(0.95, 0.95, 0.95)
            c.rect(margin-0.2*cm, y-0.2*cm, width-2*margin+0.4*cm, 1.2*cm, fill=1, stroke=0)
            
            c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 12)
            titre = rap.titre or "Observation"
            date_rap = ""
            if rap.date_creation:
                if isinstance(rap.date_creation, str): date_rap = rap.date_creation[:10]
                elif isinstance(rap.date_creation, datetime): date_rap = rap.date_creation.strftime('%d/%m')
            
            c.drawString(margin, y+0.3*cm, f"📅 {date_rap} - {titre}")
            y -= 0.5*cm
            
            if rap.description:
                c.setFont(FONT_TEXT, 10); c.setFillColorRGB(0.3, 0.3, 0.3)
                c.drawString(margin, y, rap.description)
                y -= 0.8*cm

            # Récupération Images
            imgs = []
            if hasattr(rap, 'images') and rap.images:
                imgs = [img.url for img in rap.images]
            elif hasattr(rap, 'photo_url') and rap.photo_url:
                imgs = [rap.photo_url]

            # GRILLE 2 COLONNES
            # On traite les images par paire
            img_w = 8*cm
            img_h = 6*cm
            gap = 1*cm
            
            for i in range(0, len(imgs), 2):
                check_space(img_h + 1*cm)
                
                # Image Gauche
                url1 = imgs[i]
                pil1 = get_optimized_image(url1)
                if pil1:
                    try:
                        pil1 = ImageOps.exif_transpose(pil1)
                        c.drawImage(ImageReader(pil1), margin, y-img_h, width=img_w, height=img_h, preserveAspectRatio=True)
                    except: pass
                
                # Image Droite (si existe)
                if i+1 < len(imgs):
                    url2 = imgs[i+1]
                    pil2 = get_optimized_image(url2)
                    if pil2:
                        try:
                            pil2 = ImageOps.exif_transpose(pil2)
                            c.drawImage(ImageReader(pil2), margin+img_w+gap, y-img_h, width=img_w, height=img_h, preserveAspectRatio=True)
                        except: pass
                
                y -= (img_h + 0.5*cm)
            
            y -= 1*cm

    # --- SECTION 2 : QHSE (TABLEAU) ---
    if inspections:
        check_space(5*cm)
        c.setFillColorRGB(*COLOR_PRIMARY); c.setFont(FONT_TITLE, 18)
        c.drawString(margin, y, "2. CONTRÔLES QHSE")
        y -= 0.2*cm; c.setLineWidth(2); c.setStrokeColorRGB(*COLOR_PRIMARY)
        c.line(margin, y, width-margin, y)
        y -= 1.5 * cm

        for insp in inspections:
            check_space(3*cm)
            
            # Titre Audit (Fond coloré)
            c.setFillColorRGB(*COLOR_BG_HEADER)
            c.rect(margin, y-0.8*cm, width-2*margin, 1.2*cm, fill=1, stroke=0)
            
            c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 12)
            date_audit = insp.date_creation.strftime('%d/%m') if isinstance(insp.date_creation, datetime) else ""
            c.drawString(margin+0.5*cm, y, f"📋 {insp.titre or 'Audit'} ({date_audit})")
            y -= 1.2*cm
            
            questions = insp.data if isinstance(insp.data, list) else []
            for q in questions:
                check_space(1*cm)
                
                # Ligne de séparation fine
                c.setStrokeColorRGB(0.9, 0.9, 0.9); c.setLineWidth(0.5)
                c.line(margin, y-0.2*cm, width-margin, y-0.2*cm)
                
                # Question
                c.setFont(FONT_TEXT, 10); c.setFillColorRGB(0,0,0)
                q_text = q.get('q') or "Question"
                c.drawString(margin, y, f"- {q_text}")
                
                # Statut aligné à droite
                stat = q.get('status', 'NA')
                txt, color = "N/A", (0.5,0.5,0.5)
                if stat == 'OK': txt, color = "CONFORME", (0, 0.6, 0)
                elif stat == 'NOK': txt, color = "NON CONFORME", (0.8, 0, 0)
                
                c.setFont(FONT_TITLE, 10); c.setFillColorRGB(*color)
                c.drawRightString(width-margin, y, txt)
                
                y -= 0.8*cm
            y -= 1*cm

    # --- SECTION 3 : SIGNATURE ---
    check_space(5*cm)
    y -= 1*cm
    c.setStrokeColorRGB(0,0,0); c.setLineWidth(1)
    c.line(margin, y, width-margin, y)
    y -= 1*cm
    
    c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 12)
    c.drawString(width-8*cm, y, "Visa / Validation :")
    
    if chantier.signature_url:
        sig = get_optimized_image(chantier.signature_url)
        if sig:
            try: c.drawImage(ImageReader(sig), width-8*cm, y-4*cm, 5*cm, 3*cm, mask='auto', preserveAspectRatio=True)
            except: pass
    
    # Dernier pied de page
    draw_footer(c, width, height, chantier)
    c.save()

# ==========================================
# 2. GENERATEUR PPSPS (Même logique pro)
# ==========================================
def generate_ppsps_pdf(chantier, ppsps, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    
    draw_cover_page(c, chantier, "P.P.S.P.S", "Plan Particulier de Sécurité et de protection de la santé")

    y = height - 3 * cm

    def check_space(needed):
        nonlocal y
        if y < needed:
            draw_footer(c, width, height, chantier)
            c.showPage()
            y = height - 3 * cm

    # Styles Titres
    def draw_section_title(title):
        nonlocal y
        check_space(2*cm)
        c.setFillColorRGB(*COLOR_PRIMARY); c.setFont(FONT_TITLE, 16)
        c.drawString(margin, y, title)
        y -= 0.2*cm; c.setLineWidth(1.5); c.setStrokeColorRGB(*COLOR_PRIMARY)
        c.line(margin, y, width-margin, y)
        c.setFillColorRGB(0,0,0)
        y -= 1*cm

    # 1. INTERVENANTS
    draw_section_title("1. RENSEIGNEMENTS GÉNÉRAUX")
    c.setFont(FONT_TEXT, 11)
    
    data_list = [
        f"Responsable Chantier : {ppsps.responsable_chantier or ''}",
        f"CSPS : {ppsps.coordonnateur_sps or ''}",
        f"Maître d'Ouvrage : {ppsps.maitre_ouvrage or ''}",
        f"Maître d'Œuvre : {ppsps.maitre_oeuvre or ''}",
        f"Effectif : {ppsps.nb_compagnons} pers. | Horaires : {ppsps.horaires}",
        f"Durée : {ppsps.duree_travaux or ''}"
    ]
    
    for line in data_list:
        c.drawString(margin, y, line)
        y -= 0.7*cm
    y -= 1*cm

    # 2. SECOURS
    draw_section_title("2. ORGANISATION DES SECOURS")
    secours = ppsps.secours_data if ppsps.secours_data else {}
    
    # Cadre rouge pour l'urgence
    c.setStrokeColorRGB(0.8, 0, 0); c.setLineWidth(2)
    c.roundRect(margin, y-2.5*cm, width-2*margin, 2.5*cm, 8, stroke=1, fill=0)
    
    c.setFont(FONT_TITLE, 12); c.setFillColorRGB(0.8, 0, 0)
    c.drawString(margin+0.5*cm, y-0.8*cm, f"📞 URGENCES : {secours.get('num_urgence', '15 / 18')}")
    c.setFillColorRGB(0,0,0); c.setFont(FONT_TEXT, 11)
    c.drawString(margin+0.5*cm, y-1.5*cm, f"🏥 Hôpital : {secours.get('hopital', '-')}")
    c.drawString(margin+0.5*cm, y-2.1*cm, f"⛑️ Sauveteurs : {secours.get('sst_noms', '-')}")
    y -= 3.5*cm

    # 3. HYGIENE
    draw_section_title("3. HYGIÈNE & VIE DE CHANTIER")
    inst = ppsps.installations_data if ppsps.installations_data else {}
    c.drawString(margin, y, f"• Base vie : {inst.get('type_base', '-')}")
    y -= 0.6*cm
    c.drawString(margin, y, f"• Eau potable : {inst.get('eau', '-')}")
    y -= 0.6*cm
    c.drawString(margin, y, f"• Repas : {inst.get('repas', '-')}")
    y -= 1.5*cm

    # 4. RISQUES
    draw_section_title("4. ANALYSE DES RISQUES")
    taches = ppsps.taches_data if ppsps.taches_data else []
    
    if not taches:
        c.drawString(margin, y, "Aucun risque spécifique.")
    
    for t in taches:
        check_space(3*cm)
        # Fond gris pour la tache
        c.setFillColorRGB(0.95, 0.95, 0.95)
        c.rect(margin, y-2*cm, width-2*margin, 2*cm, fill=1, stroke=0)
        
        c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 11)
        c.drawString(margin+0.5*cm, y-0.5*cm, f"📌 {t.get('tache')}")
        
        c.setFillColorRGB(0.8, 0, 0); c.setFont(FONT_TEXT, 10)
        c.drawString(margin+1*cm, y-1*cm, f"⚠️ {t.get('risque')}")
        
        c.setFillColorRGB(0, 0.5, 0)
        c.drawString(margin+1*cm, y-1.5*cm, f"🛡️ {t.get('prevention')}")
        
        y -= 2.5*cm

    draw_footer(c, width, height, chantier)
    c.save()