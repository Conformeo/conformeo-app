import os
import requests
import base64

def get_gps_from_address(address: str):
    if not address or len(address) < 3: return None, None
    try:
        # On ne nettoie plus la virgule, on laisse l'adresse brute, c'est souvent mieux
        url = "https://nominatim.openstreetmap.org/search"
        params = {'q': address, 'format': 'json', 'limit': 1, 'countrycodes': 'fr'}
        headers = {'User-Agent': 'ConformeoApp/1.0'}
        res = requests.get(url, params=params, headers=headers, timeout=4)
        if res.status_code == 200 and len(res.json()) > 0:
            data = res.json()[0]
            return float(data['lat']), float(data['lon'])
    except Exception as e:
        print(f"⚠️ Erreur GPS: {e}")
    return None, None

def send_email_via_brevo(to_email: str, subject: str, html_content: str, pdf_attachment=None, pdf_filename="document.pdf"):
    api_key = os.getenv("BREVO_API_KEY")
    sender_email = os.getenv("SENDER_EMAIL", "contact@conformeo-app.fr")
    sender_name = os.getenv("SENDER_NAME", "Conforméo")

    if not api_key: return False

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
        except: pass

    try:
        requests.post(url, json=payload, headers=headers)
        return True
    except: return False