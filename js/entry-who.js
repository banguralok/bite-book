document.addEventListener('DOMContentLoaded', () => {
  const companionChips = document.querySelectorAll('#companion-chips .chip');
  const companionOtherWrap = document.getElementById('companion-other-wrap');
  const companionOtherInput = document.getElementById('companion-other');
  const namesSection = document.getElementById('section-names');
  const addNamesLink = document.getElementById('add-names-link');
  const namesWrap = document.getElementById('names-wrap');
  const companionNamesInput = document.getElementById('companion-names');
  const backBtn = document.getElementById('back-btn');
  const continueBtn = document.getElementById('continue-btn');
  const savedToast = document.getElementById('saved-toast');
  const autosaveHint = document.getElementById('autosave-hint');

  let entryId = null;
  let createdAt = null;
  let hasInteracted = false;
  const selectedTypes = new Set();

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function buildEntry() {
    const existing = BiteBookStorage.getEntry(entryId) || {};
    const now = new Date().toISOString();
    return {
      ...existing,
      id: entryId,
      companionTypes: Array.from(selectedTypes),
      companionDetail: companionOtherInput.value.trim() || null,
      companionNames: companionNamesInput.value.trim() || null,
      createdAt: createdAt || existing.createdAt || now,
      updatedAt: now,
    };
  }

  function saveNow() {
    if (!hasInteracted) return;
    const entry = buildEntry();
    if (!createdAt) createdAt = entry.createdAt;
    const ok = BiteBookStorage.saveEntry(entry);
    flashAutosaveBadge(autosaveHint, ok);
  }

  const scheduleSave = debounce(saveNow, 500);

  function isSoloOnly() {
    return selectedTypes.has('solo') && selectedTypes.size === 1;
  }

  function refreshUI() {
    companionChips.forEach((c) => setChipSelected(c, selectedTypes.has(c.dataset.value)));

    const wantsDetail = selectedTypes.has('other') || selectedTypes.has('big-group');
    companionOtherWrap.style.display = wantsDetail ? 'block' : 'none';
    if (!wantsDetail) companionOtherInput.value = '';

    if (isSoloOnly()) {
      namesSection.classList.remove('visible');
      namesWrap.style.display = 'none';
      companionNamesInput.value = '';
    } else if (selectedTypes.size > 0) {
      namesSection.classList.add('visible');
    } else {
      namesSection.classList.remove('visible');
    }

    updateContinueState();
  }

  function toggleChip(value) {
    hasInteracted = true;
    if (value === 'solo') {
      if (selectedTypes.has('solo')) {
        selectedTypes.delete('solo');
      } else {
        selectedTypes.clear();
        selectedTypes.add('solo');
      }
    } else {
      selectedTypes.delete('solo');
      if (selectedTypes.has(value)) {
        selectedTypes.delete(value);
      } else {
        selectedTypes.add(value);
      }
    }
    refreshUI();
  }

  function updateContinueState() {
    continueBtn.disabled = selectedTypes.size === 0;
  }

  companionChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      toggleChip(chip.dataset.value);
      scheduleSave();
    });
  });

  companionOtherInput.addEventListener('input', () => {
    scheduleSave();
  });

  addNamesLink.addEventListener('click', () => {
    namesWrap.style.display = 'block';
    companionNamesInput.focus();
  });

  companionNamesInput.addEventListener('input', () => {
    scheduleSave();
  });

  function restoreFromStorage() {
    const existing = BiteBookStorage.getEntry(entryId);
    if (!existing) return;
    createdAt = existing.createdAt;

    const types = existing.companionTypes || (existing.companionType ? [existing.companionType] : []);
    types.forEach((t) => selectedTypes.add(t));
    refreshUI();

    if (existing.companionDetail) companionOtherInput.value = existing.companionDetail;
    if (existing.companionNames) {
      companionNamesInput.value = existing.companionNames;
      namesWrap.style.display = 'block';
    }
  }

  function resolveEntryId() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
      window.location.href = 'entry.html';
      return null;
    }
    return id;
  }

  entryId = resolveEntryId();
  if (entryId) {
    backBtn.href = `entry-where.html?id=${encodeURIComponent(entryId)}`;
    restoreFromStorage();
  }

  continueBtn.addEventListener('click', () => {
    saveNow();
    savedToast.classList.add('visible');
    continueBtn.disabled = true;
    setTimeout(() => {
      window.location.href = `entry-made.html?id=${encodeURIComponent(entryId)}`;
    }, 500);
  });

  document.getElementById('finish-later-btn').addEventListener('click', () => {
    saveNow();
    window.location.href = 'entries.html';
  });

});
