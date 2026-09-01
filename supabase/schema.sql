-- ============================================================
-- Bite Book — Multi-User Edition schema
--
-- Run this ONCE in the Supabase dashboard: Project > SQL Editor >
-- New Query, paste this whole file, and click Run.
--
-- Design notes:
--  - Every table has Row Level Security (RLS) enabled. RLS is what
--    actually enforces "private by default, shared only if explicit" —
--    at the database layer, not just in app code that could have a bug.
--  - profile_directory is a deliberately narrow (id/name/avatar) mirror
--    of profiles, kept in sync by a trigger, so the "share with..."
--    picker can list people by name without ever exposing birthdays,
--    home addresses, or family members to anyone but the profile owner.
-- ============================================================

-- ---------- profiles ----------
-- One row per signed-up user. Same fields as today's local profile.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar text,
  birthday date,
  anniversary date,
  home_address text,
  home_coords jsonb,
  family_members jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: owner has full access"
  on public.profiles for all
  using ( id = auth.uid() )
  with check ( id = auth.uid() );

-- ---------- profile_directory ----------
create table public.profile_directory (
  id uuid primary key references public.profiles(id) on delete cascade,
  name text,
  avatar text
);

alter table public.profile_directory enable row level security;

create policy "profile_directory: any signed-in user can read"
  on public.profile_directory for select
  using ( auth.role() = 'authenticated' );

create function public.sync_profile_directory()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profile_directory (id, name, avatar)
  values (new.id, new.name, new.avatar)
  on conflict (id) do update set name = excluded.name, avatar = excluded.avatar;
  return new;
end;
$$;

create trigger profiles_sync_directory
  after insert or update of name, avatar on public.profiles
  for each row execute function public.sync_profile_directory();

-- ---------- entries ----------
-- Same fields as today's local entry object; photos/videos/ingredients_file
-- hold Storage object paths instead of embedded base64 (see js/storage.js).
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  food text,
  meal_type text,
  meal_type_auto_picked boolean,
  cuisine text,
  ate_on date,
  time_mode text,
  time_of_day text,
  time_auto_picked boolean,
  exact_time text,
  place_name text,
  place_address text,
  place_type text,
  place_source text,
  coords jsonb,
  companion_types text[] not null default '{}',
  companion_family_ids text[] not null default '{}',
  companion_names text,
  made_by text,
  made_by_name text,
  reason text,
  occasion_date date,
  ingredients_text text,
  ingredients_link text,
  ingredients_file jsonb,
  liked_qualities text[] not null default '{}',
  liked_other text,
  rating int,
  would_eat_again text,
  personal_rank text,
  reflection text,
  photos jsonb not null default '[]'::jsonb,
  videos jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  ai_parsed boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entries enable row level security;

-- ---------- shares ----------
-- What RLS on `entries` reads to decide who else can see a given entry.
create table public.shares (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references public.entries(id) on delete cascade,
  trip_id uuid, -- reserved for Phase B (Trips); unused for now
  shared_by uuid not null references public.profiles(id) on delete cascade,
  shared_with uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint shares_target_check check (entry_id is not null or trip_id is not null)
);

alter table public.shares enable row level security;

create policy "shares: visible to sharer and recipient"
  on public.shares for select
  using ( shared_by = auth.uid() or shared_with = auth.uid() );

create policy "shares: only the entry owner can create a share"
  on public.shares for insert
  with check (
    shared_by = auth.uid()
    and exists (
      select 1 from public.entries
      where entries.id = entry_id and entries.owner_id = auth.uid()
    )
  );

create policy "shares: only the sharer can revoke it"
  on public.shares for delete
  using ( shared_by = auth.uid() );

-- entries policies (defined after `shares` so they can reference it):
create policy "entries: owner has full access"
  on public.entries for all
  using ( owner_id = auth.uid() )
  with check ( owner_id = auth.uid() );

create policy "entries: readable if shared with you"
  on public.entries for select
  using (
    exists (
      select 1 from public.shares
      where shares.entry_id = entries.id
      and shares.shared_with = auth.uid()
    )
  );

-- ---------- invites ----------
-- A lightweight log of who was invited by whom, for the user's own
-- reference. Access control itself is enforced by Supabase Auth's
-- admin invite flow (Authentication > Users > Invite), not this table.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  invited_email text not null,
  invited_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;

create policy "invites: visible to the person who sent them"
  on public.invites for select
  using ( invited_by = auth.uid() );

create policy "invites: only the sender can log one"
  on public.invites for insert
  with check ( invited_by = auth.uid() );

-- ---------- trips (stub for Phase B — no UI/feature yet) ----------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.trips enable row level security;

create policy "trips: owner has full access"
  on public.trips for all
  using ( owner_id = auth.uid() )
  with check ( owner_id = auth.uid() );

-- ---------- auto-create a profile row on signup ----------
create function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.profile_directory (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
