from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib import colors
from PIL import Image, ImageOps
import os
import requests
from io import BytesIO
from datetime import datetime

# --- CONFIGURATION DESIGN SOBRE ---
COLOR_PRIMARY = (0.1, 0.1, 0.3) # Bleu nuit Conforméo
COLOR_SECONDARY = (0.4, 0.4, 0.4) # Gris
FONT_TITLE = "Helvetica-Bold"
FONT_TEXT = "Helvetica"



# ==========================================
# 1. FONCTIONS UTILITAIRES
# ==========================================

def get_optimized_image(path_or_url):
    """Télécharge ou récupère une image locale de manière robuste."""
    if not path_or_url: return None
    try:
        if path_or_url.startswith("http"):
            # Gestion Cloudinary ou URL externe
            optimized_url = path_or_url
            if "cloudinary.com" in path_or_url and "/upload/" in path_or_url:
                # On demande une image optimisée (largeur 1000px max, qualité auto)
                optimized_url = path_or_url.replace("/upload/", "/upload/w_1000,q_auto,f_jpg/")
            
            response = requests.get(optimized_url, stream=True, timeout=5)
            if response.status_code == 200:
                return Image.open(BytesIO(response.content))
        else:
            # Gestion fichier local (Uploads)
            # On nettoie le chemin (parfois stocké avec un slash devant)
            clean_path = path_or_url.strip("/")
            
            possible_paths = [
                clean_path,
                os.path.join("uploads", os.path.basename(clean_path)),
                os.path.join(os.getcwd(), clean_path)
            ]
            
            for p in possible_paths:
                if os.path.exists(p):
                    return Image.open(p)
                    
    except Exception as e:
        print(f"❌ Erreur image: {e}")
    return None

def draw_footer(c, width, height, chantier, titre_doc):
    """Pied de page standardisé"""
    c.saveState()
    footer_y = 2 * cm 
    c.setStrokeColorRGB(0.8, 0.8, 0.8); c.setLineWidth(0.5)
    c.line(1*cm, footer_y + 0.5*cm, width-1*cm, footer_y + 0.5*cm)
    
    c.setFont(FONT_TEXT, 8); c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawString(1*cm, footer_y, f"Conforméo - {titre_doc} - {chantier.nom}")
    c.drawRightString(width-1*cm, footer_y, f"Page {c.getPageNumber()}")
    c.restoreState()

def draw_cover_page(c, chantier, titre_principal, sous_titre, company=None):
    """Page de garde standardisée"""
    width, height = A4
    logo_center_y = height / 2 + 3 * cm 
    
    # 1. Logo
    logo_source = None
    if company and company.logo_url: logo_source = company.logo_url
    elif hasattr(chantier, 'company') and chantier.company: logo_source = chantier.company.logo_url

    if logo_source:
        img = get_optimized_image(logo_source)
        if img:
            # Dimensions max du logo
            max_im_w = 12 * cm
            max_im_h = 8 * cm
            iw, ih = img.size
            ratio = min(max_im_w/iw, max_im_h/ih)
            new_w = iw * ratio
            new_h = ih * ratio
            
            pos_x = (width - new_w) / 2
            pos_y = logo_center_y - (new_h / 2)
            
            try:
                c.drawImage(ImageReader(img), pos_x, pos_y, width=new_w, height=new_h, mask='auto', preserveAspectRatio=True)
            except: pass

    # 2. Titres
    y_text = logo_center_y - 5 * cm 
    c.setFillColorRGB(*COLOR_PRIMARY); c.setFont(FONT_TITLE, 24)
    c.drawCentredString(width/2, y_text, titre_principal)
    
    y_text -= 1.2 * cm
    c.setFillColorRGB(*COLOR_SECONDARY); c.setFont(FONT_TEXT, 14)
    c.drawCentredString(width/2, y_text, sous_titre)
    
    # 3. Ligne de séparation
    y_text -= 2 * cm
    c.setStrokeColorRGB(0.8, 0.8, 0.8); c.setLineWidth(0.5)
    c.line(2*cm, y_text, width-2*cm, y_text)

    # 4. Infos Chantier
    y_info = y_text - 3 * cm
    x_labels = 2 * cm 
    x_values = 6 * cm 
    c.setFillColorRGB(0, 0, 0)
    
    c.setFont(FONT_TITLE, 14); c.drawString(x_labels, y_info, "PROJET :")
    c.setFont(FONT_TEXT, 14); c.drawString(x_values, y_info, chantier.nom or "Non défini")
    
    y_info -= 1.5 * cm
    c.setFont(FONT_TITLE, 14); c.drawString(x_labels, y_info, "ADRESSE :")
    c.setFont(FONT_TEXT, 14); c.drawString(x_values, y_info, chantier.adresse or "Non définie")
    
    if company:
        y_info -= 2.5 * cm
        c.setFont(FONT_TITLE, 12); c.setFillColorRGB(*COLOR_SECONDARY)
        c.drawString(x_labels, y_info, "RÉALISÉ PAR :")
        c.setFont(FONT_TEXT, 12); c.drawString(x_values, y_info, company.name)

    # Date génération
    date_str = datetime.now().strftime('%d/%m/%Y')
    c.setFont(FONT_TEXT, 10); c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawRightString(width-2*cm, y_info, f"Édité le {date_str}")
    
    c.showPage()

