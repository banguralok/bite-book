function escapeHtmlStats(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function tallyBy(entries, getValueFn) {
  const counts = {};
  entries.forEach((e) => {
    const value = getValueFn(e);
    if (!value) return;
    counts[value] = (counts[value] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function barBlock(title, pairs, labelFn) {
  if (pairs.length === 0) {
    return `<div class="stat-block"><h3>${title}</h3><p class="stat-empty-note">Not enough data yet.</p></div>`;
  }
  const top = pairs.slice(0, 5);
  const max = top[0][1];
  const rows = top.map(([key, count]) => `
    <div class="bar-row">
      <div class="bar-row-label"><span>${escapeHtmlStats(labelFn(key))}</span><span>${count}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width: ${(count / max) * 100}%;"></div></div>
    </div>
  `).join('');
  return `<div class="stat-block"><h3>${title}</h3>${rows}</div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('stats-content');
  const entries = BiteBookStorage.listEntries();

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <h3>No stats yet</h3>
        <p>Log a few entries and your story will start to take shape here.</p>
        <a href="entry.html" class="btn btn-primary">Start My First Entry</a>
      </div>
    `;
    return;
  }

  const complete = entries.filter((e) => e.status === 'complete');
  const now = new Date();
  const thisMonth = entries.filter((e) => {
    const d = new Date(e.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const rated = complete.filter((e) => e.rating);
  const avgRating = rated.length
    ? (rated.reduce((sum, e) => sum + e.rating, 0) / rated.length).toFixed(1)
    : '—';

  const topRated = complete
    .filter((e) => e.rating)
    .sort((a, b) => b.rating - a.rating)[0];

  const tiles = `
    <div class="stat-tiles">
      <div class="stat-tile"><div class="stat-tile-value">${entries.length}</div><div class="stat-tile-label">Total Entries</div></div>
      <div class="stat-tile"><div class="stat-tile-value">${complete.length}</div><div class="stat-tile-label">Complete</div></div>
      <div class="stat-tile"><div class="stat-tile-value">${avgRating}${avgRating !== '—' ? ' ★' : ''}</div><div class="stat-tile-label">Avg Rating</div></div>
      <div class="stat-tile"><div class="stat-tile-value">${thisMonth}</div><div class="stat-tile-label">This Month</div></div>
    </div>
  `;

  const topRatedBlock = topRated ? `
    <div class="stat-block">
      <h3>🏆 Top-Rated Dish</h3>
      <p><a href="entry-view.html?id=${encodeURIComponent(topRated.id)}"><strong>${escapeHtmlStats(topRated.food)}</strong></a> — ${ratingStarsLabel(topRated.rating)}</p>
    </div>
  ` : '';

  const cuisineBars = barBlock('🍽️ Top Cuisines', tallyBy(entries, (e) => e.cuisine), (v) => cuisineLabel(v));
  const mealBars = barBlock('⏰ When You Eat Most', tallyBy(entries, (e) => e.mealType), (v) => mealTypeLabel(v));
  const companionBars = barBlock(
    '👥 Who You Eat With Most',
    tallyBy(entries, (e) => (e.companionTypes && e.companionTypes[0]) || e.companionType),
    (v) => companionTypeLabel(v)
  );
  const makerBars = barBlock('👩‍🍳 Who Makes Your Food', tallyBy(entries, (e) => e.madeBy), (v) => makerTypeLabel(v));

  container.innerHTML = tiles + topRatedBlock + cuisineBars + mealBars + companionBars + makerBars;
});
