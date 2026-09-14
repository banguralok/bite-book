-- ============================================================
-- Invite someone not yet on Bite Book, to see one shared entry
--
-- Run this ONCE in the Supabase dashboard: Project > SQL Editor >
-- New Query, paste this whole file, and click Run. Additive to
-- schema.sql and every prior migration, which must already exist.
--
-- Design notes:
--  - Extends the `invites` table from schema.sql rather than adding a
--    parallel one. That table has existed since the original schema
--    but nothing in the app has ever written to it (it was a stub for
--    Supabase Auth's own admin-invite flow) — this is its first real use.
--  - The link a recipient gets always carries the invite's own id
--    (?invite=<uuid>). Whether they sign in with an existing account or
--    create a brand new one, claim_pending_invites() below grants the
--    share the moment they authenticate — the app never needs to know
--    in advance whether they already had an account.
--  - claim_pending_invites() is security definer for the same reason
--    resolve_duplicate_by_removing_mine() is in 003_duplicate_detection.sql:
--    the caller needs to write a `shares` row on an entry they don't own,
--    which plain RLS on `shares` (insert only by the entry's owner) would
--    otherwise block. The function checks the invite itself instead.
-- ============================================================

alter table public.invites
  alter column invited_email drop not null,
  add column entry_id uuid references public.entries(id) on delete cascade,
  add column invited_phone text,
  add column channel text not null default 'email', -- 'sms' | 'email'
  add column claimed_by uuid references public.profiles(id) on delete set null,
  add column claimed_at timestamptz,
  add constraint invites_target_check check (invited_email is not null or invited_phone is not null);

create or replace function public.claim_pending_invites(p_invite_id uuid default null)
returns table(claimed_entry_id uuid)
language plpgsql security definer as $$
declare
  me uuid := auth.uid();
  my_email text := lower(auth.jwt() ->> 'email');
  rec record;
begin
  if me is null then
    return;
  end if;

  -- Direct claim: the specific invite this session followed a link for.
  if p_invite_id is not null then
    for rec in
      select * from public.invites where id = p_invite_id and claimed_by is null
    loop
      update public.invites set status = 'claimed', claimed_by = me, claimed_at = now()
        where id = rec.id;
      if rec.entry_id is not null and not exists (
        select 1 from public.shares where entry_id = rec.entry_id and shared_with = me
      ) then
        insert into public.shares (entry_id, shared_by, shared_with)
          values (rec.entry_id, rec.invited_by, me);
      end if;
      claimed_entry_id := rec.entry_id;
      return next;
    end loop;
  end if;

  -- Sweep: any other still-pending invites addressed to this verified email
  -- (covers someone who signs up independently of the link they were sent).
  for rec in
    select * from public.invites
    where claimed_by is null and invited_email is not null
      and lower(invited_email) = my_email
      and (p_invite_id is null or id <> p_invite_id)
  loop
    update public.invites set status = 'claimed', claimed_by = me, claimed_at = now()
      where id = rec.id;
    if rec.entry_id is not null and not exists (
      select 1 from public.shares where entry_id = rec.entry_id and shared_with = me
    ) then
      insert into public.shares (entry_id, shared_by, shared_with)
        values (rec.entry_id, rec.invited_by, me);
    end if;
    claimed_entry_id := rec.entry_id;
    return next;
  end loop;
end;
$$;

grant execute on function public.claim_pending_invites(uuid) to authenticated;
