# 🚀 EduPlatform Backend API

Backend Express.js + Prisma pour la plateforme éducative EduPlatform.

## 📦 Installation Rapide

### 1. Créer le dossier backend et installer les dépendances

```bash
# Depuis la racine du projet
mkdir -p backend
cd backend

# Copier tous les fichiers fournis dans ce dossier

# Installer les dépendances
npm install
```

### 2. Configuration de l'environnement

```bash
# Copier le fichier .env.example
cp .env.example .env

# Éditer .env et modifier si nécessaire
```

### 3. Initialiser la base de données

```bash
# Créer le dossier prisma et y placer schema.prisma
mkdir -p prisma

# Générer le client Prisma
npm run prisma:generate

# Créer la base de données
npm run prisma:push

# Peupler avec des données de test
npm run prisma:seed
```

### 4. Démarrer le serveur

```bash
# Mode développement (avec auto-reload)
npm run dev

# OU Mode production
npm start
```

Le serveur démarre sur **http://localhost:5000**

## 📁 Structure des Fichiers

```
backend/
├── prisma/
│   ├── schema.prisma          # Schéma de la base de données
│   └── seed.js                # Données initiales
├── routes/
│   ├── auth.routes.js         # Authentification
│   ├── user.routes.js         # Gestion utilisateurs
│   ├── promotion.routes.js    # Gestion promotions
│   ├── space.routes.js        # Espaces pédagogiques
│   ├── work.routes.js         # Travaux
│   ├── submission.routes.js   # Livraisons
│   └── evaluation.routes.js   # Évaluations
├── middleware/
│   ├── auth.js                # Middleware JWT
│   └── errorHandler.js        # Gestion erreurs
├── server.js                  # Point d'entrée
├── package.json
├── .env.example
├── .env                       # À créer
└── eduplatform.db            # Base SQLite (auto-créée)
```

## 🔑 Comptes de Test

Après le seed, utilisez ces comptes (mot de passe: `password123`):

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Directeur | directeur@eduplatform.com | password123 |
| Formateur 1 | formateur1@eduplatform.com | password123 |
| Formateur 2 | formateur2@eduplatform.com | password123 |
| Formateur 3 | formateur3@eduplatform.com | password123 |
| Étudiant 1-10 | etudiant1@eduplatform.com | password123 |

## 🛣️ Routes API Principales

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/change-password` - Changer mot de passe
- `POST /api/auth/forgot-password` - Mot de passe oublié
- `POST /api/auth/reset-password` - Réinitialiser
- `GET /api/auth/verify` - Vérifier token

### Utilisateurs (Directeur)
- `GET /api/users` - Liste utilisateurs
- `POST /api/users` - Créer utilisateur
- `GET /api/users/:id` - Détails utilisateur
- `PUT /api/users/:id` - Modifier utilisateur
- `DELETE /api/users/:id` - Supprimer utilisateur
- `PATCH /api/users/:id/toggle-status` - Activer/Désactiver
- `GET /api/users/inactive/list` - Comptes inactifs

### Promotions
- `GET /api/promotions` - Liste promotions
- `POST /api/promotions` - Créer promotion (Directeur)
- `GET /api/promotions/:id` - Détails promotion
- `PUT /api/promotions/:id` - Modifier promotion (Directeur)
- `DELETE /api/promotions/:id` - Supprimer promotion (Directeur)

### Espaces Pédagogiques
- `GET /api/spaces` - Liste espaces (filtrés par rôle)
- `POST /api/spaces` - Créer espace (Directeur)
- `GET /api/spaces/:id` - Détails espace
- `PUT /api/spaces/:id` - Modifier espace (Directeur)
- `POST /api/spaces/:id/enroll` - Inscrire étudiants (Directeur)
- `GET /api/spaces/matieres` - Liste matières
- `POST /api/spaces/matieres` - Créer matière (Directeur)

### Travaux
- `GET /api/works` - Liste travaux (filtrés par rôle)
- `POST /api/works` - Créer travail (Formateur)
- `GET /api/works/:id` - Détails travail
- `PUT /api/works/:id` - Modifier travail (Formateur)
- `POST /api/works/:id/assign-individual` - Affecter individuellement
- `POST /api/works/:id/groups` - Créer groupe
- `GET /api/works/student/my-works` - Mes travaux (Étudiant)

### Livraisons
- `POST /api/submissions/individual/:affectationId` - Soumettre individuel (Étudiant)
- `POST /api/submissions/group/:groupeId` - Soumettre groupe (Étudiant)
- `GET /api/submissions/work/:travailId` - Liste livraisons (Formateur)
- `GET /api/submissions/:id` - Détails livraison
- `GET /api/submissions/student/my-submissions` - Mes livraisons (Étudiant)

### Évaluations
- `POST /api/evaluations` - Évaluer (Formateur)
- `PUT /api/evaluations/:id` - Modifier évaluation (Directeur)
- `GET /api/evaluations/:id` - Détails évaluation
- `GET /api/evaluations/student/my-grades` - Mes notes (Étudiant)
- `GET /api/evaluations/student/grades-by-subject` - Notes par matière (Étudiant)
- `GET /api/evaluations/stats/global` - Statistiques (Directeur)

## 🔒 Authentification

Toutes les routes (sauf `/api/auth/login`) nécessitent un token JWT dans le header:

```javascript
headers: {
  'Authorization': 'Bearer <votre-token-jwt>'
}
```

## 🧪 Tester l'API

### Avec curl

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"directeur@eduplatform.com","motDePasse":"password123"}'

# Utiliser le token retourné pour les autres requêtes
curl http://localhost:5000/api/users \
  -H "Authorization: Bearer <votre-token>"
```

