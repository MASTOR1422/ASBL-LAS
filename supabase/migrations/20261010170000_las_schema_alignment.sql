-- ASBL LAS — réconciliation non destructive du schéma existant.
-- Conserve les tables et les enregistrements historiques; aligne les noms et rôles utilisés par l'application.
begin;

create extension if not exists pgcrypto;

-- Profil : vocabulaire de rôles unique côté application.
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists member_id bigint;
alter table public.profiles add column if not exists active boolean not null default false;
update public.profiles
set display_name = coalesce(nullif(btrim(display_name), ''), nullif(btrim(full_name), ''), 'Membre LAS');
alter table public.profiles alter column display_name set not null;

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

update public.profiles
set role = case role
  when 'secretariat' then 'secretaire'
  when 'treasurer' then 'tresorier'
  when 'reader' then 'membre'
  else role
end;
alter table public.profiles alter column role set default 'membre';
alter table public.profiles add constraint profiles_role_las_check
  check (role in ('admin','secretaire','tresorier','membre'));

-- Fiches membres : renommer les anciennes colonnes au lieu de perdre leur contenu.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='joined')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='joined_on') then
    alter table public.members rename column joined to joined_on;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='poste')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='position') then
    alter table public.members rename column poste to position;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='forum')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='forum_status') then
    alter table public.members rename column forum to forum_status;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='asbl')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='asbl_status') then
    alter table public.members rename column asbl to asbl_status;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='reunion')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='meeting_status') then
    alter table public.members rename column reunion to meeting_status;
  end if;
end $$;

alter table public.members add column if not exists position text;
alter table public.members add column if not exists joined_on date;
alter table public.members add column if not exists asbl_status text;
alter table public.members add column if not exists forum_status text;
alter table public.members add column if not exists meeting_status text;
alter table public.members add column if not exists birthday_visible boolean not null default true;
alter table public.members add column if not exists status text not null default 'active';
alter table public.members add column if not exists photo_path text;
alter table public.members add column if not exists updated_at timestamptz not null default now();
alter table public.members alter column phone drop not null;
update public.members
set status = case when asbl_status = 'NON' then 'inactive' else coalesce(status,'active') end;
alter table public.members drop constraint if exists members_status_las_check;
alter table public.members add constraint members_status_las_check
  check (status in ('active','inactive','suspended'));

-- Les cotisations historiques en montant restent intactes dans monthly_contributions.
-- La nouvelle table sert à l'interface mensuelle par cases cochées.
create table if not exists public.member_payments (
  id uuid primary key default gen_random_uuid(),
  member_id bigint not null references public.members(id) on delete cascade,
  payment_year integer not null check (payment_year between 2000 and 2200),
  payment_month integer not null check (payment_month between 1 and 12),
  paid boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(member_id,payment_year,payment_month)
);
insert into public.member_payments(member_id,payment_year,payment_month,paid,updated_by,updated_at)
select member_id, contribution_year::integer, contribution_month::integer, true, recorded_by, now()
from public.monthly_contributions
on conflict (member_id,payment_year,payment_month) do nothing;

-- Compléter le schéma médias sans remplacer l'identifiant bigint existant.
alter table public.media_items add column if not exists legacy_id text;
alter table public.media_items add column if not exists author_id uuid references public.profiles(id) on delete set null;
alter table public.media_items add column if not exists status text not null default 'published';
alter table public.media_items drop constraint if exists media_items_status_las_check;
alter table public.media_items add constraint media_items_status_las_check
  check (status in ('published','hidden'));

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

create index if not exists members_birthdate_idx on public.members(birthdate);
create index if not exists member_payments_member_year_idx on public.member_payments(member_id,payment_year);
create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists post_comments_post_created_idx on public.post_comments(post_id,created_at);
create index if not exists media_items_created_at_las_idx on public.media_items(created_at desc);
create index if not exists audit_logs_changed_by_idx on public.audit_logs(changed_by);
create index if not exists media_items_created_by_idx on public.media_items(created_by);
create index if not exists monthly_contributions_recorded_by_idx on public.monthly_contributions(recorded_by);

-- Fonctions de contrôle de rôle : les comptes inactifs ne sont jamais autorisés.
create or replace function public.is_las_active()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.active = true)
$$;

