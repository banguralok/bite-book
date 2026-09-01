// index.html stays public (no requireAuth) so logged-out visitors see the
// marketing page. But a signed-in visitor landing here — most commonly
// right after clicking an invite/magic-link email — should skip straight
// into the app instead of seeing the pitch again: to profile setup if
// they haven't picked a name yet, or straight to their entries if they have.
document.addEventListener('DOMContentLoaded', async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) return;

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('name')
    .eq('id', data.session.user.id)
    .single();

  window.location.href = (!profile || !profile.name)
    ? 'profile.html?welcome=1'
    : 'entries.html';
});
