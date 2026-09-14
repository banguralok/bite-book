function escapeHtmlRank(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function miniEntryRowHtml(entry) {
  const photo = entry.photos && entry.photos[0];
  const thumbHtml = photo
    ? `<img class="ranking-thumb" src="${photo.url}" alt="">`
    : `<div class="ranking-thumb-placeholder">🍽️</div>`;
  return `
    <div class="ranking-row">
      ${thumbHtml}
      <div class="ranking-info">
        <a href="entry-view.html?id=${encodeURIComponent(entry.id)}">${escapeHtmlRank(entry.food || 'Untitled entry')}</a>
        ${entry.rating ? `<span class="stars">${ratingStarsLabel(entry.rating)}</span>` : ''}
      </div>
    </div>
  `;
}

function collectionBlock(icon, title, innerHtml) {
  return `<div class="stat-block"><h3>${icon} ${title}</h3>${innerHtml}</div>`;
}

function buildHallOfFame(entries) {
  const picks = entries.filter((e) => e.rating === 5)
    .sort((a, b) => new Date(b.ateOn || b.createdAt) - new Date(a.ateOn || a.createdAt));
  if (!picks.length) return '';
  return collectionBlock('🏆', 'Hall of Fame', picks.map(miniEntryRowHtml).join(''));
}

function buildMostLoved(entries) {
  const picks = entries.filter((e) => e.wouldEatAgain === 'yes')
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));
  if (!picks.length) return '';
  return collectionBlock('❤️', 'Most Loved', picks.map(miniEntryRowHtml).join(''));
}

function buildFamilyFavorites(entries) {
  const picks = entries.filter((e) => (e.companionTypes || []).includes('family') && e.rating)
    .sort((a, b) => b.rating - a.rating);
  if (!picks.length) return '';
  return collectionBlock('👨‍👩‍👧', 'Family Favorites', picks.map(miniEntryRowHtml).join(''));
}

function buildPlacesWorthReturning(entries) {
  const byPlace = {};
  entries.forEach((e) => {
    if (!e.placeName || !e.rating) return;
    if (!byPlace[e.placeName]) byPlace[e.placeName] = [];
    byPlace[e.placeName].push(e.rating);
  });
  const places = Object.entries(byPlace)
    .filter(([, ratings]) => ratings.length >= 2)
    .map(([name, ratings]) => ({
      name,
      count: ratings.length,
      avg: ratings.reduce((s, r) => s + r, 0) / ratings.length,
    }))
    .filter((p) => p.avg >= 4)
    .sort((a, b) => b.avg - a.avg);
  if (!places.length) return '';
  const rows = places.map((p) => `
    <div class="ranking-row">
      <div class="ranking-thumb-placeholder">📍</div>
      <div class="ranking-info">
        <a href="entries.html">${escapeHtmlRank(p.name)}</a>
        <span class="stars">${'★'.repeat(Math.round(p.avg))}${'☆'.repeat(5 - Math.round(p.avg))} · ${p.count} visits</span>
      </div>
    </div>
  `).join('');
  return collectionBlock('📍', 'Places Worth Returning To', rows);
}

function quarterKey(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const q = Math.floor(d.getMonth() / 3) + 1;
  return { key: `${d.getFullYear()}-Q${q}`, label: `Q${q} ${d.getFullYear()}`, sortValue: d.getFullYear() * 10 + q };
}

