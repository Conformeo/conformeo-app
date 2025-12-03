from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageOps
import os
import requests
from io import BytesIO
from datetime import datetime

def get_optimized_image(path_or_url):
    try:
        if path_or_url.startswith("http"):
            optimized_url = path_or_url
            if "cloudinary.com" in path_or_url and "/upload/" in path_or_url:
                optimized_url = path_or_url.replace("/upload/", "/upload/w_1000,q_auto,f_jpg/")
            response = requests.get(optimized_url, stream=True)
            if response.status_code == 200:
                return Image.open(BytesIO(response.content))
        else:
            clean_path = path_or_url.replace("/static/", "")
            possible_paths = [os.path.join("uploads", clean_path), clean_path]
            for p in possible_paths:
                if os.path.exists(p):
                    return Image.open(p)
    except Exception as e:
        print(f"Erreur image: {e}")
    return None

def draw_cover_page(c, chantier, titre, soustitre):
    width, height = A4
    # Image de fond
    if chantier.cover_url:
        cover = get_optimized_image(chantier.cover_url)
        if cover:
            try:
                w, h = cover.size
                aspect = h / float(w)
                c.drawImage(ImageReader(cover), 0, 0, width=width, height=width*aspect, preserveAspectRatio=True)
                c.setFillColorRGB(0, 0, 0, 0.6)
                c.rect(0, 0, width, height, fill=1, stroke=0)
            except: pass
    else:
        c.setFillColorRGB(0.1, 0.2, 0.4)
        c.rect(0, 0, width, height, fill=1, stroke=0)

    # Logo
    logo = get_optimized_image("logo.png")
    if logo:
        try:
            c.setFillColorRGB(1, 1, 1)
            c.roundRect(width/2-3*cm, height-4*cm, 6*cm, 3*cm, 10, fill=1, stroke=0)
            c.drawImage(ImageReader(logo), width/2-2.5*cm, height-3.8*cm, 5*cm, 2.5*cm, mask='auto', preserveAspectRatio=True)
        except: pass

    # Textes
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 32)
    c.drawCentredString(width/2, height/2+1*cm, titre)
    c.setFont("Helvetica", 16)
    c.drawCentredString(width/2, height/2-0.5*cm, soustitre)
    
    c.setStrokeColorRGB(1, 1, 1); c.setLineWidth(2)
    c.line(width/2-4*cm, height/2-1.5*cm, width/2+4*cm, height/2-1.5*cm)

    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(width/2, height/2-3*cm, chantier.nom)
    c.setFont("Helvetica", 14)
    c.drawCentredString(width/2, height/2-4*cm, chantier.adresse)
    
    c.setFont("Helvetica-Oblique", 10)
    c.drawCentredString(width/2, 2*cm, f"Édité le {datetime.now().strftime('%d/%m/%Y')}")
    c.showPage()

# 👇 C'EST ICI LA CORRECTION : AJOUT DE L'ARGUMENT 'inspections'
def generate_pdf(chantier, rapports, inspections, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    
    draw_cover_page(c, chantier, "JOURNAL DE BORD", "Suivi & Avancement")
    
    y = height - 3 * cm
    def check_space(needed):
        nonlocal y
        if y < needed:
            c.showPage(); y = height - 3 * cm

    # --- RAPPORTS PHOTOS ---
    if rapports:
        c.setFillColorRGB(0, 0.2, 0.5); c.setFont("Helvetica-Bold", 16)
        c.drawString(margin, y, "1. RELEVÉS PHOTOS")
        c.setFillColorRGB(0, 0, 0); y -= 1.5 * cm

        for rap in rapports:
            check_space(4*cm)
            c.setFont("Helvetica-Bold", 12)
            c.drawString(margin, y, f"• {rap.titre}")
            y -= 0.6*cm
            c.setFont("Helvetica", 10); c.setFillColorRGB(0.3, 0.3, 0.3)
            c.drawString(margin, y, rap.description or "")
            c.setFillColorRGB(0, 0, 0); y -= 0.8*cm

            # Images (V1 + V2)
            imgs = [img.url for img in rap.images] if hasattr(rap, 'images') and rap.images else []
            if not imgs and rap.photo_url: imgs.append(rap.photo_url)

            for url in imgs:
                check_space(7*cm)
                img = get_optimized_image(url)
                if img:
                    try:
                        img = ImageOps.exif_transpose(img)
                        c.drawImage(ImageReader(img), margin+1*cm, y-6*cm, 8*cm, 6*cm, preserveAspectRatio=True)
                    except: pass
                y -= 6.5*cm
            y -= 0.5*cm
            c.setLineWidth(0.5); c.setStrokeColorRGB(0.8,0.8,0.8)
            c.line(margin, y, width-margin, y); y -= 1*cm

    # --- INSPECTIONS QHSE (NOUVEAU) ---
    if inspections:
        check_page_break = lambda h: check_space(h) # Alias rapide
        check_page_break(4*cm)
        c.setFillColorRGB(0, 0.2, 0.5); c.setFont("Helvetica-Bold", 16)
        c.drawString(margin, y, "2. CONTRÔLES QHSE")
        c.setFillColorRGB(0, 0, 0); y -= 1.5 * cm

        for insp in inspections:
            check_space(3*cm)
            c.setFont("Helvetica-Bold", 12)
            c.drawString(margin, y, f"📋 {insp.titre}")
            y -= 0.8*cm
            
            questions = insp.data if isinstance(insp.data, list) else []
            for q in questions:
                check_space(1*cm)
                c.setFont("Helvetica", 10)
                c.drawString(margin+0.5*cm, y, f"- {q.get('q','')}")
                
                stat = q.get('status', 'NA')
                if stat == 'OK': c.setFillColorRGB(0, 0.6, 0); txt="CONFORME"
                elif stat == 'NOK': c.setFillColorRGB(0.8, 0, 0); txt="NON CONFORME"
                else: c.setFillColorRGB(0.5, 0.5, 0.5); txt="N/A"
                
                c.drawRightString(width-margin, y, txt)
                c.setFillColorRGB(0, 0, 0)
                y -= 0.6*cm
            y -= 0.5*cm

    # --- SIGNATURE ---
    check_space(5*cm)
    y -= 1*cm; c.setStrokeColorRGB(0,0,0); c.setLineWidth(1)
    c.line(margin, y, width-margin, y); y -= 1*cm
    c.setFont("Helvetica-Bold", 12)
    c.drawString(width-8*cm, y, "Validation :")
    
    if chantier.signature_url:
        sig = get_optimized_image(chantier.signature_url)
        if sig:
            try: c.drawImage(ImageReader(sig), width-8*cm, y-4*cm, 5*cm, 3*cm, mask='auto', preserveAspectRatio=True)
            except: pass
            
    c.save()

# ==========================================
# 2. GENERATEUR PPSPS
# ==========================================
def generate_ppsps_pdf(chantier, ppsps, output_path):
    """Génère le PPSPS avec la nouvelle page de garde Design"""
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    
    draw_cover_page(c, chantier, "P.P.S.P.S", "Plan Particulier de Sécurité")

    y = height - 3 * cm

    def check_page():
        nonlocal y
        if y < 3 * cm:
            c.showPage()
            y = height - 3 * cm

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