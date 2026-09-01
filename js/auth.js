// Shared session gate, included on every page that requires sign-in
// (after js/supabase-config.js). Redirects to login.html if there's
// no active session.

async function requireAuth() {
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

async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}
