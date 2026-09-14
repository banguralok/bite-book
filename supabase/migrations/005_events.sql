-- Lightweight product analytics.
--
-- One row per meaningful action: a verb, a small JSON payload, a timestamp,
-- and who did it. Deliberately never the CONTENT of an entry — no dish names,
-- no reflections, no place names, no photos. This table answers "did people
-- come back, and did they come back to read rather than to write", nothing
-- about what anyone ate.
--
-- Insert-and-read-your-own only: there are no update or delete policies, so
-- nobody (including the person who wrote a row) can quietly rewrite history.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_user_created_idx on public.events (user_id, created_at desc);
create index events_name_created_idx on public.events (name, created_at desc);

alter table public.events enable row level security;

create policy "events: you can log your own"
  on public.events for insert
  with check ( user_id = auth.uid() );

create policy "events: you can read your own"
  on public.events for select
  using ( user_id = auth.uid() );
