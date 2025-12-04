from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageOps
import os
import requests
from io import BytesIO
from datetime import datetime

# --- CONFIGURATION DESIGN ARCHITECTE ---
COLOR_PRIMARY = (0.1, 0.2, 0.4) # Bleu Nuit (Titres)
COLOR_LINE = (0.7, 0.7, 0.7)    # Gris (Lignes)
FONT_TITLE = "Helvetica-Bold"
FONT_TEXT = "Helvetica"

def get_optimized_image(path_or_url):
    """Télécharge image optimisée (Cloudinary ou Local)"""
    if not path_or_url: return None
    try:
        if path_or_url.startswith("http"):
            opt_url = path_or_url
            if "cloudinary.com" in path_or_url and "/upload/" in path_or_url:
                opt_url = path_or_url.replace("/upload/", "/upload/w_800,q_auto,f_jpg/")
            resp = requests.get(opt_url, stream=True, timeout=10)
            if resp.status_code == 200: return Image.open(BytesIO(resp.content))
        else:
            clean = path_or_url.replace("/static/", "")
            paths = [os.path.join("uploads", clean), clean]
            for p in paths: 
                if os.path.exists(p): return Image.open(p)
    except: pass
    return None

def draw_footer(c, width, height, chantier, doc_type):
    """Pied de page technique simple"""
    c.saveState()
    c.setLineWidth(0.5); c.setStrokeColorRGB(*COLOR_LINE)
    c.line(1.5*cm, 1.5*cm, width-1.5*cm, 1.5*cm)
    
    c.setFont(FONT_TEXT, 8); c.setFillColorRGB(0.4, 0.4, 0.4)
    c.drawString(1.5*cm, 1*cm, f"CONFORMÉO | {doc_type} | {chantier.nom}")
    c.drawRightString(width-1.5*cm, 1*cm, f"Page {c.getPageNumber()}")
    c.restoreState()

def draw_cover_page(c, chantier, titre, sous_titre):
    """PAGE DE GARDE SOBRE (STYLE ARCHITECTE)"""
    width, height = A4
    
    # 1. Logo (Haut Gauche)
    logo = get_optimized_image("logo.png")
    if logo:
        try:
            rl_logo = ImageReader(logo)
            # Logo plus petit et discret
            c.drawImage(rl_logo, 2*cm, height-4*cm, width=4*cm, height=2*cm, mask='auto', preserveAspectRatio=True)
        except: pass

    # 2. Date (Haut Droite)
    date_str = datetime.now().strftime('%d/%m/%Y')
    c.setFont(FONT_TEXT, 10); c.setFillColorRGB(0.4, 0.4, 0.4)
    c.drawRightString(width-2*cm, height-3*cm, f"Date : {date_str}")

    # 3. Bloc Titre (Au tiers de la page)
    y = height - 10*cm
    
    # Ligne épaisse bleue
    c.setStrokeColorRGB(*COLOR_PRIMARY); c.setLineWidth(3)
    c.line(2*cm, y+1*cm, 2*cm, y-2*cm) # Barre verticale à gauche du titre
    
    c.setFillColorRGB(*COLOR_PRIMARY)
    c.setFont(FONT_TITLE, 32)
    c.drawString(2.5*cm, y, titre)
    
    c.setFillColorRGB(0,0,0); c.setFont(FONT_TEXT, 16)
    c.drawString(2.5*cm, y-1*cm, sous_titre)

    # 4. Bloc Infos Chantier (Encadré gris fin)
    y_info = 10*cm
    c.setStrokeColorRGB(0.8, 0.8, 0.8); c.setLineWidth(1)
    c.rect(2*cm, y_info, width-4*cm, 5*cm, stroke=1, fill=0)
    
    c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 12)
    c.drawString(3*cm, y_info+4*cm, "PROJET :")
    c.setFont(FONT_TEXT, 14)
    c.drawString(3*cm, y_info+3.3*cm, chantier.nom or "Non défini")
    
    c.setFont(FONT_TITLE, 12)
    c.drawString(3*cm, y_info+2*cm, "ADRESSE :")
    c.setFont(FONT_TEXT, 14)
    c.drawString(3*cm, y_info+1.3*cm, chantier.adresse or "-")

    c.showPage()

