document.addEventListener('DOMContentLoaded', () => {
  const placeNameInput = document.getElementById('place-name');
  const useGeoBtn = document.getElementById('use-geo-btn');
  const geoStatus = document.getElementById('geo-status');
  const addAddressLink = document.getElementById('add-address-link');
  const addressWrap = document.getElementById('address-wrap');
  const placeAddressInput = document.getElementById('place-address');
  const placeTypeSection = document.getElementById('section-place-type');
  const placeTypeChips = document.querySelectorAll('#place-type-chips .chip');
  const placeTypeOtherWrap = document.getElementById('place-type-other-wrap');
  const placeTypeOtherInput = document.getElementById('place-type-other');
  const backBtn = document.getElementById('back-btn');
  const continueBtn = document.getElementById('continue-btn');
  const savedToast = document.getElementById('saved-toast');
  const autosaveHint = document.getElementById('autosave-hint');

  let entryId = null;
  let createdAt = null;
  let selectedPlaceType = null;
  let placeSource = 'manual';
  let coords = null;
  let inferredCuisine = null;

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function buildEntry() {
    const existing = BiteBookStorage.getEntry(entryId) || {};
    const placeType = selectedPlaceType === 'other'
      ? placeTypeOtherInput.value.trim()
      : selectedPlaceType;
    const now = new Date().toISOString();
    const cuisineUpdate = (inferredCuisine && !existing.cuisine) ? { cuisine: inferredCuisine } : {};
    return {
      ...existing,
      ...cuisineUpdate,
      id: entryId,
      placeName: placeNameInput.value.trim(),
      placeAddress: placeAddressInput.value.trim() || null,
      placeType: placeType || null,
      placeSource,
      coords,
      createdAt: createdAt || existing.createdAt || now,
      updatedAt: now,
    };
  }

  function saveNow() {
    if (!placeNameInput.value.trim()) return;
    const entry = buildEntry();
    if (!createdAt) createdAt = entry.createdAt;
    const ok = BiteBookStorage.saveEntry(entry);
    flashAutosaveBadge(autosaveHint, ok);
  }

  const scheduleSave = debounce(saveNow, 500);

  function showPlaceTypeSection() {
    placeTypeSection.classList.add('visible');
  }

  function selectPlaceTypeChip(value) {
    selectedPlaceType = value;
    placeTypeChips.forEach((c) => setChipSelected(c, c.dataset.value === value));
    if (value === 'other') {
      placeTypeOtherWrap.style.display = 'block';
    } else {
      placeTypeOtherWrap.style.display = 'none';
      placeTypeOtherInput.value = '';
    }
    updateContinueState();
  }

  function showAddressField() {
    addressWrap.style.display = 'block';
  }

  function updateContinueState() {
    continueBtn.disabled = !(placeNameInput.value.trim() && selectedPlaceType);
  }

  placeNameInput.addEventListener('input', () => {
    placeSource = 'manual';
    if (placeNameInput.value.trim().length > 0) {
      showPlaceTypeSection();
    } else {
      placeTypeSection.classList.remove('visible');
    }
    updateContinueState();
    scheduleSave();
  });

  addAddressLink.addEventListener('click', () => {
    showAddressField();
    placeAddressInput.focus();
  });

  placeAddressInput.addEventListener('input', () => {
    placeSource = 'manual';
    scheduleSave();
  });

  placeTypeChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      selectPlaceTypeChip(chip.dataset.value);
      scheduleSave();
    });
  });

  placeTypeOtherInput.addEventListener('input', () => {
    scheduleSave();
  });

  function resetGeoButton() {
    useGeoBtn.disabled = false;
    useGeoBtn.textContent = '📍 Use My Current Location';
  }

  function geoErrorMessage(err) {
    if (err && err.code === 1) return "No worries — permission wasn't given, just type it in below.";
    if (err && err.code === 2) return "Couldn't pin your location — just type it in below.";
    if (err && err.code === 3) return "That took too long — just type it in below.";
    return "Couldn't get your location — just type it in below.";
  }

  useGeoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      geoStatus.textContent = "Geolocation isn't available here — just type it in below.";
      return;
    }
    useGeoBtn.disabled = true;
    useGeoBtn.textContent = '📍 Locating...';
    geoStatus.textContent = '';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        coords = { lat, lon };
        placeSource = 'geolocation';
        try {
          const data = await reverseGeocodeLookup(lat, lon);
          const context = inferPlaceContext(data, coords);

          if (context.isHome) {
            const profile = BiteBookProfile.get();
            placeNameInput.value = (profile && profile.homeAddress) ? 'Home' : (placeNameFromGeocode(data) || 'Home');
            placeAddressInput.value = (profile && profile.homeAddress) || shortAddressFromGeocode(data);
            showAddressField();
            selectPlaceTypeChip('home');
            geoStatus.textContent = "📍 Looks like home — tagged accordingly.";
          } else {
            const name = placeNameFromGeocode(data);
            if (name) placeNameInput.value = name;
            placeAddressInput.value = shortAddressFromGeocode(data);
            showAddressField();

            if (context.placeType === 'restaurant') {
              selectPlaceTypeChip('restaurant');
              if (context.cuisine) inferredCuisine = context.cuisine;
              geoStatus.textContent = context.cuisine
                ? `📍 Looks like a restaurant — cuisine and place type filled in for you.`
                : '📍 Looks like a restaurant — place type filled in for you.';
            } else {
              geoStatus.textContent = '📍 Location added — feel free to edit it.';
            }
          }
        } catch (e) {
          placeAddressInput.value = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
          showAddressField();
          geoStatus.textContent = "📍 Got your coordinates, but couldn't look up the address — tweak it below.";
        }
        if (placeNameInput.value.trim()) showPlaceTypeSection();
        updateContinueState();
        scheduleSave();
        resetGeoButton();
      },
      (err) => {
        geoStatus.textContent = geoErrorMessage(err);
        resetGeoButton();
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  });

  function restoreFromStorage() {
    const existing = BiteBookStorage.getEntry(entryId);
    if (!existing) return;
    createdAt = existing.createdAt;

    if (existing.placeName) {
      placeNameInput.value = existing.placeName;
      showPlaceTypeSection();
    }
    if (existing.placeAddress) {
      placeAddressInput.value = existing.placeAddress;
      showAddressField();
    }
    if (existing.placeSource) placeSource = existing.placeSource;
    if (existing.coords) coords = existing.coords;

    if (existing.placeType) {
      const known = Array.from(placeTypeChips).some((c) => c.dataset.value === existing.placeType);
      if (known) {
        selectPlaceTypeChip(existing.placeType);
      } else {
        selectPlaceTypeChip('other');
        placeTypeOtherInput.value = existing.placeType;
      }
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
    backBtn.href = `entry-when.html?id=${encodeURIComponent(entryId)}`;
    restoreFromStorage();
  }

  continueBtn.addEventListener('click', () => {
    saveNow();
    savedToast.classList.add('visible');
    continueBtn.disabled = true;
    setTimeout(() => {
      window.location.href = `entry-who.html?id=${encodeURIComponent(entryId)}`;
    }, 500);
  });

  document.getElementById('finish-later-btn').addEventListener('click', () => {
    saveNow();
    window.location.href = 'entries.html';
  });

});
