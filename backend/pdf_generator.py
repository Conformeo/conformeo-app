from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as ReportLabImage
from reportlab.lib.styles import getSampleStyleSheet
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
                optimized_url = path_or_url.replace("/upload/", "/upload/w_1000,q_auto,f_jpg/")
            response = requests.get(optimized_url, stream=True, timeout=5)
            if response.status_code == 200:
                return Image.open(BytesIO(response.content))
        else:
            # Gestion fichier local (Uploads)
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
    """Pied de page remonté pour éviter les débordements"""
    c.saveState()
    
    # On remonte le footer à 2cm du bas (au lieu de 1cm) pour éviter la coupure
    footer_y = 2 * cm 
    
    c.setStrokeColorRGB(0.8, 0.8, 0.8); c.setLineWidth(0.5)
    c.line(1*cm, footer_y + 0.5*cm, width-1*cm, footer_y + 0.5*cm) # Ligne
    
    c.setFont(FONT_TEXT, 8); c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawString(1*cm, footer_y, f"Conforméo - {titre_doc} - {chantier.nom}")
    c.drawRightString(width-1*cm, footer_y, f"Page {c.getPageNumber()}")
    c.restoreState()

def draw_cover_page(c, chantier, titre_principal, sous_titre, company=None):
    width, height = A4
    
    # --- MISE EN PAGE : LOGO LIBRE ET GRAND ---
    
    # On définit le centre vertical pour le bloc logo
    # On le remonte un peu pour laisser de la place aux titres
    logo_center_y = height / 2 + 3 * cm 
    
    # 1. Insertion du Logo (SANS CADRE)
    logo_source = None
    if company and company.logo_url: logo_source = company.logo_url
    elif hasattr(chantier, 'company') and chantier.company: logo_source = chantier.company.logo_url

    logo_drawn = False
    if logo_source:
        img = get_optimized_image(logo_source)
        if img:
            # --- MODIFICATION TAILLE ---
            # On autorise une taille beaucoup plus grande (12cm de large ou 8cm de haut)
            max_im_w = 12 * cm  # Avant c'était ~10cm avec marges
            max_im_h = 8 * cm   # Avant c'était ~5cm
            
            iw, ih = img.size
            ratio = min(max_im_w/iw, max_im_h/ih)
            new_w = iw * ratio
            new_h = ih * ratio
            
            # Centrage horizontal
            pos_x = (width - new_w) / 2
            # Centrage vertical autour de logo_center_y
            pos_y = logo_center_y - (new_h / 2)
            
            try:
                c.drawImage(ImageReader(img), pos_x, pos_y, width=new_w, height=new_h, mask='auto', preserveAspectRatio=True)
                logo_drawn = True
            except Exception as e:
                print(f"Erreur rendu logo PDF: {e}")

    # Si pas de logo, on ne met rien ou un texte discret
    if not logo_drawn:
        c.setFillColorRGB(0.7, 0.7, 0.7); c.setFont(FONT_TEXT, 10)
        c.drawCentredString(width/2, logo_center_y, "")

    # ... (Code du logo inchangé) ...

    # 2. Titres (SOUS le logo)
    y_text = logo_center_y - 5 * cm 
    
    c.setFillColorRGB(*COLOR_PRIMARY); c.setFont(FONT_TITLE, 24)
    c.drawCentredString(width/2, y_text, titre_principal)
    
    y_text -= 1.2 * cm
    c.setFillColorRGB(*COLOR_SECONDARY); c.setFont(FONT_TEXT, 14)
    c.drawCentredString(width/2, y_text, sous_titre)
    
    # 3. Ligne de séparation (ALIGNÉE À GAUCHE MAINTENANT)
    y_text -= 2 * cm
    c.setStrokeColorRGB(0.8, 0.8, 0.8); c.setLineWidth(0.5)
    # 👇 On commence la ligne à 2*cm (Marge gauche) jusqu'à width-2*cm (Marge droite)
    c.line(2*cm, y_text, width-2*cm, y_text)

    # 4. Infos Projet (ALIGNÉES À GAUCHE)
    y_info = y_text - 3 * cm
    
    # 👇 C'est ici que ça se joue : 2*cm c'est le bord gauche du contenu
    x_labels = 2 * cm 
    x_values = 6 * cm 
    
    c.setFillColorRGB(0, 0, 0)
    
    # Projet
    c.setFont(FONT_TITLE, 14)
    c.drawString(x_labels, y_info, "PROJET :")
    c.setFont(FONT_TEXT, 14)
    c.drawString(x_values, y_info, chantier.nom or "Non défini")
    
    # Adresse
    y_info -= 1.5 * cm
    c.setFont(FONT_TITLE, 14)
    c.drawString(x_labels, y_info, "ADRESSE :")
    c.setFont(FONT_TEXT, 14)
    c.drawString(x_values, y_info, chantier.adresse or "Non définie")
    
    # Réalisé par
    if company:
        y_info -= 2.5 * cm
        c.setFont(FONT_TITLE, 12); c.setFillColorRGB(*COLOR_SECONDARY)
        c.drawString(x_labels, y_info, "RÉALISÉ PAR :")
        c.setFont(FONT_TEXT, 12)
        c.drawString(x_values, y_info, company.name)

    # Date en bas (Alignée avec Réalisé par)
    date_str = datetime.now().strftime('%d/%m/%Y')
    c.setFont(FONT_TEXT, 10); c.setFillColorRGB(0.5, 0.5, 0.5)
    # Alignée à droite
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
    bottom_limit = 3 * cm # Limite de sécurité

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

            img_w, img_h, gap = 8*cm, 6*cm, 1*cm
            for i in range(0, len(imgs), 2):
                check_space(img_h + 0.5*cm)
                url1 = imgs[i]
                pil1 = get_optimized_image(url1)
                if pil1:
                    try:
                        pil1 = ImageOps.exif_transpose(pil1)
                        c.drawImage(ImageReader(pil1), margin, y-img_h, width=img_w, height=img_h, preserveAspectRatio=True)
                    except: pass
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
    c.setFont(FONT_TITLE, 10); c.setFillColorRGB(0.8, 0, 0)
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
# 6. GENERATEUR DUERP
# ==========================================
def generate_duerp_pdf(company, duerp, filepath):
    doc = SimpleDocTemplate(filepath, pagesize=landscape(A4), rightMargin=20, leftMargin=20, topMargin=20, bottomMargin=20)
    elements = []
    styles = getSampleStyleSheet()

    if company and company.logo_url:
        try:
            pil_img = get_optimized_image(company.logo_url)
            if pil_img:
                temp_logo_path = "temp_logo_duerp.jpg"
                pil_img.save(temp_logo_path)
                logo = ReportLabImage(temp_logo_path)
                max_h = 4 * cm
                img_w, img_h = pil_img.size
                aspect = img_w / float(img_h)
                logo.drawHeight = max_h
                logo.drawWidth = max_h * aspect
                logo.hAlign = 'LEFT'
                elements.append(logo)
                elements.append(Spacer(1, 10))
        except: pass

    title = f"<b>DOCUMENT UNIQUE (DUERP) - {duerp.annee}</b>"
    elements.append(Paragraph(title, styles['Title']))
    elements.append(Spacer(1, 10))
    if company: elements.append(Paragraph(f"Entreprise : {company.name}", styles['Normal']))
    date_str = duerp.date_mise_a_jour.strftime('%d/%m/%Y') if duerp.date_mise_a_jour else "N/A"
    elements.append(Paragraph(f"Mis à jour le : {date_str}", styles['Normal']))
    elements.append(Spacer(1, 20))

    headers = ["1. Tâches effectuées", "2. Identification des risques", "3. Gravité\n(1-3)", "4. Mesures réalisées", "5. Mesures à réaliser"]
    data = [headers]
    for l in duerp.lignes:
        row = [
            Paragraph(l.tache or "", styles['Normal']),
            Paragraph(l.risque or "", styles['Normal']),
            str(l.gravite),
            Paragraph(l.mesures_realisees or "", styles['Normal']),
            Paragraph(l.mesures_a_realiser or "", styles['Normal'])
        ]
        data.append(row)

    col_widths = [140, 140, 50, 200, 200] 
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.white),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (2, 1), (2, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('BOX', (0, 0), (-1, -1), 2, colors.black),
    ]))
    elements.append(t)
    try:
        doc.build(elements)
        print(f"✅ PDF DUERP généré : {filepath}")
    except Exception as e:
        print(f"❌ Erreur PDF DUERP : {e}")
        raise e