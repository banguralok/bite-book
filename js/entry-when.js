document.addEventListener('DOMContentLoaded', () => {
  const dateChips = document.querySelectorAll('#date-chips .chip');
  const datePickerWrap = document.getElementById('date-picker-wrap');
  const datePicker = document.getElementById('date-picker');
  const dateConfirm = document.getElementById('date-confirm');
  const timeSection = document.getElementById('section-time');
  const timeHint = document.getElementById('time-hint');
  const timeChips = document.querySelectorAll('#time-chips .chip');
  const fuzzyTimeWrap = document.getElementById('fuzzy-time-wrap');
  const exactTimeWrap = document.getElementById('exact-time-wrap');
  const useExactTimeBtn = document.getElementById('use-exact-time');
  const useFuzzyTimeBtn = document.getElementById('use-fuzzy-time');
  const exactTimeInput = document.getElementById('exact-time-input');
  const backBtn = document.getElementById('back-btn');
  const continueBtn = document.getElementById('continue-btn');
  const savedToast = document.getElementById('saved-toast');
  const autosaveHint = document.getElementById('autosave-hint');

  let entryId = null;
  let createdAt = null;
  let ateOn = null;
  let timeMode = 'fuzzy';
  let selectedTimeOfDay = null;
  let exactTime = null;
  let timeAutoPicked = false;

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
      ateOn,
      timeMode,
      timeOfDay: timeMode === 'fuzzy' ? selectedTimeOfDay : null,
      timeAutoPicked: timeMode === 'fuzzy' ? timeAutoPicked : false,
      exactTime: timeMode === 'exact' ? exactTime : null,
      createdAt: createdAt || existing.createdAt || now,
      updatedAt: now,
    };
  }

  function saveNow() {
    if (!ateOn) return;
    const entry = buildEntry();
    if (!createdAt) createdAt = entry.createdAt;
    const ok = BiteBookStorage.saveEntry(entry);
    flashAutosaveBadge(autosaveHint, ok);
  }

  const scheduleSave = debounce(saveNow, 500);

  function guessTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 7) return 'early-morning';
    if (hour >= 7 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 14) return 'midday';
    if (hour >= 14 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 20) return 'evening';
    if (hour >= 20 && hour < 23) return 'night';
    return 'late-night';
  }

  function currentTimeValue() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  function offsetDateStr(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return toDateInputValue(d);
  }

  function updateDateConfirm() {
    dateConfirm.textContent = ateOn ? formatDateLabel(ateOn) : '';
  }

  function selectDateChip(value) {
    dateChips.forEach((c) => setChipSelected(c, c.dataset.value === value));
    if (value === 'today') {
      ateOn = offsetDateStr(0);
      datePickerWrap.style.display = 'none';
    } else if (value === 'yesterday') {
      ateOn = offsetDateStr(1);
      datePickerWrap.style.display = 'none';
    } else if (value === '2-days-ago') {
      ateOn = offsetDateStr(2);
      datePickerWrap.style.display = 'none';
    } else if (value === 'pick') {
      datePickerWrap.style.display = 'block';
      if (datePicker.value) {
        ateOn = datePicker.value;
      } else {
        datePicker.value = ateOn || offsetDateStr(0);
        ateOn = datePicker.value;
      }
    }
    updateDateConfirm();
    showTimeSection();
    updateContinueState();
  }

  function matchDateChipValue(dateStr) {
    if (dateStr === offsetDateStr(0)) return 'today';
    if (dateStr === offsetDateStr(1)) return 'yesterday';
    if (dateStr === offsetDateStr(2)) return '2-days-ago';
    return 'pick';
  }

  function showTimeSection() {
    timeSection.classList.add('visible');
    if (timeMode === 'fuzzy' && !selectedTimeOfDay) {
      timeAutoPicked = true;
      selectTimeChip(guessTimeOfDay(), true);
    }
  }

  function selectTimeChip(value, isAuto) {
    selectedTimeOfDay = value;
    timeChips.forEach((c) => setChipSelected(c, c.dataset.value === value));
    timeHint.textContent = isAuto
      ? "We're guessing based on the current time — tap another if that's not right."
      : '';
    updateContinueState();
  }

  dateChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      selectDateChip(chip.dataset.value);
      scheduleSave();
    });
  });

  datePicker.addEventListener('change', () => {
    ateOn = datePicker.value;
    updateDateConfirm();
    showTimeSection();
    updateContinueState();
    scheduleSave();
  });

  timeChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      timeAutoPicked = false;
      selectTimeChip(chip.dataset.value, false);
      scheduleSave();
    });
  });

  useExactTimeBtn.addEventListener('click', () => {
    timeMode = 'exact';
    fuzzyTimeWrap.style.display = 'none';
    exactTimeWrap.style.display = 'block';
    timeHint.textContent = '';
    if (!exactTime) {
      exactTimeInput.value = currentTimeValue();
      exactTime = exactTimeInput.value;
    }
    updateContinueState();
    scheduleSave();
  });

  useFuzzyTimeBtn.addEventListener('click', () => {
    timeMode = 'fuzzy';
    exactTimeWrap.style.display = 'none';
    fuzzyTimeWrap.style.display = 'block';
    if (!selectedTimeOfDay) {
      timeAutoPicked = true;
      selectTimeChip(guessTimeOfDay(), true);
    } else {
      timeHint.textContent = timeAutoPicked
        ? "We're guessing based on the current time — tap another if that's not right."
        : '';
    }
    updateContinueState();
    scheduleSave();
  });

  exactTimeInput.addEventListener('input', () => {
    exactTime = exactTimeInput.value;
    updateContinueState();
    scheduleSave();
  });

  function updateContinueState() {
    const timeReady = timeMode === 'exact' ? !!exactTime : !!selectedTimeOfDay;
    continueBtn.disabled = !(ateOn && timeReady);
  }

  function restoreFromStorage() {
    const existing = BiteBookStorage.getEntry(entryId);
    if (!existing) return;
    createdAt = existing.createdAt;

    if (existing.ateOn) {
      ateOn = existing.ateOn;
      const chipValue = matchDateChipValue(ateOn);
      if (chipValue === 'pick') datePicker.value = ateOn;
      selectDateChip(chipValue);
    }

    if (existing.timeMode === 'exact' && existing.exactTime) {
      timeMode = 'exact';
      exactTime = existing.exactTime;
      fuzzyTimeWrap.style.display = 'none';
      exactTimeWrap.style.display = 'block';
      exactTimeInput.value = existing.exactTime;
      timeHint.textContent = '';
    } else if (existing.timeOfDay) {
      timeMode = 'fuzzy';
      selectTimeChip(existing.timeOfDay, !!existing.timeAutoPicked);
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
    backBtn.href = `entry.html?id=${encodeURIComponent(entryId)}`;
    restoreFromStorage();
  }

  continueBtn.addEventListener('click', () => {
    saveNow();
    savedToast.classList.add('visible');
    continueBtn.disabled = true;
    setTimeout(() => {
      window.location.href = `entry-where.html?id=${encodeURIComponent(entryId)}`;
    }, 500);
  });

  document.getElementById('finish-later-btn').addEventListener('click', () => {
    saveNow();
    window.location.href = 'entries.html';
  });

});
