-- LAS — unifier les droits du blog, des médias et du stockage privé.
-- Migration idempotente : n'efface aucune publication ni aucun fichier.
begin;

drop policy if exists media_read_authenticated on public.media_items;
drop policy if exists media_read_active on public.media_items;
create policy media_read_active on public.media_items for select to authenticated
using (private.is_las_active() and (status='published' or author_id=auth.uid() or private.has_role('admin')));

drop policy if exists media_insert_secretariat_admin on public.media_items;
drop policy if exists media_insert_staff on public.media_items;
drop policy if exists media_update_secretariat_admin on public.media_items;
drop policy if exists media_update_staff on public.media_items;
drop policy if exists media_delete_admin on public.media_items;
drop policy if exists media_update_active on public.media_items;
drop policy if exists media_insert_active on public.media_items;
create policy media_insert_active on public.media_items for insert to authenticated
with check (author_id=auth.uid() and (private.has_role('admin') or private.has_role('secretaire')));

drop policy if exists media_update_author_admin on public.media_items;
create policy media_update_author_admin on public.media_items for update to authenticated
using ((private.has_role('admin') or private.has_role('secretaire')))
with check ((private.has_role('admin') or private.has_role('secretaire')));

drop policy if exists media_delete_author_admin on public.media_items;
create policy media_delete_author_admin on public.media_items for delete to authenticated
using (private.has_role('admin'));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('las-private-media','las-private-media',false,52428800,
  array['image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/webm'])
on conflict (id) do update set public=false, file_size_limit=52428800,
allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists las_media_read_authenticated on storage.objects;
drop policy if exists las_media_upload_secretariat_admin on storage.objects;
drop policy if exists las_media_update_secretariat_admin on storage.objects;
drop policy if exists las_media_select_active on storage.objects;
create policy las_media_select_active on storage.objects for select to authenticated
using (
  bucket_id='las-private-media'
  and (
    (name like 'media/%' and private.is_las_active())
    or (name like 'members/%' and (private.has_role('admin') or private.has_role('secretaire') or private.has_role('tresorier')))
  )
);

drop policy if exists las_media_insert_active on storage.objects;
create policy las_media_insert_active on storage.objects for insert to authenticated
with check (
  bucket_id='las-private-media'
  and (name like 'media/%' or name like 'members/%')
  and (private.has_role('admin') or private.has_role('secretaire'))
);

drop policy if exists las_media_update_active on storage.objects;
create policy las_media_update_active on storage.objects for update to authenticated
using (
  bucket_id='las-private-media'
  and (name like 'media/%' or name like 'members/%')
  and (private.has_role('admin') or private.has_role('secretaire'))
)
with check (
  bucket_id='las-private-media'
  and (name like 'media/%' or name like 'members/%')
  and (private.has_role('admin') or private.has_role('secretaire'))
);

drop policy if exists las_media_delete_admin on storage.objects;
create policy las_media_delete_admin on storage.objects for delete to authenticated
using (
  bucket_id='las-private-media'
  and (
    (name like 'media/%' and (
      private.has_role('admin')
      or (private.has_role('secretaire') and name like ('media/' || auth.uid()::text || '/%'))
    ))
    or (name like 'members/%' and (private.has_role('admin') or private.has_role('secretaire')))
  )
);

commit;
