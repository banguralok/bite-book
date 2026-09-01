document.addEventListener('bitebook:ready', () => {
  const makerChips = document.querySelectorAll('#maker-chips .chip');
  const makerOtherWrap = document.getElementById('maker-other-wrap');
  const makerOtherInput = document.getElementById('maker-other');
  const nameSection = document.getElementById('section-maker-name');
  const addNameLink = document.getElementById('add-maker-name-link');
  const nameWrap = document.getElementById('maker-name-wrap');
  const makerNameInput = document.getElementById('maker-name');
  const backBtn = document.getElementById('back-btn');
  const continueBtn = document.getElementById('continue-btn');
  const savedToast = document.getElementById('saved-toast');
  const autosaveHint = document.getElementById('autosave-hint');
  const makerHint = document.getElementById('maker-hint');

  let entryId = null;
  let createdAt = null;
  let selectedMakerType = null;

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function buildEntry() {
    const existing = BiteBookStorage.getEntry(entryId) || {};
    const madeBy = selectedMakerType === 'other'
      ? makerOtherInput.value.trim()
      : selectedMakerType;
    const now = new Date().toISOString();
    return {
      ...existing,
      id: entryId,
      madeBy: madeBy || null,
      madeByName: makerNameInput.value.trim() || null,
      createdAt: createdAt || existing.createdAt || now,
      updatedAt: now,
    };
  }

  function saveNow() {
    if (!selectedMakerType) return;
    const entry = buildEntry();
    if (!createdAt) createdAt = entry.createdAt;
    const ok = BiteBookStorage.saveEntry(entry);
    flashAutosaveBadge(autosaveHint, ok);
  }

  const scheduleSave = debounce(saveNow, 500);

  function showNameSection() {
    nameSection.classList.add('visible');
  }

  function showNameField() {
    nameWrap.style.display = 'block';
  }

  function selectMakerChip(value, isAuto) {
    selectedMakerType = value;
    makerChips.forEach((c) => setChipSelected(c, c.dataset.value === value));
    if (value === 'other') {
      makerOtherWrap.style.display = 'block';
    } else {
      makerOtherWrap.style.display = 'none';
      makerOtherInput.value = '';
    }
    makerHint.textContent = isAuto
      ? "This place looked like a restaurant, so we guessed — tap another if that's not right."
      : '';
    showNameSection();
    updateContinueState();
  }

  function updateContinueState() {
    continueBtn.disabled = !selectedMakerType;
  }

  makerChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      selectMakerChip(chip.dataset.value, false);
      scheduleSave();
    });
  });

  makerOtherInput.addEventListener('input', () => {
    scheduleSave();
  });

  addNameLink.addEventListener('click', () => {
    showNameField();
    makerNameInput.focus();
  });

  makerNameInput.addEventListener('input', () => {
    scheduleSave();
  });

  function restoreFromStorage() {
    const existing = BiteBookStorage.getEntry(entryId);
    if (!existing) return;
    createdAt = existing.createdAt;

    if (existing.madeBy) {
      const known = Array.from(makerChips).some((c) => c.dataset.value === existing.madeBy);
      if (known) {
        selectMakerChip(existing.madeBy, false);
      } else {
        selectMakerChip('other', false);
        makerOtherInput.value = existing.madeBy;
      }
    } else if (existing.placeType === 'restaurant') {
      selectMakerChip('chef-restaurant', true);
    }

    if (existing.madeByName) {
      makerNameInput.value = existing.madeByName;
      showNameField();
    }

    updateContinueState();
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
    backBtn.href = `entry-who.html?id=${encodeURIComponent(entryId)}`;
    restoreFromStorage();
  }

  continueBtn.addEventListener('click', () => {
    saveNow();
    savedToast.classList.add('visible');
    continueBtn.disabled = true;
    setTimeout(() => {
      window.location.href = `entry-why.html?id=${encodeURIComponent(entryId)}`;
    }, 500);
  });

  document.getElementById('finish-later-btn').addEventListener('click', () => {
    saveNow();
    window.location.href = 'entries.html';
  });

});
