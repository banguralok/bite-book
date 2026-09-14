-- ============================================================
-- Roles: General (free) and Power (paid). Admin already exists.
--
-- Run this ONCE in the Supabase dashboard: Project > SQL Editor >
-- New Query, paste this whole file, and click Run. Additive and safe
-- to run twice. Like everything else here it returns no rows — that
-- is success, not failure.
--
-- Design notes:
--  - Role lives in its own table, NOT a column on `profiles`, for the
--    same reason `admins` does: the profiles policy is "owner has full
--    access", so a `role` column there could be set to 'power' by any
--    signed-in person from their own browser console. Here a person
--    can READ their own role and nothing else; only an admin (or the
--    SQL editor) can write one.
--  - No row means 'general'. That is deliberate: a new signup is free
--    by default and needs no row created for them, so there is no
--    trigger to go wrong and no way to end up in an unknown state.
--  - Nothing in the app is switched off by this yet. The client keeps
--    one flag (BiteBookRoles.ENFORCE, currently false) that decides
--    whether the boundary is enforced. Roles are recorded now; the
--    gate is flipped when there is real billing behind it.
-- ============================================================

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'general' check (role in ('general', 'power')),
  granted_by uuid references public.profiles(id) on delete set null,
  note text,
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

drop policy if exists "user_roles: read your own, admins read all" on public.user_roles;
create policy "user_roles: read your own, admins read all"
  on public.user_roles for select
  using ( user_id = auth.uid() or public.bb_is_admin() );

-- Only an admin may write a role. There is deliberately no policy that
-- lets a person write their own row.
drop policy if exists "user_roles: only an admin may set one" on public.user_roles;
create policy "user_roles: only an admin may set one"
  on public.user_roles for all
  using ( public.bb_is_admin() )
  with check ( public.bb_is_admin() );

-- ---------- what am I ----------
-- One call for both facts, so a page load asks once instead of twice.
-- Returns exactly one row for any signed-in person, including someone
-- with no user_roles row at all.
create or replace function public.bb_my_access()
returns table (is_admin boolean, role text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.bb_is_admin(),
    coalesce((select r.role from public.user_roles r where r.user_id = auth.uid()), 'general');
$$;

-- ---------- admin: see and set roles ----------
create or replace function public.admin_list_roles()
returns table (
  user_id uuid,
  name text,
  role text,
  is_admin boolean,
  entries bigint,
  joined date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.name,
    coalesce(r.role, 'general'),
    exists (select 1 from public.admins a where a.user_id = p.id),
    (select count(*) from public.entries e where e.owner_id = p.id),
    p.created_at::date
  from public.profiles p
  left join public.user_roles r on r.user_id = p.id
  where public.bb_is_admin()
  order by p.created_at;
$$;

create or replace function public.admin_set_role(target_user uuid, new_role text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.bb_is_admin() then
    raise exception 'Only an admin can set a role';
  end if;
  if new_role not in ('general', 'power') then
    raise exception 'Unknown role: %', new_role;
  end if;

  insert into public.user_roles (user_id, role, granted_by, updated_at)
  values (target_user, new_role, auth.uid(), now())
  on conflict (user_id) do update
    set role = excluded.role,
        granted_by = excluded.granted_by,
        updated_at = now();

  return new_role;
end;
$$;

grant execute on function public.bb_my_access()     to authenticated;
grant execute on function public.admin_list_roles() to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
