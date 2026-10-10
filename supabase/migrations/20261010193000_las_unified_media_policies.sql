-- LAS — unifier les droits du blog, des médias et du stockage privé.
-- Migration idempotente : n'efface aucune publication ni aucun fichier.
begin;

-- Helpers sécurisés communs aux politiques RLS.
create or replace function public.current_las_role()
returns text
language sql stable security definer
set search_path = public, auth
as $func$
  select role from public.profiles
  where id = auth.uid() and active = true
  limit 1
$func$;

create or replace function public.is_las_active()
returns boolean
language sql stable security definer
set search_path = public, auth
as $func$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true
  )
$func$;

revoke all on function public.current_las_role() from public;
revoke all on function public.is_las_active() from public;
grant execute on function public.current_las_role() to authenticated;
grant execute on function public.is_las_active() to authenticated;

drop policy if exists media_read_authenticated on public.media_items;
drop policy if exists media_insert_secretariat_admin on public.media_items;
drop policy if exists media_update_secretariat_admin on public.media_items;
drop policy if exists media_delete_admin on public.media_items;
drop policy if exists media_update_active on public.media_items;
drop policy if exists media_insert_active on public.media_items;
create policy media_insert_active on public.media_items for insert to authenticated
with check (author_id=auth.uid() and public.current_las_role() in ('admin','secretaire'));

drop policy if exists media_update_author_admin on public.media_items;
create policy media_update_author_admin on public.media_items for update to authenticated
using (public.current_las_role() in ('admin','secretaire'))
with check (public.current_las_role() in ('admin','secretaire'));

drop policy if exists media_delete_author_admin on public.media_items;
create policy media_delete_author_admin on public.media_items for delete to authenticated
using (public.current_las_role()='admin');

do $$
begin
  if not exists (select 1 from storage.buckets where id='las-private-media') then
    raise exception 'Le bucket las-private-media doit être créé avant cette migration.';
  end if;
end $$;

update storage.buckets
set public=false,
    file_size_limit=52428800,
    allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/webm']
where id='las-private-media';

drop policy if exists las_media_read_authenticated on storage.objects;
drop policy if exists las_media_upload_secretariat_admin on storage.objects;
drop policy if exists las_media_update_secretariat_admin on storage.objects;
drop policy if exists las_media_select_active on storage.objects;
create policy las_media_select_active on storage.objects for select to authenticated
using (
  bucket_id='las-private-media'
  and (
    (name like 'media/%' and public.is_las_active())
    or (name like 'members/%' and public.current_las_role() in ('admin','secretaire','tresorier'))
  )
);

drop policy if exists las_media_insert_active on storage.objects;
create policy las_media_insert_active on storage.objects for insert to authenticated
with check (
  bucket_id='las-private-media'
  and (name like 'media/%' or name like 'members/%')
  and public.current_las_role() in ('admin','secretaire')
);

drop policy if exists las_media_update_active on storage.objects;
create policy las_media_update_active on storage.objects for update to authenticated
using (
  bucket_id='las-private-media'
  and (name like 'media/%' or name like 'members/%')
  and public.current_las_role() in ('admin','secretaire')
)
with check (
  bucket_id='las-private-media'
  and (name like 'media/%' or name like 'members/%')
  and public.current_las_role() in ('admin','secretaire')
);

drop policy if exists las_media_delete_admin on storage.objects;
create policy las_media_delete_admin on storage.objects for delete to authenticated
using (
  bucket_id='las-private-media'
  and (
    (name like 'media/%' and (
      public.current_las_role()='admin'
      or (public.current_las_role()='secretaire' and name like ('media/' || auth.uid()::text || '/%'))
    ))
    or (name like 'members/%' and public.current_las_role() in ('admin','secretaire'))
  )
);

commit;
