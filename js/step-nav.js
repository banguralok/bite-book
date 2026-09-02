// Lets you jump directly to any wizard step instead of clicking through
// Continue nine times — most useful when editing an existing entry.
// Renders once an entry id is in the URL (true for every wizard page
// except a brand-new visit to entry.html before an id is assigned).
document.addEventListener('bitebook:ready', () => {
  const container = document.getElementById('step-nav');
  if (!container) return;

  const entryId = new URLSearchParams(window.location.search).get('id');
  if (!entryId) return;

  const currentPage = window.location.pathname.split('/').pop();

  container.innerHTML = WIZARD_STEPS.map((step) => {
    const isCurrent = step.page === currentPage;
    const href = `${step.page}?id=${encodeURIComponent(entryId)}`;
    return `<a href="${href}" class="step-nav-item${isCurrent ? ' current' : ''}" title="${step.label}" aria-current="${isCurrent ? 'step' : 'false'}">${step.icon}</a>`;
  }).join('');
});
