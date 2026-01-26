import os
import requests
import base64

def send_email_via_brevo(to_email: str, subject: str, html_content: str, pdf_attachment=None, pdf_filename="document.pdf"):
    """
    Service d'envoi d'email via Brevo API.
    """
    api_key = os.getenv("BREVO_API_KEY")
    sender_email = os.getenv("SENDER_EMAIL", "contact@conformeo-app.fr")
    sender_name = os.getenv("SENDER_NAME", "Conforméo")

    if not api_key:
        print("❌ SERVICE EMAIL: Clé API manquante")
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
            # Gestion buffer vs bytes
            content = pdf_attachment.getvalue() if hasattr(pdf_attachment, "getvalue") else pdf_attachment
            encoded = base64.b64encode(content).decode("utf-8")
            payload["attachment"] = [{"content": encoded, "name": pdf_filename}]
        except Exception as e:
            print(f"⚠️ Erreur encodage PDF: {e}")

    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code in [200, 201, 202]:
            print(f"✅ Email envoyé à {to_email}")
            return True
        print(f"❌ Erreur Brevo: {response.text}")
        return False
    except Exception as e:
        print(f"❌ Exception Python Email: {e}")
        return False