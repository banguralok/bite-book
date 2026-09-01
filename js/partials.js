function buildSiteHeader() {
  const profile = (typeof BiteBookProfile !== 'undefined') ? BiteBookProfile.get() : null;
  const avatar = (profile && profile.avatar) || '👤';
  const profileLabel = (profile && profile.name) ? profile.name : 'Profile';
  const signOutLink = (typeof signOut !== 'undefined')
    ? `<a href="#" id="nav-sign-out" title="Sign out">🚪</a>`
    : '';

  return `
    <a class="brand" href="index.html">
      <span class="brand-emoji">🍜</span> Bite Book
    </a>
    <nav class="nav-links">
      <a href="entries.html">My Entries</a>
      <a href="quick-log.html" class="nav-quick">⚡ Quick Log</a>
      <a href="smart-entry.html" class="nav-quick">✨ Smart Entry</a>
      <a class="nav-cta" href="entry.html">New Entry</a>
      <a href="profile.html" class="nav-avatar" title="${profileLabel}">${avatar}</a>
      ${signOutLink}
    </nav>
  `;
}

const SITE_FOOTER = `
<p>Made with 💛 for the biggest foodie in the family.</p>
`;

document.addEventListener('DOMContentLoaded', async () => {
  // requireAuth (js/auth.js) is only loaded on gated pages — index.html
  // stays public, so this is a no-op there.
  if (typeof requireAuth !== 'undefined') {
    const session = await requireAuth();
    if (!session) return; // requireAuth() already redirected to login.html
  }

  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  if (header) {
    header.innerHTML = buildSiteHeader();
    const signOutBtn = document.getElementById('nav-sign-out');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signOut();
      });
    }
  }
  if (footer) footer.innerHTML = SITE_FOOTER;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
