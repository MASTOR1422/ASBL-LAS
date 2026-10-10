# Configuration de sécurité LAS

## Authentification par nom d’utilisateur

- Le navigateur envoie l’identifiant et le mot de passe à `/api/auth/username-login`.
- La correspondance identifiant/e-mail est conservée dans `public.auth_login_map`, sans politique client RLS.
- Les secrets Supabase ne sont utilisés que côté serveur.
- La récupération passe par `/api/auth/recover` et un e-mail de réinitialisation vers `/reset-password.html`.
- La réponse de récupération ne révèle pas si un identifiant existe.
- Un profil doit exister, être actif et avoir l’un des rôles autorisés pour ouvrir le portail.

## Variables Vercel

Configurer directement dans Vercel → Project Settings → Environment Variables :

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — serveur uniquement.
- `APP_BASE_URL` — origine HTTPS exacte correspondant au site déployé.

Ne jamais placer la clé service-role/secret dans GitHub, HTML, `supabase-config.js` ou une variable `NEXT_PUBLIC_*`. Ne collez jamais de valeur secrète dans une conversation.

## Migrations

Ordre des fichiers actuellement suivis :

1. `20261010155437_username_auth.sql`
2. `20261010163337_las_schema_alignment.sql`
3. `20261010163537_las_private_rls_helpers.sql`

Pour un projet neuf, exécuter d’abord `supabase/schema.sql`, puis les migrations ci-dessus dans l’ordre. Pour le projet LAS existant, ces trois migrations sont déjà enregistrées dans l’historique Supabase : ne pas les réexécuter manuellement.

Les migrations préservent les tables historiques. `monthly_contributions` reste disponible pour les montants encaissés; `member_payments` sert aux cases mensuelles de l’interface. Le bucket `las-private-media` doit rester privé et les fichiers doivent être lus avec des URL signées à durée limitée.

## Contrôles avant déploiement

- Connexion correcte et refus d’un mauvais mot de passe.
- Profil absent/inactif refusé.
- Récupération de mot de passe testée de bout en bout.
- RLS testée avec un compte de chaque rôle.
- Un membre ne peut pas modifier les fiches, cotisations, rôles ou médias.
- Secrétariat ne peut pas modifier les cotisations ni supprimer des membres.
- Trésorier peut modifier les cotisations mais pas supprimer les membres.
- Les fichiers du bucket ne sont pas accessibles par une URL publique permanente.
- Vérifier les Security Advisors et les logs Vercel après chaque Preview.

## Points qui demandent une action dans le Dashboard

- Dans Supabase Auth, activer la protection contre les mots de passe compromis.
- Vérifier les URL autorisées et le modèle e-mail de réinitialisation.
- Garder les clés secrètes hors du navigateur.
- La fonction RPC `sync_las_member_identity` est une fonction d’administration réservée à un administrateur actif; ne pas la rendre publique.
