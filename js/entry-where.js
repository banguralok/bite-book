document.addEventListener('DOMContentLoaded', () => {
  const placeNameInput = document.getElementById('place-name');
  const placeNameSuggestions = document.getElementById('place-name-suggestions');
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
        populatePlaceSuggestions();
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

  const NEARBY_RADIUS_METERS = 250 * 1000; // ~250km — roughly "this state and its neighbors"

  function suggestionReferencePoint() {
    if (coords) return coords; // freshest signal: geolocation fetched earlier this visit
    const profile = (typeof BiteBookProfile !== 'undefined') ? BiteBookProfile.get() : null;
    return (profile && profile.homeCoords) || null;
  }

  // Only entries saved via "Use My Current Location" carry coords, so this
  // is necessarily partial — placeNames typed by hand have no known location.
  function mostRecentCoordsByPlace() {
    const map = {};
    BiteBookStorage.listEntries().forEach((e) => {
      if (e.placeName && e.coords && (!map[e.placeName] || e.updatedAt > map[e.placeName].updatedAt)) {
        map[e.placeName] = { lat: e.coords.lat, lon: e.coords.lon, updatedAt: e.updatedAt };
      }
    });
    return map;
  }

  function populatePlaceSuggestions() {
    const counts = {};
    const lastSeen = {};
    BiteBookStorage.listEntries().forEach((e) => {
      if (!e.placeName) return;
      counts[e.placeName] = (counts[e.placeName] || 0) + 1;
      if (!lastSeen[e.placeName] || e.updatedAt > lastSeen[e.placeName]) {
        lastSeen[e.placeName] = e.updatedAt;
      }
    });

    const byFrequency = (a, b) => (counts[b] - counts[a]) || (lastSeen[b] || '').localeCompare(lastSeen[a] || '');
    const ref = suggestionReferencePoint();
    let names;

    if (ref) {
      const coordsByPlace = mostRecentCoordsByPlace();
      const nearby = [];
      const unknownDistance = [];
      Object.keys(counts).forEach((name) => {
        const placeCoords = coordsByPlace[name];
        if (placeCoords) {
          const dist = distanceMeters(ref.lat, ref.lon, placeCoords.lat, placeCoords.lon);
          if (dist <= NEARBY_RADIUS_METERS) nearby.push({ name, dist });
          // farther than that isn't useful for quick typing here, so it's left out
        } else {
          unknownDistance.push(name);
        }
      });
      nearby.sort((a, b) => a.dist - b.dist);
      unknownDistance.sort(byFrequency);
      names = [...nearby.map((n) => n.name), ...unknownDistance];
    } else {
      // No home address saved and no location fetched yet this visit — can't
      // judge geography, so fall back to plain frequency/recency.
      names = Object.keys(counts).sort(byFrequency);
    }

    names = names.slice(0, 30);

    placeNameSuggestions.innerHTML = '';
    names.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      placeNameSuggestions.appendChild(opt);
    });
  }

  populatePlaceSuggestions();

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
