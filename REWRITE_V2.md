# ASBL-LAS V2 — réécriture progressive

## Règles de sécurité
- Cette réécriture est isolée sur `rewrite/asbl-las-v2`; la branche `main` et la production ne sont pas modifiées.
- Ne jamais supprimer ou réinitialiser la base Supabase existante.
- Les migrations de ce dépôt sont des propositions versionnées : ne les appliquer qu'après comparaison avec les migrations déjà appliquées.
- `SUPABASE_SERVICE_ROLE_KEY` reste exclusivement côté serveur.
- Les données privées doivent être protégées par RLS dans PostgreSQL, pas uniquement par l'interface.
- Ne jamais considérer le masquage d'un menu comme une autorisation.
- Tester les scénarios de refus d'accès avec des comptes membre, trésorier, secrétaire et administrateur avant fusion.

## Architecture cible
- Site public : accueil, activités, tontine (présentation), entraide, plan d'affaires, structure, bibliothèque publique, photothèque publique, contact.
- Espace membres : profil personnel, cotisations personnelles, situation de tontine, entraide, documents privés.
- Administration : membres, rôles, contenus, cotisations, tontine, aides, médias, journal d'audit.
- Authentification : identifiant + mot de passe via endpoint serveur, vérification de session côté serveur, récupération sécurisée par e-mail.
- Base : Supabase Auth + PostgreSQL + RLS + Storage privé.
- Déploiement : branche de réécriture et Preview uniquement jusqu'à validation explicite.

## État de cette première étape
- Création d'une branche de travail isolée.
- Pages V2 initiales séparées sous `/v2/` pour permettre les tests sans remplacer le site actuel.
- Les endpoints d'authentification et les politiques de base doivent être ajoutés/validés avant toute ouverture à des utilisateurs réels.
