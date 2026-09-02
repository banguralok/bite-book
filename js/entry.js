document.addEventListener('bitebook:ready', async () => {
  const foodInput = document.getElementById('food-name');
  const mealSection = document.getElementById('section-meal-type');
  const cuisineSection = document.getElementById('section-cuisine');
  const mealChips = document.querySelectorAll('#meal-type-chips .chip');
  const cuisineChips = document.querySelectorAll('#cuisine-chips .chip');
  const cuisineOtherWrap = document.getElementById('cuisine-other-wrap');
  const cuisineOtherInput = document.getElementById('cuisine-other');
  const mealTypeHint = document.getElementById('meal-type-hint');
  const continueBtn = document.getElementById('continue-btn');
  const savedToast = document.getElementById('saved-toast');
  const autosaveHint = document.getElementById('autosave-hint');

  let selectedMealType = null;
  let selectedCuisine = null;
  let mealTypeAutoPicked = false;
  let entryId = null;
  let createdAt = null;
  let cachedEntry = null;

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function resolveEntryId() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    if (!id) {
      id = BiteBookStorage.newId();
      params.set('id', id);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
    return id;
  }

  function guessMealType() {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 15) return 'lunch';
    if (hour >= 15 && hour < 18) return 'high-tea';
    if (hour >= 18 && hour < 22) return 'dinner';
    return 'supper';
  }

  function selectMealChip(value, isAuto) {
    selectedMealType = value;
    mealChips.forEach((chip) => {
      setChipSelected(chip, chip.dataset.value === value);
    });
    mealTypeHint.textContent = isAuto
      ? "We're guessing based on the time — tap another if that's not right."
      : '';
    updateContinueState();
  }

  function selectCuisineChip(value) {
    selectedCuisine = value;
    cuisineChips.forEach((c) => setChipSelected(c, c.dataset.value === value));
    if (value === 'other') {
      cuisineOtherWrap.style.display = 'block';
    } else {
      cuisineOtherWrap.style.display = 'none';
      cuisineOtherInput.value = '';
    }
  }

  function showMealSection() {
    mealSection.classList.add('visible');
  }

  function showCuisineSection() {
    cuisineSection.classList.add('visible');
  }

  mealChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      mealTypeAutoPicked = false;
      selectMealChip(chip.dataset.value, false);
      showCuisineSection();
      scheduleSave();
    });
  });

  cuisineChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      selectCuisineChip(chip.dataset.value);
      if (chip.dataset.value === 'other') cuisineOtherInput.focus();
      scheduleSave();
    });
  });

  cuisineOtherInput.addEventListener('input', () => scheduleSave());

  foodInput.addEventListener('input', () => {
    if (foodInput.value.trim().length > 0) {
      showMealSection();
      if (!selectedMealType) {
        mealTypeAutoPicked = true;
        selectMealChip(guessMealType(), true);
      }
      showCuisineSection();
    } else {
      mealSection.classList.remove('visible');
      cuisineSection.classList.remove('visible');
    }
    updateContinueState();
    scheduleSave();
  });

  function updateContinueState() {
    const ready = foodInput.value.trim().length > 0 && !!selectedMealType;
    continueBtn.disabled = !ready;
  }

  function buildEntry() {
    const existing = cachedEntry || {};
    const cuisine = selectedCuisine === 'other'
      ? cuisineOtherInput.value.trim()
      : selectedCuisine;
    const now = new Date().toISOString();
    return {
      ...existing,
      id: entryId,
      food: foodInput.value.trim(),
      mealType: selectedMealType,
      mealTypeAutoPicked,
      cuisine: cuisine || null,
      status: 'draft',
      createdAt: createdAt || existing.createdAt || now,
      updatedAt: now,
    };
  }

  async function saveNow() {
    const hasContent = foodInput.value.trim() || selectedMealType || selectedCuisine;
    if (!hasContent) return;
    const entry = buildEntry();
    if (!createdAt) createdAt = entry.createdAt;
    cachedEntry = entry;
    const ok = await BiteBookStorage.saveEntry(entry);
    flashAutosaveBadge(autosaveHint, ok);
  }

  const scheduleSave = debounce(saveNow, 500);

  async function restoreFromStorage() {
    const existing = await BiteBookStorage.getEntry(entryId);
    if (!existing) return;
    cachedEntry = existing;
    createdAt = existing.createdAt;
    if (existing.food) foodInput.value = existing.food;
    if (existing.food) showMealSection();
    if (existing.mealType) {
      selectMealChip(existing.mealType, !!existing.mealTypeAutoPicked);
      showCuisineSection();
    }
    if (existing.cuisine) {
      const known = Array.from(cuisineChips).some((c) => c.dataset.value === existing.cuisine);
      if (known) {
        selectCuisineChip(existing.cuisine);
      } else {
        selectCuisineChip('other');
        cuisineOtherInput.value = existing.cuisine;
      }
    }
    updateContinueState();
  }

  entryId = resolveEntryId();
  await restoreFromStorage();

  continueBtn.addEventListener('click', async () => {
    await saveNow();
    savedToast.classList.add('visible');
    continueBtn.disabled = true;
    setTimeout(() => {
      window.location.href = `entry-when.html?id=${encodeURIComponent(entryId)}`;
    }, 400);
  });

  document.getElementById('finish-later-btn').addEventListener('click', async () => {
    await saveNow();
    window.location.href = 'entries.html';
  });

});
