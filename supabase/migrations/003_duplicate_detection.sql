-- ============================================================
-- Cross-user duplicate entry detection + notifications
--
-- Run this ONCE in the Supabase dashboard: Project > SQL Editor >
-- New Query, paste this whole file, and click Run. Additive to
-- schema.sql + 002_ranking_and_photos.sql, which must already exist.
--
-- Design notes:
--  - entries' RLS (schema.sql) only ever shows a user their own rows
--    plus rows explicitly shared with them via `shares` — that's
--    correct and does not change. But it means one user's browser
--    literally cannot fetch another user's un-shared entry to compare
--    it. entry_signatures below is a narrow view, owned by the table
--    owner so it deliberately bypasses entries' RLS, exposing only
--    place/date/owner for *complete* entries — never photos, ratings,
--    reflections, or companions. That's the only cross-user exposure
--    this feature needs.
--  - Writing a notification for *someone else* is exactly the kind of
--    thing RLS should block by default. report_possible_duplicate()
--    is a security definer function instead of an insert policy, so
--    it can write both sides of a match in one trusted call while
--    still checking the caller actually owns the entry they claim.
-- ============================================================

-- ---------- entry_signatures ----------
-- created_at is included too (just a logging timestamp, not personal) so
-- either side can independently work out which of a matching pair is the
-- earlier one without needing full read access to the other entry.
create view public.entry_signatures as
  select id, owner_id, place_name, ate_on, coords, created_at
  from public.entries
  where status = 'complete';

grant select on public.entry_signatures to authenticated;

-- ---------- notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, -- 'possible_duplicate' | 'possible_duplicate_unshared' | 'missing_details'
  entry_id uuid references public.entries(id) on delete cascade,
  other_user_id uuid references public.profiles(id) on delete set null,
  other_entry_id uuid references public.entries(id) on delete cascade,
  message text not null,
  status text not null default 'pending', -- pending | dismissed | actioned
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications: owner reads their own"
  on public.notifications for select
  using ( user_id = auth.uid() );

create policy "notifications: owner can update their own"
  on public.notifications for update
  using ( user_id = auth.uid() )
  with check ( user_id = auth.uid() );

-- No insert policy — all writes go through report_possible_duplicate()
-- below, so a client can never insert into someone else's notifications
-- directly, and every write is checked server-side against real
-- ownership of the entry being claimed.

create function public.report_possible_duplicate(
  p_my_entry_id uuid,
  p_other_owner_id uuid,
  p_other_entry_id uuid,
  p_type text,
  p_message text
) returns void language plpgsql security definer as $$
begin
  if not exists (
    select 1 from public.entries
    where id = p_my_entry_id and owner_id = auth.uid()
  ) then
    raise exception 'not your entry';
  end if;

  insert into public.notifications (user_id, type, entry_id, other_user_id, other_entry_id, message)
  values (auth.uid(), p_type, p_my_entry_id, p_other_owner_id, p_other_entry_id, p_message);

  insert into public.notifications (user_id, type, entry_id, other_user_id, other_entry_id, message)
  values (p_other_owner_id, p_type, p_other_entry_id, auth.uid(), p_my_entry_id, p_message);
end;
$$;

grant execute on function public.report_possible_duplicate to authenticated;

-- ---------- resolving a duplicate by removing your own copy ----------
-- Deletes the caller's own entry (verified) and, when p_grant_share is
-- true (the "we weren't already sharing" case), grants the caller access
-- to the surviving entry in the same call — so agreeing "yes, mine is a
-- duplicate" doesn't cost that person their only access to the memory.
-- Needs security definer because the caller isn't the surviving entry's
-- owner, so couldn't create that share themselves under the normal
-- "shares: only the entry owner can create a share" policy.
create function public.resolve_duplicate_by_removing_mine(
  p_my_entry_id uuid,
  p_keep_entry_id uuid,
  p_grant_share boolean
) returns void language plpgsql security definer as $$
begin
  if not exists (
    select 1 from public.entries
    where id = p_my_entry_id and owner_id = auth.uid()
  ) then
    raise exception 'not your entry';
  end if;

  delete from public.entries where id = p_my_entry_id;

  if p_grant_share and not exists (
    select 1 from public.shares
    where entry_id = p_keep_entry_id and shared_with = auth.uid()
  ) then
    insert into public.shares (entry_id, shared_by, shared_with)
    select id, owner_id, auth.uid() from public.entries where id = p_keep_entry_id;
  end if;
end;
$$;

grant execute on function public.resolve_duplicate_by_removing_mine to authenticated;
