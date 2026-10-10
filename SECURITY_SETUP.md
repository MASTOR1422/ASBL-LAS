# Mise en service sécurisée — ASBL LAS

## Ce que le dépôt contient maintenant
- Authentification via Supabase Auth; aucune session administrateur automatique ni mot de passe codé en dur.
- Rôles chargés depuis `public.profiles`; aucun rôle sélectionnable sur la page de connexion.
- Configuration publique chargée à l'exécution via `/api/supabase-config`, sans committer de clé dans le dépôt.
- Données de membres et cotisations lues/écrites dans Supabase, sous politiques RLS.
- Blog communautaire et commentaires pour les comptes actifs.
- Outil de sauvegarde et migration historique à `/admin-migration.html`.
- La branche `security/las-security-by-design` reste séparée de `main`.

## Configuration du projet Supabase existant
La branche principale du dépôt ne contenait pas d'URL Supabase ni de clé publique configurée. Le code ne permet donc pas d'identifier automatiquement le projet existant. Aucun secret n'a été recherché ou ajouté au dépôt.

### 1. Variables de déploiement
Dans Vercel → Project Settings → Environment Variables, ajoutez :
- `SUPABASE_URL` : URL HTTPS du projet Supabase.
- `SUPABASE_PUBLISHABLE_KEY` : clé publishable (ou anon) du projet.

Ne configurez jamais `service_role`, une clé secrète ou un mot de passe dans une variable exposée au navigateur. Redéployez après l'ajout des variables. L'endpoint `/api/supabase-config` renvoie uniquement l'URL et la clé publique nécessaire au client.

Si le site n'est pas hébergé sur Vercel, il faut adapter l'endpoint de configuration à l'hébergeur avant déploiement.

### 2. Schéma et autorisations
1. Faites une sauvegarde de la base Supabase existante.
2. Examinez `supabase/schema.sql`; il crée les tables `profiles`, `members`, `member_payments`, `posts`, `post_comments`, `media_items` et le bucket privé `las-private-media`, avec RLS.
3. Exécutez le SQL dans le SQL Editor du projet existant uniquement après avoir vérifié les éventuelles tables déjà présentes. Le script n'efface pas les tables, mais une installation antérieure avec des colonnes différentes doit être réconciliée avant exécution.
4. Créez les comptes dans Supabase Authentication, puis ajoutez manuellement leurs profils via le Dashboard avec le même UUID. Attribuez les rôles depuis le Dashboard; les profils restent inactifs jusqu'à validation.
5. Vérifiez avec des comptes de test admin, secrétaire, trésorier et membre. Les rôles doivent être confirmés par RLS, pas seulement par les boutons masqués.

## Migration des données du navigateur
1. Les données du navigateur ne sont accessibles que depuis leur origine actuelle. Comme la branche de travail est séparée, le navigateur du site de production et celui d'une prévisualisation peuvent avoir des stockages différents.
2. Sur l'ancien site de production, ouvrez les outils de développement du navigateur (F12 → Console) et exécutez ce code pour télécharger une sauvegarde locale. Il ne transmet rien au réseau :

```javascript
const backup = {
  createdAt: new Date().toISOString(),
  members: localStorage.getItem("las_members_v2"),
  media: localStorage.getItem("las_media_v1")
};
const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
const a = document.createElement("a");
a.href = url;
a.download = "las-backup-local.json";
a.click();
URL.revokeObjectURL(url);
```

3. Ouvrez la branche de travail sur l'hébergement configuré, connectez-vous avec un compte administrateur Supabase actif et ouvrez `/admin-migration.html`.
4. Chargez le fichier JSON exporté, vérifiez les volumes, puis téléchargez une copie de sauvegarde avant de lancer l'import.
5. L'outil importe les fiches membres et les états mensuels de cotisation dans les tables dédiées. Il importe aussi les métadonnées médias disponibles et charge les fichiers base64 dans le bucket privé si leur taille ne dépasse pas 10 Mo.
6. Les données d'origine ne sont pas supprimées. Contrôlez les comptes de lignes dans Supabase et testez les fiches et paiements dans le site avant toute suppression manuelle.

Important : les données du navigateur sont propres à chaque navigateur/appareil. Si plusieurs appareils contiennent des versions différentes, sauvegardez-les séparément et réconciliez les doublons avant de migrer. Les données de démonstration qui n'ont jamais été enregistrées dans `localStorage` ne sont pas automatiquement importées.

## Blog communautaire
Les publications et commentaires sont enregistrés dans `posts` et `post_comments`. Seuls les profils actifs peuvent lire et écrire. Les auteurs peuvent modifier/supprimer leurs propres publications/commentaires; l'administrateur peut modérer. Vérifiez ces règles par des tentatives d'accès direct à la base, pas uniquement via l'interface.

## Limites connues avant production
- Le contenu historique de photothèque qui n'a pas été migré ne s'affichera pas dans la nouvelle session; vérifiez la page de migration.
- Le composant historique de photothèque/ajout de média n'est pas encore entièrement remplacé par le stockage Supabase dans l'interface principale. N'utilisez pas cette partie pour de nouveaux documents confidentiels avant l'étape dédiée au média.
- Les fiches complètes et cotisations sont visibles seulement aux rôles admin, secrétaire et trésorier via RLS. Les membres ordinaires accèdent au blog, pas au répertoire financier.
- Vérifiez les formats de dates, les identifiants membres existants et la cohérence des années de cotisation avant l'import.
- Le rappel d'anniversaire utilise les dates de naissance autorisées; définissez une politique interne sur qui peut voir ces données personnelles.
- Exécutez des tests fonctionnels et RLS avant de fusionner. Cette branche n'est pas fusionnée dans `main`.

## Tests minimums
- Session absente, profil absent/inactif, et mauvais mot de passe : accès refusé.
- Membre : peut publier/commenter mais ne peut pas lire/modifier les tables de membres ou de cotisations.
- Secrétaire : peut gérer les fiches mais ne peut pas modifier les paiements.
- Trésorier : peut lire les données financières et modifier les paiements, mais pas supprimer des membres.
- Admin : peut modérer et gérer les opérations prévues.
- Import : comptez les membres, mois de cotisation et médias avant/après; vérifiez que la source locale est toujours présente.
