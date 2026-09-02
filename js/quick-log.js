document.addEventListener('bitebook:ready', async () => {
  const foodInput = document.getElementById('quick-food-name');
  const captureWhen = document.getElementById('capture-when');
  const captureWhere = document.getElementById('capture-where');
  const captureContextRow = document.getElementById('capture-context-row');
  const captureContext = document.getElementById('capture-context');
  const logItBtn = document.getElementById('log-it-btn');
  const savedToast = document.getElementById('saved-toast');

  const captured = {
    ateOn: toDateInputValue(new Date()),
    mealType: guessMealTypeFromTime(),
    timeOfDay: guessTimeOfDayFromTime(),
    placeName: null,
    placeAddress: null,
    placeType: null,
    madeBy: null,
    cuisine: null,
    coords: null,
  };

  captureWhen.textContent = `Today · ${mealTypeLabel(captured.mealType)} · ${timeOfDayLabel(captured.timeOfDay)}`;

  function showContext(message) {
    captureContext.textContent = message;
    captureContextRow.style.display = 'flex';
  }

  function updateContinueState() {
    logItBtn.disabled = !foodInput.value.trim();
  }

  foodInput.addEventListener('input', updateContinueState);
  foodInput.focus();

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        captured.coords = { lat, lon };

        try {
          const data = await reverseGeocodeLookup(lat, lon);
          const context = inferPlaceContext(data, captured.coords);

          if (context.isHome) {
            captured.placeType = 'home';
            const profile = BiteBookProfile.get();
            captured.placeName = (profile && profile.homeAddress) || 'Home';
            captureWhere.textContent = '🏠 Home';
            showContext("Looks like you're home — tagged accordingly.");
          } else {
            captured.placeName = placeNameFromGeocode(data);
            captured.placeAddress = shortAddressFromGeocode(data);
            captureWhere.textContent = captured.placeName
              ? `${captured.placeName} — ${captured.placeAddress}`
              : captured.placeAddress || 'Location found';

            if (context.placeType === 'restaurant') {
              captured.placeType = 'restaurant';
              captured.madeBy = 'chef-restaurant';
              if (context.cuisine) captured.cuisine = context.cuisine;
              showContext(
                context.cuisine
                  ? `Looks like a ${cuisineLabel(context.cuisine).replace(/^[^ ]+ /, '')} restaurant — tagged the chef as the maker.`
                  : 'Looks like a restaurant — tagged the chef as the maker.'
              );
            }
          }
        } catch (e) {
          captureWhere.textContent = `📍 ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }
      },
      () => {
        captureWhere.textContent = "Not available — that's okay, add it later.";
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  } else {
    captureWhere.textContent = "Not available on this device.";
  }

  logItBtn.addEventListener('click', async () => {
    const food = foodInput.value.trim();
    if (!food) return;

    const id = BiteBookStorage.newId();
    const now = new Date().toISOString();

    const entry = {
      id,
      food,
      mealType: captured.mealType,
      mealTypeAutoPicked: true,
      cuisine: captured.cuisine,
      ateOn: captured.ateOn,
      timeMode: 'fuzzy',
      timeOfDay: captured.timeOfDay,
      timeAutoPicked: true,
      placeName: captured.placeName,
      placeAddress: captured.placeAddress,
      placeType: captured.placeType,
      placeSource: captured.coords ? 'geolocation' : null,
      coords: captured.coords,
      madeBy: captured.madeBy,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    logItBtn.disabled = true;
    logItBtn.textContent = '⚡ Logging...';
    await BiteBookStorage.saveEntry(entry);
    savedToast.classList.add('visible');
    setTimeout(() => {
      window.location.href = 'entries.html';
    }, 900);
  });

  foodInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !logItBtn.disabled) {
      logItBtn.click();
    }
  });
});
