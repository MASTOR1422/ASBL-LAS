-- LAS — autoriser des médias plus utiles tout en conservant une liste MIME stricte.
begin;

do $$
begin
  if not exists (select 1 from storage.buckets where id='las-private-media') then
    raise exception 'Le bucket privé las-private-media est absent; aucune modification effectuée.';
  end if;
end $$;

update storage.buckets
set public=false,
    file_size_limit=52428800,
    allowed_mime_types=array[
      'image/jpeg','image/png','image/webp',
      'application/pdf','video/mp4','video/webm'
    ]
where id='las-private-media';

commit;
