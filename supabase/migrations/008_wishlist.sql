-- ============================================================
-- "Want to Try" — the wishlist.
--
-- Run this ONCE in the Supabase dashboard: Project > SQL Editor >
-- New Query, paste this whole file, and click Run. Additive; nothing
-- existing is changed. Safe to run twice.
--
-- Design notes:
--  - Owner-only for now, exactly like `trips`. A wishlist someone can
--    add to on your behalf ("you HAVE to try this") is an obvious
--    later feature, but sharing means a shares-style table and a whole
--    set of "who may write to whose list" questions. Not being paid
--    for yet, so not built yet.
--  - `kind` separates a place you want to visit from a dish you want
--    to eat, because they behave differently when you finally go: a
--    place pre-fills where, a dish pre-fills what.
--  - `entry_id` is how an item stops being a wish. It points at the
--    entry that was created when you actually went, so the list can
--    show "you did this, on this date" rather than just deleting the
--    row and losing the fact that a recommendation paid off. ON DELETE
--    SET NULL so deleting that meal doesn't delete the wish.
-- ============================================================

create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'place' check (kind in ('place', 'dish')),
  title text not null,
  place_name text,
  recommended_by text,
  note text,
  status text not null default 'open' check (status in ('open', 'done')),
  entry_id uuid references public.entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wishlist_owner_status_idx
  on public.wishlist (owner_id, status, created_at desc);

alter table public.wishlist enable row level security;

drop policy if exists "wishlist: owner has full access" on public.wishlist;
create policy "wishlist: owner has full access"
  on public.wishlist for all
  using ( owner_id = auth.uid() )
  with check ( owner_id = auth.uid() );
