document.addEventListener('bitebook:ready', () => {
  const reasonChips = document.querySelectorAll('#reason-chips .chip');
  const reasonOtherWrap = document.getElementById('reason-other-wrap');
  const reasonOtherInput = document.getElementById('reason-other');
  const occasionSection = document.getElementById('section-occasion-date');
  const occasionDateInput = document.getElementById('occasion-date');
  const occasionDateHint = document.getElementById('occasion-date-hint');
  const reasonHint = document.getElementById('reason-hint');
  const backBtn = document.getElementById('back-btn');
  const continueBtn = document.getElementById('continue-btn');
  const savedToast = document.getElementById('saved-toast');
  const autosaveHint = document.getElementById('autosave-hint');

  const DATE_RELEVANT = ['birthday', 'anniversary', 'celebration', 'other'];

  let entryId = null;
  let createdAt = null;
  let mealDate = null;
  let selectedReason = null;

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function buildEntry() {
    const existing = BiteBookStorage.getEntry(entryId) || {};
    const reason = selectedReason === 'other'
      ? reasonOtherInput.value.trim()
      : selectedReason;
    const now = new Date().toISOString();
    return {
      ...existing,
      id: entryId,
      reason: reason || null,
      occasionDate: occasionSection.classList.contains('visible') ? (occasionDateInput.value || null) : null,
      createdAt: createdAt || existing.createdAt || now,
      updatedAt: now,
    };
  }

  function saveNow() {
    if (!selectedReason) return;
    const entry = buildEntry();
    if (!createdAt) createdAt = entry.createdAt;
    const ok = BiteBookStorage.saveEntry(entry);
    flashAutosaveBadge(autosaveHint, ok);
  }

  const scheduleSave = debounce(saveNow, 500);

  function showOccasionSection() {
    occasionSection.classList.add('visible');
    if (!occasionDateInput.value) {
      occasionDateInput.value = mealDate || toDateInputValue(new Date());
    }
    occasionDateHint.textContent = mealDate
      ? `Defaults to the day you logged this meal — change it if the occasion was on a different date.`
      : 'Change it if the occasion was on a different date.';
  }

  function hideOccasionSection() {
    occasionSection.classList.remove('visible');
    occasionDateInput.value = '';
  }

  function selectReasonChip(value, autoHintText) {
    selectedReason = value;
    reasonChips.forEach((c) => setChipSelected(c, c.dataset.value === value));
    if (value === 'other') {
      reasonOtherWrap.style.display = 'block';
    } else {
      reasonOtherWrap.style.display = 'none';
      reasonOtherInput.value = '';
    }
    reasonHint.textContent = autoHintText || '';
    if (DATE_RELEVANT.includes(value)) {
      showOccasionSection();
    } else {
      hideOccasionSection();
    }
    updateContinueState();
  }

  function updateContinueState() {
    continueBtn.disabled = !selectedReason;
  }

  reasonChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      selectReasonChip(chip.dataset.value);
      scheduleSave();
    });
  });

  reasonOtherInput.addEventListener('input', () => {
    scheduleSave();
  });

  occasionDateInput.addEventListener('change', () => {
    scheduleSave();
  });

  function restoreFromStorage() {
    const existing = BiteBookStorage.getEntry(entryId);
    if (!existing) return;
    createdAt = existing.createdAt;
    mealDate = existing.ateOn || null;

    if (existing.reason) {
      const known = Array.from(reasonChips).some((c) => c.dataset.value === existing.reason);
      if (known) {
        selectReasonChip(existing.reason);
      } else {
        selectReasonChip('other');
        reasonOtherInput.value = existing.reason;
      }
    } else if (mealDate) {
      const match = findMatchingOccasion(mealDate);
      if (match) {
        selectReasonChip(match.reason, `Looks like it's ${match.label} — tap another if that's not it.`);
      }
    }

    if (existing.occasionDate && occasionSection.classList.contains('visible')) {
      occasionDateInput.value = existing.occasionDate;
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
    backBtn.href = `entry-made.html?id=${encodeURIComponent(entryId)}`;
    restoreFromStorage();
  }

  continueBtn.addEventListener('click', () => {
    saveNow();
    savedToast.classList.add('visible');
    continueBtn.disabled = true;
    setTimeout(() => {
      window.location.href = `entry-ingredients.html?id=${encodeURIComponent(entryId)}`;
    }, 500);
  });

  document.getElementById('finish-later-btn').addEventListener('click', () => {
    saveNow();
    window.location.href = 'entries.html';
  });

});
