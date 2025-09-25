# Agri Holann – Gestion des chauffeurs

Application web permettant à l'entreprise Agri Holann de planifier les tournées de ses chauffeurs, de suivre l'exécution des courses et de centraliser les justificatifs de transport.

## Fonctionnalités principales

- **Authentification simplifiée** : recherche et connexion d'un chauffeur par son nom de famille, accès dédié à l'administration.
- **Tableaux de bord** : vue chauffeur (courses du jour et de la semaine) et vue administrateur (planning global, filtres par chauffeur, journal des activités).
- **Comptes administrateurs** : session sécurisée par jeton, rôles `superadmin`, `manager` ou `standard` avec contrôle fin des droits et historique des actions signées par les initiales.
- **Gestion du parc de chauffeurs** : ajout/suppression de chauffeurs et pilotage de leurs mots de passe depuis un panneau dédié aux administrateurs.
- **Archivage avancé** : onglet dédié pour consulter les courses archivées avec filtres par chauffeur, période et type de marchandise, archivage/désarchivage directement depuis le journal d'activité.
- **Gestion complète des courses** : création, édition, suppression et validation avec prise de photo du bon de transport.
- **Notifications par e-mail** : envoi automatique via l'API Gmail avec pièce jointe lors de la validation d'une course et adresse de réception administrable depuis les paramètres.
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

L'onglet « Paramètres » de l'administration propose un onglet « Configuration email » qui permet aux administrateurs
connectés de modifier l'adresse de réception des comptes rendus. Les identifiants OAuth (client, secret,
refresh token, redirect URI) restent pilotés par les variables d'environnement ou par les fichiers `credentials.json`
et `token.json` présents à la racine du projet. Lorsqu'ils sont enregistrés en base via l'API, ils servent de valeur
de secours mais ne sont pas éditables dans l'interface.

### Structure des données

La base SQLite est initialisée automatiquement au démarrage dans le dossier `db/agriholann.db` avec des données de démonstration (chauffeurs et courses). Les photos prises lors des validations ainsi que les pièces jointes des e-mails simulés sont stockées dans `storage/attachments`.

### Accès administrateur

- Cliquez sur « Connexion administration » puis saisissez votre identifiant : initiale du prénom suivie du nom en minuscules (ex. `lsaquet`).
- Un compte super administrateur « Laurent Saquet » est automatiquement créé au démarrage avec l'identifiant `lsaquet` et le mot de passe par défaut `lannion` (surchageable via `SUPER_ADMIN_DEFAULT_PASSWORD`).
- Seul ce super administrateur peut créer ou supprimer d'autres comptes administrateurs depuis l'onglet **Paramètres → Administrateurs** et attribuer un rôle (`manager` ou `standard`).
- Chaque administrateur peut modifier son propre mot de passe dans l'onglet **Paramètres → Administrateurs** après saisie du mot de passe actuel.
- L'onglet **Paramètres → Accès chauffeurs** permet d'ajouter, modifier ou retirer les mots de passe des chauffeurs ; ils deviennent obligatoires à la connexion lorsqu'ils sont définis.
- Toutes les actions menées depuis l'administration (création, modification, archivage, suppression, gestion des comptes) sont historisées dans le journal avec les initiales de l'administrateur connecté.

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
| `POST /api/drivers` | Ajoute un chauffeur (requiert l'en-tête `X-Admin-Token`). |
| `DELETE /api/drivers/:id` | Supprime un chauffeur et ses courses associées (requiert `X-Admin-Token`). |
| `GET /api/drivers/credentials` | Retourne la liste des chauffeurs et l'état de leurs mots de passe (requiert `X-Admin-Token`). |
| `PUT /api/drivers/:id/password` | Définit ou met à jour le mot de passe d'un chauffeur (requiert `X-Admin-Token`). |
| `DELETE /api/drivers/:id/password` | Supprime le mot de passe d'un chauffeur (requiert `X-Admin-Token`). |
| `POST /api/drivers/login` | Valide l'accès chauffeur et vérifie le mot de passe lorsqu'il est défini. |
| `GET /api/admins` | Liste les comptes administrateurs existants (données minimales pour l'écran de connexion). |
| `POST /api/admins` | Crée un compte administrateur (réservé au super administrateur via `X-Admin-Token`). |
| `DELETE /api/admins/:id` | Supprime un compte administrateur (réservé au super administrateur via `X-Admin-Token`). |
| `POST /api/admins/login` | Connecte un administrateur et retourne un jeton de session. |
| `POST /api/admins/logout` | Ferme la session administrateur active (requiert `X-Admin-Token`). |
| `PUT /api/admins/:id/password` | Met à jour le mot de passe de l'administrateur connecté (requiert `X-Admin-Token`). |
| `GET /api/courses` | Liste les courses avec filtres `driverId`, `from`, `to`, `archived`. |
| `GET /api/courses/:id` | Récupère le détail d'une course. |
| `POST /api/courses` | Crée une nouvelle course. |
| `PUT /api/courses/:id` | Met à jour une course existante. |
| `DELETE /api/courses/:id` | Supprime une course et journalise l'opération. |
| `POST /api/courses/:id/complete` | Valide une course, sauvegarde la photo et journalise l'activité. |
| `POST /api/courses/:id/archive` | Archive une course active. |
| `POST /api/courses/:id/unarchive` | Restaure une course archivée. |
| `GET /api/activity` | Retourne le journal des actions sur les courses. |
| `GET /api/settings/email-recipient` | Retourne l'adresse email de réception (requiert `X-Admin-Token`). |
| `PUT /api/settings/email-recipient` | Met à jour l'adresse email de réception (requiert `X-Admin-Token`). |
| `GET /api/emails` | Liste les e-mails simulés envoyés lors des validations. |

## Développement futur

- Ajout d'une authentification sécurisée (mots de passe / SSO).
- Intégration à un vrai service SMTP pour l'envoi d'e-mails.
- Exposition d'API supplémentaires pour le reporting.
- Mise en place de tests automatisés (unitaires et end-to-end).

## Licence

Ce projet est distribué sous licence MIT.
