-- LAS — réserver la synchronisation des identifiants membres au service serveur.
-- Le portail n'appelle pas cette RPC depuis le navigateur; l'accès client n'est donc pas nécessaire.
begin;
revoke execute on function public.sync_las_member_identity() from public, anon, authenticated;
grant execute on function public.sync_las_member_identity() to service_role;
commit;
