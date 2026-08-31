function relativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(isoString).toLocaleDateString();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const STEP_SEQUENCE = [
  { page: 'entry.html', done: (e) => !!e.food },
  { page: 'entry-when.html', done: (e) => !!e.ateOn },
  { page: 'entry-where.html', done: (e) => !!e.placeName },
  { page: 'entry-who.html', done: (e) => !!(e.companionTypes && e.companionTypes.length) },
  { page: 'entry-made.html', done: (e) => !!e.madeBy },
  { page: 'entry-why.html', done: (e) => !!e.reason },
  { page: 'entry-ingredients.html', done: (e) => !!(e.ingredientsText || e.ingredientsLink || e.ingredientsFile) },
  { page: 'entry-loved.html', done: (e) => !!(e.likedQualities && e.likedQualities.length) },
  { page: 'entry-photos.html', done: (e) => e.status === 'complete' },
];

function resumePageFor(entry) {
  for (const step of STEP_SEQUENCE) {
    if (!step.done(entry)) return step.page;
  }
  return STEP_SEQUENCE[STEP_SEQUENCE.length - 1].page;
}

document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('entries-list');
  const emptyEl = document.getElementById('empty-state');
  const noResultsEl = document.getElementById('no-results-state');
  const searchInput = document.getElementById('search-input');
  const statusChips = document.querySelectorAll('#status-filter-chips .chip');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFileInput = document.getElementById('import-file-input');
  const importExportStatus = document.getElementById('import-export-status');
  const undoToast = document.getElementById('undo-toast');
  const undoToastText = document.getElementById('undo-toast-text');
  const undoToastBtn = document.getElementById('undo-toast-btn');

  let statusFilter = 'all';
  let hiddenIds = new Set();
  let pendingDelete = null;

  function searchableText(entry) {
    return [
      entry.food, entry.placeName, entry.ingredientsText,
      entry.reflection, entry.madeByName, entry.companionNames,
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function matchesFilters(entry, query) {
    if (hiddenIds.has(entry.id)) return false;
    if (statusFilter === 'complete' && entry.status !== 'complete') return false;
    if (statusFilter === 'draft' && entry.status === 'complete') return false;
    if (query && !searchableText(entry).includes(query)) return false;
    return true;
  }

  function render() {
    const allEntries = BiteBookStorage.listEntries();
    const query = searchInput.value.trim().toLowerCase();
    const entries = allEntries.filter((e) => matchesFilters(e, query));

    listEl.innerHTML = '';

    if (allEntries.length === 0) {
      listEl.style.display = 'none';
      emptyEl.style.display = 'block';
      noResultsEl.style.display = 'none';
      return;
    }

    emptyEl.style.display = 'none';

    if (entries.length === 0) {
      listEl.style.display = 'none';
      noResultsEl.style.display = 'block';
      return;
    }

    listEl.style.display = 'flex';
    noResultsEl.style.display = 'none';

    entries.forEach((entry) => {
      const wrap = document.createElement('div');
      wrap.className = 'entry-card';

      const title = entry.food || 'Untitled entry';
      const mealLabel = mealTypeLabel(entry.mealType);
      const cuisLabel = cuisineLabel(entry.cuisine);
      const whenLabel = dateTimeSummaryLabel(entry);
      const placeLabel = placeSummaryLabel(entry);
      const companionLabel = companionSummaryLabel(entry);
      const makerLabel = makerSummaryLabel(entry);
      const reasonLabelText = reasonSummaryLabel(entry);
      const ingredientsLabel = ingredientsSummaryLabel(entry);
      const likedLabel = likedQualitiesSummaryLabel(entry);
      const starsLabel = ratingStarsLabel(entry.rating);
      const rankLabelText = rankLabel(entry.personalRank);
      const mediaLabel = mediaSummaryLabel(entry);
      const isComplete = entry.status === 'complete';
      const linkPage = isComplete ? 'entry-view.html' : resumePageFor(entry);

      wrap.innerHTML = `
        <a class="entry-card-link" href="${linkPage}?id=${encodeURIComponent(entry.id)}">
          <div class="entry-card-main">
            <h3>${escapeHtml(title)}</h3>
            <div class="entry-card-tags">
              ${whenLabel ? `<span class="entry-tag">🕰️ ${escapeHtml(whenLabel)}</span>` : ''}
              ${placeLabel ? `<span class="entry-tag">📍 ${escapeHtml(placeLabel)}</span>` : ''}
              ${companionLabel ? `<span class="entry-tag">${escapeHtml(companionLabel)}</span>` : ''}
              ${makerLabel ? `<span class="entry-tag">${escapeHtml(makerLabel)}</span>` : ''}
              ${reasonLabelText ? `<span class="entry-tag">${escapeHtml(reasonLabelText)}</span>` : ''}
              ${ingredientsLabel ? `<span class="entry-tag">${escapeHtml(ingredientsLabel)}</span>` : ''}
              ${starsLabel ? `<span class="entry-tag">${escapeHtml(starsLabel)}</span>` : ''}
              ${rankLabelText ? `<span class="entry-tag">${escapeHtml(rankLabelText)}</span>` : ''}
              ${likedLabel ? `<span class="entry-tag">${escapeHtml(likedLabel)}</span>` : ''}
              ${mediaLabel ? `<span class="entry-tag">${escapeHtml(mediaLabel)}</span>` : ''}
              ${mealLabel ? `<span class="entry-tag">${mealLabel}</span>` : ''}
              ${cuisLabel ? `<span class="entry-tag">${cuisLabel}</span>` : ''}
            </div>
          </div>
          <div class="entry-card-meta">
            <span class="entry-status${isComplete ? ' complete' : ''}">${isComplete ? '✓ complete' : 'draft'}</span>
            <span class="entry-updated">Updated ${relativeTime(entry.updatedAt)}</span>
            <span class="entry-continue">${isComplete ? '📖 View Story →' : 'Continue →'}</span>
          </div>
        </a>
        <div class="entry-card-actions">
          ${isComplete ? `<button type="button" class="entry-icon-btn" title="Log this again" aria-label="Log &quot;${escapeHtml(title)}&quot; again" data-again="${escapeHtml(entry.id)}">🔁</button>` : ''}
          <button type="button" class="entry-icon-btn" title="Delete this entry" aria-label="Delete &quot;${escapeHtml(title)}&quot;" data-id="${escapeHtml(entry.id)}">🗑️</button>
        </div>
      `;

      listEl.appendChild(wrap);
    });

    listEl.querySelectorAll('[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const title = btn.closest('.entry-card').querySelector('h3').textContent;
        const ok = window.confirm(`Delete "${title}"? You'll have a few seconds to undo.`);
        if (!ok) return;
        startPendingDelete(btn.dataset.id, title);
      });
    });

    listEl.querySelectorAll('[data-again]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const source = BiteBookStorage.getEntry(btn.dataset.again);
        if (!source) return;
        const newId = BiteBookStorage.duplicateForLogAgain(source);
        window.location.href = `entry.html?id=${encodeURIComponent(newId)}`;
      });
    });
  }

  function startPendingDelete(id, title) {
    if (pendingDelete) finalizePendingDelete();
    hiddenIds.add(id);
    render();
    undoToastText.textContent = `"${title}" deleted.`;
    undoToast.classList.add('visible');
    pendingDelete = {
      id,
      timer: setTimeout(() => {
        BiteBookStorage.deleteEntry(id);
        hiddenIds.delete(id);
        pendingDelete = null;
        undoToast.classList.remove('visible');
      }, 6000),
    };
  }

  function finalizePendingDelete() {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    BiteBookStorage.deleteEntry(pendingDelete.id);
    hiddenIds.delete(pendingDelete.id);
    pendingDelete = null;
  }

  undoToastBtn.addEventListener('click', () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    hiddenIds.delete(pendingDelete.id);
    pendingDelete = null;
    undoToast.classList.remove('visible');
    render();
  });

  searchInput.addEventListener('input', () => render());

  statusChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      statusFilter = chip.dataset.value;
      statusChips.forEach((c) => setChipSelected(c, c === chip));
      render();
    });
  });

  exportBtn.addEventListener('click', () => {
    const json = BiteBookStorage.exportAllAsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `bite-book-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    importExportStatus.textContent = '✅ Your backup downloaded.';
    importExportStatus.classList.remove('error');
  });

  importBtn.addEventListener('click', () => importFileInput.click());

  importFileInput.addEventListener('change', () => {
    const file = importFileInput.files[0];
    importFileInput.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const ok = window.confirm(
        'Import entries from this file? New ones will be added, and any with matching IDs will be updated.'
      );
      if (!ok) return;
      const result = BiteBookStorage.importFromJson(reader.result, 'merge');
      if (result.ok) {
        importExportStatus.textContent = `✅ Imported ${result.count} entr${result.count === 1 ? 'y' : 'ies'}.`;
        importExportStatus.classList.remove('error');
        render();
      } else {
        importExportStatus.textContent = `⚠️ ${result.error}`;
        importExportStatus.classList.add('error');
      }
    };
    reader.readAsText(file);
  });

  render();
});