# ==========================================
# 2. GENERATEUR JOURNAL DE BORD 
# ==========================================
def generate_pdf(chantier, rapports, inspections, output_path, company=None):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    
    draw_cover_page(c, chantier, "JOURNAL DE BORD", "Suivi d'exécution & Rapports", company)

    y = height - 3 * cm
    bottom_limit = 3 * cm 

    def check_space(needed_height):
        nonlocal y
        if (y - needed_height) < bottom_limit:
            draw_footer(c, width, height, chantier, "Journal de Bord")
            c.showPage()
            y = height - 3 * cm

    # --- PHOTOS ---
    if rapports:
        c.setFillColorRGB(*COLOR_PRIMARY); c.setFont(FONT_TITLE, 14)
        c.drawString(margin, y, "1. RELEVÉS PHOTOS")
        y -= 0.2*cm; c.setLineWidth(1); c.setStrokeColorRGB(*COLOR_PRIMARY)
        c.line(margin, y, width-margin, y)
        y -= 1 * cm

        for rap in rapports:
            check_space(4*cm)
            c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 11)
            date_rap = rap.date_creation.strftime('%d/%m') if isinstance(rap.date_creation, datetime) else str(rap.date_creation)[:10]
            c.drawString(margin, y, f"{date_rap} | {rap.titre or 'Observation'}")
            y -= 0.6*cm
            
            if rap.description:
                c.setFont(FONT_TEXT, 10); c.setFillColorRGB(0.2, 0.2, 0.2)
                c.drawString(margin, y, rap.description)
                y -= 0.8*cm

            imgs = []
            if hasattr(rap, 'images') and rap.images: imgs = [i.url for i in rap.images]
            elif hasattr(rap, 'photo_url') and rap.photo_url: imgs = [rap.photo_url]

            # Grille 2 colonnes pour les images
            img_w, img_h, gap = 8*cm, 6*cm, 1*cm
            for i in range(0, len(imgs), 2):
                check_space(img_h + 0.5*cm)
                
                # Image 1
                url1 = imgs[i]
                pil1 = get_optimized_image(url1)
                if pil1:
                    try:
                        pil1 = ImageOps.exif_transpose(pil1) # Rotation auto selon EXIF
                        c.drawImage(ImageReader(pil1), margin, y-img_h, width=img_w, height=img_h, preserveAspectRatio=True)
                    except: pass
                
                # Image 2 (si existe)
                if i+1 < len(imgs):
                    url2 = imgs[i+1]
                    pil2 = get_optimized_image(url2)
                    if pil2:
                        try:
                            pil2 = ImageOps.exif_transpose(pil2)
                            c.drawImage(ImageReader(pil2), margin+img_w+gap, y-img_h, width=img_w, height=img_h, preserveAspectRatio=True)
                        except: pass
                
                y -= (img_h + 0.5*cm)
            
            y -= 0.5*cm

    # --- INSPECTIONS ---
    if inspections:
        check_space(4*cm)
        c.setFillColorRGB(*COLOR_PRIMARY); c.setFont(FONT_TITLE, 14)
        c.drawString(margin, y, "2. INSPECTIONS")
        y -= 0.2*cm; c.setLineWidth(1); c.setStrokeColorRGB(*COLOR_PRIMARY)
        c.line(margin, y, width-margin, y)
        y -= 1 * cm

        for insp in inspections:
            check_space(2*cm)
            c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 11)
            date_audit = insp.date_creation.strftime('%d/%m') if isinstance(insp.date_creation, datetime) else ""
            c.drawString(margin, y, f"{insp.titre or 'Audit'} ({date_audit})")
            y -= 0.8*cm
            
            questions = insp.data if isinstance(insp.data, list) else []
            for q in questions:
                check_space(0.6*cm)
                c.setFont(FONT_TEXT, 9); c.setFillColorRGB(0.2, 0.2, 0.2)
                c.drawString(margin+0.5*cm, y, f"- {q.get('q','')}")
                
                stat = q.get('status', 'NA')
                txt, color = "N/A", (0.5,0.5,0.5)
                if stat=='OK': txt, color = "CONFORME", (0, 0.6, 0)
                elif stat=='NOK': txt, color = "NON CONFORME", (0.8, 0, 0)
                
                c.setFont(FONT_TITLE, 9); c.setFillColorRGB(*color)
                c.drawRightString(width-margin, y, txt)
                y -= 0.5*cm
            y -= 0.5*cm

    # --- SIGNATURE ---
    check_space(5*cm)
    y -= 1*cm; c.setStrokeColorRGB(0,0,0); c.setLineWidth(1)
    c.line(margin, y, width-margin, y)
    y -= 1*cm; c.setFillColorRGB(0,0,0); c.setFont(FONT_TITLE, 12)
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
# 3. GENERATEUR PPSPS
# ==========================================
def generate_ppsps_pdf(chantier, ppsps, output_path, company=None):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    draw_cover_page(c, chantier, "P.P.S.P.S", "Plan Particulier de Sécurité", company)
    
    y = height - 3 * cm
    bottom_limit = 3 * cm

    def check_space(needed_height):
        nonlocal y
        if (y - needed_height) < bottom_limit:
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

    # 1. INFO
    draw_section("1. RENSEIGNEMENTS GÉNÉRAUX")
    c.setFont(FONT_TEXT, 10)
    lines = [
        f"Responsable : {ppsps.responsable_chantier or ''}",
        f"Effectif : {ppsps.nb_compagnons} pers. | Horaires : {ppsps.horaires}",
        f"CSPS : {ppsps.coordonnateur_sps or ''} | MOA : {ppsps.maitre_ouvrage or ''}"
    ]
    for l in lines: c.drawString(margin, y, l); y -= 0.6*cm
    y -= 0.5*cm

    # 2. SECOURS
    draw_section("2. SECOURS & URGENCES")
    sec = ppsps.secours_data or {}
    c.setFont(FONT_TITLE, 10);  c.setFillColorRGB(0.8, 0, 0)
    c.drawString(margin, y, f"URGENCES : {sec.get('num_urgence','15')}")
    c.setFillColorRGB(0,0,0); c.setFont(FONT_TEXT, 10); y -= 0.6*cm
    c.drawString(margin, y, f"Hôpital : {sec.get('hopital','-')}")
    y -= 0.6*cm
    c.drawString(margin, y, f"SST : {sec.get('sst_noms','-')}")
    y -= 1*cm

    # 3. RISQUES
    draw_section("3. ANALYSE DES RISQUES")
    taches = ppsps.taches_data or []
    if not taches: c.drawString(margin, y, "Aucun risque spécifique."); y -= 1*cm
    for t in taches:
        check_space(2.5*cm)
        c.setStrokeColorRGB(0.9,0.9,0.9); c.setLineWidth(0.5)
        c.line(margin, y, width-margin, y); y -= 0.5*cm
        c.setFont(FONT_TITLE, 10); c.drawString(margin, y, t.get('tache',''))
        y -= 0.5*cm
        c.setFont(FONT_TEXT, 9); c.setFillColorRGB(0.8, 0, 0)
        c.drawString(margin+0.5*cm, y, f"Risque : {t.get('risque','')}")
        y -= 0.5*cm
        c.setFillColorRGB(0, 0.4, 0)
        c.drawString(margin+0.5*cm, y, f"Prévention : {t.get('prevention','')}")
        c.setFillColorRGB(0,0,0); y -= 0.8*cm

    draw_footer(c, width, height, chantier, "PPSPS")
    c.save()
    return output_path

