-- ASBL LAS — retirer les helpers SECURITY DEFINER de l'API publique.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_las_active()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.active = true)
$$;

create or replace function private.has_role(required_role text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = required_role and p.active = true
  )
$$;

revoke all on function private.is_las_active() from public, anon;
revoke all on function private.has_role(text) from public, anon;
grant execute on function private.is_las_active() to authenticated, service_role;
grant execute on function private.has_role(text) to authenticated, service_role;

-- Remplacer toutes les règles qui appelaient les anciens helpers de public.
drop policy if exists profiles_read_active_names on public.profiles;
create policy profiles_read_active_names on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_las_active()));

drop policy if exists members_read_active on public.members;
create policy members_read_active on public.members for select to authenticated
using ((select private.is_las_active()));
drop policy if exists members_insert_staff on public.members;
create policy members_insert_staff on public.members for insert to authenticated
with check ((select private.has_role('admin')) or (select private.has_role('secretaire')));
drop policy if exists members_update_staff on public.members;
create policy members_update_staff on public.members for update to authenticated
using ((select private.has_role('admin')) or (select private.has_role('secretaire')))
with check ((select private.has_role('admin')) or (select private.has_role('secretaire')));
drop policy if exists members_delete_admin on public.members;
create policy members_delete_admin on public.members for delete to authenticated
using ((select private.has_role('admin')));

drop policy if exists contributions_read_staff on public.monthly_contributions;
create policy contributions_read_staff on public.monthly_contributions for select to authenticated
using ((select private.has_role('admin')) or (select private.has_role('secretaire')) or (select private.has_role('tresorier')));
drop policy if exists contributions_insert_finance on public.monthly_contributions;
create policy contributions_insert_finance on public.monthly_contributions for insert to authenticated
with check ((select private.has_role('admin')) or (select private.has_role('tresorier')));
drop policy if exists contributions_update_finance on public.monthly_contributions;
create policy contributions_update_finance on public.monthly_contributions for update to authenticated
using ((select private.has_role('admin')) or (select private.has_role('tresorier')))
with check ((select private.has_role('admin')) or (select private.has_role('tresorier')));
drop policy if exists contributions_delete_admin on public.monthly_contributions;
create policy contributions_delete_admin on public.monthly_contributions for delete to authenticated
using ((select private.has_role('admin')));

drop policy if exists member_payments_read_staff on public.member_payments;
create policy member_payments_read_staff on public.member_payments for select to authenticated
using ((select private.has_role('admin')) or (select private.has_role('secretaire')) or (select private.has_role('tresorier')));
drop policy if exists member_payments_insert_treasury on public.member_payments;
create policy member_payments_insert_treasury on public.member_payments for insert to authenticated
with check ((select private.has_role('admin')) or (select private.has_role('tresorier')));
drop policy if exists member_payments_update_treasury on public.member_payments;
create policy member_payments_update_treasury on public.member_payments for update to authenticated
using ((select private.has_role('admin')) or (select private.has_role('tresorier')))
with check ((select private.has_role('admin')) or (select private.has_role('tresorier')));
drop policy if exists member_payments_delete_admin on public.member_payments;
create policy member_payments_delete_admin on public.member_payments for delete to authenticated
using ((select private.has_role('admin')));

drop policy if exists media_delete_admin on public.media_items;
create policy media_delete_admin on public.media_items for delete to authenticated
using ((select private.has_role('admin')));
drop policy if exists media_read_active on public.media_items;
create policy media_read_active on public.media_items for select to authenticated
using ((select private.is_las_active()) and (status='published' or author_id=(select auth.uid()) or (select private.has_role('admin'))));
drop policy if exists media_insert_staff on public.media_items;
create policy media_insert_staff on public.media_items for insert to authenticated
with check ((select private.has_role('admin')) or (select private.has_role('secretaire')));
drop policy if exists media_update_staff on public.media_items;
create policy media_update_staff on public.media_items for update to authenticated
using ((select private.has_role('admin')) or (select private.has_role('secretaire')))
with check ((select private.has_role('admin')) or (select private.has_role('secretaire')));
drop policy if exists media_delete_admin on public.media_items;
create policy media_delete_admin on public.media_items for delete to authenticated
using ((select private.has_role('admin')));

drop policy if exists audit_read_admin on public.audit_logs;
create policy audit_read_admin on public.audit_logs for select to authenticated
using ((select private.has_role('admin')));

