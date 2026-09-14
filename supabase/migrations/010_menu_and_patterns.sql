-- ============================================================
-- Two features' worth of columns, in one file so there is one
-- thing to run rather than two.
--
-- Run this ONCE in the Supabase dashboard: Project > SQL Editor >
-- New Query, paste this whole file, and click Run. Additive, safe to
-- run twice, and — like every other file here — it returns no rows.
-- That is success. A failure is a red error message.
--
-- PART 1 — Menu lookup provenance.
--   When a dish name comes off a restaurant's own menu rather than out
--   of someone's head, the entry records that, and where from. This is
--   the honest half of the feature: an AI reading the web can be wrong,
--   so every name it supplies is marked and traceable back to the page
--   it came from. A name the person typed themselves stays unmarked.
--
-- PART 2 — Pattern fields.
--   `drinks` is a new question on an entry — the heat map is meant to
--   show what you ate AND drank, and until now nothing recorded the
--   second half. `city` and `country` exist so patterns can be grouped
--   by place without re-parsing a free-text address every time.
--
--   Honest note: city and country are only filled in for entries logged
--   AFTER this ships and only when location was captured. Older entries
--   get a best-effort guess from their saved address, client-side, and
--   anything that can't be worked out simply doesn't appear in the
--   place breakdown rather than being guessed at.
-- ============================================================

-- ---------- Part 1: menu lookup ----------
alter table public.entries
  add column if not exists food_source text;

alter table public.entries
  add column if not exists menu_url text;

alter table public.entries
  add column if not exists menu_dish_description text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'entries_food_source_check'
  ) then
    alter table public.entries
      add constraint entries_food_source_check
      check (food_source is null or food_source in ('typed', 'menu'));
  end if;
end $$;

-- ---------- Part 2: what you drank, and where you were ----------
alter table public.entries
  add column if not exists drinks text;

alter table public.entries
  add column if not exists city text;

alter table public.entries
  add column if not exists country text;

-- Grouping by place is the slowest thing the patterns page does, so give
-- it an index. Owner first because every query is already scoped to one
-- person by RLS.
create index if not exists entries_owner_city_idx
  on public.entries (owner_id, city);
