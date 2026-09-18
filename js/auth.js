// Shared session gate, included on every page that requires sign-in
// (after js/supabase-config.js). Redirects to login.html if there's
// no active session.

// A password-reset link's URL carries #...&type=recovery&... — if it lands
// here instead of on reset-password.html (e.g. because the redirect URL
// wasn't on Supabase's allowlist), the session it creates would otherwise
// look like an ordinary sign-in and this page would just let it through
// without ever asking for a new password. Catching it here means that
// mistake can happen on the dashboard side and the app still does the
// right thing instead of silently granting a stale-password login.
function redirectIfPasswordRecovery() {
  if (window.location.hash.includes('type=recovery')) {
    window.location.href = `reset-password.html${window.location.hash}`;
    return true;
  }
  return false;
}

async function requireAuth() {
  if (redirectIfPasswordRecovery()) return null;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    const here = window.location.pathname + window.location.search;
    window.location.href = `login.html?redirect=${encodeURIComponent(here)}`;
    return null;
  }
  return data.session;
}

async function currentUserId() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session ? data.session.user.id : null;
}

async function signOut(redirectTo) {
  await supabaseClient.auth.signOut();
  window.location.href = redirectTo || 'index.html';
}