drop policy if exists posts_read_active on public.posts;
create policy posts_read_active on public.posts for select to authenticated
using ((select private.is_las_active()) and (status='published' or (select private.has_role('admin'))));
drop policy if exists posts_insert_active on public.posts;
create policy posts_insert_active on public.posts for insert to authenticated
with check (author_id=(select auth.uid()) and (select private.is_las_active()));
drop policy if exists posts_update_author_admin on public.posts;
create policy posts_update_author_admin on public.posts for update to authenticated
using (author_id=(select auth.uid()) or (select private.has_role('admin')))
with check (author_id=(select auth.uid()) or (select private.has_role('admin')));
drop policy if exists posts_delete_author_admin on public.posts;
create policy posts_delete_author_admin on public.posts for delete to authenticated
using (author_id=(select auth.uid()) or (select private.has_role('admin')));

drop policy if exists comments_read_active on public.post_comments;
create policy comments_read_active on public.post_comments for select to authenticated
using ((select private.is_las_active()) and (status='published' or author_id=(select auth.uid()) or (select private.has_role('admin'))));
drop policy if exists comments_insert_active on public.post_comments;
create policy comments_insert_active on public.post_comments for insert to authenticated
with check (author_id=(select auth.uid()) and (select private.is_las_active()));
drop policy if exists comments_update_author_admin on public.post_comments;
create policy comments_update_author_admin on public.post_comments for update to authenticated
using (author_id=(select auth.uid()) or (select private.has_role('admin')))
with check (author_id=(select auth.uid()) or (select private.has_role('admin')));
drop policy if exists comments_delete_author_admin on public.post_comments;
create policy comments_delete_author_admin on public.post_comments for delete to authenticated
using (author_id=(select auth.uid()) or (select private.has_role('admin')));

drop policy if exists las_media_upload_secretariat_admin on storage.objects;
drop policy if exists las_media_update_secretariat_admin on storage.objects;
drop policy if exists las_media_select_active on storage.objects;
create policy las_media_select_active on storage.objects for select to authenticated
using (bucket_id='las-private-media' and (select private.is_las_active()));
drop policy if exists las_media_insert_active on storage.objects;
create policy las_media_insert_active on storage.objects for insert to authenticated
with check (bucket_id='las-private-media' and ((select private.has_role('admin')) or (select private.has_role('secretaire'))));
drop policy if exists las_media_update_active on storage.objects;
create policy las_media_update_active on storage.objects for update to authenticated
using (bucket_id='las-private-media' and ((select private.has_role('admin')) or (select private.has_role('secretaire'))))
with check (bucket_id='las-private-media' and ((select private.has_role('admin')) or (select private.has_role('secretaire'))));
drop policy if exists las_media_delete_admin on storage.objects;
create policy las_media_delete_admin on storage.objects for delete to authenticated
using (bucket_id='las-private-media' and (select private.has_role('admin')));

-- RPC d'anniversaires en SECURITY INVOKER : RLS filtre la table membres.
create or replace function public.las_birthday_feed()
returns table(member_id bigint, display_name text, birth_month integer, birth_day integer)
language sql stable security invoker set search_path = ''
as $$
  select m.id, m.name, extract(month from m.birthdate)::integer, extract(day from m.birthdate)::integer
  from public.members m
  where (select private.is_las_active())
    and m.status = 'active'
    and m.birthday_visible = true
    and m.birthdate is not null
  order by extract(month from m.birthdate), extract(day from m.birthdate), m.name
$$;
revoke all on function public.las_birthday_feed() from public, anon;
grant execute on function public.las_birthday_feed() to authenticated;

-- Fonction de synchronisation réservée à l'administrateur actif.
create or replace function public.sync_las_member_identity()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (select private.has_role('admin')) then
    raise exception 'Administrator role required';
  end if;
  perform setval(
    pg_get_serial_sequence('public.members','id'),
    coalesce((select max(id) from public.members), 0) + 1,
    false
  );
end;
$$;
revoke all on function public.sync_las_member_identity() from public, anon;
grant execute on function public.sync_las_member_identity() to authenticated;

-- Les anciens helpers publics ne sont plus nécessaires et ne sont pas des RPC.
drop function if exists public.has_role(text);
drop function if exists public.is_las_active();

-- Index des clés étrangères utilisées par les jointures/suppressions.
create index if not exists media_items_author_id_idx on public.media_items(author_id);
create index if not exists member_payments_updated_by_idx on public.member_payments(updated_by);
create index if not exists post_comments_author_id_idx on public.post_comments(author_id);
create index if not exists posts_author_id_idx on public.posts(author_id);

commit;