function buildTasteEvolution(entries) {
  const buckets = {};
  entries.forEach((e) => {
    const dateStr = e.ateOn || e.createdAt;
    if (!dateStr) return;
    const bucket = quarterKey(dateStr);
    if (!bucket) return;
    if (!buckets[bucket.key]) buckets[bucket.key] = { label: bucket.label, sortValue: bucket.sortValue, entries: [] };
    buckets[bucket.key].entries.push(e);
  });
  const ordered = Object.values(buckets).sort((a, b) => a.sortValue - b.sortValue);
  if (ordered.length < 2) return '';

  const rows = ordered.map((bucket) => {
    const cuisineCounts = tallyBy(bucket.entries, (e) => e.cuisine);
    const topCuisine = cuisineCounts.length ? cuisineLabel(cuisineCounts[0][0]) : null;
    const rated = bucket.entries.filter((e) => e.rating);
    const avg = rated.length ? (rated.reduce((s, e) => s + e.rating, 0) / rated.length).toFixed(1) : null;
    const bits = [topCuisine, avg ? `avg ${avg} ★` : null].filter(Boolean).join(' · ');
    return `
      <div class="bar-row">
        <div class="bar-row-label"><span>${escapeHtmlRank(bucket.label)}</span><span>${bits}</span></div>
      </div>
    `;
  }).join('');
  return collectionBlock('📈', 'Taste Evolution', rows);
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

document.addEventListener('bitebook:ready', async () => {
  const collectionsEl = document.getElementById('collections-content');
  const collectionsEmptyEl = document.getElementById('collections-empty');
  const manualToggle = document.getElementById('manual-ranking-toggle');
  const manualWrap = document.getElementById('manual-ranking-wrap');
  const listEl = document.getElementById('ranking-list');
  const emptyEl = document.getElementById('ranking-empty');

  async function getOrderedEntries() {
    const allEntries = await BiteBookStorage.listEntries();
    const complete = allEntries.filter((e) => e.status === 'complete');
    const byId = {};
    complete.forEach((e) => { byId[e.id] = e; });

    const savedOrder = (await BiteBookStorage.getRankingOrder()).filter((id) => byId[id]);
    const ordered = savedOrder.map((id) => byId[id]);
    const remaining = complete.filter((e) => !savedOrder.includes(e.id));
    remaining.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    return ordered.concat(remaining);
  }

  function renderManualList(ordered) {
    if (ordered.length === 0) {
      listEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }

    listEl.style.display = 'flex';
    emptyEl.style.display = 'none';
    listEl.innerHTML = '';

    ordered.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'ranking-row';
      const photo = entry.photos && entry.photos[0];
      const thumbHtml = photo
        ? `<img class="ranking-thumb" src="${photo.url}" alt="">`
        : `<div class="ranking-thumb-placeholder">🍽️</div>`;

      row.innerHTML = `
        <div class="ranking-position">${index + 1}</div>
        ${thumbHtml}
        <div class="ranking-info">
          <a href="entry-view.html?id=${encodeURIComponent(entry.id)}">${escapeHtmlRank(entry.food || 'Untitled entry')}</a>
          ${entry.rating ? `<span class="stars">${ratingStarsLabel(entry.rating)}</span>` : ''}
        </div>
        <div class="ranking-arrows">
          <button type="button" class="ranking-arrow-btn" data-dir="up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" class="ranking-arrow-btn" data-dir="down" data-index="${index}" ${index === ordered.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
      `;
      listEl.appendChild(row);
    });

    listEl.querySelectorAll('.ranking-arrow-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const index = Number(btn.dataset.index);
        const dir = btn.dataset.dir;
        const swapWith = dir === 'up' ? index - 1 : index + 1;
        const ids = ordered.map((e) => e.id);
        [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];
        await BiteBookStorage.setRankingOrder(ids);
        render();
      });
    });
  }

  async function render() {
    const ordered = await getOrderedEntries();
    renderManualList(ordered);

    const blocks = [
      buildHallOfFame(ordered),
      buildMostLoved(ordered),
      buildFamilyFavorites(ordered),
      buildPlacesWorthReturning(ordered),
      buildTasteEvolution(ordered),
    ].filter(Boolean);

    if (blocks.length === 0) {
      collectionsEl.style.display = 'none';
      collectionsEmptyEl.style.display = ordered.length === 0 ? 'none' : 'block';
    } else {
      collectionsEl.style.display = 'block';
      collectionsEmptyEl.style.display = 'none';
      collectionsEl.innerHTML = blocks.join('');
    }
  }

  manualToggle.addEventListener('click', () => {
    const isOpen = manualWrap.style.display !== 'none';
    manualWrap.style.display = isOpen ? 'none' : 'block';
    manualToggle.textContent = isOpen ? 'Or rank them yourself, one at a time ▾' : 'Or rank them yourself, one at a time ▴';
  });

  render();
});