# --- 1. JOURNAL DE BORD ---
def generate_pdf(chantier, rapports, inspections, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    
    draw_cover_page(c, chantier, "JOURNAL DE BORD", "Suivi d'exécution & Contrôles")
    y = height - 3 * cm

    def check_space(needed):
        nonlocal y
        if y < needed or y < 3*cm:
            draw_footer(c, width, height, chantier, "Journal")
            c.showPage()
            y = height - 3 * cm

    if rapports:
        c.setFont(FONT_TITLE, 16); c.setFillColorRGB(*COLOR_PRIMARY)
        c.drawString(margin, y, "1. RELEVÉS PHOTOS")
        y -= 0.2*cm; c.setLineWidth(1); c.setStrokeColorRGB(0,0,0)
        c.line(margin, y, width-margin, y); y -= 1.5*cm

        for rap in rapports:
            check_space(4*cm)
            
            # Titre Rapport
            c.setFont(FONT_TITLE, 12); c.setFillColorRGB(0,0,0)
            d = rap.date_creation.strftime('%d/%m') if rap.date_creation else ""
            c.drawString(margin, y, f"📅 {d} - {rap.titre}")
            y -= 0.6*cm
            
            if rap.description:
                c.setFont(FONT_TEXT, 10); c.setFillColorRGB(0.3,0.3,0.3)
                c.drawString(margin, y, rap.description)
                y -= 0.8*cm
            
            # Images (Grille)
            imgs = [i.url for i in rap.images] if rap.images else ([rap.photo_url] if rap.photo_url else [])
            img_w, img_h = 8.2*cm, 6*cm
            
            for i in range(0, len(imgs), 2):
                check_space(7*cm)
                # Img 1
                pil1 = get_optimized_image(imgs[i])
                if pil1:
                    try:
                        pil1 = ImageOps.exif_transpose(pil1)
                        c.drawImage(ImageReader(pil1), margin, y-img_h, width=img_w, height=img_h, preserveAspectRatio=True)
                    except: pass
                # Img 2
                if i+1 < len(imgs):
                    pil2 = get_optimized_image(imgs[i+1])
                    if pil2:
                        try:
                            pil2 = ImageOps.exif_transpose(pil2)
                            c.drawImage(ImageReader(pil2), width-margin-img_w, y-img_h, width=img_w, height=img_h, preserveAspectRatio=True)
                        except: pass
                y -= (img_h + 0.5*cm)
            y -= 0.8*cm

    if inspections:
        check_space(4*cm)
        c.setFont(FONT_TITLE, 16); c.setFillColorRGB(*COLOR_PRIMARY)
        c.drawString(margin, y, "2. CONTRÔLES QHSE")
        y -= 0.2*cm; c.line(margin, y, width-margin, y); y -= 1.5*cm

        for insp in inspections:
            check_space(3*cm)
            c.setFont(FONT_TITLE, 12); c.setFillColorRGB(0,0,0)
            d = insp.date_creation.strftime('%d/%m') if insp.date_creation else ""
            c.drawString(margin, y, f"📋 {insp.titre} ({d})")
            y -= 0.8*cm
            
            # Entete tableau
            c.setFillColorRGB(0.95, 0.95, 0.95)
            c.rect(margin, y-0.6*cm, width-2*margin, 0.6*cm, fill=1, stroke=0)
            c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 9)
            c.drawString(margin+0.2*cm, y-0.4*cm, "Point de contrôle")
            c.drawRightString(width-margin-0.2*cm, y-0.4*cm, "Résultat")
            y -= 0.8*cm

            for q in (insp.data or []):
                check_space(0.8*cm)
                c.setFont(FONT_TEXT, 10); c.setFillColorRGB(0,0,0)
                c.drawString(margin+0.2*cm, y, f"- {q.get('q')}")
                
                st = q.get('status')
                txt, col = "N/A", (0.5,0.5,0.5)
                if st=='OK': txt, col = "CONFORME", (0, 0.6, 0)
                elif st=='NOK': txt, col = "NON CONFORME", (0.8, 0, 0)
                
                c.setFont(FONT_TITLE, 9); c.setFillColorRGB(*col)
                c.drawRightString(width-margin-0.2*cm, y, txt)
                
                c.setStrokeColorRGB(0.9,0.9,0.9); c.setLineWidth(0.5)
                c.line(margin, y-0.2*cm, width-margin, y-0.2*cm)
                y -= 0.6*cm
            y -= 1*cm

    draw_footer(c, width, height, chantier, "Journal")
    c.save()

