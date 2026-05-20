# VoiceBot Admin — Guide d'installation

## Structure
```
voicebot_admin/
├── backend/
│   ├── main.py           ← API FastAPI (auth, upload, KB, historique)
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/App.jsx       ← Interface React complète
│   ├── index.html
│   └── package.json
└── database.sql          ← Script SQL à importer dans XAMPP
```

## 1. Base de données XAMPP
1. Démarrer Apache + MySQL dans XAMPP Control Panel
2. Ouvrir http://localhost/phpmyadmin
3. Onglet "Import" → choisir `database.sql` → Exécuter
4. La base `voicebot_db` est créée avec toutes les tables

## 2. Backend FastAPI
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Configurer .env si besoin (DB_PASSWORD si MySQL a un mot de passe)
# Lancer
uvicorn main:app --reload --port 8000
```
API disponible sur http://localhost:8000
Docs Swagger : http://localhost:8000/docs

Note compatibilite Python :
- Recommande : Python 3.11 ou 3.12 pour un setup local simple.
- Python 3.13 peut fonctionner, mais si une dependance compile en natif, vous pouvez avoir besoin des Build Tools C++.
- En cas de probleme local, preferez la methode Docker (`docker compose up -d --build`) qui evite ces dependances systeme.

## 3. Frontend React
```powershell
cd frontend
npm install
npm run dev
```
Interface disponible sur http://localhost:5173

## 4. Dockeriser MySQL + Backend (recommandé)
Le projet inclut maintenant un fichier `docker-compose.yml` qui démarre :
- MySQL 8 (`mysql`) avec persistance des données
- Backend FastAPI (`backend`) connecté automatiquement à MySQL

### Démarrage
```powershell
cd voicebot_admin
docker compose up -d --build
```

### Accès
- API : http://localhost:8000
- Swagger : http://localhost:8000/docs
- MySQL exposé sur le port hôte `3307` (utile si XAMPP utilise déjà `3306`)

### Arrêt
```powershell
docker compose down
```

### Réinitialiser complètement la base Docker
```powershell
docker compose down -v
docker compose up -d --build
```

Notes :
- Le script `database.sql` est exécuté automatiquement lors de la première initialisation du volume MySQL.
- Les fichiers uploadés sont persistés dans le volume Docker `backend_uploads`.
- Si vous lancez le frontend en local (`npm run dev`), il peut continuer d'appeler `http://localhost:8000` sans changement.

## Comptes de démo
| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@voicebot.sn | admin123 | Admin |
| user@voicebot.sn  | user123  | User  |

## Fonctionnalités Admin
- **Tableau de bord** : statistiques globales (users, conversations, messages, PDFs, KB)
- **Gestion utilisateurs** : liste, changement de rôle, désactivation
- **Upload fichiers** : PDF, images, texte, CSV — glisser-déposer, catégorisation
- **Base de connaissances** : CRUD des Q/R par catégorie et langue
- **Historique global** : toutes les conversations de tous les users avec détail messages

## Fonctionnalités User
- **Mon historique** : mes conversations et messages
- **Mes documents** : PDFs générés

## Intégration avec le voicebot principal
Ajouter dans `voicebot_complet/backend/main.py` :
```python
import requests

ADMIN_API = "http://localhost:8000"

# Sauvegarder un message après chaque échange
def save_to_db(session_id, user_token, role, wolof, fr, intent, slots):
    try:
        requests.post(f"{ADMIN_API}/conversations/message",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"session_id": session_id, "role": role,
                  "contenu_wolof": wolof, "contenu_fr": fr,
                  "intent_detecte": intent, "slots_json": slots})
    except: pass
```
# voice_bot_dev_mag