# ==========================================
# 4. GENERATEUR AUDIT UNIQUE
# ==========================================
def generate_audit_pdf(chantier, inspection, output_path, company=None):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    draw_cover_page(c, chantier, "RAPPORT D'INSPECTION", f"{inspection.titre} ({inspection.type})", company)
    
    y = height - 3 * cm
    bottom_limit = 3 * cm

    def check_space(needed_height):
        nonlocal y
        if (y - needed_height) < bottom_limit:
            draw_footer(c, width, height, chantier, "Rapport d'Inspection")
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
        c.setFont(FONT_TEXT, 10); c.drawString(margin, y, q_text)
        
        txt, color = "N/A", (0.5,0.5,0.5)
        if status == 'OK': txt, color = "CONFORME", (0, 0.6, 0)
        elif status == 'NOK': txt, color = "NON CONFORME", (0.8, 0, 0)
        
        c.setFont(FONT_TITLE, 10); c.setFillColorRGB(*color)
        c.drawRightString(width-margin, y, txt)
        c.setFillColorRGB(0,0,0)
        c.setStrokeColorRGB(0.9,0.9,0.9); c.setLineWidth(0.5)
        c.line(margin, y-0.4*cm, width-margin, y-0.4*cm)
        y -= 1*cm

    draw_footer(c, width, height, chantier, "Rapport d'Inspection")
    c.save()

