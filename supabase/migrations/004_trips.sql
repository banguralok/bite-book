-- ============================================================
-- Trips — link entries to a trip
--
-- Run this ONCE in the Supabase dashboard: Project > SQL Editor >
-- New Query, paste this whole file, and click Run. Additive —
-- `public.trips` already exists (see schema.sql) as an unused stub;
-- this is what actually wires entries up to it.
--
-- Trips stay owner-only for now (not shareable) — schema.sql's own
-- comment on shares.trip_id already flags cross-user trip sharing as
-- "reserved for Phase B," so that's a deliberate, separate follow-up.
-- ============================================================

alter table public.entries
  add column trip_id uuid references public.trips(id) on delete set null;
