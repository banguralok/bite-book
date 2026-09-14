-- ============================================================
-- Admin insights — who is coming back, and what for.
--
-- Run this ONCE in the Supabase dashboard: Project > SQL Editor >
-- New Query, paste this whole file, and click Run. Additive to
-- schema.sql and migrations 002-005, which must already exist.
--
-- Design notes:
--  - Admin is a row in its own table, NOT a column on `profiles`.
--    That is deliberate: the profiles policy is "owner has full
--    access", so an `is_admin` column there could be flipped to true
--    by any signed-in person from their own browser console. The
--    `admins` table below has a SELECT policy and nothing else, so a
--    person can find out whether they are an admin but cannot make
--    themselves one — only the SQL editor (service role) can.
--  - Every reporting function is `security definer` so it can read
--    across all users, and every one of them is gated on
--    bb_is_admin(). They return COUNTS AND DATES ONLY. No dish name,
--    reflection, place, photo or note is reachable through any of
--    them; the worst a leak could expose is how often someone logged.
--  - search_path is pinned on every definer function so a rogue
--    temp-schema object can't be resolved ahead of the real table.
-- ============================================================

-- ---------- who is an admin ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

drop policy if exists "admins: you can see whether you are one" on public.admins;
create policy "admins: you can see whether you are one"
  on public.admins for select
  using ( user_id = auth.uid() );

-- No insert/update/delete policy on purpose. To make yourself an admin,
-- run this once here in the SQL editor with your own email:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com'
--   on conflict do nothing;

create or replace function public.bb_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- headline numbers ----------
create or replace function public.admin_overview()
returns table (
  people bigint,
  people_with_entries bigint,
  entries bigint,
  entries_last_7 bigint,
  active_last_7 bigint,
  active_last_30 bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.profiles),
    (select count(distinct owner_id) from public.entries),
    (select count(*) from public.entries),
    (select count(*) from public.entries where created_at >= now() - interval '7 days'),
    (select count(distinct user_id) from public.events
      where name = 'session_start' and created_at >= now() - interval '7 days'),
    (select count(distinct user_id) from public.events
      where name = 'session_start' and created_at >= now() - interval '30 days')
  where public.bb_is_admin();
$$;

