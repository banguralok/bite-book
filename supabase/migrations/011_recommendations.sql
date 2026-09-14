-- ============================================================
-- Recommendations, middle tier: what other Bite Book households
-- think of a place — without exposing any of them.
--
-- Run this ONCE in the Supabase dashboard: Project > SQL Editor >
-- New Query, paste this whole file, and click Run. Additive, safe to
-- run twice, returns no rows (that is success).
--
-- THE PRIVACY RULE, and why it is shaped this way:
--
--   A place appears ONLY once at least three DIFFERENT households have
--   logged it. Below that the aggregate stops being an aggregate: with
--   one household "liked by 1, avg 5" is simply that family's private
--   habit republished to strangers, and with two it takes one guess.
--   Three is the smallest number where the answer is about the PLACE
--   rather than about people.
--
--   What comes back is a place, a town, a cuisine, a count and an
--   average. Never who, never when, never a rating tied to a person,
--   never anyone's notes or photos. There is no column here that could
--   be joined back to an individual.
--
--   The view is deliberately NOT security_invoker, so it aggregates
--   across everyone's rows the way `entry_signatures` in migration 003
--   does. To stop that being a back door, SELECT on the view itself is
--   revoked and the only way in is bb_recommend_places(), which caps
--   what comes back. A view you can query freely is a view someone can
--   probe one filter at a time.
-- ============================================================

create or replace view public.place_reputation as
  select
    -- The most COMMON spelling, not the alphabetically smallest. min() looked
    -- fine until a row arrived as "  saffron " — a leading space sorts before
    -- every letter, so min() displayed the one sloppy spelling out of 195
    -- and the restaurant appeared in lower case with stray whitespace.
    mode() within group (order by btrim(e.place_name))  as place_name,
    e.city                                         as city,
    e.country                                      as country,
    mode() within group (order by e.cuisine)       as cuisine,
    count(distinct e.owner_id)                     as households,
    count(*)                                       as meals,
    round(avg(e.rating)::numeric, 1)               as avg_rating
  from public.entries e
  where e.status = 'complete'
    and e.place_name is not null
    and btrim(e.place_name) <> ''
    and e.rating is not null
  group by lower(btrim(e.place_name)), e.city, e.country
  having count(distinct e.owner_id) >= 3;

-- The view is the mechanism, not the door.
revoke all on public.place_reputation from anon, authenticated;

create or replace function public.bb_recommend_places(target_city text default null)
returns table (
  place_name text,
  city text,
  country text,
  cuisine text,
  households bigint,
  meals bigint,
  avg_rating numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.place_name, r.city, r.country, r.cuisine,
         r.households, r.meals, r.avg_rating
  from public.place_reputation r
  where target_city is null
     or lower(btrim(r.city)) = lower(btrim(target_city))
  order by r.avg_rating desc, r.households desc, r.place_name
  limit 25;
$$;

grant execute on function public.bb_recommend_places(text) to authenticated;

-- ---------- a town on a wishlist item ----------
-- "Want to Try" entries can now say WHERE the recommended place is, which is
-- what lets the Ideas engine notice you are in the same town as something
-- somebody told you about months ago.
alter table public.wishlist
  add column if not exists city text;