# ==========================================
# 5. GENERATEUR PLAN DE PREVENTION (PdP)
# ==========================================
def generate_pdp_pdf(chantier, pdp, output_path, company=None):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    draw_cover_page(c, chantier, "PLAN DE PRÉVENTION", "Travaux en site occupé / Coactivité", company)

    y = height - 3 * cm
    bottom_limit = 3 * cm

    def check_space(needed_height):
        nonlocal y
        if (y - needed_height) < bottom_limit:
            draw_footer(c, width, height, chantier, "Plan de Prévention")
            c.showPage()
            y = height - 3 * cm

    def draw_section_title(title):
        nonlocal y
        check_space(2*cm)
        c.setFillColorRGB(*COLOR_PRIMARY); c.setFont(FONT_TITLE, 14)
        c.drawString(margin, y, title)
        y -= 0.2*cm; c.setLineWidth(1); c.setStrokeColorRGB(*COLOR_PRIMARY)
        c.line(margin, y, width-margin, y); c.setFillColorRGB(0,0,0); y -= 1*cm

    draw_section_title("1. INTERVENANTS & INSPECTION COMMUNE")
    c.setFont(FONT_TEXT, 10)
    date_insp = pdp.date_inspection_commune.strftime('%d/%m/%Y à %H:%M') if isinstance(pdp.date_inspection_commune, datetime) else str(pdp.date_inspection_commune)[:16]
    c.drawString(margin, y, f"Date de l'inspection commune : {date_insp}")
    y -= 0.8*cm
    
    col_w = (width - 2*margin) / 2
    c.setFont(FONT_TITLE, 11)
    c.drawString(margin, y, "Entreprise Utilisatrice (Client)")
    c.drawString(margin + col_w, y, "Entreprise Extérieure (Nous)")
    y -= 0.5*cm
    c.setFont(FONT_TEXT, 10); c.setFillColorRGB(0.2, 0.2, 0.2)
    c.drawString(margin, y, pdp.entreprise_utilisatrice or "Non défini")
    c.drawString(margin + col_w, y, pdp.entreprise_exterieure or (company.name if company else "Nous"))
    y -= 1.5*cm

    draw_section_title("2. CONSIGNES DU SITE & SECOURS")
    cons = pdp.consignes_securite or {}
    items = [
        f"🚑 Numéros d'urgence : {cons.get('urgence', '15 / 18')}",
        f"📍 Point de Rassemblement : {cons.get('rassemblement', 'Parking Principal')}",
        f"🚽 Accès Sanitaires/Eau : {cons.get('sanitaires', 'Oui, accès commun')}",
        f"🚬 Zone Fumeur : {cons.get('fumeur', 'Zone dédiée uniquement')}",
        f"🔥 Permis de Feu requis : {cons.get('permis_feu', 'Non')}"
    ]
    for item in items:
        check_space(0.8*cm); c.setFont(FONT_TEXT, 10)
        c.drawString(margin, y, f"• {item}"); y -= 0.6*cm
    y -= 0.5*cm

    draw_section_title("3. RISQUES LIÉS À LA COACTIVITÉ")
    risques = pdp.risques_interferents or []
    if not risques:
        c.setFont(FONT_TEXT, 10); c.drawString(margin, y, "Aucun risque d'interférence majeur identifié.")
    else:
        for r in risques:
            check_space(2.5*cm)
            c.setStrokeColorRGB(0.9, 0.9, 0.9); c.setLineWidth(0.5)
            c.rect(margin, y-1.8*cm, width-2*margin, 1.8*cm)
            c.setFont(FONT_TITLE, 10); c.setFillColorRGB(0, 0, 0)
            c.drawString(margin+0.2*cm, y-0.5*cm, f"Activité : {r.get('tache', '?')}")
            c.setFont(FONT_TEXT, 9); c.setFillColorRGB(0.8, 0, 0)
            c.drawString(margin+0.2*cm, y-1.0*cm, f"Risque : {r.get('risque', '?')}")
            c.setFillColorRGB(0, 0.5, 0)
            c.drawString(margin+0.2*cm, y-1.5*cm, f"Mesure : {r.get('mesure', '?')}")
            y -= 2.2*cm

    check_space(5*cm); y -= 1*cm
    c.setStrokeColorRGB(0.8, 0.8, 0.8); c.setLineWidth(1)
    c.line(margin, y, width-margin, y); y -= 0.5*cm
    col_w = (width - 2*margin) / 2
    c.setFont(FONT_TITLE, 10); c.setFillColorRGB(0, 0, 0)
    c.drawString(margin, y, "Pour l'Entreprise Utilisatrice (Client) :")
    c.drawString(margin + col_w, y, "Pour l'Entreprise Extérieure (Nous) :")
    y_sig_start = y - 3.5*cm

    # Signatures
    if pdp.signature_eu:
        sig_eu = get_optimized_image(pdp.signature_eu)
        if sig_eu:
            try:
                c.drawImage(ImageReader(sig_eu), margin, y_sig_start, width=5*cm, height=3*cm, mask='auto', preserveAspectRatio=True)
                c.setFont(FONT_TEXT, 8); c.setFillColorRGB(0, 0.6, 0)
                c.drawString(margin, y_sig_start - 0.3*cm, "Signé électroniquement")
            except: pass

    sig_ee_source = pdp.signature_ee or (chantier.signature_url if chantier.signature_url else None)
    if sig_ee_source:
        sig_ee = get_optimized_image(sig_ee_source)
        if sig_ee:
            try:
                c.drawImage(ImageReader(sig_ee), margin + col_w, y_sig_start, width=5*cm, height=3*cm, mask='auto', preserveAspectRatio=True)
                c.setFont(FONT_TEXT, 8); c.setFillColorRGB(0, 0.6, 0)
                c.drawString(margin + col_w, y_sig_start - 0.3*cm, "Signé électroniquement (Auto)")
            except: pass

    y = y_sig_start - 1*cm
    c.setFont(FONT_TEXT, 8); c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawCentredString(width/2, y, "Document certifié conforme par Conforméo BTP.")
    draw_footer(c, width, height, chantier, "Plan de Prévention")
    c.save()
    return output_path

