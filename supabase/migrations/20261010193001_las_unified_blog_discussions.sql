-- LAS — garantir que le blog communautaire et les commentaires partagent l'authentification LAS.
-- Idempotent : crée les tables manquantes et pose les droits attendus par las-blog.js.
begin;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 180),
  body text not null check (char_length(body) between 1 and 10000),
  category text not null default 'general' check (category in ('general','annonce','entraide','evenement')),
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 3000),
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists comments_post_created_idx on public.post_comments (post_id, created_at);

alter table public.posts enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists posts_read_published on public.posts;
drop policy if exists posts_create_active_member on public.posts;
drop policy if exists posts_update_author_or_admin on public.posts;
drop policy if exists posts_delete_author_or_admin on public.posts;
drop policy if exists posts_read_active on public.posts;
drop policy if exists posts_insert_active on public.posts;
drop policy if exists posts_update_author_admin on public.posts;
drop policy if exists posts_delete_author_admin on public.posts;
create policy posts_read_active on public.posts for select to authenticated
using (public.is_las_active() and (status='published' or public.current_las_role()='admin'));

drop policy if exists posts_insert_active on public.posts;
create policy posts_insert_active on public.posts for insert to authenticated
with check (author_id=auth.uid() and public.is_las_active());

drop policy if exists posts_update_author_admin on public.posts;
create policy posts_update_author_admin on public.posts for update to authenticated
using (author_id=auth.uid() or public.current_las_role()='admin')
with check (author_id=auth.uid() or public.current_las_role()='admin');

drop policy if exists posts_delete_author_admin on public.posts;
create policy posts_delete_author_admin on public.posts for delete to authenticated
using (author_id=auth.uid() or public.current_las_role()='admin');

drop policy if exists comments_read_active on public.post_comments;
drop policy if exists comments_insert_active on public.post_comments;
drop policy if exists comments_update_author_admin on public.post_comments;
drop policy if exists comments_delete_author_admin on public.post_comments;
create policy comments_read_active on public.post_comments for select to authenticated
using (public.is_las_active() and (status='published' or author_id=auth.uid() or public.current_las_role()='admin'));

drop policy if exists comments_insert_active on public.post_comments;
create policy comments_insert_active on public.post_comments for insert to authenticated
with check (author_id=auth.uid() and public.is_las_active());

drop policy if exists comments_update_author_admin on public.post_comments;
create policy comments_update_author_admin on public.post_comments for update to authenticated
using (author_id=auth.uid() or public.current_las_role()='admin')
with check (author_id=auth.uid() or public.current_las_role()='admin');

drop policy if exists comments_delete_author_admin on public.post_comments;
create policy comments_delete_author_admin on public.post_comments for delete to authenticated
using (author_id=auth.uid() or public.current_las_role()='admin');

grant select, insert, update, delete on public.posts, public.post_comments to authenticated;

-- Activer les événements du blog dans Supabase Realtime si la publication est disponible.
do $realtime$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='posts'
    ) then
      execute 'alter publication supabase_realtime add table public.posts';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='post_comments'
    ) then
      execute 'alter publication supabase_realtime add table public.post_comments';
    end if;
  end if;
end $realtime$;

commit;
