// Minimal product analytics.
//
// Records WHAT happened and WHEN — never what was in an entry. No dish
// names, no notes, no place names, no photos ever go into `props`. Row-level
// security means a person can only write, and only read, their own rows.
//
// Loaded on gated pages only, after js/partials.js, and everything waits for
// the `bitebook:ready` signal so the session is already resolved. Every call
// is fire-and-forget: analytics must never break, block, or slow a page.
const BiteBookTrack = (() => {
  async function event(name, props) {
    try {
      if (typeof supabaseClient === 'undefined') return;
      const { data } = await supabaseClient.auth.getSession();
      if (!data || !data.session) return;
      await supabaseClient.from('events').insert({
        user_id: data.session.user.id,
        name,
        props: props || {},
      });
    } catch (err) {
      // Swallowed on purpose. A failed metric is never worth a broken page.
    }
  }

  function currentPage() {
    const last = (window.location.pathname || '').split('/').pop();
    return last || 'index.html';
  }

  document.addEventListener('bitebook:ready', () => {
    // One session_start per browser tab, so "how often does someone come
    // back" isn't inflated by ordinary clicking around inside the app.
    try {
      if (!sessionStorage.getItem('bb_session_logged')) {
        sessionStorage.setItem('bb_session_logged', '1');
        event('session_start', { entry_page: currentPage() });
      }
    } catch (err) {
      // Private browsing can refuse sessionStorage; the page_view below
      // still fires, so the visit is not lost entirely.
    }
    event('page_view', { page: currentPage() });
  });

  return { event };
})();
