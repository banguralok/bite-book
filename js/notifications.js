function escapeHtmlNotif(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

document.addEventListener('bitebook:ready', async () => {
  const listEl = document.getElementById('notifications-list');
  const emptyEl = document.getElementById('notifications-empty');

  function maybeShowEmpty() {
    if (listEl.children.length === 0) {
      listEl.style.display = 'none';
      emptyEl.style.display = 'block';
    }
  }

  const notifications = (await BiteBookStorage.getNotifications()).filter((n) => n.status === 'pending');

  if (notifications.length === 0) {
    listEl.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }

  listEl.style.display = 'flex';
  emptyEl.style.display = 'none';

  for (const n of notifications) {
    const card = document.createElement('div');
    card.className = 'dedupe-group-card';

    if (n.type === 'missing_details') {
      card.innerHTML = `
        <div>ℹ️ ${escapeHtmlNotif(n.message)}</div>
        <div><button type="button" class="btn btn-back" data-dismiss>Got it</button></div>
      `;
      card.querySelector('[data-dismiss]').addEventListener('click', async () => {
        await BiteBookStorage.updateNotificationStatus(n.id, 'dismissed');
        card.remove();
        maybeShowEmpty();
      });
      listEl.appendChild(card);
      continue;
    }

    const mine = await BiteBookStorage.getEntry(n.entryId);
    const theirSig = await BiteBookStorage.getEntrySignature(n.otherEntryId);
    if (!mine || !theirSig) continue; // resolved already elsewhere

    const iAmOlder = new Date(mine.createdAt) <= new Date(theirSig.created_at);
    const whenLabel = mine.ateOn ? formatDateLabel(mine.ateOn) : '';

    if (iAmOlder) {
      card.innerHTML = `
        <div><strong>${escapeHtmlNotif(mine.food || 'Untitled entry')}</strong> at ${escapeHtmlNotif(mine.placeName || '')}${whenLabel ? ` — ${escapeHtmlNotif(whenLabel)}` : ''}</div>
        <div>${escapeHtmlNotif(n.message)}</div>
        <p class="stat-empty-note">Yours looks like the original — the other person has been notified about theirs.</p>
        <div><button type="button" class="btn btn-back" data-not-dup>Not a duplicate</button></div>
      `;
      card.querySelector('[data-not-dup]').addEventListener('click', async () => {
        await BiteBookStorage.updateNotificationStatus(n.id, 'dismissed');
        card.remove();
        maybeShowEmpty();
      });
    } else {
      card.innerHTML = `
        <div><strong>${escapeHtmlNotif(mine.food || 'Untitled entry')}</strong> at ${escapeHtmlNotif(mine.placeName || '')}${whenLabel ? ` — ${escapeHtmlNotif(whenLabel)}` : ''}</div>
        <div>${escapeHtmlNotif(n.message)}</div>
        <p class="stat-empty-note">The other entry was logged first — it'll stay as the record of this meal.</p>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button type="button" class="btn btn-primary" data-remove>🗑️ Remove My Entry</button>
          <button type="button" class="btn btn-back" data-not-dup>Not a duplicate</button>
        </div>
        <p class="upload-status" data-status></p>
      `;
      const statusEl = card.querySelector('[data-status]');

      card.querySelector('[data-remove]').addEventListener('click', async () => {
        const ok = window.confirm(
          "Remove your entry? Your rating, reflection, and any photos on this entry are yours alone and will be gone — only the earlier entry will remain (and you'll keep access to it)."
        );
        if (!ok) return;
        const grantShare = n.type === 'possible_duplicate_unshared';
        const success = await BiteBookStorage.resolveDuplicateByRemovingMine(n.entryId, n.otherEntryId, grantShare);
        if (success) {
          card.remove();
          maybeShowEmpty();
        } else {
          statusEl.textContent = '⚠️ Something went wrong — try again.';
        }
      });

      card.querySelector('[data-not-dup]').addEventListener('click', async () => {
        await BiteBookStorage.updateNotificationStatus(n.id, 'dismissed');
        card.remove();
        maybeShowEmpty();
      });
    }

    listEl.appendChild(card);
  }

  maybeShowEmpty();
});
