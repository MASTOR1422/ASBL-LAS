-- LAS — réduire l'accès direct aux données personnelles des membres.
begin;

drop policy if exists members_read_active on public.members;
create policy members_read_staff on public.members for select to authenticated
using (
  (select private.has_role('admin'))
  or (select private.has_role('secretaire'))
  or (select private.has_role('tresorier'))
);

-- Le flux anniversaire ne renvoie que le nom et le jour/mois; il exige un compte actif.
-- SECURITY DEFINER est nécessaire ici pour ne pas donner l'accès à toutes les fiches membres.
create or replace function public.las_birthday_feed()
returns table(member_id bigint, display_name text, birth_month integer, birth_day integer)
language sql stable security definer set search_path = ''
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

commit;