-- LAS — permettre aux utilisateurs authentifiés d'évaluer les fonctions
-- privées utilisées par les politiques RLS, sans exposer le schéma via l'API.
-- Cette migration ne modifie aucune donnée applicative.
begin;

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Les fonctions appelées par les politiques RLS doivent conserver leurs droits
-- EXECUTE explicites. Ne pas accorder CREATE sur le schéma aux utilisateurs.
revoke create on schema private from public, anon, authenticated;

commit;