-- ---------- per person ----------
-- days_opened_without_logging is the number that matters: days somebody
-- opened Bite Book and created nothing. That is a person coming back to
-- REMEMBER rather than to maintain a database.
create or replace function public.admin_people()
returns table (
  name text,
  entries bigint,
  first_entry date,
  last_entry date,
  days_opened bigint,
  days_opened_without_logging bigint,
  pct_pure_remember numeric,
  last_seen date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with entry_stats as (
    select owner_id,
           count(*) as n,
           min(created_at)::date as first_at,
           max(created_at)::date as last_at
    from public.entries
    group by owner_id
  ),
  log_days as (
    select distinct owner_id as user_id, created_at::date as day
    from public.entries
  ),
  open_days as (
    select distinct user_id, created_at::date as day
    from public.events
    where name = 'session_start'
  ),
  per_person as (
    select o.user_id,
           count(*) as days_opened,
           count(*) filter (where l.user_id is null) as days_no_log
    from open_days o
    left join log_days l on l.user_id = o.user_id and l.day = o.day
    group by o.user_id
  )
  select
    p.name,
    coalesce(e.n, 0),
    e.first_at,
    e.last_at,
    coalesce(pp.days_opened, 0),
    coalesce(pp.days_no_log, 0),
    round(100.0 * coalesce(pp.days_no_log, 0)
          / nullif(coalesce(pp.days_opened, 0), 0), 0),
    (select max(ev.created_at)::date from public.events ev where ev.user_id = p.id)
  from public.profiles p
  left join entry_stats e on e.owner_id = p.id
  left join per_person pp on pp.user_id = p.id
  where public.bb_is_admin()
  order by coalesce(e.n, 0) desc;
$$;

-- ---------- did they come back ----------
-- "Started" is the earliest trace of a person anywhere — first entry, first
-- recorded session, or failing both, the day their profile row was created.
-- Only people who started long enough ago to have HAD the chance to return
-- are counted in each cohort.
create or replace function public.admin_retention()
returns table (
  window_days int,
  cohort bigint,
  returned bigint,
  pct numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with first_seen as (
    select p.id as user_id,
           least(
             coalesce((select min(e.created_at) from public.entries e where e.owner_id = p.id), p.created_at),
             coalesce((select min(ev.created_at) from public.events ev where ev.user_id = p.id), p.created_at),
             p.created_at
           ) as started
    from public.profiles p
  ),
  activity as (
    select owner_id as user_id, created_at from public.entries
    union all
    select user_id, created_at from public.events
  ),
  flags as (
    select f.user_id,
           f.started <= now() - interval '7 days'  as eligible_7,
           f.started <= now() - interval '30 days' as eligible_30,
           exists (select 1 from activity a
                   where a.user_id = f.user_id
                     and a.created_at >= f.started + interval '7 days')  as back_7,
           exists (select 1 from activity a
                   where a.user_id = f.user_id
                     and a.created_at >= f.started + interval '30 days') as back_30
    from first_seen f
  )
  select 7,
         count(*) filter (where eligible_7),
         count(*) filter (where eligible_7 and back_7),
         round(100.0 * count(*) filter (where eligible_7 and back_7)
               / nullif(count(*) filter (where eligible_7), 0), 0)
  from flags
  where public.bb_is_admin()
  union all
  select 30,
         count(*) filter (where eligible_30),
         count(*) filter (where eligible_30 and back_30),
         round(100.0 * count(*) filter (where eligible_30 and back_30)
               / nullif(count(*) filter (where eligible_30), 0), 0)
  from flags
  where public.bb_is_admin();
$$;

-- ---------- where people fall out ----------
create or replace function public.admin_funnel()
returns table (
  step_order int,
  step text,
  people bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 1, 'Opened Bite Book', count(distinct user_id)
  from public.events where name = 'session_start' and public.bb_is_admin()
  union all
  select 2, 'Opened a new-entry page', count(distinct user_id)
  from public.events
  where name = 'page_view'
    and props->>'page' in ('smart-entry.html', 'quick-log.html', 'entry.html')
    and public.bb_is_admin()
  union all
  select 3, 'Started an entry', count(distinct owner_id)
  from public.entries where public.bb_is_admin()
  union all
  select 4, 'Finished an entry', count(distinct owner_id)
  from public.entries where status = 'complete' and public.bb_is_admin()
  union all
  select 5, 'Shared one', count(distinct user_id)
  from public.events where name = 'entry_shared' and public.bb_is_admin()
  order by 1;
$$;

-- ---------- which pages earn their place ----------
create or replace function public.admin_pages()
returns table (
  page text,
  views bigint,
  people bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select props->>'page', count(*), count(distinct user_id)
  from public.events
  where name = 'page_view' and public.bb_is_admin()
  group by 1
  order by 2 desc;
$$;

-- ---------- week by week ----------
create or replace function public.admin_weekly()
returns table (
  week date,
  people_opened bigint,
  sessions bigint,
  entries bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with weeks as (
    select date_trunc('week', created_at)::date as week,
           count(distinct user_id) as people_opened,
           count(*) as sessions
    from public.events
    where name = 'session_start'
    group by 1
  ),
  made as (
    select date_trunc('week', created_at)::date as week, count(*) as entries
    from public.entries
    group by 1
  )
  select coalesce(w.week, m.week),
         coalesce(w.people_opened, 0),
         coalesce(w.sessions, 0),
         coalesce(m.entries, 0)
  from weeks w
  full outer join made m on m.week = w.week
  where public.bb_is_admin()
  order by 1;
$$;

-- Reporting functions are callable by any signed-in person; each one checks
-- bb_is_admin() itself and returns nothing to everyone else.
grant execute on function public.bb_is_admin()      to authenticated;
grant execute on function public.admin_overview()   to authenticated;
grant execute on function public.admin_people()     to authenticated;
grant execute on function public.admin_retention()  to authenticated;
grant execute on function public.admin_funnel()     to authenticated;
grant execute on function public.admin_pages()      to authenticated;
grant execute on function public.admin_weekly()     to authenticated;
