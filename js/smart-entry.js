function escapeHtmlSmart(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

document.addEventListener('bitebook:ready', () => {
  const textInput = document.getElementById('smart-entry-text');
  const submitBtn = document.getElementById('smart-entry-btn');
  const statusEl = document.getElementById('smart-entry-status');
  const photoGrid = document.getElementById('smart-entry-photo-grid');
  const photoAddTile = document.getElementById('smart-entry-photo-add');
  const photoInput = document.getElementById('smart-entry-photo-input');
  const geoBtn = document.getElementById('smart-entry-geo-btn');
  const geoStatus = document.getElementById('smart-entry-geo-status');
  const actionsRow = document.getElementById('smart-entry-actions');
  const confirmWrap = document.getElementById('smart-entry-confirm');
  const confirmCard = document.getElementById('smart-entry-confirm-card');
  const confirmBtn = document.getElementById('smart-entry-confirm-btn');
  const editBtn = document.getElementById('smart-entry-edit-btn');

  let photo = null;
  let capturedPlace = null; // {name, address, coords, placeType, cuisine, city, country} from "Tag My Location"
  let pendingEntry = null;

  function geoErrorMessage(err) {
    if (err && err.code === 1) return "Location access denied — just mention the place in your description.";
    if (err && err.code === 3) return "That took too long — just mention the place in your description.";
    return "Couldn't get your location — just mention the place in your description.";
  }

  geoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      geoStatus.textContent = "Geolocation isn't available here.";
      return;
    }
    geoBtn.disabled = true;
    geoBtn.textContent = '📍 Locating...';
    geoStatus.textContent = '';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const coords = { lat, lon };
        try {
          const data = await reverseGeocodeLookup(lat, lon);
          const context = inferPlaceContext(data, coords);
          const geoCity = cityFromGeocode(data);
          const geoCountry = countryFromGeocode(data);
          const profile = (typeof BiteBookProfile !== 'undefined') ? BiteBookProfile.get() : null;

          if (context.isHome) {
            capturedPlace = {
              name: (profile && profile.homeAddress) ? 'Home' : (placeNameFromGeocode(data) || 'Home'),
              address: (profile && profile.homeAddress) || shortAddressFromGeocode(data),
              coords, placeType: 'home', cuisine: null,
              city: geoCity, country: geoCountry,
            };
            geoStatus.textContent = '📍 Looks like home.';
          } else {
            capturedPlace = {
              name: placeNameFromGeocode(data),
              address: shortAddressFromGeocode(data),
              coords,
              placeType: context.placeType || null,
              cuisine: context.cuisine || null,
              city: geoCity, country: geoCountry,
            };
            geoStatus.textContent = capturedPlace.name ? `📍 Tagged: ${capturedPlace.name}` : '📍 Location tagged.';
          }
        } catch (e) {
          capturedPlace = { name: null, address: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, coords, placeType: null, cuisine: null, city: null, country: null };
          geoStatus.textContent = "📍 Got your coordinates, but couldn't look up the address.";
        }
        geoBtn.disabled = false;
        geoBtn.textContent = '📍 Tag My Location';
      },
      (err) => {
        geoStatus.textContent = geoErrorMessage(err);
        geoBtn.disabled = false;
        geoBtn.textContent = '📍 Tag My Location';
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  });

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

    if (isHeicFile(file)) showStatus('Converting HEIC photo...', false);

    try {
      photo = await decodePhotoForUpload(file);
      renderPhotoTile();
      updateButtonState();
      showStatus('', false);
    } catch (e) {
      console.error('Photo attach failed:', e);
      showStatus(`⚠️ Couldn't process that photo: ${e && e.message ? e.message : 'unknown error'}.`, true);
    }
  });

  // matchFamilyIds/resolveOrOther/clampRating/isValidDateStr now live in
  // js/labels.js, shared with js/ask.js's own AI-result-to-draft-entry path.

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

    // What the user actually described takes priority; GPS is only a
    // fallback for whatever the description didn't cover.
    const placeName = result.placeName || (capturedPlace && capturedPlace.name) || null;
    const placeType = resolveOrOther(result.placeType, result.placeTypeOther) || (capturedPlace && capturedPlace.placeType) || null;
    const cuisine = resolveOrOther(result.cuisine, result.cuisineOther) || (capturedPlace && capturedPlace.cuisine) || null;

    const now = new Date().toISOString();
    const id = BiteBookStorage.newId();

    return {
      id,
      food: (result.food && result.food.trim()) || rawText.trim(),
      mealType: mealTypeFromAi || guessMealTypeFromTime(),
      mealTypeAutoPicked: !mealTypeFromAi,
      cuisine,
      ateOn: ateOnFromAi || toDateInputValue(new Date()),
      timeMode: 'fuzzy',
      timeOfDay: timeOfDayFromAi || guessTimeOfDayFromTime(),
      timeAutoPicked: !timeOfDayFromAi,
      placeName,
      placeType,
      placeAddress: (!result.placeName && capturedPlace) ? capturedPlace.address : null,
      placeSource: result.placeName ? 'ai' : (capturedPlace ? 'geolocation' : null),
      drinks: result.drinks || null,
      coords: (capturedPlace && capturedPlace.coords) || null,
      city: (capturedPlace && capturedPlace.city) || null,
      country: (capturedPlace && capturedPlace.country) || null,
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

  function buildConfirmCardHtml(entry) {
    const bits = [];
    if (entry.placeName) bits.push(`📍 ${escapeHtmlSmart(entry.placeName)}`);
    if (entry.ateOn) bits.push(`🕰️ ${escapeHtmlSmart(formatDateLabel(entry.ateOn))}`);
    const companionText = companionSummaryLabel(entry);
    if (companionText) bits.push(`👥 ${escapeHtmlSmart(companionText)}`);
    if (entry.rating) bits.push(ratingStarsLabel(entry.rating));

    const fromMenu = entry.foodSource === 'menu'
      ? `<span class="menu-badge">${BiteBookIcons.svg('check')} from their menu</span>`
      : '';

    return `
      <h3>${escapeHtmlSmart(entry.food || 'Untitled entry')} ${fromMenu}</h3>
      ${bits.length ? `<p style="margin-top: 8px;">${bits.join(' &nbsp;·&nbsp; ')}</p>` : ''}
      ${entry.reflection ? `<p class="scrapbook-quote" style="margin-top: 14px;">"${escapeHtmlSmart(entry.reflection)}"</p>` : ''}
    `;
  }

  function showConfirmation(entry) {
    pendingEntry = entry;
    confirmCard.innerHTML = buildConfirmCardHtml(entry);
    actionsRow.style.display = 'none';
    confirmWrap.style.display = 'block';

    // This is the one place in the app where the photo is still in memory as
    // a data URL, so it is the only place the picture can be matched against
    // a real menu. Once saved, the photo lives behind a signed URL in
    // Storage and only the description is available.
    if (typeof BiteBookMenuLookup !== 'undefined') {
      BiteBookMenuLookup.mount('menu-lookup-smart', {
        getPlace: () => ({
          name: pendingEntry && pendingEntry.placeName,
          address: pendingEntry && pendingEntry.placeAddress,
          city: pendingEntry && pendingEntry.city,
        }),
        getDescription: () => [
          pendingEntry && pendingEntry.food,
          textInput.value.trim(),
        ].filter(Boolean).join('. '),
        getPhoto: () => (photo && photo.dataUrl) || null,
        onPick: async (dish, result) => {
          pendingEntry = {
            ...pendingEntry,
            food: dish.name,
            foodSource: 'menu',
            menuUrl: result.menuUrl || null,
            menuDishDescription: dish.description || null,
            updatedAt: new Date().toISOString(),
          };
          confirmCard.innerHTML = buildConfirmCardHtml(pendingEntry);
          await BiteBookStorage.saveEntry(pendingEntry);
        },
      });
    }
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
      showStatus('', false);
      showConfirmation(entry);
    } catch (err) {
      showStatus(BiteBookAI.friendlyErrorMessage(err), true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '✨ Fill It In For Me';
    }
  });

  confirmBtn.addEventListener('click', async () => {
    if (!pendingEntry) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Saving...';
    const finished = { ...pendingEntry, status: 'complete', updatedAt: new Date().toISOString() };
    await BiteBookStorage.saveEntry(finished);
    if (typeof BiteBookTrack !== 'undefined') {
      BiteBookTrack.event('entry_created', { via: 'smart_entry' });
    }
    window.location.href = `entry-view.html?id=${encodeURIComponent(pendingEntry.id)}`;
  });

  editBtn.addEventListener('click', () => {
    if (!pendingEntry) return;
    window.location.href = `entry.html?id=${encodeURIComponent(pendingEntry.id)}`;
  });

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !submitBtn.disabled) {
      submitBtn.click();
    }
  });

  // Voice capture. Dictation goes straight into the description box and the
  // normal "Fill It In For Me" flow then runs completely unchanged — this is
  // a shortcut to the same text, not a second way of creating an entry.
  // Feature-detected: the button stays hidden where the browser has no Web
  // Speech support, notably iOS Safari, where the keyboard's own mic key
  // already does this job.
  const micWrap = document.getElementById('smart-entry-mic-wrap');
  const micBtn = document.getElementById('smart-entry-mic-btn');
  const micStatus = document.getElementById('smart-entry-mic-status');
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (micWrap && micBtn && micStatus && SpeechRec) {
    micWrap.style.display = '';
    let recognition = null;
    let listening = false;

    const setIdle = (message) => {
      listening = false;
      micBtn.textContent = '🎙 Say It Instead';
      micStatus.textContent = message || '';
    };

    micBtn.addEventListener('click', () => {
      if (listening && recognition) {
        recognition.stop();
        return;
      }

      recognition = new SpeechRec();
      recognition.lang = navigator.language || 'en-US';
      recognition.interimResults = true;
      recognition.continuous = true;

      // Whatever is already typed stays put; speech is appended to it.
      const base = textInput.value.trim();
      let finalText = '';

      recognition.onstart = () => {
        listening = true;
        micBtn.textContent = '⏹ Stop';
        micStatus.textContent = 'Listening — say what you ate, who you were with, and why it mattered.';
      };

      recognition.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const chunk = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += chunk;
          else interim += chunk;
        }
        const spoken = (finalText + interim).trim();
        textInput.value = [base, spoken].filter(Boolean).join(' ');
        updateButtonState();
      };

      recognition.onerror = (e) => {
        const blocked = e && (e.error === 'not-allowed' || e.error === 'service-not-allowed');
        setIdle(blocked
          ? 'Microphone access was blocked — you can still type it.'
          : 'Did not catch that. Try again, or just type it.');
      };

      recognition.onend = () => {
        setIdle(textInput.value.trim() ? 'Got it — edit anything, then fill it in.' : '');
        updateButtonState();
      };

      try {
        recognition.start();
      } catch (err) {
        setIdle('Could not start the microphone — you can still type it.');
      }
    });
  }
});
