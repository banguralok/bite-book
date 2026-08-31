function buildSiteHeader() {
  const profile = (typeof BiteBookProfile !== 'undefined') ? BiteBookProfile.get() : null;
  const avatar = (profile && profile.avatar) || '👤';
  const profileLabel = (profile && profile.name) ? profile.name : 'Profile';

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
    </nav>
  `;
}

const SITE_FOOTER = `
<p>Made with 💛 for the biggest foodie in the family.</p>
`;

document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  if (header) header.innerHTML = buildSiteHeader();
  if (footer) footer.innerHTML = SITE_FOOTER;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
