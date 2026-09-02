document.addEventListener('bitebook:ready', async () => {
  const likedChips = document.querySelectorAll('#liked-chips .chip');
  const likedOtherWrap = document.getElementById('liked-other-wrap');
  const likedOtherInput = document.getElementById('liked-other');
  const ratingSection = document.getElementById('section-rating');
  const stars = document.querySelectorAll('#star-rating .star');
  const ratingHint = document.getElementById('rating-hint');
  const eatAgainSection = document.getElementById('section-eat-again');
  const eatAgainChips = document.querySelectorAll('#eat-again-chips .chip');
  const frequencySection = document.getElementById('section-frequency');
  const frequencyChips = document.querySelectorAll('#frequency-chips .chip');
  const rankSection = document.getElementById('section-rank');
  const rankChips = document.querySelectorAll('#rank-chips .chip');
  const reflectionSection = document.getElementById('section-reflection');
  const reflectionInput = document.getElementById('reflection-text');
  const backBtn = document.getElementById('back-btn');
  const continueBtn = document.getElementById('continue-btn');
  const savedToast = document.getElementById('saved-toast');
  const autosaveHint = document.getElementById('autosave-hint');

  const RATING_HINTS = {
    1: "Not really for you — good to know!",
    2: "It was okay.",
    3: "Pretty good.",
    4: "Really great!",
    5: "Absolutely perfect!",
  };

  let entryId = null;
  let createdAt = null;
  let cachedEntry = null;
  let hasInteracted = false;
  const selectedQualities = new Set();
  let rating = 0;
  let selectedEatAgain = null;
  let selectedFrequency = null;
  let selectedRank = null;

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function buildEntry() {
    const existing = cachedEntry || {};
    const now = new Date().toISOString();
    return {
      ...existing,
      id: entryId,
      likedQualities: Array.from(selectedQualities),
      likedOther: likedOtherInput.value.trim() || null,
      rating: rating || null,
      wouldEatAgain: selectedEatAgain,
      eatAgainFrequency: selectedEatAgain === 'no' ? null : selectedFrequency,
      personalRank: selectedRank,
      reflection: reflectionInput.value.trim() || null,
      createdAt: createdAt || existing.createdAt || now,
      updatedAt: now,
    };
  }

  async function saveNow() {
    if (!hasInteracted) return;
    const entry = buildEntry();
    if (!createdAt) createdAt = entry.createdAt;
    cachedEntry = entry;
    const ok = await BiteBookStorage.saveEntry(entry);
    flashAutosaveBadge(autosaveHint, ok);
  }

  const scheduleSave = debounce(saveNow, 500);

  function updateContinueState() {
    continueBtn.disabled = selectedQualities.size === 0;
  }

  function toggleLikedChip(value) {
    hasInteracted = true;
    if (selectedQualities.has(value)) {
      selectedQualities.delete(value);
    } else {
      selectedQualities.add(value);
    }
    likedChips.forEach((c) => setChipSelected(c, selectedQualities.has(c.dataset.value)));

    const wantsOther = selectedQualities.has('other');
    likedOtherWrap.style.display = wantsOther ? 'block' : 'none';
    if (!wantsOther) likedOtherInput.value = '';

    if (selectedQualities.size > 0) {
      ratingSection.classList.add('visible');
    } else {
      ratingSection.classList.remove('visible');
    }
    updateContinueState();
  }

  likedChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      toggleLikedChip(chip.dataset.value);
      scheduleSave();
    });
  });

  likedOtherInput.addEventListener('input', () => scheduleSave());

  function setRating(value) {
    rating = value;
    stars.forEach((s) => {
      const filled = Number(s.dataset.value) <= value;
      s.classList.toggle('filled', filled);
      s.setAttribute('aria-pressed', filled ? 'true' : 'false');
    });
    ratingHint.textContent = RATING_HINTS[value] || '';
    eatAgainSection.classList.add('visible');
  }

  stars.forEach((star) => {
    star.addEventListener('click', () => {
      setRating(Number(star.dataset.value));
      scheduleSave();
    });
  });

  function selectEatAgainChip(value) {
    selectedEatAgain = value;
    eatAgainChips.forEach((c) => setChipSelected(c, c.dataset.value === value));
    if (value === 'no') {
      frequencySection.classList.remove('visible');
      selectedFrequency = null;
      frequencyChips.forEach((c) => setChipSelected(c, false));
    } else {
      frequencySection.classList.add('visible');
    }
    rankSection.classList.add('visible');
  }

  eatAgainChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      selectEatAgainChip(chip.dataset.value);
      scheduleSave();
    });
  });

  function selectFrequencyChip(value) {
    selectedFrequency = value;
    frequencyChips.forEach((c) => setChipSelected(c, c.dataset.value === value));
  }

  frequencyChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      selectFrequencyChip(chip.dataset.value);
      scheduleSave();
    });
  });

  function selectRankChip(value) {
    selectedRank = value;
    rankChips.forEach((c) => setChipSelected(c, c.dataset.value === value));
    reflectionSection.classList.add('visible');
  }

  rankChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      selectRankChip(chip.dataset.value);
      scheduleSave();
    });
  });

  reflectionInput.addEventListener('input', () => scheduleSave());

  async function restoreFromStorage() {
    const existing = await BiteBookStorage.getEntry(entryId);
    if (!existing) return;
    cachedEntry = existing;
    createdAt = existing.createdAt;

    (existing.likedQualities || []).forEach((q) => selectedQualities.add(q));
    if (selectedQualities.size > 0) {
      likedChips.forEach((c) => setChipSelected(c, selectedQualities.has(c.dataset.value)));
      if (selectedQualities.has('other')) likedOtherWrap.style.display = 'block';
      ratingSection.classList.add('visible');
    }
    if (existing.likedOther) likedOtherInput.value = existing.likedOther;

    if (existing.rating) setRating(existing.rating);
    if (existing.wouldEatAgain) selectEatAgainChip(existing.wouldEatAgain);
    if (existing.eatAgainFrequency) selectFrequencyChip(existing.eatAgainFrequency);
    if (existing.personalRank) selectRankChip(existing.personalRank);
    if (existing.reflection) {
      reflectionInput.value = existing.reflection;
      reflectionSection.classList.add('visible');
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
    backBtn.href = `entry-ingredients.html?id=${encodeURIComponent(entryId)}`;
    await restoreFromStorage();
  }

  continueBtn.addEventListener('click', async () => {
    await saveNow();
    savedToast.classList.add('visible');
    continueBtn.disabled = true;
    setTimeout(() => {
      window.location.href = `entry-photos.html?id=${encodeURIComponent(entryId)}`;
    }, 400);
  });

  document.getElementById('finish-later-btn').addEventListener('click', async () => {
    await saveNow();
    window.location.href = 'entries.html';
  });

});
