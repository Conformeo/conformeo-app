# 1. On part d'une version légère de Python
FROM python:3.10-slim

# 2. On installe les outils système nécessaires pour PostgreSQL et PDF
RUN apt-get update && apt-get install -y libpq-dev gcc

# 3. On crée le dossier de travail
WORKDIR /app

# 4. On copie les besoins et on les installe
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. On copie tout le code
COPY . .

# 6. On crée les dossiers nécessaires
RUN mkdir -p uploads

# 7. La commande de démarrage (Render utilise le port 10000 par défaut souvent, ou on force le 8000)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]