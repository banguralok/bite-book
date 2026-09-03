function buildSiteHeader() {
  const profile = (typeof BiteBookProfile !== 'undefined') ? BiteBookProfile.get() : null;
  const avatar = (profile && profile.avatar) || '👤';
  const profileLabel = (profile && profile.name) ? profile.name : 'Profile';
  const signOutLink = (typeof signOut !== 'undefined')
    ? `<a href="#" id="nav-sign-out" title="Sign out">🚪</a>`
    : '';
  // On a gated page we're already signed in, so send the brand link
  // straight to My Entries — landing on index.html here would just
  // flash the marketing page before its own session check bounces back.
  const brandHref = (typeof requireAuth !== 'undefined') ? 'entries.html' : 'index.html';

  return `
    <a class="brand" href="${brandHref}">
      <img class="brand-icon" src="icons/header-icon.png" alt="Bite Book"> Bite Book
    </a>
    <nav class="nav-links">
      <a href="entries.html">My Entries</a>
      <a href="quick-log.html" class="nav-quick">⚡ Quick Log</a>
      <a href="entry.html" class="nav-quick">📝 Full Form</a>
      <a class="nav-cta" href="smart-entry.html">✨ New Entry</a>
      <a href="notifications.html" class="nav-bell" id="nav-bell" title="Notifications">🔔<span class="nav-bell-badge" id="nav-bell-badge" style="display: none;"></span></a>
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
    if (typeof BiteBookProfile !== 'undefined') {
      await BiteBookProfile.load();
    }
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
    if (typeof BiteBookStorage !== 'undefined') {
      BiteBookStorage.countPendingNotifications().then((count) => {
        const badge = document.getElementById('nav-bell-badge');
        if (badge && count > 0) {
          badge.textContent = count > 9 ? '9+' : String(count);
          badge.style.display = 'inline-flex';
        }
      }).catch(() => {});
    }
  }
  if (footer) footer.innerHTML = SITE_FOOTER;

  // Every page-controller script waits for this instead of DOMContentLoaded
  // directly, so BiteBookProfile.get() is guaranteed populated by the time
  // any page touches it — DOMContentLoaded listeners across separate
  // <script> tags don't wait for each other, so without this signal a
  // page's own script could run before the profile finished loading.
  document.dispatchEvent(new CustomEvent('bitebook:ready'));
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
