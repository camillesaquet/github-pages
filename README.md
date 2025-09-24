# Agri Holann – Gestion des chauffeurs

Application web permettant à l'entreprise Agri Holann de planifier les tournées de ses chauffeurs, de suivre l'exécution des courses et de centraliser les justificatifs de transport.

## Fonctionnalités principales

- **Authentification simplifiée** : recherche et connexion d'un chauffeur par son nom de famille, accès dédié à l'administration.
- **Tableaux de bord** : vue chauffeur (courses du jour et de la semaine) et vue administrateur (planning global, filtres par chauffeur, journal des activités).
- **Comptes administrateurs** : création et connexion d'un compte dont l'identifiant est construit à partir de l'initiale du prénom et du nom de famille, suivi des actions avec ces initiales.
- **Gestion du parc de chauffeurs** : ajout/suppression de chauffeurs depuis l'administration, sélection rapide dans les formulaires de création de course.
- **Archivage avancé** : onglet dédié pour consulter les courses archivées avec filtres par chauffeur, période et type de marchandise, archivage/désarchivage directement depuis le journal d'activité.
- **Gestion complète des courses** : création, édition, suppression et validation avec prise de photo du bon de transport.
- **Notifications par e-mail simulées** : enregistrement d'un récapitulatif lors de la validation d'une course, avec la photo et les commentaires du chauffeur.
- **Persistance des données** : stockage des chauffeurs, courses, journaux d'activité et e-mails simulés dans une base SQLite embarquée.

## Déploiement sur Hostinger

L'application est prête à être copiée telle quelle sur une offre d'hébergement mutualisé (Apache + PHP) comme Hostinger. Le dossier `public_html/` contient l'intégralité des fichiers à exposer publiquement.

1. **Copier les fichiers**
   - Téléversez le contenu du dossier `public_html/` dans le dossier `public_html` de votre hébergement Hostinger.
   - Créez à la racine du compte (au même niveau que `public_html`) un dossier `storage/` et conservez le fichier `.gitkeep` si vous utilisez Git.

2. **Vérifier les permissions**
   - Assurez-vous que les dossiers `storage/` et `public_html/uploads/` sont accessibles en écriture par PHP (`chmod 775` généralement suffisant).

3. **Accès à l'application**
   - Rendez-vous sur l'URL de votre site. Le fichier `public_html/index.html` charge l'interface et communique avec les scripts PHP situés dans `public_html/api/`.

Aucun serveur Node.js n'est requis : toutes les API sont servies par PHP et la base SQLite est initialisée automatiquement si elle n'existe pas.

## Structure des données

- La base SQLite est créée dans `storage/agriholann.db` dès le premier accès à l'API.
- Les photos déposées lors des validations sont sauvegardées dans `public_html/uploads/` et accessibles via l'URL `/uploads/nom-du-fichier`.
- Les journaux d'activité et les e-mails simulés sont conservés dans la base SQLite.

## Accès administrateur

- À la connexion, cliquez sur « Connexion administration » puis saisissez votre identifiant : initiale du prénom suivie du nom en minuscules (ex. `lsaquet`).
- Un mot de passe est requis pour accéder à l'espace d'administration. Le compte de démonstration créé automatiquement utilise le mot de passe `admin` (modifiable en recréant l'utilisateur ou via la base).
- Il est possible de créer un nouveau compte directement depuis la fenêtre dédiée en renseignant un prénom, un nom et un mot de passe. L'application génère automatiquement l'identifiant associé.
- Toutes les actions menées depuis l'administration (création, édition, archivage, suppression) sont historisées dans le journal avec les initiales de l'administrateur connecté.

## API (aperçu)

Les points d'entrées sont disponibles sous `https://votre-domaine/api/…` et renvoient toutes les réponses en JSON.

| Méthode | Chemin | Description |
| --- | --- | --- |
| `GET /api/drivers` | Liste les chauffeurs (filtrage via `?search=`). |
| `POST /api/drivers` | Ajoute un chauffeur. |
| `GET /api/drivers/:id` | Retourne un chauffeur. |
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

- Ajout d'une authentification renforcée (règles de mot de passe, récupération, SSO, etc.).
- Intégration à un vrai service SMTP pour l'envoi d'e-mails.
- Exposition d'API supplémentaires pour le reporting.
- Mise en place de tests automatisés (unitaires et end-to-end).

## Licence

Ce projet est distribué sous licence MIT.
