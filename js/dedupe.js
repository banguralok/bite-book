document.addEventListener('bitebook:ready', () => {
  const findBtn = document.getElementById('find-duplicates-btn');
  const statusEl = document.getElementById('dedupe-status');
  const groupsEl = document.getElementById('dedupe-groups');

  function escapeHtmlDedupe(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  async function placeNameCounts() {
    const counts = {};
    const entries = await BiteBookStorage.listEntries();
    entries.forEach((e) => {
      if (!e.placeName) return;
      counts[e.placeName] = (counts[e.placeName] || 0) + 1;
    });
    return counts;
  }

  function renderGroups(groups, counts) {
    groupsEl.innerHTML = '';
    if (groups.length === 0) {
      groupsEl.innerHTML = '<p class="stat-empty-note">No likely duplicates found — your place names look clean!</p>';
      return;
    }

    groups.forEach((group) => {
      const card = document.createElement('div');
      card.className = 'dedupe-group-card';

      const namesList = group.names
        .map((n) => `${escapeHtmlDedupe(n)} (${counts[n] || 0})`)
        .join(', ');

      card.innerHTML = `
        <div><strong>Might be the same place:</strong> ${namesList}</div>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <input type="text" class="text-input" value="${escapeHtmlDedupe(group.suggestedName)}" data-merge-name style="flex: 1; min-width: 180px;">
          <button type="button" class="btn btn-primary" data-merge-btn>Merge</button>
          <button type="button" class="btn btn-back" data-skip-btn>Skip</button>
        </div>
        <p class="upload-status" data-merge-status></p>
      `;
      groupsEl.appendChild(card);

      const mergeBtn = card.querySelector('[data-merge-btn]');
      const skipBtn = card.querySelector('[data-skip-btn]');
      const nameInput = card.querySelector('[data-merge-name]');
      const mergeStatus = card.querySelector('[data-merge-status]');

      mergeBtn.addEventListener('click', async () => {
        const canonicalName = nameInput.value.trim();
        if (!canonicalName) return;
        let count = 0;
        const entries = await BiteBookStorage.listEntries();
        for (const e of entries) {
          if (group.names.includes(e.placeName)) {
            e.placeName = canonicalName;
            await BiteBookStorage.saveEntry(e);
            count += 1;
          }
        }
        mergeStatus.textContent = `✅ Merged — updated ${count} ${count === 1 ? 'entry' : 'entries'}.`;
        mergeBtn.disabled = true;
        skipBtn.disabled = true;
        nameInput.disabled = true;
      });

      skipBtn.addEventListener('click', () => {
        card.style.opacity = '0.5';
        mergeBtn.disabled = true;
        skipBtn.disabled = true;
        nameInput.disabled = true;
      });
    });
  }

  findBtn.addEventListener('click', async () => {
    findBtn.disabled = true;
    findBtn.textContent = '✨ Thinking...';
    statusEl.textContent = '';
    statusEl.classList.remove('error');
    groupsEl.innerHTML = '';

    const counts = await placeNameCounts();
    const placeNames = Object.keys(counts);

    if (placeNames.length < 2) {
      statusEl.textContent = 'Not enough place names logged yet to check for duplicates.';
      findBtn.disabled = false;
      findBtn.textContent = '✨ Find Possible Duplicates';
      return;
    }

    try {
      const groups = await BiteBookAI.findDuplicatePlaces(placeNames);
      renderGroups(groups, counts);
    } catch (err) {
      statusEl.textContent = BiteBookAI.friendlyErrorMessage(err);
      statusEl.classList.add('error');
    } finally {
      findBtn.disabled = false;
      findBtn.textContent = '✨ Find Possible Duplicates';
    }
  });
});
