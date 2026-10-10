-- LAS username authentication migration.
-- Non-destructive: creates a private lookup table; does not delete or truncate users or application data.
begin;

create table if not exists public.auth_login_map (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  login_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_login_map_username_format check (username ~ '^[a-z0-9._-]{3,80}$')
);

create unique index if not exists auth_login_map_username_lower_uidx
  on public.auth_login_map (lower(username));

alter table public.auth_login_map enable row level security;
revoke all on table public.auth_login_map from anon, authenticated;
-- Deliberately no client-facing policies: only the server-side service key may query this mapping.

-- Backfill only users who already have an application profile. The suffix makes generated
-- identifiers unique and does not change any Auth UUID or profile row.
insert into public.auth_login_map (user_id, username, login_email)
select
  p.id,
  left(
    coalesce(
      nullif(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9._-]', '', 'g'), ''),
      'user'
    ) || '_' || left(replace(p.id::text, '-', ''), 6),
    80
  ),
  u.email
from public.profiles p
join auth.users u on u.id = p.id
where u.email is not null
on conflict (user_id) do update
set login_email = excluded.login_email,
    updated_at = now();

commit;

-- Après migration, vérifiez les identifiants générés avec :
-- select user_id, username from public.auth_login_map order by username;
-- Pour créer le compte root, créez d'abord un utilisateur Auth dans le Dashboard Supabase,
-- ajoutez son profil admin actif avec le même UUID, puis définissez username='root' dans auth_login_map.
