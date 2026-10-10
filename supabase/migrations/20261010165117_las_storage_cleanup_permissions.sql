-- LAS — permettre au secrétariat de nettoyer ses uploads/photos, sans supprimer les médias d'autrui.
begin;

drop policy if exists las_media_delete_admin on storage.objects;
create policy las_media_delete_admin on storage.objects for delete to authenticated
using (
  bucket_id='las-private-media'
  and (
    (name like 'media/%' and (
      (select private.has_role('admin'))
      or (
        (select private.has_role('secretaire'))
        and name like ('media/' || (select auth.uid())::text || '/%')
      )
    ))
    or
    (name like 'members/%' and (
      (select private.has_role('admin'))
      or (select private.has_role('secretaire'))
    ))
  )
);

commit;