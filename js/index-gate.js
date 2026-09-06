// index.html is public: logged-out visitors see the marketing page, and so
// should logged-in ones. The only time we bounce straight into the app is
// when the visit IS an auth callback — someone arriving from a magic-link
// or confirmation email, where showing the pitch again would be wrong.
//
// Everything else (typing the URL, a bookmark, the brand logo, a shared
// link) renders the landing page and simply re-points the call-to-action
// at the journal instead of at first-entry onboarding.

// Captured at parse time, on purpose: supabase-js strips the auth hash from
// the URL asynchronously once it has consumed it, so by DOMContentLoaded it
// may already be gone. This script runs immediately after supabase-config.js,
// before that async cleanup fires.
const ARRIVED_FROM_AUTH = (() => {
  const hash = window.location.hash || '';
  const query = window.location.search || '';
  return (
    hash.includes('access_token=') ||
    hash.includes('refresh_token=') ||
    hash.includes('error_description=') ||
    /[?&]code=/.test(query) ||
    /[?&]welcome=/.test(query) ||
    /[?&]app=1/.test(query)
  );
})();

document.addEventListener('DOMContentLoaded', async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) return;

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('name')
    .eq('id', data.session.user.id)
    .single();

  const needsWelcome = !profile || !profile.name;
  const destination = needsWelcome ? 'profile.html?welcome=1' : 'entries.html';

  // Genuine auth callback — send them into the app.
  if (ARRIVED_FROM_AUTH) {
    window.location.replace(destination);
    return;
  }

  // Ordinary visit while signed in: keep the landing page, retarget the CTAs.
  const label = needsWelcome ? '👋 Finish Setting Up' : '🍽️ Open My Journal';
  document
    .querySelectorAll('a.btn-primary[href="smart-entry.html"]')
    .forEach((cta) => {
      cta.setAttribute('href', destination);
      cta.textContent = label;
    });
});
