# Agri Holann – Gestion des chauffeurs

Application web permettant à l'entreprise Agri Holann de planifier les tournées de ses chauffeurs, de suivre l'exécution des courses et de centraliser les justificatifs de transport.

## Fonctionnalités principales

- **Authentification simplifiée** : recherche et connexion d'un chauffeur par son nom de famille, accès dédié à l'administration.
- **Tableaux de bord** : vue chauffeur (courses du jour et de la semaine) et vue administrateur (planning global, filtres, journal des activités).
- **Comptes administrateurs** : création et connexion d'un compte dont l'identifiant est construit à partir de l'initiale du prénom et du nom de famille, suivi des actions avec ces initiales.
- **Gestion du parc de chauffeurs** : ajout/suppression de chauffeurs depuis l'administration, sélection rapide dans les formulaires de création de course.
- **Archivage avancé** : onglet dédié pour consulter les courses archivées avec filtres par chauffeur, période et type de marchandise, archivage/désarchivage depuis le journal d'activité.
- **Gestion complète des courses** : création, édition, suppression et validation avec prise de photo du bon de transport.
- **Notifications par e-mail simulées** : enregistrement d'un récapitulatif lors de la validation d'une course, avec la photo et les commentaires du chauffeur.
- **Persistance des données** : stockage des chauffeurs, courses, journaux d'activité et e-mails simulés dans une base SQLite embarquée.

## Démarrage rapide

L'application repose sur un serveur Node.js/Express qui expose l'API et sert les fichiers statiques du dossier `public_html/`.

```bash
npm install
npm run init-db   # initialise la base SQLite avec des données de démonstration
npm start         # démarre le serveur sur http://localhost:3000
```

Par défaut, le compte administrateur de démonstration est :

- Identifiant : `lsaquet`
- Mot de passe : `admin`

Le script `npm run init-db` peut être rejoué à tout moment pour repartir d'une base propre (il supprime puis régénère la base `storage/agriholann.db`).

## Structure du projet

- `server.js` : point d'entrée du serveur Express.
- `src/database.js` : gestion de la base SQLite, initialisation, enregistrement des photos et de l'activité.
- `src/api.js` : routes HTTP (`/api/...`).
- `public_html/` : fichiers statiques (HTML, CSS, JS, images) servis au navigateur.
- `storage/agriholann.db` : base SQLite générée automatiquement (dossier créé au démarrage si besoin).
- `public_html/uploads/` : dossier d'enregistrement des photos prises lors de la validation d'une course.

## API (aperçu)

Les points d'entrée sont exposés sous `http://localhost:3000/api/...` (ou sur le domaine que vous utilisez) et renvoient toutes les réponses en JSON.

| Méthode | Chemin | Description |
| --- | --- | --- |
| `GET /api/drivers` | Liste les chauffeurs (filtrage via `?search=`). |
| `POST /api/drivers` | Ajoute un chauffeur. |
| `GET /api/drivers/:id` | Retourne un chauffeur. |
| `DELETE /api/drivers/:id` | Supprime un chauffeur et nettoie ses photos. |
| `GET /api/admins` | Liste les comptes administrateurs existants. |
| `POST /api/admins` | Crée un compte administrateur à partir d'un prénom, d'un nom et d'un mot de passe. |
| `POST /api/admins/login` | Connecte un administrateur via son identifiant généré. |
| `GET /api/courses` | Liste les courses avec filtres `driverId`, `from`, `to`, `archived`. |
| `GET /api/courses/:id` | Récupère le détail d'une course. |
| `POST /api/courses` | Crée une nouvelle course et journalise l'action. |
| `PUT /api/courses/:id` | Met à jour une course existante. |
| `DELETE /api/courses/:id` | Supprime une course. |
| `POST /api/courses/:id/complete` | Valide une course, sauvegarde la photo et fusionne la création/validation dans le journal. |
| `POST /api/courses/:id/archive` | Archive une course active. |
| `POST /api/courses/:id/unarchive` | Restaure une course archivée. |
| `GET /api/activity` | Retourne le journal des actions sur les courses (hors courses archivées). |
| `GET /api/emails` | Liste les e-mails simulés enregistrés lors des validations. |

## Notes de déploiement

- Prévoir que les dossiers `storage/` et `public_html/uploads/` soient accessibles en écriture par le serveur.
- Vous pouvez ajuster le port via la variable d'environnement `PORT`.
- Pour modifier le mot de passe par défaut du compte administrateur pré-rempli, définir `ADMIN_DEFAULT_PASSWORD` avant d'exécuter `npm run init-db` ou démarrer le serveur.

## Licence

Ce projet est distribué sous licence MIT.
