-- Bite Book — the beta scorecard.
--
-- Run these in the Supabase SQL editor (they read across all users, which
-- the service role can do; the app itself can only ever see its own rows).
-- Queries 1-3 need no instrumentation at all — they run off entries.created_at,
-- which has always been there. Queries 4-6 need the events table (005).
--
-- The one that matters most is #5: it separates people who came back to
-- REMEMBER from people who came back to LOG. If that number is near zero,
-- Bite Book is a chore, not a memory system.

-- ---------------------------------------------------------------
-- 1. Activation — did each person get past their first entry?
-- ---------------------------------------------------------------
select
  p.name,
  count(e.id)                                as entries,
  min(e.created_at)::date                    as first_entry,
  max(e.created_at)::date                    as last_entry,
  count(e.id) filter (where e.created_at < min(e.created_at) + interval '7 days') as entries_first_week
from public.profiles p
left join public.entries e on e.owner_id = p.id
group by p.id, p.name
order by entries desc;

-- ---------------------------------------------------------------
-- 2. Logging cadence — entries per household per week
-- ---------------------------------------------------------------
select
  date_trunc('week', e.created_at)::date as week,
  count(distinct e.owner_id)             as active_people,
  count(*)                               as entries,
  round(count(*)::numeric
        / nullif(count(distinct e.owner_id), 0), 1) as entries_per_person
from public.entries e
group by 1
order by 1;

-- ---------------------------------------------------------------
-- 3. Week-4 retention — of the people who logged in their first week,
--    how many were still logging four weeks later?
-- ---------------------------------------------------------------
with first_seen as (
  select owner_id, min(created_at) as started
  from public.entries
  group by owner_id
)
select
  count(*)                                                   as cohort,
  count(*) filter (where still_logging)                      as retained_week_4,
  round(100.0 * count(*) filter (where still_logging)
        / nullif(count(*), 0), 1)                            as pct
from (
  select
    f.owner_id,
    exists (
      select 1 from public.entries e
      where e.owner_id = f.owner_id
        and e.created_at >= f.started + interval '21 days'
        and e.created_at <  f.started + interval '28 days'
    ) as still_logging
  from first_seen f
  where f.started < now() - interval '28 days'
) x;

-- ---------------------------------------------------------------
-- 4. Are people opening it at all?  (needs events)
-- ---------------------------------------------------------------
select
  date_trunc('week', created_at)::date as week,
  count(distinct user_id)              as people_who_opened,
  count(*)                             as sessions
from public.events
where name = 'session_start'
group by 1
order by 1;

-- ---------------------------------------------------------------
-- 5. THE ONE THAT MATTERS — visits with no logging.
--    Days where someone opened Bite Book and created nothing:
--    they came back to look, not to maintain a database.
-- ---------------------------------------------------------------
with opens as (
  select user_id, created_at::date as day
  from public.events
  where name = 'session_start'
  group by 1, 2
),
logs as (
  select owner_id as user_id, created_at::date as day
  from public.entries
  group by 1, 2
)
select
  p.name,
  count(*)                                          as days_opened,
  count(*) filter (where l.user_id is null)         as days_opened_without_logging,
  round(100.0 * count(*) filter (where l.user_id is null)
        / nullif(count(*), 0), 1)                   as pct_pure_remember
from opens o
left join logs l on l.user_id = o.user_id and l.day = o.day
join public.profiles p on p.id = o.user_id
group by p.id, p.name
order by pct_pure_remember desc nulls last;

-- ---------------------------------------------------------------
-- 6. Which surfaces earn their place, and how entries get made
-- ---------------------------------------------------------------
select props->>'page' as page, count(*) as views, count(distinct user_id) as people
from public.events where name = 'page_view'
group by 1 order by views desc;

select props->>'via' as created_via, count(*) as entries
from public.events where name = 'entry_created'
group by 1 order by entries desc;

select props->>'via' as shared_via, count(*) as shares, count(distinct user_id) as people
from public.events where name = 'entry_shared'
group by 1 order by shares desc;
