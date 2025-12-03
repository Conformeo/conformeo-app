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
    """Télécharge une image de manière sécurisée (Cloudinary ou Local)."""
    if not path_or_url: return None
    try:
        # CAS 1 : URL Cloudinary
        if path_or_url.startswith("http"):
            optimized_url = path_or_url
            # Optimisation : Largeur 1000px, Qualité Auto, Format JPG
            if "cloudinary.com" in path_or_url and "/upload/" in path_or_url:
                optimized_url = path_or_url.replace("/upload/", "/upload/w_1000,q_auto,f_jpg/")
            
            response = requests.get(optimized_url, stream=True, timeout=10)
            if response.status_code == 200:
                return Image.open(BytesIO(response.content))
        
        # CAS 2 : Fichier Local
        else:
            clean_path = path_or_url.replace("/static/", "")
            possible_paths = [os.path.join("uploads", clean_path), clean_path]
            for p in possible_paths:
                if os.path.exists(p):
                    return Image.open(p)
    except Exception as e:
        print(f"Erreur chargement image ({path_or_url}): {e}")
    return None

def draw_cover_page(c, chantier, titre, soustitre):
    """Dessine la page de garde commune"""
    width, height = A4
    
    # 1. Image de fond (Cover)
    if chantier.cover_url:
        cover = get_optimized_image(chantier.cover_url)
        if cover:
            try:
                w, h = cover.size
                aspect = h / float(w)
                # Image plein écran
                c.drawImage(ImageReader(cover), 0, 0, width=width, height=width*aspect, preserveAspectRatio=True)
                # Voile noir semi-transparent pour lisibilité
                c.setFillColorRGB(0, 0, 0, 0.6)
                c.rect(0, 0, width, height, fill=1, stroke=0)
            except: pass
    else:
        # Fond bleu par défaut si pas d'image
        c.setFillColorRGB(0.1, 0.2, 0.4)
        c.rect(0, 0, width, height, fill=1, stroke=0)

    # 2. Logo (centré en haut)
    logo = get_optimized_image("logo.png")
    if logo:
        try:
            rl_logo = ImageReader(logo)
            # Petit fond blanc sous le logo
            c.setFillColorRGB(1, 1, 1)
            c.roundRect(width/2-3*cm, height-4*cm, 6*cm, 3*cm, 10, fill=1, stroke=0)
            c.drawImage(rl_logo, width/2-2.5*cm, height-3.8*cm, 5*cm, 2.5*cm, mask='auto', preserveAspectRatio=True)
        except: pass

    # 3. Titres
    c.setFillColorRGB(1, 1, 1) # Blanc
    c.setFont("Helvetica-Bold", 32)
    c.drawCentredString(width/2, height/2+1*cm, titre)
    c.setFont("Helvetica", 16)
    c.drawCentredString(width/2, height/2-0.5*cm, soustitre)
    
    # Ligne de séparation
    c.setStrokeColorRGB(1, 1, 1); c.setLineWidth(2)
    c.line(width/2-4*cm, height/2-1.5*cm, width/2+4*cm, height/2-1.5*cm)

    # 4. Infos Chantier
    c.setFont("Helvetica-Bold", 22)
    # Protection contre titre vide (or "")
    c.drawCentredString(width/2, height/2-3*cm, chantier.nom or "Chantier sans nom")
    c.setFont("Helvetica", 14)
    c.drawCentredString(width/2, height/2-4*cm, chantier.adresse or "")
    
    # 5. Date en bas
    c.setFont("Helvetica-Oblique", 10)
    date_str = datetime.now().strftime('%d/%m/%Y')
    c.drawCentredString(width/2, 2*cm, f"Édité le {date_str}")
    
    c.showPage() # Fin page de garde

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
            c.showPage(); y = height - 3 * cm

    # --- SECTION PHOTOS ---
    if rapports:
        c.setFillColorRGB(0, 0.2, 0.5); c.setFont("Helvetica-Bold", 16)
        c.drawString(margin, y, "1. RELEVÉS PHOTOS")
        c.setFillColorRGB(0, 0, 0); y -= 1.5 * cm

        for rap in rapports:
            check_space(4*cm)
            
            # Titre et Date
            c.setFont("Helvetica-Bold", 12)
            titre = rap.titre or "Sans titre"
            date_rap = ""
            if rap.date_creation:
                if isinstance(rap.date_creation, str): date_rap = rap.date_creation[:10]
                elif isinstance(rap.date_creation, datetime): date_rap = rap.date_creation.strftime('%d/%m')
            
            c.drawString(margin, y, f"• {titre} ({date_rap})")
            y -= 0.6*cm
            
            # Description (tronquée si trop longue)
            desc = rap.description or ""
            c.setFont("Helvetica", 10); c.setFillColorRGB(0.3, 0.3, 0.3)
            display_desc = (desc[:90] + '...') if len(desc) > 90 else desc
            c.drawString(margin, y, display_desc)
            c.setFillColorRGB(0, 0, 0); y -= 0.8*cm

            # Récupération des images (V1 et V2)
            imgs = []
            if hasattr(rap, 'images') and rap.images:
                imgs = [img.url for img in rap.images]
            elif hasattr(rap, 'photo_url') and rap.photo_url:
                imgs = [rap.photo_url]

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

    # --- SECTION QHSE ---
    if inspections:
        check_space(4*cm)
        c.setFillColorRGB(0, 0.2, 0.5); c.setFont("Helvetica-Bold", 16)
        c.drawString(margin, y, "2. CONTRÔLES QHSE")
        c.setFillColorRGB(0, 0, 0); y -= 1.5 * cm

        for insp in inspections:
            check_space(3*cm)
            c.setFont("Helvetica-Bold", 12)
            
            # 👇 NOUVEAU : Formatage de la date
            date_audit = ""
            if insp.date_creation:
                if isinstance(insp.date_creation, str): 
                    date_audit = insp.date_creation[:10] # Prend YYYY-MM-DD
                elif isinstance(insp.date_creation, datetime): 
                    date_audit = insp.date_creation.strftime('%d/%m/%Y')
            
            # 👇 TITRE AVEC DATE
            titre_complet = f"📋 {insp.titre} (du {date_audit})"
            c.drawString(margin, y, titre_complet)
            
            y -= 0.8*cm
            
            questions = insp.data if isinstance(insp.data, list) else []
            for q in questions:
                check_space(1*cm)
                c.setFont("Helvetica", 10)
                q_text = q.get('q') or "Question"
                c.drawString(margin+0.5*cm, y, f"- {q_text}")
                
                stat = q.get('status', 'NA')
                txt, color = "N/A", (0.5,0.5,0.5)
                if stat == 'OK': txt, color = "CONFORME", (0, 0.6, 0)
                elif stat == 'NOK': txt, color = "NON CONFORME", (0.8, 0, 0)
                
                c.setFillColorRGB(*color)
                c.drawRightString(width-margin, y, txt)
                c.setFillColorRGB(0, 0, 0)
                y -= 0.6*cm
            y -= 0.5*cm

    # --- SIGNATURE ---
    check_space(5*cm)
    y -= 1*cm
    c.setStrokeColorRGB(0,0,0); c.setLineWidth(1)
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
    c.drawString(margin, y, f"Responsable Chantier : {ppsps.responsable_chantier or ''}")
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

    # 4. ANALYSE DES RISQUES
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