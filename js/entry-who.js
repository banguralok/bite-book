document.addEventListener('bitebook:ready', async () => {
  const companionChips = document.querySelectorAll('#companion-chips .chip');
  const companionOtherWrap = document.getElementById('companion-other-wrap');
  const companionOtherInput = document.getElementById('companion-other');
  const familyPickerSection = document.getElementById('section-family-picker');
  const familyPickerChipsEl = document.getElementById('family-picker-chips');
  const namesSection = document.getElementById('section-names');
  const addNamesLink = document.getElementById('add-names-link');
  const pickContactsLink = document.getElementById('pick-contacts-link');
  const namesWrap = document.getElementById('names-wrap');
  const companionNamesInput = document.getElementById('companion-names');
  const tagInviteWrap = document.getElementById('tag-invite-wrap');
  const tagInviteLabel = document.getElementById('tag-invite-label');
  const tagInviteList = document.getElementById('tag-invite-list');
  const backBtn = document.getElementById('back-btn');
  const continueBtn = document.getElementById('continue-btn');
  const savedToast = document.getElementById('saved-toast');
  const autosaveHint = document.getElementById('autosave-hint');

  let entryId = null;
  let createdAt = null;
  let cachedEntry = null;
  let hasInteracted = false;
  const selectedTypes = new Set();
  const selectedFamilyIds = new Set();
  const offeredInviteTargets = new Set(); // dedupe by phone/email across repeated contact picks

  const profile = BiteBookProfile.get();
  const familyMembers = (profile && profile.familyMembers) || [];

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
      companionTypes: Array.from(selectedTypes),
      companionFamilyIds: Array.from(selectedFamilyIds),
      companionDetail: companionOtherInput.value.trim() || null,
      companionNames: companionNamesInput.value.trim() || null,
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

  function isSoloOnly() {
    return selectedTypes.has('solo') && selectedTypes.size === 1;
  }

  function renderFamilyPickerChips() {
    familyPickerChipsEl.innerHTML = '';
    familyMembers.forEach((member) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.setAttribute('aria-pressed', 'false');
      chip.dataset.id = member.id;
      const relLabel = familyRelationshipLabel(member.relationship);
      const icon = relLabel ? relLabel.split(' ')[0] : '👤';
      chip.textContent = `${icon} ${familyMemberDisplayName(member)}`;
      chip.addEventListener('click', () => {
        hasInteracted = true;
        if (selectedFamilyIds.has(member.id)) {
          selectedFamilyIds.delete(member.id);
        } else {
          selectedFamilyIds.add(member.id);
        }
        setChipSelected(chip, selectedFamilyIds.has(member.id));
        scheduleSave();
      });
      familyPickerChipsEl.appendChild(chip);
    });
  }

  function updateFamilyPickerVisibility() {
    const shouldShow = familyMembers.length > 0 && selectedTypes.has('family');
    familyPickerSection.classList.toggle('visible', shouldShow);
  }

  function refreshUI() {
    companionChips.forEach((c) => setChipSelected(c, selectedTypes.has(c.dataset.value)));

    const wantsDetail = selectedTypes.has('other') || selectedTypes.has('big-group');
    companionOtherWrap.style.display = wantsDetail ? 'block' : 'none';
    if (!wantsDetail) companionOtherInput.value = '';

    updateFamilyPickerVisibility();

    if (isSoloOnly()) {
      namesSection.classList.remove('visible');
      namesWrap.style.display = 'none';
      companionNamesInput.value = '';
    } else if (selectedTypes.size > 0) {
      namesSection.classList.add('visible');
    } else {
      namesSection.classList.remove('visible');
    }

    updateContinueState();
  }

  function toggleChip(value) {
    hasInteracted = true;
    if (value === 'solo') {
      if (selectedTypes.has('solo')) {
        selectedTypes.delete('solo');
      } else {
        selectedTypes.clear();
        selectedTypes.add('solo');
      }
    } else {
      selectedTypes.delete('solo');
      if (selectedTypes.has(value)) {
        selectedTypes.delete(value);
      } else {
        selectedTypes.add(value);
      }
    }
    refreshUI();
  }

  function updateContinueState() {
    continueBtn.disabled = selectedTypes.size === 0;
  }

  companionChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      toggleChip(chip.dataset.value);
      scheduleSave();
    });
  });

  companionOtherInput.addEventListener('input', () => {
    scheduleSave();
  });

  addNamesLink.addEventListener('click', () => {
    namesWrap.style.display = 'block';
    companionNamesInput.focus();
  });

  // Tagging someone from your contacts is a separate question from telling
  // them about it — picking a name off your phone is not consent to send
  // that person anything. So this only ever offers a "let them know" row
  // per contact, never fires an invite on its own; sending still needs its
  // own explicit tap, same as the invite panel on entry-view.html.
  function renderInviteOffer(contact) {
    const target = contact.tel || contact.email;
    if (!target || offeredInviteTargets.has(target)) return;
    offeredInviteTargets.add(target);

    tagInviteWrap.style.display = 'block';
    tagInviteLabel.textContent = 'Let them know about this entry?';

    const row = document.createElement('div');
    row.className = 'invite-row';
    row.style.cssText = 'display:flex; align-items:center; gap:10px; flex-wrap:wrap;';
    row.innerHTML = `
      <span>${contact.name || target}</span>
      <button type="button" class="btn btn-back" data-send>✉️ Let Them Know</button>
      <button type="button" class="btn btn-back" data-skip>Not Now</button>
    `;
    tagInviteList.appendChild(row);

    row.querySelector('[data-skip]').addEventListener('click', () => row.remove());

    row.querySelector('[data-send]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const inviteId = await BiteBookStorage.createInvite({ entryId, phone: contact.tel || null, email: contact.tel ? null : contact.email });
      if (!inviteId) {
        row.innerHTML = `<span>${contact.name || target}</span> <span class="field-sublabel">⚠️ Something went wrong — try again from the entry later.</span>`;
        return;
      }
      const url = `${window.location.origin}/login.html?invite=${encodeURIComponent(inviteId)}`;
      const message = BiteBookInvite.buildMessage({
        senderName: BiteBookProfile.get().name,
        food: (cachedEntry && cachedEntry.food) || null,
        url,
      });
      BiteBookInvite.send({ phone: contact.tel || null, email: contact.tel ? null : contact.email, message });
      const via = contact.tel ? 'texted' : 'emailed';
      row.innerHTML = `<span>${contact.name || target}</span> <span class="field-sublabel">⏳ ${via} — waiting</span>`;
    });
  }

  // Chrome/Android only — same feature-detected Contact Picker API already
  // used to invite someone from js/invite.js, just picking several people
  // at once here instead of one.
  if (typeof BiteBookContacts !== 'undefined' && BiteBookContacts.isSupported()) {
    pickContactsLink.style.display = 'inline';
    pickContactsLink.addEventListener('click', async () => {
      pickContactsLink.disabled = true;
      const picked = await BiteBookContacts.pick({ multiple: true });
      pickContactsLink.disabled = false;
      const names = picked.map((c) => c.name).filter(Boolean);
      if (names.length === 0) return;

      hasInteracted = true;
      namesWrap.style.display = 'block';
      const existingNames = companionNamesInput.value
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      const merged = Array.from(new Set([...existingNames, ...names]));
      companionNamesInput.value = merged.join(', ');
      scheduleSave();

      if (typeof BiteBookInvite !== 'undefined' && entryId) {
        picked.forEach(renderInviteOffer);
      }
    });
  }

  companionNamesInput.addEventListener('input', () => {
    scheduleSave();
  });

  async function restoreFromStorage() {
    const existing = await BiteBookStorage.getEntry(entryId);
    if (!existing) return;
    cachedEntry = existing;
    createdAt = existing.createdAt;

    const types = existing.companionTypes || (existing.companionType ? [existing.companionType] : []);
    types.forEach((t) => selectedTypes.add(t));

    (existing.companionFamilyIds || []).forEach((id) => selectedFamilyIds.add(id));
    familyPickerChipsEl.querySelectorAll('.chip').forEach((chip) => {
      setChipSelected(chip, selectedFamilyIds.has(chip.dataset.id));
    });

    refreshUI();

    if (existing.companionDetail) companionOtherInput.value = existing.companionDetail;
    if (existing.companionNames) {
      companionNamesInput.value = existing.companionNames;
      namesWrap.style.display = 'block';
    }
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

  renderFamilyPickerChips();

  entryId = resolveEntryId();
  if (entryId) {
    backBtn.href = `entry-where.html?id=${encodeURIComponent(entryId)}`;
    await restoreFromStorage();
  }

  continueBtn.addEventListener('click', async () => {
    await saveNow();
    savedToast.classList.add('visible');
    continueBtn.disabled = true;
    setTimeout(() => {
      window.location.href = `entry-made.html?id=${encodeURIComponent(entryId)}`;
    }, 400);
  });

  document.getElementById('finish-later-btn').addEventListener('click', async () => {
    await saveNow();
    window.location.href = 'entries.html';
  });

});
