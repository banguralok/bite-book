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

const DEDUPE_DISMISSED_KEY = 'bitebook:dedupeDismissed';

function dedupeGroupKey(group) {
  return group.names.slice().sort().join('|');
}

function getDismissedDedupeKeys() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DEDUPE_DISMISSED_KEY) || '[]'));
  } catch (e) {
    return new Set();
  }
}

function dismissDedupeGroup(key) {
  const dismissed = getDismissedDedupeKeys();
  dismissed.add(key);
  localStorage.setItem(DEDUPE_DISMISSED_KEY, JSON.stringify(Array.from(dismissed)));
}

function renderDedupeBanner(entries) {
  const banner = document.getElementById('dedupe-banner');
  if (!banner) return;

  const placeNames = entries.map((e) => e.placeName).filter(Boolean);
  const groups = findLikelyDuplicatePlaceNames(placeNames);
  const dismissed = getDismissedDedupeKeys();
  const activeGroups = groups.filter((g) => !dismissed.has(dedupeGroupKey(g)));

  if (activeGroups.length === 0) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'flex';
  banner.innerHTML = `
    <span>We found ${activeGroups.length} place name${activeGroups.length === 1 ? '' : 's'} that might be the same restaurant.</span>
    <div class="dedupe-banner-actions">
      <a href="dedupe.html" class="link-pill">Review →</a>
      <button type="button" class="dedupe-banner-dismiss" id="dedupe-banner-dismiss" aria-label="Dismiss">✕</button>
    </div>
  `;

  document.getElementById('dedupe-banner-dismiss').addEventListener('click', () => {
    activeGroups.forEach((g) => dismissDedupeGroup(dedupeGroupKey(g)));
    banner.style.display = 'none';
  });
}

document.addEventListener('bitebook:ready', async () => {
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
  const smartSearchBtn = document.getElementById('smart-search-btn');
  const smartSearchStatus = document.getElementById('smart-search-status');
  const smartSearchActiveNote = document.getElementById('smart-search-active-note');

  let statusFilter = 'all';
  let hiddenIds = new Set();
  let pendingDelete = null;
  let smartSearchIds = null;
  let smartSearchForQuery = null;
  // Fetched once (and refreshed only after an actual data change) so
  // search/filter typing re-filters locally instead of hitting Supabase
  // on every keystroke.
  let allEntriesCache = [];
  let myId = null;
  let directoryById = new Map();

  async function refreshEntriesCache() {
    if (!myId) myId = await BiteBookStorage.getCurrentUserId();
    if (directoryById.size === 0) {
      const directory = await BiteBookStorage.listDirectory();
      directory.forEach((p) => directoryById.set(p.id, p.name || 'Unnamed'));
    }
    allEntriesCache = await BiteBookStorage.listEntries();
    renderDedupeBanner(allEntriesCache);
    if (typeof checkForCrossUserDuplicates === 'function') {
      checkForCrossUserDuplicates(allEntriesCache).catch(() => {});
    }
  }

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
    if (query) {
      const substringMatch = searchableText(entry).includes(query);
      const smartMatch = !!(smartSearchIds && smartSearchForQuery === query && smartSearchIds.has(entry.id));
      if (!substringMatch && !smartMatch) return false;
    }
    return true;
  }

  function render() {
    const allEntries = allEntriesCache;
    const query = searchInput.value.trim().toLowerCase();
    const entries = allEntries.filter((e) => matchesFilters(e, query));

    listEl.innerHTML = '';

    const smartActive = !!(smartSearchIds && smartSearchForQuery === query && query);
    smartSearchActiveNote.style.display = smartActive && entries.length > 0 ? 'block' : 'none';
    if (smartActive && entries.length > 0) {
      smartSearchActiveNote.textContent = `✨ Showing smart search results for "${searchInput.value.trim()}"`;
    }

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
      const isOwner = entry.ownerId === myId;
      const sharedByLabel = isOwner ? '' : `👥 Shared by ${directoryById.get(entry.ownerId) || 'someone'}`;

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
              ${sharedByLabel ? `<span class="entry-tag shared-by-badge">${escapeHtml(sharedByLabel)}</span>` : ''}
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
          ${isOwner ? `<button type="button" class="entry-icon-btn" title="Delete this entry" aria-label="Delete &quot;${escapeHtml(title)}&quot;" data-id="${escapeHtml(entry.id)}">🗑️</button>` : ''}
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
      btn.addEventListener('click', async () => {
        const source = await BiteBookStorage.getEntry(btn.dataset.again);
        if (!source) return;
        const newId = await BiteBookStorage.duplicateForLogAgain(source);
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
      timer: setTimeout(async () => {
        await BiteBookStorage.deleteEntry(id);
        allEntriesCache = allEntriesCache.filter((e) => e.id !== id);
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
    allEntriesCache = allEntriesCache.filter((e) => e.id !== pendingDelete.id);
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

  searchInput.addEventListener('input', () => {
    smartSearchIds = null;
    smartSearchForQuery = null;
    smartSearchStatus.textContent = '';
    smartSearchStatus.classList.remove('error');
    render();
  });

  smartSearchBtn.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    if (!query) return;

    smartSearchBtn.disabled = true;
    smartSearchBtn.textContent = '✨ Thinking...';
    smartSearchStatus.textContent = '';
    smartSearchStatus.classList.remove('error');

    try {
      const compact = allEntriesCache.map((e) => ({
        id: e.id,
        food: e.food,
        cuisine: e.cuisine,
        mealType: e.mealType,
        placeName: e.placeName,
        placeType: e.placeType,
        madeBy: e.madeBy,
        reason: e.reason,
        ingredients: e.ingredientsText,
        likedQualities: e.likedQualities,
        reflection: e.reflection,
        companions: companionSummaryLabel(e) || null,
      }));
      const ids = await BiteBookAI.semanticSearchEntries(query, compact);
      smartSearchIds = new Set(ids);
      smartSearchForQuery = query.toLowerCase();
      if (ids.length === 0) {
        smartSearchStatus.textContent = 'No smart matches either — try rephrasing your search.';
      } else {
        render();
      }
    } catch (err) {
      smartSearchStatus.textContent = BiteBookAI.friendlyErrorMessage(err);
      smartSearchStatus.classList.add('error');
    } finally {
      smartSearchBtn.disabled = false;
      smartSearchBtn.textContent = '✨ Try Smart Search';
    }
  });

  statusChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      statusFilter = chip.dataset.value;
      statusChips.forEach((c) => setChipSelected(c, c === chip));
      render();
    });
  });

  exportBtn.addEventListener('click', async () => {
    const json = await BiteBookStorage.exportAllAsJson();
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
    reader.onload = async () => {
      const ok = window.confirm(
        'Import entries from this file? New ones will be added, and any with matching IDs will be updated.'
      );
      if (!ok) return;
      importExportStatus.textContent = '⏳ Importing...';
      importExportStatus.classList.remove('error');
      const result = await BiteBookStorage.importFromJson(reader.result, 'merge');
      if (result.ok) {
        importExportStatus.textContent = `✅ Imported ${result.count} entr${result.count === 1 ? 'y' : 'ies'}.`;
        importExportStatus.classList.remove('error');
        await refreshEntriesCache();
        render();
      } else {
        importExportStatus.textContent = `⚠️ ${result.error}`;
        importExportStatus.classList.add('error');
      }
    };
    reader.readAsText(file);
  });

  await refreshEntriesCache();
  render();
});
