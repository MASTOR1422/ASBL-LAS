-- LAS — séparer l'accès aux photos des membres et aux médias publiés.
begin;

drop policy if exists las_media_select_active on storage.objects;
create policy las_media_select_active on storage.objects for select to authenticated
using (
  bucket_id='las-private-media'
  and (
    (name like 'media/%' and (select private.is_las_active()))
    or
    (name like 'members/%' and (
      (select private.has_role('admin'))
      or (select private.has_role('secretaire'))
      or (select private.has_role('tresorier'))
    ))
  )
);

drop policy if exists las_media_insert_active on storage.objects;
create policy las_media_insert_active on storage.objects for insert to authenticated
with check (
  bucket_id='las-private-media'
  and (name like 'media/%' or name like 'members/%')
  and ((select private.has_role('admin')) or (select private.has_role('secretaire')))
);

drop policy if exists las_media_update_active on storage.objects;
create policy las_media_update_active on storage.objects for update to authenticated
using (
  bucket_id='las-private-media'
  and (name like 'media/%' or name like 'members/%')
  and ((select private.has_role('admin')) or (select private.has_role('secretaire')))
)
with check (
  bucket_id='las-private-media'
  and (name like 'media/%' or name like 'members/%')
  and ((select private.has_role('admin')) or (select private.has_role('secretaire')))
);

drop policy if exists las_media_delete_admin on storage.objects;
create policy las_media_delete_admin on storage.objects for delete to authenticated
using (
  bucket_id='las-private-media'
  and (name like 'media/%' or name like 'members/%')
  and (select private.has_role('admin'))
);

commit;