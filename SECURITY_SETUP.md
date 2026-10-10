# Mise en service sécurisée — ASBL LAS

## État de cette première étape
- Authentification locale par mots de passe intégrés au JavaScript supprimée.
- Les rôles ne sont plus sélectionnables dans la page de connexion.
- La connexion utilise Supabase Auth et exige un profil actif.
- L'application échoue fermée si Supabase n'est pas configuré.
- Les données historiques de membres et de médias sont encore dans le navigateur : elles ne sont PAS encore migrées vers la base sécurisée. Ne considérez pas cette étape comme la sécurisation complète de la gestion des membres.

## Configuration obligatoire
1. Créez/choisissez le projet Supabase LAS.
2. Dans `supabase-config.js`, renseignez l'URL du projet et la clé publique (publishable/anon). N'utilisez jamais `service_role`, un secret API ou un mot de passe dans le dépôt.
3. Exécutez `supabase/schema.sql` dans le SQL Editor du projet.
4. Créez les utilisateurs dans Supabase Authentication. Les identifiants doivent être des e-mails valides.
5. Dans le tableau de bord Supabase, ajoutez un profil dans `public.profiles` pour chaque utilisateur en utilisant son UUID Auth. Attribuez le rôle uniquement côté administrateur et laissez `active = false` jusqu'à validation.
6. Vérifiez les politiques RLS avec deux comptes de test (membre et administrateur) avant toute mise en production.

## Limites et étapes suivantes
- Le fichier HTML historique contient des données de membres, paiements et médias stockées dans `localStorage`. Elles doivent être migrées vers des tables Supabase avec des politiques RLS plus granulaires avant d'utiliser des données réelles.
- Les autorisations visuelles côté navigateur ne sont pas une frontière de sécurité ; la base de données doit refuser les opérations non autorisées via RLS.
- Les champs personnels (date de naissance, téléphone, adresse, paiement) doivent être limités au strict besoin. Le rappel d'anniversaire doit afficher uniquement les informations autorisées.
- Les publications du blog devront être stockées dans `public.posts`; les fichiers devront être stockés dans un bucket privé avec politiques d'accès.
- Après configuration, testez connexion, déconnexion, compte inactif, compte sans profil, et tentative d'accès direct à `index.html`.
