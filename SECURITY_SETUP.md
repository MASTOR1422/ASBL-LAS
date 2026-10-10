# Authentification LAS par nom d'utilisateur

## Changements préparés
- La page de connexion utilise un nom d'utilisateur et un mot de passe.
- La recherche nom d'utilisateur → adresse Auth se fait côté serveur dans `/api/auth/*`.
- La table privée `public.auth_login_map` ne possède aucune politique RLS donnant accès aux navigateurs.
- La récupération renvoie un e-mail vers `/reset-password.html`; la page permet de définir un nouveau mot de passe.
- Les messages de récupération ne révèlent pas si un identifiant existe.
- Aucun compte, profil ou contenu existant n'est supprimé.

## Variables Vercel nécessaires
Conservez les variables publiques déjà utilisées et ajoutez les variables serveur suivantes dans **Vercel → Project Settings → Environment Variables** :
- `SUPABASE_SERVICE_ROLE_KEY`: clé service-role/secret, serveur uniquement, jamais préfixée `NEXT_PUBLIC_`.
- `APP_BASE_URL`: URL exacte du site déployé, par exemple `https://asbl-las-security-preview.vercel.app` pour la prévisualisation actuelle.
- `SUPABASE_URL`: URL du projet Supabase.
- `SUPABASE_PUBLISHABLE_KEY`: clé publishable (ou anon).

Ne placez jamais la clé service-role/secret dans `supabase-config.js`, dans le HTML, dans GitHub ou dans une variable `NEXT_PUBLIC_*`.

## Migration de base de données
1. Faites une sauvegarde du projet Supabase.
2. Exécutez `supabase/migrations/202610100001_username_auth.sql` dans le SQL Editor du projet existant.
3. Vérifiez que les utilisateurs déjà autorisés ont une ligne dans `auth_login_map`. La migration ne supprime aucune table ni aucun utilisateur.
4. Dans **Authentication → URL Configuration**, définissez **Site URL** sur la base URL déployée et ajoutez `https://asbl-las-security-preview.vercel.app/**` (ainsi que les URL de production et de développement réellement utilisées) aux Redirect URLs.
5. Vérifiez le modèle d'e-mail de récupération Supabase et le lien de redirection vers `/reset-password.html`.

## Création manuelle et sûre du compte root
Aucun mot de passe générique n'est codé dans le dépôt et aucun compte privilégié n'est créé automatiquement par le navigateur.
1. Dans Supabase → Authentication → Users, créez un nouvel utilisateur avec **ton adresse e-mail de secours personnelle** et un mot de passe long aléatoire, ou utilisez l'option d'invitation/réinitialisation proposée par le Dashboard.
2. Copiez son UUID et créez dans `public.profiles` le profil correspondant avec `role='admin'`, `active=true`, `display_name='Root LAS'`. Adaptez les colonnes obligatoires à la structure réellement présente.
3. Dans SQL Editor, après vérification de l'UUID et de l'adresse, ajoutez la ligne correspondante à `public.auth_login_map` avec `username='root'` et l'adresse e-mail de cet utilisateur. Ne modifiez pas le profil administrateur actuel.
4. Connectez-vous une première fois avec `root`, puis changez le mot de passe pour un mot de passe unique conservé dans un gestionnaire de mots de passe.

**Ne réutilisez pas un mot de passe générique permanent.** Le nom d'utilisateur `root` n'est pas un secret : la sécurité repose sur un mot de passe fort, la récupération vérifiée et les contrôles de rôle/RLS.

## Récupération administrateur
Si l'e-mail de récupération n'est plus accessible, le propriétaire doit utiliser le Dashboard Supabase pour lancer une réinitialisation/invitation sur l'adresse de secours ou corriger l'adresse après vérification d'identité. Ne créez pas de bouton public qui modifie les mots de passe ou les rôles sans authentification. Si une récupération assistée est nécessaire, elle doit être opérée côté serveur avec une procédure d'identité distincte et auditée.

## Contrôles avant fusion
- Connexion avec un identifiant existant généré par la migration.
- Identifiant ou mot de passe incorrect : refus générique.
- Compte inactif : refus.
- Demande de récupération : réponse neutre et e-mail reçu.
- Lien récent : la page `reset-password.html` permet de changer le mot de passe.
- Lien expiré : message explicite et retour vers `login.html`.
- Vérifier les rôles et politiques RLS avec des comptes de test.
