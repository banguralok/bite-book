// Re-engagement nudges: a friendly notification when a brand new account
// hasn't logged anything yet, or an existing one has gone quiet. There is
// no server-side cron behind this — it's checked once per app open, so a
// nudge only ever queues the next time this person actually opens Bite
// Book, not the instant a threshold is crossed while they're away. See
// supabase/migrations/013_engagement_nudges.sql for the insert policy
// this relies on.
const BiteBookEngagement = (() => {
  const THRESHOLDS_MS = {
    nudge_new_user: 24 * 60 * 60 * 1000,
    nudge_week: 7 * 24 * 60 * 60 * 1000,
    nudge_month: 30 * 24 * 60 * 60 * 1000,
  };

  const MESSAGES = {
    nudge_new_user: "Your Bite Book is still a blank page, and it's already been a day. Somewhere in there was a bite worth remembering — write it down before the plate gets cleared.",
    nudge_week: "Your last entry has been sitting alone for a week now. Plenty of meals have quietly come and gone since then — give the next one a page.",
    nudge_month: "It's been a whole month since your last entry. Those meals are already starting to blur together in memory — whatever's on your plate tonight is a good place to pick the thread back up.",
  };

  async function alreadyNudged(userId, type, entryId) {
    let q = supabaseClient.from('notifications').select('id').eq('user_id', userId).eq('type', type);
    q = entryId ? q.eq('entry_id', entryId) : q.is('entry_id', null);
    const { data } = await q.limit(1);
    return !!(data && data.length > 0);
  }

  async function queue(userId, type, entryId) {
    if (await alreadyNudged(userId, type, entryId)) return;
    await supabaseClient.from('notifications').insert({
      user_id: userId,
      type,
      entry_id: entryId || null,
      message: MESSAGES[type],
    });
  }

  async function check() {
    if (typeof supabaseClient === 'undefined') return;
    const { data } = await supabaseClient.auth.getUser();
    const user = data && data.user;
    if (!user) return;

    const { data: latest } = await supabaseClient
      .from('entries')
      .select('id, created_at')
      .eq('owner_id', user.id)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = Date.now();

    if (!latest) {
      const signedUpAt = new Date(user.created_at).getTime();
      if (now - signedUpAt >= THRESHOLDS_MS.nudge_new_user) {
        await queue(user.id, 'nudge_new_user', null);
      }
      return;
    }

    const idleFor = now - new Date(latest.created_at).getTime();
    if (idleFor >= THRESHOLDS_MS.nudge_month) await queue(user.id, 'nudge_month', latest.id);
    if (idleFor >= THRESHOLDS_MS.nudge_week) await queue(user.id, 'nudge_week', latest.id);
  }

  return { check };
})();

// At most once per browser session — every gated page fires bitebook:ready,
// and nobody needs a fresh round trip on every single click through the app.
document.addEventListener('bitebook:ready', () => {
  try {
    if (sessionStorage.getItem('bb_engagement_checked')) return;
    sessionStorage.setItem('bb_engagement_checked', '1');
  } catch (e) {}
  BiteBookEngagement.check().catch(() => {});
});
