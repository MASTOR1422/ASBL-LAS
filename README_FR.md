# LAS — Kit de préparation à la production (Supabase + Vercel)

Ce kit est un **squelette de configuration**, pas une version finale de `index.html`.
Il fournit une migration SQL initiale, une page de connexion d'exemple et les points de configuration.
L'interface LAS doit encore être raccordée à ces fonctions Supabase avant d'utiliser de vraies données.

## 1. Avant toute chose

- Ne publiez pas le `index.html` actuel tel quel : il contient `DEFAULT_MEMBERS` et des données personnelles d'exemple.
- L'ancien fichier `Auth.js` n'a pas été fourni. N'assumez pas qu'il protège correctement l'application.
- Les fonctions `loadData()`, `saveData()` et `saveMediaStorage()` utilisent `localStorage`. Elles doivent être remplacées par des opérations Supabase asynchrones.
- Ne migrez pas automatiquement les données du navigateur. Exportez-les, vérifiez-les, puis importez-les dans un environnement de test.
- Vérifiez les règles de cotisation avant de convertir les booléens `payments[année][mois]` en paiements enregistrés.

## 2. Créer le projet Supabase

1. Créez un projet Supabase et conservez les identifiants d'administration hors du dépôt.
2. Dans **SQL Editor**, exécutez `supabase/migrations/202610090001_las_init.sql`.
3. Dans **Authentication > Providers**, activez Email/Password.
4. Désactivez l'inscription publique si seuls les responsables doivent créer les comptes.
5. Créez les utilisateurs dans **Authentication > Users**.
6. Après création, attribuez un profil à chaque utilisateur via SQL Editor, par exemple :

```sql
insert into public.profiles (id, full_name, role)
select id, 'Administrateur LAS', 'admin'
from auth.users
where email = 'EMAIL_ADMIN_A_REMPLACER'
on conflict (id) do update
set full_name = excluded.full_name, role = excluded.role;
```

Répétez avec le bon rôle pour chaque compte :
- `admin` : administration complète
- `secretariat` : gestion des fiches membres et médias
- `treasurer` : gestion des cotisations
- `reader` : consultation uniquement

Ne donnez jamais aux utilisateurs le droit de modifier leur propre rôle depuis le navigateur.

## 3. Configurer le client web

1. Copiez `supabase-config.js.example` vers `supabase-config.js`.
2. Remplacez les valeurs d'exemple par le **Project URL** et la **publishable key** du projet Supabase.
3. Ces deux valeurs sont publiques dans une application navigateur. La sécurité dépend des politiques RLS. N'ajoutez jamais de clé `secret` ou `service_role` dans le navigateur.
4. Le dépôt doit inclure `supabase-config.js` si le site statique en dépend. Ce fichier ne doit contenir que l'URL et la clé publishable.

## 4. Adapter index.html

L'ordre de chargement doit être :

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-config.js"></script>
<script src="supabase-client.js"></script>
```

- Ajoutez `auth-guard.js` sur la page protégée après le client Supabase.
- Ajoutez une page `login.html` comme point d'entrée non protégé.
- Remplacez les appels à l'ancien `Auth.js`, `SESSION`, `changeUserPassword()` et `logout()` par Supabase Auth.
- Ne lancez pas le rendu principal avant l'événement `las:ready` émis par `auth-guard.js`.
- Remplacez les lectures/écritures `localStorage` par `supabase.from(...)`.
- Adaptez la forme des données : les cotisations sont dans `monthly_contributions`, pas dans un tableau `payments` stocké sur la fiche.
- Remplacez le stockage Base64 des photos par un bucket Supabase Storage privé `las-media`; enregistrez seulement le chemin de stockage dans la base.
- Traitez les erreurs réseau et de permission explicitement. Ne montrez pas un message « enregistré » avant confirmation de Supabase.

Le script CDN est pratique pour un prototype statique. Pour la production, épinglez une version précise testée de `@supabase/supabase-js` et surveillez les mises à jour.

## 5. Déploiement Vercel

1. Placez les fichiers web dans la racine du dépôt GitHub.
2. Ajoutez les logos et ressources nécessaires (vérifiez les noms exacts `logo LAS_2.jpg` et `logo LAS.jpg`).
3. Importez le dépôt dans Vercel, Framework Preset : **Other**, Root Directory : `./`.
4. Pas de commande de build nécessaire pour un site HTML statique.
5. Déployez d'abord en Preview et testez l'authentification et les autorisations.
6. Déployez en Production seulement après les tests. L'adresse sera un sous-domaine `*.vercel.app`.
7. Dans Supabase Authentication > URL Configuration, ajoutez l'URL Vercel finale aux URL de site/redirection autorisées.
8. Vérifiez que l'inscription publique est désactivée et que les utilisateurs sans profil ne peuvent accéder aux données.

La migration crée aussi le bucket privé `las-media` et ses politiques d'accès. Les téléchargements doivent utiliser une session authentifiée et, si nécessaire, des URL signées à durée limitée. Le `vercel.json` fourni ajoute des en-têtes de sécurité de base. Il ne remplace ni les politiques RLS ni une revue de sécurité.

## 6. Migration des données existantes

1. Sauvegardez les données locales dans chaque navigateur qui contient des modifications importantes.
2. Réconciliez les doublons et vérifiez le nombre réel de membres.
3. Importez les fiches dans `members` depuis un CSV nettoyé.
4. Convertissez chaque mois réellement payé en une ligne `monthly_contributions`.
5. Vérifiez les montants, années, mois et dates d'adhésion.
6. N'importez pas les photos Base64 dans PostgreSQL : téléversez-les dans le bucket privé.
7. Conservez une copie de sauvegarde hors du navigateur.

## 7. Tests de réception obligatoires

- [ ] Un visiteur non connecté est redirigé vers `login.html`.
- [ ] Un compte sans ligne `profiles` n'accède pas à l'application.
- [ ] `reader` peut lire mais ne peut ni ajouter ni modifier ni supprimer.
- [ ] `secretariat` peut gérer les membres mais ne peut pas modifier les cotisations.
- [ ] `treasurer` peut enregistrer/corriger les cotisations mais ne peut pas supprimer les membres.
- [ ] `admin` a les droits d'administration prévus.
- [ ] Une tentative directe via l'API Supabase sans session ne permet pas de lire les tables.
- [ ] Les erreurs réseau n'affichent pas de faux succès.
- [ ] Les données sont identiques sur deux appareils connectés.
- [ ] Les médias privés ne sont pas accessibles par URL publique permanente.
- [ ] Les exports CSV et impressions ne révèlent que les informations autorisées.
- [ ] Une sauvegarde et une restauration ont été testées.

## Limite importante

Ce kit ne remplace pas l'intégration métier dans le fichier `index.html`. Il faut adapter les handlers existants (création/modification/suppression de membre, paiement mensuel, médias, export et statistiques) puis tester la migration sur un projet Supabase de test avant production.
