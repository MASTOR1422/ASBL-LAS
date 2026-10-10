# État de l’intégration LAS

Le portail a été raccordé à Supabase; ce document remplace l’ancien plan d’intégration devenu obsolète.

## Chaîne de données

- `Auth.js` initialise Supabase Auth, puis exige un profil actif avec rôle autorisé.
- `api/auth/username-login.js` effectue la connexion par identifiant côté serveur.
- `api/auth/recover.js` déclenche la récupération sans révéler l’existence d’un compte.
- `supabase/las-data.js` charge les membres et les cases mensuelles de `member_payments`.
- `supabase/las-media.js` téléverse les fichiers dans le bucket privé `las-private-media` et charge des URL signées.
- `las-blog.js` gère les publications, commentaires et anniversaires.

## Modèle des cotisations

- `monthly_contributions` conserve les montants, devises et dates des anciennes écritures financières.
- `member_payments` stocke les cases mensuelles de l’interface : membre, année, mois et payé/non payé.
- La migration d’alignement copie les anciennes écritures existantes vers `member_payments` sans supprimer `monthly_contributions`.

## Schéma et migrations

Pour un nouveau projet, exécuter `supabase/schema.sql` puis les migrations versionnées dans `supabase/migrations/`. Pour le projet LAS déjà configuré, les migrations `username_auth`, `las_schema_alignment`, `las_private_rls_helpers`, `las_member_privacy`, `las_storage_path_access`, `las_legacy_policy_cleanup` et `las_storage_cleanup_permissions` sont enregistrées dans Supabase; ne pas les réexécuter.

## Contrôles restants

- Tester la Preview Vercel avec les quatre rôles.
- Tester connexion, récupération et réinitialisation de mot de passe.
- Tester création/modification/suppression de membre et cotisations.
- Tester téléversement, lecture signée et suppression de médias.
- Vérifier le blog, les commentaires et les rappels d’anniversaire.
- Vérifier les logs Vercel et les Security Advisors Supabase avant la promotion Production.