### Avec Prisma Studio

```bash
# Ouvrir l'interface graphique de la base de données
npm run prisma:studio
```

## 🔧 Scripts npm Disponibles

```bash
npm run dev              # Démarre en mode développement
npm start                # Démarre en mode production
npm run prisma:generate  # Génère le client Prisma
npm run prisma:push      # Applique le schéma à la DB
npm run prisma:studio    # Ouvre l'interface graphique
npm run prisma:seed      # Peuple la DB avec données test
npm run setup            # Setup complet (generate + push + seed)
```

## 🌐 Connexion avec le Frontend

### 1. Configuration du Frontend

Dans votre frontend React, créez/modifiez `src/services/api.js`:

```javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour ajouter le token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
```

### 2. Variables d'environnement Frontend

Créez `.env` dans le frontend:

```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Exemple d'utilisation dans le Frontend

```javascript
import api from './services/api';

// Login
const login = async (email, motDePasse) => {
  const response = await api.post('/auth/login', { email, motDePasse });
  localStorage.setItem('token', response.data.token);
  localStorage.setItem('user', JSON.stringify(response.data.user));
  return response.data;
};

// Récupérer les utilisateurs
const getUsers = async () => {
  const response = await api.get('/users');
  return response.data;
};
```

## 🚀 Déploiement

### Option 1: Render.com (Recommandé)

1. Créer un compte sur [Render.com](https://render.com)
2. Créer un nouveau "Web Service"
3. Connecter votre repo GitHub
4. Configuration:
   - **Build Command**: `npm install && npm run setup`
   - **Start Command**: `npm start`
   - **Environment Variables**: Ajouter les variables du `.env`

### Option 2: Railway

1. Créer un compte sur [Railway.app](https://railway.app)
2. Créer un nouveau projet depuis GitHub
3. Ajouter les variables d'environnement
4. Railway détectera automatiquement Node.js

### Option 3: Heroku

```bash
# Installer Heroku CLI puis:
heroku create eduplatform-api
git push heroku main
heroku config:set JWT_SECRET=votre-secret
```

## 🐛 Dépannage

### La base de données n'est pas créée
```bash
rm -f prisma/eduplatform.db
npm run prisma:push
npm run prisma:seed
```

### Erreur "Cannot find module"
```bash
rm -rf node_modules package-lock.json
npm install
```

### Port déjà utilisé
Modifiez le `PORT` dans `.env` ou arrêtez le processus:
```bash
# Linux/Mac
lsof -ti:5000 | xargs kill

# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

## 📝 Notes Importantes

- **Base de données**: SQLite (fichier `eduplatform.db`)
- **JWT Secret**: CHANGEZ-LE en production !
- **CORS**: Configuré pour `http://localhost:5173` (frontend Vite)
- **Upload de fichiers**: Non implémenté (utilisez Cloudinary/S3)
- **Emails**: Non implémentés (ajoutez Nodemailer)

## 🎯 Prochaines Étapes

1. ✅ Backend fonctionnel
2. 🔄 Adapter les appels API dans le frontend
3. 🧪 Tester toutes les fonctionnalités
4. 🚀 Déployer backend et frontend
5. 🔐 Sécuriser en production

## 🆘 Besoin d'Aide ?

Si vous rencontrez des problèmes:
1. Vérifiez les logs du serveur
2. Vérifiez que toutes les dépendances sont installées
3. Assurez-vous que le port 5000 est libre
4. Vérifiez le fichier `.env`

Bon courage ! 🚀