# ==========================================
# 6. GENERATEUR DUERP (Tableau Dynamique)
# ==========================================
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from io import BytesIO

def generate_duerp_pdf(duerp, company, lignes):
    """
    Génère le DUERP - Mode Transparent
    - Historique conservé même si l'action est terminée.
    - État calculé automatiquement (FAIT / À FAIRE).
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    
    elements = []
    styles = getSampleStyleSheet()
    
    # --- STYLES ---
    style_titre = ParagraphStyle('TitreDoc', parent=styles['Title'], fontSize=18, spaceAfter=20, textColor=colors.HexColor('#333333'), alignment=TA_CENTER)
    style_sous_titre = ParagraphStyle('SousTitre', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#666666'), alignment=TA_CENTER)
    style_cell_header = ParagraphStyle('CellHeader', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold', textColor=colors.black, alignment=TA_CENTER)
    style_cell_normal = ParagraphStyle('CellNormal', parent=styles['Normal'], fontSize=10, fontName='Helvetica', leading=12)
    
    # --- EN-TÊTE ---
    elements.append(Paragraph(f"DOCUMENT UNIQUE D'ÉVALUATION DES RISQUES (DUERP) - {duerp.annee}", style_titre))
    elements.append(Paragraph(f"<b>Entreprise :</b> {company.name} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Mise à jour :</b> {duerp.date_mise_a_jour.strftime('%d/%m/%Y')}", style_sous_titre))
    elements.append(Spacer(1, 25))
    
    # --- TABLEAU ---
    headers = [
        Paragraph('Unité / Tâche', style_cell_header),
        Paragraph('Risque Identifié', style_cell_header),
        Paragraph('G.', style_cell_header),
        Paragraph('Mesures de Prévention', style_cell_header),
        Paragraph('État', style_cell_header)
    ]
    
    data = [headers]
    
    for l in lignes:
        # Données de base
        tache = Paragraph(f"<b>{l.unite_travail}</b><br/>{l.tache}", style_cell_normal)
        risque = Paragraph(l.risque, style_cell_normal)
        gravite = Paragraph(str(l.gravite), ParagraphStyle('Center', parent=style_cell_normal, alignment=TA_CENTER))
        
        # --- LOGIQUE D'AFFICHAGE INTELLIGENTE ---
        statut_val = l.statut if l.statut else "À FAIRE"
        # On force l'ancien "EN COURS" vers "À FAIRE" pour la cohérence binaire
        if statut_val == "EN COURS": statut_val = "À FAIRE"
            
        mesures_html = ""

        # CAS 1 : C'est FAIT (Vert)
        if statut_val == "FAIT":
            # A. On affiche ce qui a été fait (En Vert et Gras)
            if l.mesures_realisees:
                mesures_html += f"<font color='#27AE60'><b>✔ ACTION TERMINÉE : {l.mesures_realisees}</b></font>"
            else:
                mesures_html += f"<font color='#27AE60'><b>✔ ACTION TERMINÉE</b></font>"
            
            # B. On affiche QUAND MÊME ce qui était prévu (En Gris, plus petit) pour l'historique
            if l.mesures_a_realiser:
                mesures_html += f"<br/><br/><font color='#888888' size='9'><i>(Mesure initiale prévue : {l.mesures_a_realiser})</i></font>"
        
        # CAS 2 : C'est À FAIRE (Rouge)
        else:
            # A. On affiche ce qu'il reste à faire en priorité
            if l.mesures_a_realiser:
                mesures_html += f"<b>➔ Reste à faire :</b> {l.mesures_a_realiser}"
            
            # B. On affiche ce qui est déjà fait en dessous (En Gris)
            if l.mesures_realisees:
                mesures_html += f"<br/><br/><font color='#666666'><i>✔ Déjà réalisé : {l.mesures_realisees}</i></font>"
            
            if not mesures_html: mesures_html = "<i>(Aucune mesure définie)</i>"

        mesures = Paragraph(mesures_html, style_cell_normal)
        
        # Couleurs de la colonne État
        color_statut = "#C0392B" # Rouge (À FAIRE)
        if statut_val == "FAIT": color_statut = "#27AE60" # Vert
        
        statut_html = f"<font color='{color_statut}'><b>{statut_val}</b></font>"
        statut = Paragraph(statut_html, ParagraphStyle('Statut', parent=style_cell_normal, alignment=TA_CENTER))
        
        data.append([tache, risque, gravite, mesures, statut])

    # --- STYLE DU TABLEAU ---
    t = Table(data, colWidths=[160, 140, 40, 360, 80], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F0F0F0')), # Gris clair entête
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#999999')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('ALIGN', (2, 1), (2, -1), 'CENTER'), # Centrer la gravité
    ]))
    
    elements.append(t)
    doc.build(elements)
    buffer.seek(0)
    return buffer

# ==========================================
# 7. GENERATEUR PERMIS FEU (Canvas)
# ==========================================
# --- CONFIGURATION DES COULEURS ---
BRAND_RED = colors.Color(0.75, 0.15, 0.15) # Un rouge professionnel "brique"
DARK_GREY = colors.Color(0.2, 0.2, 0.2)
LIGHT_RED_BG = colors.Color(0.95, 0.9, 0.9) # Pour les fonds de cases

width, height = A4

# --- FONCTIONS UTILITAIRES DE DESSIN ---
def draw_header(c, permis, chantier):
    """Dessine l'en-tête rouge style 'réglementaire'"""
    # Bannière rouge supérieure
    c.setFillColor(BRAND_RED)
    c.rect(0, height - 3*cm, width, 3*cm, fill=1, stroke=0)
    
    # Logo texte "Conforméo" (à gauche)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-BoldOblique", 18)
    c.drawString(1.5*cm, height - 1.8*cm, "Conforméo")
    c.setFont("Helvetica", 10)
    c.drawString(1.5*cm, height - 2.3*cm, "Solutions QHSE Digitales")

    # Titre central
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width / 2.0, height - 1.9*cm, "PERMIS DE FEU")
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2.0, height - 2.5*cm, "Travaux par Points Chauds")

    # Cadre N° Permis (à droite, style tampon)
    c.setStrokeColor(colors.white)
    c.setLineWidth(2)
    c.roundRect(width - 5.5*cm, height - 2.5*cm, 4*cm, 1.5*cm, 5, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - 1.8*cm, height - 1.5*cm, "N° PERMIS")
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(width - 1.8*cm, height - 2.2*cm, str(permis.id).zfill(6))
    c.setStrokeColor(BRAND_RED) # Reset stroke color

