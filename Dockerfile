# 1. Image de base
FROM python:3.10-slim

# 2. Dossier de travail
WORKDIR /app

# 3. Optimisations Python
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 4. Installation des dépendances système (OBLIGATOIRE pour psycopg2/Postgres)
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 5. Installation des librairies Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# 6. Copie du code
COPY . .

# 7. Lancement du serveur (Render fournit le port automatiquement)
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-10000}"]