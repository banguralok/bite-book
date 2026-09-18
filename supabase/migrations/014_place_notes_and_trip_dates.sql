-- ============================================================
-- Two small, unrelated additions bundled into one migration because both
-- are single-purpose and neither touches the other's tables.
--
-- Run this ONCE in the Supabase dashboard: Project > SQL Editor >
-- New Query, paste this whole file, and click Run. Additive to
-- schema.sql + 004_trips.sql, which must already exist.
-- ============================================================

-- ---------- place_notes ----------
-- A running note attached to a PLACE, not one meal — "always get the garlic
-- naan," "cash only," "ask for the corner table." Surfaced on entry-where.html
-- whenever a place name matches one already noted. Matched on the exact
-- place_name string, same as everywhere else in the app that already relies
-- on Clean Up Places to keep spellings consistent, rather than adding a
-- second, fuzzier matching rule just for this.
create table public.place_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  place_name text not null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, place_name)
);

alter table public.place_notes enable row level security;

create policy "place_notes: owner has full access"
  on public.place_notes for all
  using ( owner_id = auth.uid() )
  with check ( owner_id = auth.uid() );

-- ---------- trips: an optional future date range and city ----------
-- Until now a trip only ever held meals already eaten — it had no concept
-- of "coming up." Both columns are nullable and additive: every existing
-- trip (all in the past, already full of entries) simply has them unset,
-- and nothing about how a trip works today changes. `city` is free text,
-- matched case-insensitively against wishlist.city by js/nudges.js — not a
-- foreign key to anything, same looseness the wishlist's own city field
-- already has.
alter table public.trips
  add column starts_on date,
  add column ends_on date,
  add column city text;