def draw_section_title(c, y_pos, title):
    """Dessine une barre de titre de section rouge"""
    c.setFillColor(BRAND_RED)
    c.rect(1*cm, y_pos, width - 2*cm, 0.8*cm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(1.5*cm, y_pos + 0.25*cm, title.upper())
    c.setFillColor(DARK_GREY) # Reset text color

def draw_field(c, x, y, label, value, field_width=8*cm):
    """Dessine un champ label : valeur soulignée"""
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x, y, label + " :")
    c.setFont("Helvetica", 10)
    c.drawString(x + 0.2*cm, y - 0.5*cm, value or "Non renseigné")
    # Ligne de soulignement
    c.setStrokeColor(colors.grey)
    c.setLineWidth(0.5)
    c.line(x, y - 0.7*cm, x + field_width, y - 0.7*cm)
    c.setStrokeColor(BRAND_RED)

def draw_checkbox_line(c, x, y, label, checked, is_mandatory=False):
    """Dessine une ligne avec case à cocher style formulaire"""
    # Carré
    c.setStrokeColor(BRAND_RED)
    c.setLineWidth(1)
    c.rect(x, y, 0.5*cm, 0.5*cm)
    
    if checked:
        # Grande croix rouge si coché
        c.setLineWidth(2)
        c.line(x, y, x + 0.5*cm, y + 0.5*cm)
        c.line(x, y + 0.5*cm, x + 0.5*cm, y)
        c.setLineWidth(1)

    # Label
    font = "Helvetica-Bold" if is_mandatory else "Helvetica"
    c.setFont(font, 10)
    prefix = "IMPÉRATIF : " if is_mandatory else ""
    c.drawString(x + 0.8*cm, y + 0.1*cm, prefix + label)