# --- 2. PPSPS ---
def generate_ppsps_pdf(chantier, ppsps, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    draw_cover_page(c, chantier, "P.P.S.P.S", "Plan Particulier de Sécurité")
    
    y = height - 3 * cm
    def check_space(n):
        nonlocal y
        if y < n: draw_footer(c, width, height, chantier, "PPSPS"); c.showPage(); y = height - 3 * cm
    
    # Sections (Code simplifié pour tenir ici, gardez votre logique de contenu)
    sections = [
        ("1. RENSEIGNEMENTS", [
            f"Responsable: {ppsps.responsable_chantier}",
            f"CSPS: {ppsps.coordonnateur_sps}",
            f"Effectif: {ppsps.nb_compagnons} pers."
        ]),
        ("2. SECOURS", [
            f"Urgences: {ppsps.secours_data.get('num_urgence')}",
            f"Hôpital: {ppsps.secours_data.get('hopital')}"
        ])
    ]
    
    for title, lines in sections:
        check_space(3*cm)
        c.setFont(FONT_TITLE, 14); c.setFillColorRGB(*COLOR_PRIMARY)
        c.drawString(margin, y, title); y-=0.2*cm
        c.setStrokeColorRGB(0,0,0); c.line(margin, y, width-margin, y); y-=0.8*cm
        c.setFont(FONT_TEXT, 10); c.setFillColorRGB(0,0,0)
        for l in lines: c.drawString(margin, y, str(l)); y-=0.6*cm
        y-=1*cm

    # Risques
    check_space(4*cm)
    c.setFont(FONT_TITLE, 14); c.setFillColorRGB(*COLOR_PRIMARY)
    c.drawString(margin, y, "3. ANALYSE DES RISQUES")
    y-=1*cm
    
    taches = ppsps.taches_data or []
    for t in taches:
        check_space(2.5*cm)
        c.setFillColorRGB(0.95, 0.95, 0.95)
        c.rect(margin, y-2*cm, width-2*margin, 2*cm, fill=1, stroke=0)
        c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 10)
        c.drawString(margin+0.3*cm, y-0.5*cm, f"📌 {t.get('tache')}")
        c.setFillColorRGB(0.8,0,0); c.setFont(FONT_TEXT, 9)
        c.drawString(margin+0.5*cm, y-1*cm, f"⚠️ {t.get('risque')}")
        c.setFillColorRGB(0,0.5,0)
        c.drawString(margin+0.5*cm, y-1.5*cm, f"🛡️ {t.get('prevention')}")
        y-=2.5*cm

    draw_footer(c, width, height, chantier, "PPSPS")
    c.save()

# ==========================================
# 3. GENERATEUR AUDIT UNIQUE
# ==========================================
def generate_audit_pdf(chantier, inspection, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    
    draw_cover_page(c, chantier, "RAPPORT D'AUDIT", f"{inspection.titre} ({inspection.type})")
    
    y = height - 3 * cm
    def check_space(needed):
        nonlocal y
        if y < needed or y < 2.5*cm:
            draw_footer(c, width, height, chantier, "Rapport d'Audit")
            c.showPage()
            y = height - 3 * cm

    check_space(3*cm)
    c.setFillColorRGB(*COLOR_PRIMARY); c.setFont(FONT_TITLE, 16)
    c.drawString(margin, y, "DÉTAIL DE L'INSPECTION")
    y -= 0.2*cm; c.setLineWidth(1.5); c.setStrokeColorRGB(*COLOR_PRIMARY)
    c.line(margin, y, width-margin, y); c.setFillColorRGB(0,0,0); y -= 1*cm
    
    c.setFont(FONT_TEXT, 11)
    date_audit = inspection.date_creation.strftime('%d/%m/%Y à %H:%M')
    c.drawString(margin, y, f"Date : {date_audit} | Contrôleur : {inspection.createur}")
    y -= 1.5*cm

    questions = inspection.data if isinstance(inspection.data, list) else []
    for item in questions:
        check_space(1.5*cm)
        q_text = item.get('q', 'Point')
        status = item.get('status', 'NA')
        
        c.setFont(FONT_TEXT, 10)
        c.drawString(margin, y, q_text)
        
        txt, color = "N/A", (0.5,0.5,0.5)
        if status == 'OK': txt, color = "CONFORME", (0, 0.6, 0)
        elif status == 'NOK': txt, color = "NON CONFORME", (0.8, 0, 0)
        
        c.setFont(FONT_TITLE, 10); c.setFillColorRGB(*color)
        c.drawRightString(width-margin, y, txt)
        c.setFillColorRGB(0,0,0)
        
        c.setStrokeColorRGB(0.9,0.9,0.9); c.setLineWidth(0.5)
        c.line(margin, y-0.4*cm, width-margin, y-0.4*cm)
        y -= 1*cm

    draw_footer(c, width, height, chantier, "Rapport d'Audit")
    c.save()