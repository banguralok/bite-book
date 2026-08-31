document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('profile-name');
  const avatarChips = document.querySelectorAll('#avatar-chips .chip');
  const birthdayInput = document.getElementById('profile-birthday');
  const anniversaryInput = document.getElementById('profile-anniversary');
  const homeAddressInput = document.getElementById('profile-home-address');
  const useHomeGeoBtn = document.getElementById('use-home-geo-btn');
  const homeGeoStatus = document.getElementById('home-geo-status');
  const saveBtn = document.getElementById('save-profile-btn');
  const savedToast = document.getElementById('saved-toast');

  const familyListEl = document.getElementById('family-list');
  const addFamilyBtn = document.getElementById('add-family-btn');
  const familyForm = document.getElementById('family-form');
  const relationshipChips = document.querySelectorAll('#relationship-chips .chip');
  const relationshipOtherWrap = document.getElementById('relationship-other-wrap');
  const relationshipOtherInput = document.getElementById('relationship-other');
  const familyNameInput = document.getElementById('family-name');
  const familyBirthdayInput = document.getElementById('family-birthday');
  const familyAnniversaryInput = document.getElementById('family-anniversary');
  const cancelFamilyBtn = document.getElementById('cancel-family-btn');
  const saveFamilyBtn = document.getElementById('save-family-btn');

  let selectedAvatar = null;
  let homeCoords = null;
  let familyMembers = [];
  let selectedRelationship = null;

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

  // ---------- Family members ----------

  function renderFamilyList() {
    familyListEl.innerHTML = '';
    familyMembers.forEach((member) => {
      const card = document.createElement('div');
      card.className = 'family-card';
      const relLabel = familyRelationshipLabel(member.relationship);
      const icon = relLabel ? relLabel.split(' ')[0] : '👤';
      const dates = [];
      if (member.birthday) dates.push(`🎂 ${monthDayLabel(member.birthday)}`);
      if (member.anniversary) dates.push(`💍 ${monthDayLabel(member.anniversary)}`);

      card.innerHTML = `
        <div class="family-card-icon">${icon}</div>
        <div class="family-card-info">
          <div class="family-card-name">${escapeHtmlProfile(familyMemberDisplayName(member))}</div>
          <div class="family-card-meta">${escapeHtmlProfile([relLabel.replace(/^[^ ]+ /, ''), ...dates].filter(Boolean).join(' · '))}</div>
        </div>
        <button type="button" class="entry-icon-btn" data-remove="${member.id}" aria-label="Remove ${escapeHtmlProfile(familyMemberDisplayName(member))}">🗑️</button>
      `;
      familyListEl.appendChild(card);
    });

    familyListEl.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        familyMembers = familyMembers.filter((m) => m.id !== btn.dataset.remove);
        renderFamilyList();
      });
    });
  }

  function escapeHtmlProfile(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function resetFamilyForm() {
    selectedRelationship = null;
    relationshipChips.forEach((c) => setChipSelected(c, false));
    relationshipOtherWrap.style.display = 'none';
    relationshipOtherInput.value = '';
    familyNameInput.value = '';
    familyBirthdayInput.value = '';
    familyAnniversaryInput.value = '';
  }

  addFamilyBtn.addEventListener('click', () => {
    resetFamilyForm();
    familyForm.style.display = 'block';
    addFamilyBtn.style.display = 'none';
  });

  cancelFamilyBtn.addEventListener('click', () => {
    familyForm.style.display = 'none';
    addFamilyBtn.style.display = 'inline-flex';
  });

  relationshipChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      selectedRelationship = chip.dataset.value;
      relationshipChips.forEach((c) => setChipSelected(c, c.dataset.value === selectedRelationship));
      relationshipOtherWrap.style.display = selectedRelationship === 'other' ? 'block' : 'none';
    });
  });

  saveFamilyBtn.addEventListener('click', () => {
    if (!selectedRelationship) return;
    const relationship = selectedRelationship === 'other'
      ? (relationshipOtherInput.value.trim() || 'other')
      : selectedRelationship;

    familyMembers.push({
      id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `f-${Date.now()}`,
      relationship,
      name: familyNameInput.value.trim() || null,
      birthday: familyBirthdayInput.value || null,
      anniversary: familyAnniversaryInput.value || null,
    });

    renderFamilyList();
    familyForm.style.display = 'none';
    addFamilyBtn.style.display = 'inline-flex';
  });

  // ---------- Load / Save ----------

  function restoreFromProfile() {
    const profile = BiteBookProfile.get();
    if (!profile) return;
    if (profile.name) nameInput.value = profile.name;
    if (profile.avatar) selectAvatar(profile.avatar);
    if (profile.birthday) birthdayInput.value = profile.birthday;
    if (profile.anniversary) anniversaryInput.value = profile.anniversary;
    if (profile.homeAddress) homeAddressInput.value = profile.homeAddress;
    if (profile.homeCoords) homeCoords = profile.homeCoords;
    if (profile.familyMembers) familyMembers = profile.familyMembers;
    renderFamilyList();
  }

  saveBtn.addEventListener('click', () => {
    const profile = {
      name: nameInput.value.trim() || null,
      avatar: selectedAvatar,
      birthday: birthdayInput.value || null,
      anniversary: anniversaryInput.value || null,
      homeAddress: homeAddressInput.value.trim() || null,
      homeCoords: homeAddressInput.value.trim() ? homeCoords : null,
      familyMembers,
      updatedAt: new Date().toISOString(),
    };
    BiteBookProfile.save(profile);
    savedToast.classList.add('visible');
    setTimeout(() => savedToast.classList.remove('visible'), 2000);
  });

  restoreFromProfile();
});
