function escapeHtmlRank(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('bitebook:ready', async () => {
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

  async function render() {
    const ordered = await getOrderedEntries();

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

  render();
});
