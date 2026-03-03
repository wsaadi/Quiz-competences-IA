# Quiz Compétences IA

Outil d'évaluation des compétences en Intelligence Artificielle par conversation naturelle avec Mistral AI.

## Architecture

```
backend/          → FastAPI (Python 3.12)
frontend/         → Angular 19 + Angular Material
docker-compose.yml → Orchestration Docker
```

## Fonctionnalités

- **Authentification sécurisée** : JWT, bcrypt, protection brute-force, lockout
- **Évaluation adaptative** : Conversation naturelle avec Aria (avatar IA) via Mistral AI
- **8 domaines évalués** : Marché, Terminologie, Intérêt, Veille, Technique, Usage IA, Intégration, Conception
- **Dashboard collaborateur** : Scores radar, feedback encourageant, historique
- **Espace admin** : Statistiques globales, fiches détaillées, gestion utilisateurs
- **Avatar animé** : Aria, l'évaluatrice sympa avec expressions dynamiques

## Démarrage rapide

### Prérequis

- Python 3.12+
- Node.js 22+
- Clé API Mistral

### Backend

```bash
cd backend
cp .env.example .env
# Éditer .env avec votre MISTRAL_API_KEY et un SECRET_KEY
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npx ng serve
```

### Docker

```bash
cp backend/.env.example backend/.env
# Éditer backend/.env
docker compose up --build
```

L'app sera disponible sur `http://localhost:4200`.

## Identifiants par défaut

| Rôle  | Username | Mot de passe |
|-------|----------|-------------|
| Admin | admin    | Admin@2024! |

## Sécurité

- Hachage bcrypt (12 rounds)
- JWT avec expiration
- Rate limiting (10 requêtes/min sur login)
- Lockout après 5 tentatives échouées (15 min)
- Sanitization des entrées (bleach)
- Headers de sécurité (HSTS, X-Frame-Options, X-Content-Type-Options)
- Validation de force de mot de passe
- CORS configuré

## API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Connexion |
| POST | `/api/evaluations/start` | Démarrer une évaluation |
| POST | `/api/evaluations/{id}/chat` | Envoyer un message |
| POST | `/api/evaluations/{id}/complete` | Terminer l'évaluation |
| GET | `/api/evaluations/my` | Mes évaluations |
| GET | `/api/admin/users` | Liste utilisateurs (admin) |
| POST | `/api/admin/users` | Créer utilisateur (admin) |
| GET | `/api/admin/evaluations` | Toutes les évaluations (admin) |
| GET | `/api/admin/stats` | Statistiques globales (admin) |
