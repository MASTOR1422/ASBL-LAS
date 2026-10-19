# ASBL-LAS V2 — réécriture progressive

## État du travail
- Branche isolée : `rewrite/asbl-las-v2`.
- PR de travail : [#15](https://github.com/MASTOR1422/ASBL-LAS/pull/15).
- Le site V2 est accessible sous `/v2/`; le site racine actuel n'est pas remplacé.
- Connexion par nom d'utilisateur, récupération par e-mail, page de réinitialisation et vérification serveur du profil.
- Portail membre connecté aux tables existantes : fiche personnelle, cotisations, paiements mensuels, tontine et demandes d'entraide.
- Le site public lit uniquement les annonces/événements publiés et les liens de médias explicitement publics, via les privilèges et politiques SQL prévus.
- Contrôles statiques GitHub Actions ajoutés pour syntaxe JavaScript, configuration JSON et présence des pages/ressources.
- La migration SQL ci-dessous est versionnée mais **n'a pas été appliquée à Supabase**.

## Sécurité et règles de déploiement
- Ne pas fusionner dans `main` ni promouvoir la production avant validation manuelle des scénarios d'accès.
- Ne jamais supprimer, réinitialiser ou écraser la base Supabase existante.
- `SUPABASE_SERVICE_ROLE_KEY` reste exclusivement côté serveur.
- Les Preview Vercel doivent utiliser une base Supabase de test distincte via `SUPABASE_PREVIEW_URL`, `SUPABASE_PREVIEW_PUBLISHABLE_KEY` et `SUPABASE_PREVIEW_SERVICE_ROLE_KEY`. Si ces variables ne sont pas définies, l'authentification et les données restent volontairement bloquées au lieu de se rabattre sur la production.
- Les droits d'accès sont appliqués par RLS et privilèges SQL, pas seulement par le masquage de l'interface.
- Les membres ne doivent voir que leur fiche, leurs cotisations/paiements et leurs demandes d'entraide.
- Les responsables habilités peuvent traiter les données financières et demandes; les changements financiers sont journalisés dans `audit_logs`.
- Les médias accessibles sans connexion sont limités aux lignes publiées avec URL HTTPS externe. Les chemins Storage ne sont pas accordés au rôle `anon`.
- Les fonctions administratives ne doivent jamais être autorisées sur la seule base d'une valeur reçue du navigateur.

## Migration proposée
`supabase/migrations/202610190001_las_v2_member_access_and_audit.sql` :
- Ajoute les politiques de lecture personnelle pour membres, cotisations et paiements.
- Ajoute l'audit des paiements et cotisations.
- Ajoute les tables tontine et demandes d'entraide avec RLS et journalisation.
- Accorde au public uniquement les colonnes nécessaires aux annonces/événements et médias publiés.
- Aucune table ni donnée existante n'est supprimée.

## Contrôles restant obligatoires avant ouverture
1. Vérifier la migration sur une base de préproduction isolée ou un clone, puis comparer le schéma et les politiques.
2. Créer/configurer une base Supabase de test séparée et définir dans l'environnement Preview Vercel `SUPABASE_PREVIEW_URL`, `SUPABASE_PREVIEW_PUBLISHABLE_KEY` et `SUPABASE_PREVIEW_SERVICE_ROLE_KEY`. En Production, conserver `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SERVICE_ROLE_KEY`. Ne jamais afficher ou copier les valeurs secrètes dans GitHub.
3. Autoriser les URL de redirection Supabase Auth pour le domaine de test et les previews Vercel nécessaires; le flux V2 redirige vers `/v2/reset-password.html`.
4. Tester connexion valide/invalide, compte inactif, récupération e-mail, lien expiré, déconnexion et session expirée.
5. Avec deux comptes membres distincts, vérifier qu'aucun ne peut lire ou modifier les données de l'autre.
6. Vérifier les rôles admin, trésorier et secrétaire, les refus d'accès, les écritures d'audit et les données vides.
7. Consulter les Security Advisors Supabase; la protection contre les mots de passe compromis et le RPC `las_birthday_feed()` doivent être traités séparément.
8. N'envisager une fusion que si les tests et les politiques sont validés et si une sauvegarde vérifiée existe.

## Données observées lors du contrôle
- Migrations présentes dans Supabase : 9 migrations datées du 10 octobre 2026.
- Le schéma existant comprend `profiles`, `members`, `monthly_contributions`, `member_payments`, `media_items`, `posts`, `post_comments` et `audit_logs`.
- La migration V2 est additive et attend une revue avant application.
