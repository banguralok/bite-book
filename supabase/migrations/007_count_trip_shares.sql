-- ============================================================
-- Count trip shares in the funnel.
--
-- Run this ONCE in the Supabase dashboard: Project > SQL Editor >
-- New Query, paste this whole file, and click Run. It only replaces
-- one function from 006 — nothing is dropped and no data changes,
-- so it is safe to run at any time, and safe to run twice.
--
-- Why: v2.4 added Trip Story sharing, which logs a `trip_shared`
-- event. admin_funnel()'s last step was written before that existed
-- and counts only `entry_shared`, so somebody who shared a whole trip
-- but never a single meal was invisible at exactly the step the
-- funnel is meant to measure. A share is a share.
-- ============================================================

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
  select 5, 'Shared something', count(distinct user_id)
  from public.events
  where name in ('entry_shared', 'trip_shared') and public.bb_is_admin()
  order by 1;
$$;

grant execute on function public.admin_funnel() to authenticated;
