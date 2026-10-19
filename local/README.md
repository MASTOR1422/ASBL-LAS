# ASBL-LAS local — SQLite, sans Supabase

Ce dossier prépare une exécution sur un ordinateur ou un serveur qui conserve les fichiers sur disque. Il ne modifie pas `main`, la base Supabase existante ni la configuration de production.

## Prérequis

- Node.js 22.13 ou plus récent
- npm

## Initialiser la base

Depuis le dossier `local/` :

```bash
npm install
npm run init-db
```

La base est créée dans `local/data/asbl-las.sqlite`. Ce fichier est ignoré par Git et ne doit jamais être commité. Pour changer son emplacement, définir `LAS_DB_PATH` vers un chemin persistant et protégé.

## Créer ou réinitialiser le compte administrateur local

Linux/macOS :

```bash
LAS_ADMIN_USERNAME=admin LAS_ADMIN_EMAIL=admin@example.org LAS_ADMIN_PASSWORD='Remplacer-Par-Un-Mot-De-Passe-Long' npm run create-admin
```

PowerShell :

```powershell
$env:LAS_ADMIN_USERNAME='admin'
$env:LAS_ADMIN_EMAIL='admin@example.org'
$env:LAS_ADMIN_PASSWORD='Remplacer-Par-Un-Mot-De-Passe-Long'
npm run create-admin
```

Le mot de passe n'est jamais écrit en clair dans SQLite. Choisir un mot de passe unique et fort. Ne pas réutiliser un secret de Supabase.

## Démarrer

```bash
npm start
```

Par défaut, le serveur écoute sur `http://127.0.0.1:3000` et refuse les connexions distantes. Pour une utilisation sur un serveur privé, définir explicitement `LAS_HOST` et mettre un proxy HTTPS/firewall devant l'application.

## Schéma local

Le fichier `sqlite/schema.sql` recrée les entités du projet : membres, utilisateurs/rôles, sessions, cotisations, paiements mensuels, publications, médias, commentaires, tontine, demandes d'entraide et audit. Les clés étrangères, contraintes, index et premiers déclencheurs d'audit sont inclus.

## État de la migration depuis Supabase

Cette base est séparée de Supabase. Elle démarre vide : les données ne sont ni copiées ni supprimées automatiquement. Avant d'abandonner Supabase, il faut exporter les données voulues, importer et comparer les comptes/membres/cotisations, puis tester les parcours et les autorisations. Les mots de passe Supabase ne sont pas exportables en clair : les comptes locaux doivent recevoir un mot de passe local initial ou le réinitialiser.

## Important — état fonctionnel

Cette première couche fournit le schéma SQLite et le socle serveur local (authentification locale et endpoints de données de base). La page V2 existante utilise encore Supabase dans son navigateur : elle ne doit pas être considérée comme entièrement migrée tant que les écrans ne sont pas raccordés aux API locales et testés. Ne pas fusionner la branche ni désactiver Supabase avant cette validation. Vercel n'est pas adapté à un fichier SQLite local persistant sans stockage durable partagé.


## Créer un compte membre / trésorier / secrétaire

Après avoir importé les fiches membres, utiliser la commande ci-dessous. Pour un compte membre, renseigner l’identifiant numérique de la fiche dans LAS_MEMBER_ID. La commande réinitialise aussi le mot de passe et révoque les anciennes sessions si le nom d’utilisateur existe déjà.

```bash
LAS_USERNAME=prenom.nom LAS_PASSWORD='Un-Mot-De-Passe-Long-Unique' LAS_ROLE=membre LAS_MEMBER_ID=1 LAS_DISPLAY_NAME='Prénom Nom' npm run create-user
```

Rôles acceptés : admin, tresorier, secretaire, membre.

## Importer des données exportées

import-data.js accepte un fichier JSON privé dont les clés sont les noms de tables (members, monthly_contributions, member_payments, posts, media_items, post_comments, tontine_periods, tontine_entries, aid_requests) et les valeurs des tableaux d’objets exportés. Il conserve les identifiants quand ils sont fournis, ignore les conflits existants et importe dans une transaction.

```bash
node import-data.js ./export-las.json
```

Le fichier d’export ne doit pas être ajouté au dépôt. Les références d’anciens utilisateurs/auteurs sont volontairement omises lors de l’import, car leurs identités et mots de passe ne se transfèrent pas automatiquement. Recréez les comptes locaux avec create-user.js, puis rattachez-les aux fiches membres.


### Export unique depuis Supabase (migration seulement)

Le fichier export-from-supabase.sql contient une requête SELECT en lecture seule. Dans l’ancien projet Supabase, ouvrir SQL Editor, exécuter cette requête et copier le résultat JSON dans un fichier privé export-las.json. Il contient aussi les tables de correspondance profils/identifiants pour aider à recréer les comptes, mais les mots de passe ne sont pas exportés. Garder ce fichier hors du dépôt et le supprimer de façon sûre après validation de la migration.

Avant l’import, contrôler le nombre de lignes exportées et conserver une sauvegarde séparée. Cette étape utilise Supabase uniquement pour l’export initial; le serveur SQLite local n’y fait aucun appel.
