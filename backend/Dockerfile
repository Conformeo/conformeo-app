# 1. Image de base Python (on prend une version récente et légère)
FROM python:3.10-slim

# 2. On définit le dossier de travail dans le conteneur
WORKDIR /app

# 3. On évite que Python garde des fichiers .pyc inutiles
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 4. Installation des dépendances système (nécessaire pour psycopg2 parfois)
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 5. Copie du fichier requirements et installation des librairies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# 6. Copie de tout votre code dans le conteneur
COPY . .

# 7. La commande de démarrage (Render fournit le PORT automatiquement)
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-10000}"]