create or replace function public.has_role(required_role text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = required_role and p.active = true
  )
$$;

revoke all on function public.is_las_active() from public, anon;
grant execute on function public.is_las_active() to authenticated, service_role;
revoke all on function public.has_role(text) from public, anon;
grant execute on function public.has_role(text) to authenticated, service_role;

-- Les fonctions de trigger/event ne sont pas des endpoints clients.
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Toutes les tables exposées restent sous RLS.
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.monthly_contributions enable row level security;
alter table public.member_payments enable row level security;
alter table public.media_items enable row level security;
alter table public.audit_logs enable row level security;
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;

-- Supprimer les anciennes règles permissives avant de poser les règles alignées.
drop policy if exists profiles_read_self_or_admin on public.profiles;
drop policy if exists profiles_read_active_names on public.profiles;
create policy profiles_read_active_names on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_las_active()));

drop policy if exists members_read_authenticated on public.members;
drop policy if exists members_read_staff on public.members;
create policy members_read_active on public.members for select to authenticated
using ((select public.is_las_active()));
drop policy if exists members_insert_secretariat_admin on public.members;
drop policy if exists members_insert_staff on public.members;
create policy members_insert_staff on public.members for insert to authenticated
with check ((select public.has_role('admin')) or (select public.has_role('secretaire')));
drop policy if exists members_update_secretariat_admin on public.members;
drop policy if exists members_update_staff on public.members;
create policy members_update_staff on public.members for update to authenticated
using ((select public.has_role('admin')) or (select public.has_role('secretaire')))
with check ((select public.has_role('admin')) or (select public.has_role('secretaire')));
drop policy if exists members_delete_admin on public.members;
create policy members_delete_admin on public.members for delete to authenticated
using ((select public.has_role('admin')));

drop policy if exists contributions_read_authenticated on public.monthly_contributions;
create policy contributions_read_staff on public.monthly_contributions for select to authenticated
using ((select public.has_role('admin')) or (select public.has_role('secretaire')) or (select public.has_role('tresorier')));
drop policy if exists contributions_insert_finance on public.monthly_contributions;
create policy contributions_insert_finance on public.monthly_contributions for insert to authenticated
with check ((select public.has_role('admin')) or (select public.has_role('tresorier')));
drop policy if exists contributions_update_finance on public.monthly_contributions;
create policy contributions_update_finance on public.monthly_contributions for update to authenticated
using ((select public.has_role('admin')) or (select public.has_role('tresorier')))
with check ((select public.has_role('admin')) or (select public.has_role('tresorier')));
drop policy if exists contributions_delete_admin on public.monthly_contributions;
create policy contributions_delete_admin on public.monthly_contributions for delete to authenticated
using ((select public.has_role('admin')));

drop policy if exists member_payments_read_staff on public.member_payments;
create policy member_payments_read_staff on public.member_payments for select to authenticated
using ((select public.has_role('admin')) or (select public.has_role('secretaire')) or (select public.has_role('tresorier')));
drop policy if exists member_payments_insert_treasury on public.member_payments;
create policy member_payments_insert_treasury on public.member_payments for insert to authenticated
with check ((select public.has_role('admin')) or (select public.has_role('tresorier')));
drop policy if exists member_payments_update_treasury on public.member_payments;
create policy member_payments_update_treasury on public.member_payments for update to authenticated
using ((select public.has_role('admin')) or (select public.has_role('tresorier')))
with check ((select public.has_role('admin')) or (select public.has_role('tresorier')));
drop policy if exists member_payments_delete_admin on public.member_payments;
create policy member_payments_delete_admin on public.member_payments for delete to authenticated
using ((select public.has_role('admin')));

