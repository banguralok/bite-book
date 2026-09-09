// "Want to Try" — the list of somedays.
//
// The point of this list is not the name of the restaurant. It is WHO told
// you and WHY, because that is the part that decays: six months later
// "Thai Basil" means nothing, but "Priya said the crab curry is the best
// she's had" is still a reason to go. Both fields are optional, but the
// form asks for them plainly rather than hiding them behind "add details".
//
// Marking something as tried does not delete it. It creates a draft entry,
// links the two, and moves the item to "already tried" — so the list keeps
// the record that a recommendation actually paid off.
function escapeHtmlWish(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

document.addEventListener('bitebook:ready', async () => {
  const addToggle = document.getElementById('add-wish-toggle');
  const addWrap = document.getElementById('add-wish-wrap');
  const kindChips = document.querySelectorAll('#wish-kind-chips .chip');
  const titleLabel = document.getElementById('wish-title-label');
  const titleInput = document.getElementById('wish-title');
  const placeWrap = document.getElementById('wish-place-wrap');
  const placeInput = document.getElementById('wish-place');
  const byInput = document.getElementById('wish-by');
  const peopleList = document.getElementById('wish-people');
  const noteInput = document.getElementById('wish-note');
  const saveBtn = document.getElementById('wish-save-btn');
  const statusEl = document.getElementById('wish-status');
  const openListEl = document.getElementById('wish-open-list');
  const emptyEl = document.getElementById('wish-empty');
  const doneSection = document.getElementById('wish-done-section');
  const doneToggle = document.getElementById('wish-done-toggle');
  const doneCount = document.getElementById('wish-done-count');
  const doneListEl = document.getElementById('wish-done-list');

  let kind = 'place';
  let wishes = [];

  // The people you might credit are the ones already in your world: your
  // family roster plus anyone in your Bite Book circle. Free text still
  // works — this is a convenience, not a restriction.
  function fillPeopleSuggestions() {
    const profile = BiteBookProfile.get();
    const names = new Set();
    ((profile && profile.familyMembers) || []).forEach((m) => {
      const name = familyMemberDisplayName(m);
      if (name) names.add(name);
    });
    BiteBookStorage.listDirectory().then((directory) => {
      directory.forEach((p) => { if (p.name) names.add(p.name); });
      peopleList.innerHTML = Array.from(names)
        .map((n) => `<option value="${escapeHtmlWish(n)}"></option>`).join('');
    }).catch(() => {
      peopleList.innerHTML = Array.from(names)
        .map((n) => `<option value="${escapeHtmlWish(n)}"></option>`).join('');
    });
  }

  function applyKind() {
    titleLabel.textContent = kind === 'dish' ? 'Which dish?' : 'Which place?';
    titleInput.placeholder = kind === 'dish'
      ? "e.g. Mum's mutton curry"
      : 'e.g. Thai Basil on Main St';
    placeWrap.style.display = kind === 'dish' ? 'block' : 'none';
  }

  kindChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      kind = chip.dataset.value;
      kindChips.forEach((c) => setChipSelected(c, c === chip));
      applyKind();
    });
  });

  addToggle.addEventListener('click', () => {
    const isOpen = addWrap.style.display !== 'none';
    addWrap.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) titleInput.focus();
  });

  doneToggle.addEventListener('click', () => {
    const isOpen = doneListEl.style.display !== 'none';
    doneListEl.style.display = isOpen ? 'none' : 'flex';
  });

  function wishCard(wish) {
    const kindLabel = wish.kind === 'dish' ? 'Dish' : 'Place';
    const bits = [];
    if (wish.kind === 'dish' && wish.placeName) bits.push(`At ${wish.placeName}`);
    if (wish.recommendedBy) bits.push(`From ${wish.recommendedBy}`);

    const actions = wish.status === 'open'
      ? `<button type="button" class="entry-icon-btn" title="I went — start an entry" aria-label="Log &quot;${escapeHtmlWish(wish.title)}&quot;" data-log="${escapeHtmlWish(wish.id)}">${BiteBookIcons.svg('check')}</button>
         <button type="button" class="entry-icon-btn" title="Remove from the list" aria-label="Remove &quot;${escapeHtmlWish(wish.title)}&quot;" data-remove="${escapeHtmlWish(wish.id)}">${BiteBookIcons.svg('trash')}</button>`
      : `<button type="button" class="entry-icon-btn" title="Put it back on the list" aria-label="Reopen &quot;${escapeHtmlWish(wish.title)}&quot;" data-reopen="${escapeHtmlWish(wish.id)}">${BiteBookIcons.svg('repeat')}</button>`;

    const link = (wish.status === 'done' && wish.entryId)
      ? `<a class="link-pill" href="entry-view.html?id=${encodeURIComponent(wish.entryId)}">See the meal</a>`
      : '';

    return `
      <div class="entry-card">
        <div class="entry-card-main" style="padding: 16px 18px;">
          <h3>${escapeHtmlWish(wish.title)}</h3>
          <div class="entry-card-tags">
            <span class="entry-tag">${wish.kind === 'dish' ? BiteBookIcons.svg('plate') : BiteBookIcons.svg('pin')} ${kindLabel}</span>
            ${bits.map((b) => `<span class="entry-tag">${escapeHtmlWish(b)}</span>`).join('')}
          </div>
          ${wish.note ? `<p class="story-quote" style="margin: 10px 0 0;">${escapeHtmlWish(wish.note)}</p>` : ''}
          ${link ? `<div style="margin-top: 10px;">${link}</div>` : ''}
        </div>
        <div class="entry-card-actions">${actions}</div>
      </div>
    `;
  }

  function render() {
    const open = wishes.filter((w) => w.status === 'open');
    const done = wishes.filter((w) => w.status === 'done');

    openListEl.innerHTML = open.map(wishCard).join('');
    openListEl.style.display = open.length ? 'flex' : 'none';
    emptyEl.style.display = open.length ? 'none' : 'block';

    doneSection.style.display = done.length ? 'block' : 'none';
    doneCount.textContent = done.length ? `(${done.length})` : '';
    doneListEl.innerHTML = done.map(wishCard).join('');

    document.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const wish = wishes.find((w) => w.id === btn.dataset.remove);
        if (!wish) return;
        if (!window.confirm(`Remove "${wish.title}" from the list?`)) return;
        btn.disabled = true;
        await BiteBookStorage.deleteWish(wish.id);
        wishes = wishes.filter((w) => w.id !== wish.id);
        render();
      });
    });

    document.querySelectorAll('[data-log]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const wish = wishes.find((w) => w.id === btn.dataset.log);
        if (!wish) return;
        btn.disabled = true;
        const entryId = await BiteBookStorage.logWish(wish);
        if (!entryId) {
          btn.disabled = false;
          statusEl.textContent = "⚠️ Couldn't start that entry — try again.";
          statusEl.classList.add('error');
          return;
        }
        if (typeof BiteBookTrack !== 'undefined') {
          BiteBookTrack.event('wish_logged', { kind: wish.kind });
        }
        window.location.href = `entry.html?id=${encodeURIComponent(entryId)}`;
      });
    });

    document.querySelectorAll('[data-reopen]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const ok = await BiteBookStorage.reopenWish(btn.dataset.reopen);
        if (!ok) { btn.disabled = false; return; }
        wishes = await BiteBookStorage.listWishes();
        render();
      });
    });
  }

  saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) {
      statusEl.textContent = kind === 'dish' ? 'Give the dish a name first.' : 'Give the place a name first.';
      statusEl.classList.add('error');
      titleInput.focus();
      return;
    }
    saveBtn.disabled = true;
    const label = saveBtn.textContent;
    saveBtn.textContent = 'Adding...';
    statusEl.textContent = '';
    statusEl.classList.remove('error');

    const created = await BiteBookStorage.createWish({
      kind,
      title,
      placeName: kind === 'dish' ? (placeInput.value.trim() || null) : null,
      recommendedBy: byInput.value.trim() || null,
      note: noteInput.value.trim() || null,
    });

    saveBtn.disabled = false;
    saveBtn.textContent = label;

    if (!created) {
      statusEl.textContent = "⚠️ Couldn't save that. If this is the first time, run supabase/migrations/008_wishlist.sql in the Supabase SQL editor.";
      statusEl.classList.add('error');
      return;
    }

    if (typeof BiteBookTrack !== 'undefined') {
      BiteBookTrack.event('wish_added', { kind: created.kind });
    }
    wishes.unshift(created);
    titleInput.value = '';
    placeInput.value = '';
    byInput.value = '';
    noteInput.value = '';
    titleInput.focus();
    render();
  });

  applyKind();
  fillPeopleSuggestions();
  wishes = await BiteBookStorage.listWishes();
  render();
});
