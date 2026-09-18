-- ============================================================
-- Re-engagement nudges: a friendly notification when someone's gone
-- quiet — a brand new account with nothing logged yet, or an existing
-- one that hasn't added an entry in a while.
--
-- Run this ONCE in the Supabase dashboard: Project > SQL Editor >
-- New Query, paste this whole file, and click Run. Additive to
-- schema.sql + 003_duplicate_detection.sql, which must already exist.
--
-- Design notes:
--  - These are always self-directed — a user can only ever nudge
--    themselves, there is no "other user" involved the way there is
--    for a duplicate report. So unlike 003's writes (which go through
--    a security-definer function because they touch two accounts at
--    once), a plain insert policy scoped to user_id = auth.uid() is
--    exactly as safe as a bespoke function would be here: the only
--    thing a forged row could do is spam the same account that wrote
--    it.
--  - There is no cron job behind this. js/engagement.js checks the
--    signed-in user's own account-creation time and their own most
--    recent complete entry once per app open, so a nudge is only ever
--    queued the next time that person actually opens Bite Book — not
--    the instant a threshold is crossed while they're away.
--  - New notification types this adds: 'nudge_new_user' (signed up 24h+
--    ago, still zero complete entries), 'nudge_week' and 'nudge_month'
--    (entry_id points at the most recent entry, so a new entry after
--    being nudged naturally opens up a fresh silence window instead of
--    permanently suppressing further nudges).
-- ============================================================

create policy "notifications: user can insert their own"
  on public.notifications for insert
  with check ( user_id = auth.uid() );
