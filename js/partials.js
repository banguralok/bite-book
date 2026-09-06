// The header is built from the visitor's actual session, not from whether
// the page happens to be gated. A stranger on the landing page gets a brand
// and a way in; a signed-in person gets the app nav — on every page.
function buildSiteHeader(isSignedIn) {
  // On a gated page we're already signed in, so send the brand link
  // straight to My Entries. On the public landing page the brand should
  // stay where it is rather than bouncing anyone out of the page.
  const brandHref = (typeof requireAuth !== 'undefined') ? 'entries.html' : 'index.html';

  const brand = `
    <a class="brand" href="${brandHref}">
      <img class="brand-icon" src="icons/header-icon.png" alt="Bite Book"> Bite Book
    </a>
  `;

  if (!isSignedIn) {
    // Logged out: no app links, because every one of them would only bounce
    // this visitor to a login screen they never asked for.
    return `
      ${brand}
      <nav class="nav-links">
        <a href="login.html">Sign in</a>
        <a class="nav-cta" href="login.html?redirect=${encodeURIComponent('smart-entry.html')}">✨ Get Started</a>
      </nav>
    `;
  }

  const profile = (typeof BiteBookProfile !== 'undefined') ? BiteBookProfile.get() : null;
  const avatar = (profile && profile.avatar) || '👤';
  const profileLabel = (profile && profile.name) ? profile.name : 'Profile';

  return `
    ${brand}
    <nav class="nav-links">
      <a href="entries.html">My Entries</a>
      <a href="quick-log.html" class="nav-quick">⚡ Quick Log</a>
      <a href="entry.html" class="nav-quick">📝 Full Form</a>
      <a class="nav-cta" href="smart-entry.html">✨ New Entry</a>
      <a href="notifications.html" class="nav-bell" id="nav-bell" title="Notifications">🔔<span class="nav-bell-badge" id="nav-bell-badge" style="display: none;"></span></a>
      <a href="profile.html" class="nav-avatar" title="${profileLabel}">${avatar}</a>
      <a href="#" id="nav-sign-out" title="Sign out">🚪</a>
    </nav>
  `;
}

const SITE_FOOTER = `
<p>Made with 💛 for the biggest foodie in the family.</p>
`;

document.addEventListener('DOMContentLoaded', async () => {
  let isSignedIn = false;

  // requireAuth (js/auth.js) is only loaded on gated pages — index.html and
  // login.html stay public, so the else branch handles those.
  if (typeof requireAuth !== 'undefined') {
    const session = await requireAuth();
    if (!session) return; // requireAuth() already redirected to login.html
    isSignedIn = true;
    if (typeof BiteBookProfile !== 'undefined') {
      await BiteBookProfile.load();
    }
  } else if (typeof supabaseClient !== 'undefined') {
    // Public page: look, but never redirect.
    try {
      const { data } = await supabaseClient.auth.getSession();
      isSignedIn = !!(data && data.session);
    } catch (err) {
      isSignedIn = false;
    }
  }

  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  if (header) {
    header.innerHTML = buildSiteHeader(isSignedIn);
    const signOutBtn = document.getElementById('nav-sign-out');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        // signOut() lives in js/auth.js, which public pages don't load —
        // so sign out directly there and return to the landing page.
        if (typeof signOut !== 'undefined') {
          signOut();
        } else if (typeof supabaseClient !== 'undefined') {
          await supabaseClient.auth.signOut().catch(() => {});
          window.location.href = 'index.html';
        }
      });
    }
    if (isSignedIn && typeof BiteBookStorage !== 'undefined') {
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
