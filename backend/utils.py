import os
import requests
import base64

def get_gps_from_address(address: str):
    if not address or len(address) < 3: return None, None
    try:
        clean = address.replace(",", " ").strip()
        url = "https://nominatim.openstreetmap.org/search"
        params = {'q': clean, 'format': 'json', 'limit': 1, 'countrycodes': 'fr'}
        headers = {'User-Agent': 'ConformeoApp/1.0'}
        res = requests.get(url, params=params, headers=headers, timeout=4)
        if res.status_code == 200:
            data = res.json()
            if data: return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        print(f"⚠️ Erreur GPS: {e}")
    return None, None

def send_email_via_brevo(to_email: str, subject: str, html_content: str, pdf_attachment=None, pdf_filename="document.pdf"):
    api_key = os.getenv("BREVO_API_KEY")
    sender_email = os.getenv("SENDER_EMAIL", "contact@conformeo-app.fr")
    sender_name = os.getenv("SENDER_NAME", "Conforméo")

    if not api_key:
        print("❌ ERREUR: Clé API Brevo manquante.")
        return False

    url = "https://api.brevo.com/v3/smtp/email"
    headers = {"accept": "application/json", "api-key": api_key, "content-type": "application/json"}
    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_content
    }

    if pdf_attachment:
        try:
            content = pdf_attachment.getvalue() if hasattr(pdf_attachment, "getvalue") else pdf_attachment
            encoded = base64.b64encode(content).decode("utf-8")
            payload["attachment"] = [{"content": encoded, "name": pdf_filename}]
        except Exception as e:
            print(f"⚠️ Erreur PDF Email: {e}")

    try:
        requests.post(url, json=payload, headers=headers)
        return True
    except Exception as e:
        print(f"❌ Erreur Envoi Email: {e}")
        return False