document.addEventListener('bitebook:ready', () => {
  const textInput = document.getElementById('smart-entry-text');
  const submitBtn = document.getElementById('smart-entry-btn');
  const statusEl = document.getElementById('smart-entry-status');
  const photoGrid = document.getElementById('smart-entry-photo-grid');
  const photoAddTile = document.getElementById('smart-entry-photo-add');
  const photoInput = document.getElementById('smart-entry-photo-input');

  let photo = null;

  function updateButtonState() {
    submitBtn.disabled = !textInput.value.trim() && !photo;
  }
  textInput.addEventListener('input', updateButtonState);
  updateButtonState();

  function showStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', !!isError);
  }

  function renderPhotoTile() {
    photoGrid.querySelectorAll('.photo-tile').forEach((el) => el.remove());
    if (!photo) {
      photoAddTile.style.display = 'flex';
      return;
    }
    photoAddTile.style.display = 'none';
    const tile = document.createElement('div');
    tile.className = 'photo-tile';
    tile.innerHTML = `
      <img src="${photo.dataUrl}" alt="">
      <button type="button" class="photo-tile-remove" aria-label="Remove this photo">✕</button>
    `;
    tile.querySelector('.photo-tile-remove').addEventListener('click', () => {
      photo = null;
      renderPhotoTile();
      updateButtonState();
    });
    photoGrid.insertBefore(tile, photoAddTile);
  }

  photoAddTile.addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files && photoInput.files[0];
    photoInput.value = '';
    if (!file) return;

    const isHeic = /\.(heic|heif)$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';
    if (isHeic) showStatus('Converting HEIC photo...', false);

    try {
      const decodable = await normalizeToDecodableImage(file);
      photo = await compressImageFile(decodable);
      renderPhotoTile();
      updateButtonState();
      showStatus('', false);
    } catch (e) {
      showStatus("⚠️ Something went wrong with that photo — if it's a HEIC file, this browser may not support it; try converting it to JPG, or use another photo.", true);
    }
  });

  function matchFamilyIds(mentionedFamily, familyMembers) {
    if (!mentionedFamily || !mentionedFamily.length) return [];
    const ids = new Set();
    mentionedFamily.forEach((mention) => {
      const needle = (mention || '').trim().toLowerCase();
      if (!needle) return;
      const match = familyMembers.find((m) => {
        const name = (m.name || '').toLowerCase();
        const rel = (m.relationship || '').toLowerCase();
        return (name && (name === needle || needle.includes(name) || name.includes(needle)))
          || (rel && (rel === needle || needle.includes(rel) || rel.includes(needle)));
      });
      if (match) ids.add(match.id);
    });
    return Array.from(ids);
  }

  function resolveOrOther(value, otherValue) {
    if (!value) return null;
    if (value === 'other') return otherValue ? otherValue.trim() : null;
    return value;
  }

  function clampRating(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.min(5, Math.max(1, Math.round(n)));
  }

  function isValidDateStr(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function buildEntryFromResult(result, rawText, profile, attachedPhoto) {
    const familyMembers = (profile && profile.familyMembers) || [];
    const mentionedFamilyIds = matchFamilyIds(result.mentionedFamily, familyMembers);

    const companionTypes = Array.isArray(result.companionTypes) ? [...result.companionTypes] : [];
    if (mentionedFamilyIds.length && !companionTypes.includes('family')) {
      companionTypes.push('family');
    }

    const mealTypeFromAi = result.mealType || null;
    const timeOfDayFromAi = result.timeOfDay || null;
    const ateOnFromAi = isValidDateStr(result.ateOn) ? result.ateOn : null;

    const now = new Date().toISOString();
    const id = BiteBookStorage.newId();

    return {
      id,
      food: (result.food && result.food.trim()) || rawText.trim(),
      mealType: mealTypeFromAi || guessMealTypeFromTime(),
      mealTypeAutoPicked: !mealTypeFromAi,
      cuisine: resolveOrOther(result.cuisine, result.cuisineOther),
      ateOn: ateOnFromAi || toDateInputValue(new Date()),
      timeMode: 'fuzzy',
      timeOfDay: timeOfDayFromAi || guessTimeOfDayFromTime(),
      timeAutoPicked: !timeOfDayFromAi,
      placeName: result.placeName || null,
      placeType: resolveOrOther(result.placeType, result.placeTypeOther),
      placeSource: 'ai',
      companionTypes,
      companionFamilyIds: mentionedFamilyIds,
      companionNames: result.companionNames || null,
      madeBy: resolveOrOther(result.madeBy, result.madeByOther),
      madeByName: result.madeByName || null,
      reason: resolveOrOther(result.reason, result.reasonOther),
      ingredientsText: result.ingredientsText || null,
      likedQualities: Array.isArray(result.likedQualities) ? result.likedQualities : [],
      likedOther: result.likedOther || null,
      rating: clampRating(result.rating),
      wouldEatAgain: result.wouldEatAgain || null,
      personalRank: result.personalRank || null,
      reflection: result.reflection || null,
      photos: attachedPhoto ? [attachedPhoto] : [],
      status: 'draft',
      aiParsed: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  submitBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    if (!text && !photo) return;

    submitBtn.disabled = true;
    submitBtn.textContent = '✨ Thinking...';
    showStatus('', false);

    const now = new Date();
    const profile = (typeof BiteBookProfile !== 'undefined') ? BiteBookProfile.get() : null;

    try {
      const result = await BiteBookAI.extractEntryFromText(text, {
        today: toDateInputValue(now),
        weekday: now.toLocaleDateString(undefined, { weekday: 'long' }),
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        familyMembers: (profile && profile.familyMembers) || [],
        photo,
      });

      const entry = buildEntryFromResult(result, text, profile, photo);
      await BiteBookStorage.saveEntry(entry);
      showStatus('✨ Got it! Taking you to review...', false);
      setTimeout(() => {
        window.location.href = `entry.html?id=${encodeURIComponent(entry.id)}`;
      }, 600);
    } catch (err) {
      showStatus(BiteBookAI.friendlyErrorMessage(err), true);
      submitBtn.disabled = false;
      submitBtn.textContent = '✨ Fill It In For Me';
    }
  });

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !submitBtn.disabled) {
      submitBtn.click();
    }
  });
});
