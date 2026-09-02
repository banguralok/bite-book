function escapeHtmlTripView(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

document.addEventListener('bitebook:ready', async () => {
  const params = new URLSearchParams(window.location.search);
  const tripId = params.get('id');
  if (!tripId) {
    window.location.href = 'trips.html';
    return;
  }

  const tripNameEl = document.getElementById('trip-name');
  const statsEl = document.getElementById('trip-stats');
  const listEl = document.getElementById('trip-entries-list');
  const emptyEl = document.getElementById('trip-empty');
  const addToggle = document.getElementById('add-entries-toggle');
  const addWrap = document.getElementById('add-entries-wrap');
  const addListEl = document.getElementById('add-entries-list');
  const addEmptyEl = document.getElementById('add-entries-empty');
  const deleteBtn = document.getElementById('delete-trip-btn');

  const myId = await BiteBookStorage.getCurrentUserId();
  const trip = await BiteBookStorage.getTrip(tripId);
  if (!trip) {
    window.location.href = 'trips.html';
    return;
  }
  tripNameEl.textContent = `✈️ ${trip.name}`;

  let allEntries = [];

  function tripEntries() {
    return allEntries.filter((e) => e.tripId === tripId);
  }

  function renderStats() {
    const entries = tripEntries();
    const places = new Set(entries.map((e) => e.placeName).filter(Boolean));
    const dates = entries.map((e) => e.ateOn).filter(Boolean).sort();
    const dateRange = dates.length
      ? (dates[0] === dates[dates.length - 1] ? formatDateLabel(dates[0]) : `${formatDateLabel(dates[0])} – ${formatDateLabel(dates[dates.length - 1])}`)
      : '—';
    const cuisineCounts = {};
    entries.forEach((e) => { if (e.cuisine) cuisineCounts[e.cuisine] = (cuisineCounts[e.cuisine] || 0) + 1; });
    const topCuisine = Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1])[0];

    statsEl.innerHTML = `
      <div class="stat-tile"><div class="stat-tile-value">${entries.length}</div><div class="stat-tile-label">Meals</div></div>
      <div class="stat-tile"><div class="stat-tile-value">${places.size}</div><div class="stat-tile-label">Places</div></div>
      <div class="stat-tile"><div class="stat-tile-value" style="font-size: 1.1rem;">${escapeHtmlTripView(dateRange)}</div><div class="stat-tile-label">Dates</div></div>
      <div class="stat-tile"><div class="stat-tile-value" style="font-size: 1.3rem;">${topCuisine ? cuisineLabel(topCuisine[0]) : '—'}</div><div class="stat-tile-label">Top Cuisine</div></div>
    `;
  }

  function renderTripEntries() {
    const entries = tripEntries();
    if (entries.length === 0) {
      listEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }

    listEl.style.display = 'flex';
    emptyEl.style.display = 'none';
    listEl.innerHTML = entries.map((entry) => {
      const title = entry.food || 'Untitled entry';
      const isComplete = entry.status === 'complete';
      const linkPage = isComplete ? 'entry-view.html' : 'entry.html';
      return `
        <div class="entry-card">
          <a class="entry-card-link" href="${linkPage}?id=${encodeURIComponent(entry.id)}">
            <div class="entry-card-main">
              <h3>${escapeHtmlTripView(title)}</h3>
              <div class="entry-card-tags">
                ${entry.placeName ? `<span class="entry-tag">📍 ${escapeHtmlTripView(entry.placeName)}</span>` : ''}
                ${entry.ateOn ? `<span class="entry-tag">🕰️ ${escapeHtmlTripView(formatDateLabel(entry.ateOn))}</span>` : ''}
                ${entry.rating ? `<span class="entry-tag">${ratingStarsLabel(entry.rating)}</span>` : ''}
              </div>
            </div>
          </a>
          <div class="entry-card-actions">
            <button type="button" class="entry-icon-btn" title="Remove from trip" aria-label="Remove &quot;${escapeHtmlTripView(title)}&quot; from this trip" data-remove="${escapeHtmlTripView(entry.id)}">✕</button>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await BiteBookStorage.assignEntryToTrip(btn.dataset.remove, null);
        await refresh();
      });
    });
  }

  function renderAddList() {
    const candidates = allEntries.filter((e) => e.status === 'complete' && !e.tripId);
    if (candidates.length === 0) {
      addListEl.innerHTML = '';
      addEmptyEl.style.display = 'block';
      return;
    }
    addEmptyEl.style.display = 'none';
    addListEl.innerHTML = candidates.map((e) => `
      <button type="button" class="chip" data-add="${escapeHtmlTripView(e.id)}">${escapeHtmlTripView(e.food || 'Untitled entry')}</button>
    `).join('');
    addListEl.querySelectorAll('[data-add]').forEach((chip) => {
      chip.addEventListener('click', async () => {
        chip.disabled = true;
        await BiteBookStorage.assignEntryToTrip(chip.dataset.add, tripId);
        await refresh();
        renderAddList();
      });
    });
  }

  async function refresh() {
    allEntries = (await BiteBookStorage.listEntries()).filter((e) => e.ownerId === myId);
    renderStats();
    renderTripEntries();
  }

  addToggle.addEventListener('click', () => {
    const isOpen = addWrap.style.display !== 'none';
    addWrap.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) renderAddList();
  });

  deleteBtn.addEventListener('click', async () => {
    const ok = window.confirm(`Delete "${trip.name}"? Entries themselves won't be deleted, just un-grouped from this trip.`);
    if (!ok) return;
    await BiteBookStorage.deleteTrip(tripId);
    window.location.href = 'trips.html';
  });

  await refresh();
});
