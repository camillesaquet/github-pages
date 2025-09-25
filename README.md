# Agri Holann – Gestion des chauffeurs

Application web permettant à l'entreprise Agri Holann de planifier les tournées de ses chauffeurs, de suivre l'exécution des courses et de centraliser les justificatifs de transport.

## Fonctionnalités principales

- **Authentification simplifiée** : recherche et connexion d'un chauffeur par son nom de famille, accès dédié à l'administration.
- **Tableaux de bord** : vue chauffeur (courses du jour et de la semaine) et vue administrateur (planning global, filtres par chauffeur, journal des activités).
- **Comptes administrateurs** : création et connexion d'un compte dont l'identifiant est construit à partir de l'initiale du prénom et du nom de famille, suivi des actions avec ces initiales.
- **Gestion du parc de chauffeurs** : ajout/suppression de chauffeurs depuis l'administration, sélection rapide dans les formulaires de création de course.
- **Archivage avancé** : onglet dédié pour consulter les courses archivées avec filtres par chauffeur, période et type de marchandise, archivage/désarchivage directement depuis le journal d'activité.
- **Gestion complète des courses** : création, édition, suppression et validation avec prise de photo du bon de transport.
- **Notifications par e-mail** : envoi automatique via l'API Gmail avec pièce jointe lors de la validation d'une course.
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

### Configuration de l'envoi d'e-mails

L'application utilise l'API Gmail en OAuth2. Avant de lancer le serveur, définissez les variables d'environnement suivantes :

| Variable | Description |
| --- | --- |
| `GMAIL_CLIENT_ID` | Identifiant OAuth2 de l'application Google Cloud. |
| `GMAIL_CLIENT_SECRET` | Secret OAuth2 associé. |
| `GMAIL_REFRESH_TOKEN` | Jeton d'actualisation autorisant l'envoi au nom du compte Gmail. |
| `GMAIL_REDIRECT_URI` | URI de redirection utilisé lors de la génération du jeton (défaut : `http://localhost`). |
| `GMAIL_SENDER` | Adresse e-mail expéditrice (défaut : `chauffeur.agriholann@gmail.com`). |
| `DEFAULT_COMPLETION_EMAIL` | Adresse de réception par défaut des comptes rendus de courses. |

À défaut de variables d'environnement, le serveur tente automatiquement de charger les identifiants
depuis des fichiers placés à la racine du projet (dans le même dossier que `server.js`) :

- `credentials.json` contenant la configuration OAuth (clé `web` ou `installed`, champs `client_id`, `client_secret` et `redirect_uris` ou `redirect_uri`).
- `token.json` contenant un champ `refresh_token` (le format `refreshToken` est également accepté).

Les fichiers sont relus à chaque tentative d'envoi : vous pouvez donc les ajouter ou les remplacer sans
redémarrer l'application, l'API Gmail sera automatiquement reconfigurée.

Vous pouvez générer ce fichier `token.json` automatiquement à partir d'un refresh token existant :

```bash
# Exemple avec le refresh_token récupéré via votre script get_refresh_token.js
npm run create-gmail-token -- --refresh-token="1//0gXXXXXXXXXXXXXXXXXXXX"

# Pour choisir un autre emplacement ou écraser un fichier existant
npm run create-gmail-token -- --refresh-token="1//0gXXXXXXXXXXXXXXXXXXXX" --output=/chemin/vers/token.json --force
```

Ces fichiers peuvent être générés à l'aide du script de test Gmail fourni et permettent de conserver
le dossier `assets/images` vide tout en référencant l'image `login.png` pour l'écran de connexion.

L'onglet « Paramètres » de l'administration permet de piloter toute la configuration e-mail :

- adresse de réception utilisée lors de la validation d'une course ;
- `client_id`, `client_secret`, `refresh_token` et `redirect_uri` Gmail à renseigner tels qu'affichés dans la console Google Cloud.

Les valeurs saisies sont stockées en base SQLite. Elles sont rechargées à chaque envoi d'e-mail et servent de secours si aucune
variable d'environnement n'est définie. Les variables d'environnement restent prioritaires si elles sont présentes.

### Structure des données

La base SQLite est initialisée automatiquement au démarrage dans le dossier `db/agriholann.db` avec des données de démonstration (chauffeurs et courses). Les photos prises lors des validations ainsi que les pièces jointes des e-mails simulés sont stockées dans `storage/attachments`.

### Accès administrateur

- Lors de la connexion, cliquez sur « Connexion administration » puis saisissez votre identifiant : initiale du prénom suivie du nom en minuscules (ex. `lsaquet`).
- Un mot de passe est requis pour accéder à l'espace d'administration. Le compte de démonstration créé automatiquement utilise le mot de passe `admin` (modifiable via la variable d'environnement `ADMIN_DEFAULT_PASSWORD`).
- Il est possible de créer un nouveau compte directement depuis cette fenêtre en renseignant un prénom et un nom. L'application génère automatiquement l'identifiant associé et vous invite à définir un mot de passe (aucune contrainte particulière).
- Toutes les actions menées depuis l'administration (création, édition, archivage, suppression) sont historisées dans le journal avec les initiales de l'administrateur connecté.

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
| `POST /api/drivers` | Ajoute un chauffeur. |
| `DELETE /api/drivers/:id` | Supprime un chauffeur et ses courses associées. |
| `GET /api/admins` | Liste les comptes administrateurs existants. |
| `POST /api/admins` | Crée un compte administrateur à partir d'un prénom et d'un nom. |
| `POST /api/admins/login` | Connecte un administrateur via son identifiant généré. |
| `GET /api/courses` | Liste les courses avec filtres `driverId`, `from`, `to`, `archived`. |
| `GET /api/courses/:id` | Récupère le détail d'une course. |
| `POST /api/courses` | Crée une nouvelle course. |
| `PUT /api/courses/:id` | Met à jour une course existante. |
| `DELETE /api/courses/:id` | Supprime une course. |
| `POST /api/courses/:id/complete` | Valide une course, sauvegarde la photo et journalise l'activité. |
| `POST /api/courses/:id/archive` | Archive une course active. |
| `POST /api/courses/:id/unarchive` | Restaure une course archivée. |
| `GET /api/activity` | Retourne le journal des actions sur les courses. |
| `GET /api/emails` | Liste les e-mails simulés envoyés lors des validations. |

## Développement futur

- Ajout d'une authentification sécurisée (mots de passe / SSO).
- Intégration à un vrai service SMTP pour l'envoi d'e-mails.
- Exposition d'API supplémentaires pour le reporting.
- Mise en place de tests automatisés (unitaires et end-to-end).

## Licence

Ce projet est distribué sous licence MIT.
