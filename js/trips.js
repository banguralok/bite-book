function escapeHtmlTrips(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

document.addEventListener('bitebook:ready', async () => {
  const listEl = document.getElementById('trips-list');
  const emptyEl = document.getElementById('trips-empty');
  const newTripToggle = document.getElementById('new-trip-toggle');
  const newTripWrap = document.getElementById('new-trip-wrap');
  const newTripName = document.getElementById('new-trip-name');
  const createBtn = document.getElementById('new-trip-create-btn');

  newTripToggle.addEventListener('click', () => {
    const isOpen = newTripWrap.style.display !== 'none';
    newTripWrap.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) newTripName.focus();
  });

  createBtn.addEventListener('click', async () => {
    const name = newTripName.value.trim();
    if (!name) return;
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';
    const trip = await BiteBookStorage.createTrip(name);
    if (trip) {
      window.location.href = `trip-view.html?id=${encodeURIComponent(trip.id)}`;
    } else {
      createBtn.disabled = false;
      createBtn.textContent = 'Create Trip';
    }
  });

  const [trips, entries, myId] = await Promise.all([
    BiteBookStorage.listTrips(),
    BiteBookStorage.listEntries(),
    BiteBookStorage.getCurrentUserId(),
  ]);
  const myEntries = entries.filter((e) => e.ownerId === myId);

  if (trips.length === 0) {
    listEl.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }

  listEl.style.display = 'flex';
  emptyEl.style.display = 'none';
  listEl.innerHTML = trips.map((trip) => {
    const tripEntries = myEntries.filter((e) => e.tripId === trip.id);
    const photos = tripEntries.map((e) => e.photos && e.photos[0]).filter(Boolean).slice(0, 3);
    const thumbsHtml = photos.length
      ? `<div class="trip-thumb-stack">${photos.map((p) => `<img src="${p.url}" alt="">`).join('')}</div>`
      : `<div class="ranking-thumb-placeholder">✈️</div>`;
    return `
      <a href="trip-view.html?id=${encodeURIComponent(trip.id)}" class="ranking-row">
        ${thumbsHtml}
        <div class="ranking-info">
          <span style="font-weight: 700; display: block;">${escapeHtmlTrips(trip.name)}</span>
          <span class="stars">${tripEntries.length} ${tripEntries.length === 1 ? 'entry' : 'entries'}</span>
        </div>
      </a>
    `;
  }).join('');
});
