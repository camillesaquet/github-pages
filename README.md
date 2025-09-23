# Agri Holann – Gestion des chauffeurs

Application web permettant à l'entreprise Agri Holann de planifier les tournées de ses chauffeurs, de suivre l'exécution des courses et de centraliser les justificatifs de transport.

## Fonctionnalités principales

- **Authentification simplifiée** : recherche et connexion d'un chauffeur par son nom de famille, accès dédié à l'administration.
- **Tableaux de bord** : vue chauffeur (courses du jour et de la semaine) et vue administrateur (planning global, filtres par chauffeur, journal des activités).
- **Gestion complète des courses** : création, édition, suppression et validation avec prise de photo du bon de transport.
- **Notifications par e-mail** : envoi automatique (transport simulé) d'un récapitulatif au siège lors de la validation d'une course.
- **Persistance des données** : stockage des chauffeurs, courses, journaux d'activité et e-mails simulés dans une base SQLite embarquée.

## Démarrage rapide

### Prérequis

- [Node.js](https://nodejs.org/) 18 ou plus récent
- npm (fourni avec Node.js)

### Installation

```bash
npm install
```

### Lancer l'application

```bash
npm start
```

Le serveur écoute par défaut sur [http://localhost:3000](http://localhost:3000) et sert à la fois l'API et l'interface web.

### Structure des données

La base SQLite est initialisée automatiquement au démarrage dans le dossier `db/agriholann.db` avec des données de démonstration (chauffeurs et courses). Les photos prises lors des validations ainsi que les pièces jointes des e-mails simulés sont stockées dans `storage/attachments`.

## Scripts complémentaires

| Commande | Description |
| --- | --- |
| `npm start` | Lance le serveur Express en mode production. |
| `npm run dev` | Lance le serveur avec rechargement via nodemon. |
| `npm run init-db` | Réinitialise la base en exécutant le script d'initialisation (utilisé automatiquement au démarrage). |

## API (aperçu)

| Méthode | Chemin | Description |
| --- | --- | --- |
| `GET /api/drivers` | Liste les chauffeurs (filtrage via `?search=`). |
| `GET /api/courses` | Liste les courses avec filtres `driverId`, `from`, `to`. |
| `GET /api/courses/:id` | Récupère le détail d'une course. |
| `POST /api/courses` | Crée une nouvelle course. |
| `PUT /api/courses/:id` | Met à jour une course existante. |
| `DELETE /api/courses/:id` | Supprime une course. |
| `POST /api/courses/:id/complete` | Valide une course, sauvegarde la photo et journalise l'activité. |
| `GET /api/activity` | Retourne le journal des actions sur les courses. |
| `GET /api/emails` | Liste les e-mails simulés envoyés lors des validations. |

## Développement futur

- Ajout d'une authentification sécurisée (mots de passe / SSO).
- Intégration à un vrai service SMTP pour l'envoi d'e-mails.
- Exposition d'API supplémentaires pour le reporting.
- Mise en place de tests automatisés (unitaires et end-to-end).

## Licence

Ce projet est distribué sous licence MIT.
