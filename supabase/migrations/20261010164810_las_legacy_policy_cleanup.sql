-- LAS — nettoyer les politiques héritées et documenter l'accès serveur à la table d'identifiants.
begin;

drop policy if exists las_media_read_authenticated on storage.objects;

drop policy if exists auth_login_map_service_role_only on public.auth_login_map;
create policy auth_login_map_service_role_only on public.auth_login_map
for all to service_role
using (true)
with check (true);

commit;