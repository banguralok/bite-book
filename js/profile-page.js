document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('profile-name');
  const avatarChips = document.querySelectorAll('#avatar-chips .chip');
  const homeAddressInput = document.getElementById('profile-home-address');
  const useHomeGeoBtn = document.getElementById('use-home-geo-btn');
  const homeGeoStatus = document.getElementById('home-geo-status');
  const saveBtn = document.getElementById('save-profile-btn');
  const savedToast = document.getElementById('saved-toast');

  let selectedAvatar = null;
  let homeCoords = null;

  function selectAvatar(value) {
    selectedAvatar = value;
    avatarChips.forEach((c) => setChipSelected(c, c.dataset.value === value));
  }

  avatarChips.forEach((chip) => {
    chip.addEventListener('click', () => selectAvatar(chip.dataset.value));
  });

  function resetGeoButton() {
    useHomeGeoBtn.disabled = false;
    useHomeGeoBtn.textContent = '📍 Set From My Current Location';
  }

  useHomeGeoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      homeGeoStatus.textContent = "Geolocation isn't available here — just type your address instead.";
      return;
    }
    useHomeGeoBtn.disabled = true;
    useHomeGeoBtn.textContent = '📍 Locating...';
    homeGeoStatus.textContent = '';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        homeCoords = { lat, lon };
        try {
          const data = await reverseGeocodeLookup(lat, lon);
          homeAddressInput.value = shortAddressFromGeocode(data);
          homeGeoStatus.textContent = '📍 Home location set — feel free to edit the address.';
        } catch (e) {
          homeAddressInput.value = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
          homeGeoStatus.textContent = "📍 Got your coordinates, but couldn't look up the address.";
        }
        resetGeoButton();
      },
      (err) => {
        const messages = {
          1: "No worries — permission wasn't given, just type your address in below.",
          2: "Couldn't pin your location — just type your address in below.",
          3: "That took too long — just type your address in below.",
        };
        homeGeoStatus.textContent = messages[err && err.code] || "Couldn't get your location — just type your address in below.";
        resetGeoButton();
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  });

  function restoreFromProfile() {
    const profile = BiteBookProfile.get();
    if (!profile) return;
    if (profile.name) nameInput.value = profile.name;
    if (profile.avatar) selectAvatar(profile.avatar);
    if (profile.homeAddress) homeAddressInput.value = profile.homeAddress;
    if (profile.homeCoords) homeCoords = profile.homeCoords;
  }

  saveBtn.addEventListener('click', () => {
    const profile = {
      name: nameInput.value.trim() || null,
      avatar: selectedAvatar,
      homeAddress: homeAddressInput.value.trim() || null,
      homeCoords: homeAddressInput.value.trim() ? homeCoords : null,
      updatedAt: new Date().toISOString(),
    };
    BiteBookProfile.save(profile);
    savedToast.classList.add('visible');
    setTimeout(() => savedToast.classList.remove('visible'), 2000);
  });

  restoreFromProfile();
});