drop policy if exists media_read_authenticated on public.media_items;
drop policy if exists media_read_active on public.media_items;
create policy media_read_active on public.media_items for select to authenticated
using ((select public.is_las_active()) and (status='published' or author_id=(select auth.uid()) or (select public.has_role('admin'))));
drop policy if exists media_insert_secretariat_admin on public.media_items;
drop policy if exists media_insert_active on public.media_items;
create policy media_insert_staff on public.media_items for insert to authenticated
with check ((select public.has_role('admin')) or (select public.has_role('secretaire')));
drop policy if exists media_update_secretariat_admin on public.media_items;
drop policy if exists media_update_active on public.media_items;
create policy media_update_staff on public.media_items for update to authenticated
using ((select public.has_role('admin')) or (select public.has_role('secretaire')))
with check ((select public.has_role('admin')) or (select public.has_role('secretaire')));
drop policy if exists media_delete_admin on public.media_items;
create policy media_delete_admin on public.media_items for delete to authenticated
using ((select public.has_role('admin')));

drop policy if exists audit_read_admin on public.audit_logs;
create policy audit_read_admin on public.audit_logs for select to authenticated
using ((select public.has_role('admin')));

drop policy if exists posts_read_active on public.posts;
create policy posts_read_active on public.posts for select to authenticated
using ((select public.is_las_active()) and (status='published' or (select public.has_role('admin'))));
drop policy if exists posts_insert_active on public.posts;
create policy posts_insert_active on public.posts for insert to authenticated
with check (author_id=(select auth.uid()) and (select public.is_las_active()));
drop policy if exists posts_update_author_admin on public.posts;
create policy posts_update_author_admin on public.posts for update to authenticated
using (author_id=(select auth.uid()) or (select public.has_role('admin')))
with check (author_id=(select auth.uid()) or (select public.has_role('admin')));
drop policy if exists posts_delete_author_admin on public.posts;
create policy posts_delete_author_admin on public.posts for delete to authenticated
using (author_id=(select auth.uid()) or (select public.has_role('admin')));

drop policy if exists comments_read_active on public.post_comments;
create policy comments_read_active on public.post_comments for select to authenticated
using ((select public.is_las_active()) and (status='published' or author_id=(select auth.uid()) or (select public.has_role('admin'))));
drop policy if exists comments_insert_active on public.post_comments;
create policy comments_insert_active on public.post_comments for insert to authenticated
with check (author_id=(select auth.uid()) and (select public.is_las_active()));
drop policy if exists comments_update_author_admin on public.post_comments;
create policy comments_update_author_admin on public.post_comments for update to authenticated
using (author_id=(select auth.uid()) or (select public.has_role('admin')))
with check (author_id=(select auth.uid()) or (select public.has_role('admin')));
drop policy if exists comments_delete_author_admin on public.post_comments;
create policy comments_delete_author_admin on public.post_comments for delete to authenticated
using (author_id=(select auth.uid()) or (select public.has_role('admin')));

grant usage on schema public to authenticated;
grant select on public.profiles, public.members, public.member_payments, public.posts, public.post_comments, public.media_items to authenticated;
grant insert, update, delete on public.members to authenticated;
grant insert, update, delete on public.member_payments, public.posts, public.post_comments, public.media_items to authenticated;
grant select, insert, update, delete on public.monthly_contributions to authenticated;
revoke all on table public.auth_login_map from anon, authenticated;
grant select, insert, update, delete on table public.auth_login_map to service_role;

-- Médias stockés dans un bucket privé; aucun accès public permanent.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('las-private-media','las-private-media',false,10485760,
  array['image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/webm'])
on conflict (id) do update set public=false, file_size_limit=10485760, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists las_media_select_active on storage.objects;
create policy las_media_select_active on storage.objects for select to authenticated
using (bucket_id='las-private-media' and (select public.is_las_active()));
drop policy if exists las_media_insert_active on storage.objects;
create policy las_media_insert_active on storage.objects for insert to authenticated
with check (bucket_id='las-private-media' and ((select public.has_role('admin')) or (select public.has_role('secretaire'))));
drop policy if exists las_media_update_active on storage.objects;
create policy las_media_update_active on storage.objects for update to authenticated
using (bucket_id='las-private-media' and ((select public.has_role('admin')) or (select public.has_role('secretaire'))))
with check (bucket_id='las-private-media' and ((select public.has_role('admin')) or (select public.has_role('secretaire'))));
drop policy if exists las_media_delete_admin on storage.objects;
create policy las_media_delete_admin on storage.objects for delete to authenticated
using (bucket_id='las-private-media' and (select public.has_role('admin')));

commit;