# --- FONCTION PRINCIPALE ---

def generate_permis_feu_pdf(buffer, permis, chantier):
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setTitle(f"Permis Feu {permis.id}")
    
    # Dessin de l'en-tête
    draw_header(c, permis, chantier)

    current_y = height - 4.5*cm

    # --- SECTION 1 : INTERVENANTS & LIEU ---
    draw_section_title(c, current_y, "Cadre de l'intervention")
    current_y -= 1.5*cm
    
    # Colonne Gauche (Lieu)
    draw_field(c, 1.5*cm, current_y, "Chantier / Client", chantier.nom)
    current_y -= 1.2*cm
    draw_field(c, 1.5*cm, current_y, "Lieu exact des travaux", permis.lieu)
    
    # Colonne Droite (Dates & Exécutant) - On remonte le Y
    current_y += 1.2*cm
    draw_field(c, 11*cm, current_y, "Date de validité", permis.date.strftime('%d/%m/%Y'))
    current_y -= 1.2*cm
    draw_field(c, 11*cm, current_y, "Responsable Exécutant", permis.intervenant)

    current_y -= 1.5*cm

    # --- SECTION 2 : DESCRIPTION DES TRAVAUX ---
    draw_section_title(c, current_y, "Nature des travaux par points chauds")
    current_y -= 1*cm
    
    # Boîte de description avec fond légèrement grisé
    c.setFillColor(LIGHT_RED_BG)
    c.setStrokeColor(BRAND_RED)
    c.rect(1*cm, current_y - 2*cm, width - 2*cm, 2.5*cm, fill=1, stroke=1)
    
    c.setFillColor(DARK_GREY)
    c.setFont("Helvetica", 10)
    # On positionne le texte en haut de la boîte
    text_y = current_y + 0.2*cm
    c.drawString(1.5*cm, text_y, "Description détaillée :")
    c.setFont("Helvetica-Oblique", 11)
    # Petit hack pour gérer le texte long (on prend les 90 premiers caractères pour l'instant)
    # Pour faire mieux, il faudrait utiliser l'objet Paragraph de ReportLab (plus complexe)
    desc_text = permis.description[:180] + ("..." if len(permis.description) > 180 else "")
    c.drawString(1.5*cm, text_y - 0.7*cm, desc_text)

    current_y -= 3*cm

    # --- SECTION 3 : MESURES DE SÉCURITÉ IMPÉRATIVES ---
    draw_section_title(c, current_y, "Sécurité & Consignes (Check-list avant travaux)")
    current_y -= 1.2*cm

    # Liste des cases à cocher style formulaire
    draw_checkbox_line(c, 1.5*cm, current_y, "Moyens d'extinction (extincteur adapté) à portée de main immédiate.", permis.extincteur, is_mandatory=True)
    current_y -= 0.8*cm
    draw_checkbox_line(c, 1.5*cm, current_y, "Zone nettoyée : absence de combustibles dans un rayon de 10m.", permis.nettoyage, is_mandatory=True)
    current_y -= 0.8*cm
    draw_checkbox_line(c, 1.5*cm, current_y, "Surveillance post-intervention maintenue pendant 2 heures.", permis.surveillance, is_mandatory=True)
    
    # Ajout de consignes fixes "réglementaires"
    current_y -= 1.2*cm
    c.setFont("Helvetica-Bold", 9)
    c.drawString(1.5*cm, current_y, "Autres consignes permanentes :")
    c.setFont("Helvetica", 9)
    current_y -= 0.5*cm
    c.drawString(2*cm, current_y, "• Alerte des secours : Composer le 18 ou le 112 en cas de départ de feu.")
    current_y -= 0.5*cm
    c.drawString(2*cm, current_y, "• Protection des matériaux inamovibles par bâches ignifugées.")

    current_y -= 1.5*cm

    # --- SECTION 4 : SIGNATURES ---
    draw_section_title(c, current_y, "Validation & Signatures")
    current_y -= 2.5*cm

    # Création de 2 cadres de signature côte à côte
    box_width = (width - 3*cm) / 2
    box_height = 2.5*cm

    # Cadre Demandeur / Sécurité
    c.setStrokeColor(BRAND_RED)
    c.rect(1*cm, current_y, box_width, box_height)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(1*cm + box_width/2, current_y + box_height - 0.5*cm, "Pour le Donneur d'Ordre / Sécurité")
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(1*cm + box_width/2, current_y + 0.3*cm, "(Nom, Date et Signature)")

    # Cadre Exécutant
    c.rect(1*cm + box_width + 1*cm, current_y, box_width, box_height)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(1*cm + box_width + 1*cm + box_width/2, current_y + box_height - 0.5*cm, "L'Exécutant (Intervenant)")
    
    # Gestion de la signature numérique de l'app
    if permis.signature:
        c.setFillColor(colors.green)
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(1*cm + box_width + 1*cm + box_width/2, current_y + 1.2*cm, "✅ VALIDÉ NUMÉRIQUEMENT")
        c.setFont("Helvetica", 8)
        c.drawCentredString(1*cm + box_width + 1*cm + box_width/2, current_y + 0.8*cm, f"Date : {permis.date.strftime('%d/%m/%Y %H:%M')}")
        c.setFillColor(DARK_GREY)
    else:
        c.setFont("Helvetica-Oblique", 8)
        c.drawCentredString(1*cm + box_width + 1*cm + box_width/2, current_y + 0.3*cm, "(Lu et approuvé, Signature)")

    # --- PIED DE PAGE AVEC AVERTISSEMENT ---
    c.setFillColor(BRAND_RED)
    c.setFont("Helvetica-BoldOblique", 10)
    warning_msg = "ATTENTION : Ce permis n'est valable que pour la journée, le lieu et les travaux définis ci-dessus. En cas de changement, un nouveau permis doit être établi."
    c.drawCentredString(width / 2.0, 1.5*cm, warning_msg)
    
    # Numéro de page simple
    c.setFillColor(DARK_GREY)
    c.setFont("Helvetica", 8)
    c.drawRightString(width - 1*cm, 0.5*cm, "Généré par Conforméo - Page 1/1")

    c.showPage()
    c.save()