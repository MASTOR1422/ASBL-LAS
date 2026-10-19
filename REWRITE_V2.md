# ASBL-LAS V2 — mode local SQLite

## État du dépôt
- Le socle SQLite est développé sur la branche `rewrite/asbl-las-v2`.
- PR de validation dédiée : [#16](https://github.com/MASTOR1422/ASBL-LAS/pull/16), en brouillon.
- La PR #15 portait sur la première réécriture V2 et a été fusionnée avant les derniers commits SQLite. La conversion SQLite est proposée séparément et ne doit pas être fusionnée sans validation.
- L’application locale est servie par `local/server.js`; ses données résident dans `local/data/asbl-las.sqlite` (fichier ignoré par Git).
- Les pages V2 locales utilisent les endpoints `/api/*` du serveur SQLite et ne chargent plus le client Supabase.
- La base locale démarre vide. Aucun export, mot de passe ou donnée de Supabase n’est copié automatiquement.

## Mise en route
Voir `local/README.md`. Résumé :
1. Installer Node.js 22.13+.
2. Dans `local/`, exécuter `npm install`, puis `npm run init-db`.
3. Créer le premier compte avec `npm run create-admin`.
4. Démarrer avec `npm start` et ouvrir `http://127.0.0.1:3000`.
5. Importer les données exportées et recréer les comptes locaux après avoir vérifié les fichiers.

## Schéma SQLite
`local/sqlite/schema.sql` définit :
- membres et comptes locaux avec rôles ;
- sessions révocables, mots de passe hachés et contrôles d’accès côté serveur ;
- cotisations, paiements mensuels, publications, médias et commentaires ;
- périodes/participations de tontine et demandes d’entraide ;
- journaux d’audit, contraintes, clés étrangères et index.

## Sécurité / limites
- Ne jamais commiter la base SQLite, un export de données ou un fichier .env.
- Ne pas utiliser les identifiants Supabase dans le mode local. Les mots de passe existants ne sont pas transférables en clair : recréer/réinitialiser les comptes.
- La récupération automatique par e-mail n’est pas encore configurée dans le mode local.
- Les routes d’administration vérifient les rôles côté serveur. Les tests d’autorisation, les parcours de bout en bout et la revue de sécurité restent obligatoires avant utilisation réelle.
- SQLite convient à un seul serveur/une instance avec disque persistant. Un fichier SQLite dans une fonction Vercel n’est pas une base durable partagée; ne pas déployer ce mode sur Vercel sans architecture de stockage persistant adaptée.
- Ne pas supprimer ni réinitialiser la base Supabase existante avant d’avoir exporté, importé, comparé les données et validé une sauvegarde.
- Aucun changement volontaire n’a été appliqué à la base Supabase de production par cette conversion locale.

## Vérifications automatisées
Le workflow GitHub Actions installe les dépendances locales, vérifie la syntaxe JavaScript et exécute les tests du schéma SQLite (tables, contraintes, unicité et audit). Un résultat vert ne remplace pas les tests fonctionnels manuels.
