# 1. On part d'une version légère de Python
FROM python:3.10-slim

# 2. On définit le dossier de travail
WORKDIR /app

# 3. Variables d'environnement pour optimiser Python
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 4. Installation des dépendances système (nécessaire pour psycopg2)
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 5. Copie et installation des dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# 6. Copie de tout le code du projet dans le conteneur
COPY . .

# 7. Commande de démarrage
# On lance uvicorn depuis la racine, en ciblant backend.main
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-10000}"]