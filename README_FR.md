# ASBL LAS — Portail administratif sécurisé

Le dépôt contient l’application web de l’ASBL Les Amis de la Semence, publiée comme site HTML statique et fonctions API Node sur Vercel, avec Supabase pour l’authentification, la base de données et les fichiers privés.

## Fonctionnalités

- Connexion par nom d’utilisateur et mot de passe; la correspondance identifiant/e-mail reste côté serveur.
- Vérification du profil actif et du rôle avant d’afficher le tableau de bord.
- Répertoire des membres et suivi mensuel des cotisations.
- Blog communautaire, commentaires et rappels d’anniversaire.
- Photothèque/documents dans un bucket Supabase privé avec URL signées temporaires.
- Journal d’audit et politiques RLS sur les tables exposées.
- Import historique facultatif via `admin-migration.html`; la source locale n’est jamais supprimée automatiquement.

## Organisation du dépôt

- `index.html` : tableau de bord.
- `login.html`, `reset-password.html`, `Auth.js` : authentification.
- `api/auth/` : endpoints serveur pour connexion par identifiant et récupération.
- `api/supabase-config.js` : expose uniquement l’URL Supabase et la clé publishable.
- `supabase/las-data.js`, `supabase/las-media.js`, `las-blog.js` : accès aux données.
- `supabase/schema.sql` : socle des tables pour un nouveau projet uniquement.
- `supabase/migrations/` : migrations versionnées; leurs versions correspondent à l’historique Supabase du projet connecté.
- `SECURITY_SETUP.md` : configuration et contrôles de sécurité.

## Base de données Supabase

### Nouveau projet

1. Créez le projet Supabase et activez le fournisseur Auth Email/Password.
2. Dans SQL Editor, exécutez une seule fois `supabase/schema.sql`.
3. Exécutez ensuite, dans l’ordre chronologique, les migrations du dossier `supabase/migrations/`.
4. Vérifiez les politiques RLS et les fonctions dans les Security Advisors.
5. Créez les comptes Auth puis leurs profils actifs; ne permettez pas aux utilisateurs de changer eux-mêmes leur rôle.

### Projet LAS déjà configuré

Ne réexécutez pas le socle `schema.sql`. La base connectée a déjà les migrations `username_auth`, `las_schema_alignment`, `las_private_rls_helpers`, `las_member_privacy`, `las_storage_path_access`, `las_legacy_policy_cleanup`, `las_storage_cleanup_permissions`, `restrict_sync_member_identity_rpc` et `las_media_upload_capacity`. Conservez les données et appliquez seulement les nouvelles migrations non présentes dans l’historique.

Le schéma conserve `monthly_contributions` (montants et devises) pour les écritures financières historiques. L’interface des cases mensuelles utilise `member_payments`. Les écritures historiques sont conservées; la migration d’alignement ne supprime aucune table.

## Rôles

| Rôle | Autorisations principales |
| --- | --- |
| `admin` | Administration, gestion des membres, cotisations, médias et modération |
| `secretaire` | Création/modification des fiches et publication de médias |
| `tresorier` | Consultation et mise à jour des cotisations |
| `membre` | Consultation des contenus publiés, sans accès à l’administration |

Les vérifications dans le navigateur améliorent l’interface, mais la véritable autorisation est imposée par Supabase RLS.

## Variables Vercel

Configurer dans les paramètres du projet Vercel, sans les committer dans Git :

- `SUPABASE_URL` : URL du projet.
- `SUPABASE_PUBLISHABLE_KEY` : clé publishable/anon destinée au navigateur.
- `SUPABASE_SERVICE_ROLE_KEY` : clé serveur uniquement pour les endpoints d’authentification; ne jamais l’exposer dans le HTML ou une variable `NEXT_PUBLIC_*`.
- `APP_BASE_URL` : origine HTTPS canonique autorisée. La récupération utilise l’origine de la requête validée pour rester sur la Preview ou le site courant.

L’endpoint `/api/supabase-config` ne renvoie jamais la clé service-role. Les origines des endpoints d’authentification sont vérifiées explicitement.

## Déploiement et tests

- Les pushes sur une branche non-production doivent générer une Preview Vercel.
- Tester la connexion, le lien « Mot de passe oublié ? », la réinitialisation, les droits des quatre rôles, la lecture/écriture des membres, les cotisations, les médias privés et le blog.
- Vérifier la Preview avant toute promotion vers Production.
- Configurer Supabase Auth > URL Configuration avec les origines et redirections réellement utilisées.
- Activer la protection contre les mots de passe compromis dans Supabase Auth.
- Ne jamais afficher, committer ou demander une clé secrète dans une conversation.

## Import des anciennes données

1. Ouvrir `admin-migration.html` sur l’appareil qui détient encore les données locales, si elles existent.
2. Télécharger et conserver une sauvegarde JSON dans un emplacement privé.
3. Importer uniquement après application des migrations et connexion avec un administrateur actif.
4. Comparer les nombres et quelques fiches dans Supabase; conserver le fichier de sauvegarde jusqu’à validation complète.

## État des corrections

Le dépôt est en cours de nettoyage sur une branche de correction. Ne considérez pas le travail comme une mise en production validée tant que la Preview n’a pas passé les tests fonctionnels. Les fichiers supprimés restent récupérables dans l’historique Git.
