-- ============================================================
-- Bite Book — migration 002: ranking order + photo/video Storage
--
-- Run this ONCE in the Supabase SQL Editor, in addition to (after)
-- supabase/schema.sql. Safe to run on top of the existing schema —
-- nothing here re-creates tables that already exist.
-- ============================================================

-- ---------- ranking order ----------
-- Replaces the local biteBookRankingOrder localStorage key.
alter table public.profiles
  add column if not exists ranking_order jsonb not null default '[]'::jsonb;

-- ---------- missing column from the original schema ----------
-- eatAgainFrequency (Step 8's "how often would you want it?") was used by
-- the app from the start but got left out of the original entries table.
alter table public.entries
  add column if not exists eat_again_frequency text;

-- ---------- photos bucket ----------
-- Private — not a public bucket. Paths are {ownerId}/{entryId}/{filename},
-- so policies below can check ownership and sharing directly from the path.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "photos: owner can manage their own files"
  on storage.objects for all
  using ( bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text )
  with check ( bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text );

create policy "photos: readable if the entry is shared with you"
  on storage.objects for select
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.shares
      where shares.entry_id = ((storage.foldername(name))[2])::uuid
      and shares.shared_with = auth.uid()
    )
  );
