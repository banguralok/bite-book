// Search across meals, people and places — from anywhere in the app.
//
// Two things make this more than the box that already lives on My Entries.
// First it is present on every page, so a question that occurs to you while
// reading one meal doesn't cost a trip back to the list. Second, people and
// places are first-class results: clicking "Priya" shows every meal she was
// at, and clicking "Saffron" shows every meal eaten there — neither of which
// substring-matching a list of dish names can do.
//
// The index is built from entries, which are only fetched the first time
// someone actually types. A search box on every page must not mean a
// database round trip on every page.
const BiteBookSearch = (() => {
  const MAX_PER_GROUP = 5;

  let entries = null;
  let loading = null;
  let panel = null;
  let input = null;
  let activeIndex = -1;
  let currentResults = [];

  function escapeHtmlSearch(str) {
    const div = document.createElement('div');
    div.textContent = (str === null || str === undefined) ? '' : String(str);
    return div.innerHTML;
  }

  function ensureEntries() {
    if (entries) return Promise.resolve(entries);
    if (loading) return loading;
    loading = BiteBookStorage.listEntries()
      .then((rows) => { entries = rows; return entries; })
      .catch(() => { entries = []; return entries; });
    return loading;
  }

  // People come from three places, because a person can appear in an entry
  // three different ways: as a saved family member, as free text you typed
  // into "who were you with", or as whoever cooked it.
  function peopleIndex(rows) {
    const found = new Map();
    const add = (name) => {
      const clean = String(name || '').trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      found.set(key, { label: found.has(key) ? found.get(key).label : clean, count: (found.get(key) || { count: 0 }).count + 1 });
    };
    rows.forEach((e) => {
      if (typeof resolveFamilyMemberNames === 'function') {
        resolveFamilyMemberNames(e.companionFamilyIds).forEach(add);
      }
      (e.companionNames || '').split(/[,&]| and /i).forEach(add);
      if (e.madeByName) add(e.madeByName);
    });
    const profile = (typeof BiteBookProfile !== 'undefined') ? BiteBookProfile.get() : null;
    ((profile && profile.familyMembers) || []).forEach((m) => {
      const name = familyMemberDisplayName(m);
      if (name && !found.has(name.toLowerCase())) found.set(name.toLowerCase(), { label: name, count: 0 });
    });
    return Array.from(found.values());
  }

  function placesIndex(rows) {
    const found = new Map();
    rows.forEach((e) => {
      const clean = String(e.placeName || '').trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      const existing = found.get(key);
      found.set(key, { label: existing ? existing.label : clean, count: (existing ? existing.count : 0) + 1 });
    });
    return Array.from(found.values());
  }

  function mealText(entry) {
    return [entry.food, entry.placeName, entry.reflection, entry.ingredientsText,
      entry.madeByName, entry.companionNames].filter(Boolean).join(' ').toLowerCase();
  }

  function search(query) {
    const q = query.trim().toLowerCase();
    if (!q || !entries) return [];

    const meals = entries
      .filter((e) => mealText(e).includes(q))
      .slice(0, MAX_PER_GROUP)
      .map((e) => ({
        group: 'Meals',
        icon: 'plate',
        label: e.food || 'Untitled entry',
        sub: [e.placeName, e.ateOn ? formatDateLabel(e.ateOn) : null].filter(Boolean).join(' · '),
        href: e.status === 'complete'
          ? `entry-view.html?id=${encodeURIComponent(e.id)}`
          : `entry.html?id=${encodeURIComponent(e.id)}`,
      }));

    const people = peopleIndex(entries)
      .filter((p) => p.label.toLowerCase().includes(q))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_PER_GROUP)
      .map((p) => ({
        group: 'People',
        icon: 'person',
        label: p.label,
        sub: p.count ? `${p.count} meal${p.count === 1 ? '' : 's'} together` : 'No meals logged together yet',
        href: `entries.html?person=${encodeURIComponent(p.label)}`,
      }));

    const places = placesIndex(entries)
      .filter((p) => p.label.toLowerCase().includes(q))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_PER_GROUP)
      .map((p) => ({
        group: 'Places',
        icon: 'pin',
        label: p.label,
        sub: `${p.count} meal${p.count === 1 ? '' : 's'} here`,
        href: `entries.html?place=${encodeURIComponent(p.label)}`,
      }));

    return meals.concat(people, places);
  }

  function renderResults(results, query) {
    currentResults = results;
    activeIndex = -1;

    if (!query.trim()) {
      panel.style.display = 'none';
      panel.innerHTML = '';
      return;
    }

    if (results.length === 0) {
      panel.style.display = 'block';
      panel.innerHTML = `<p class="site-search-empty">Nothing matching “${escapeHtmlSearch(query)}”. Try a dish, a person or a place.</p>`;
      return;
    }

    let html = '';
    let lastGroup = null;
    results.forEach((r, i) => {
      if (r.group !== lastGroup) {
        html += `<div class="site-search-group">${escapeHtmlSearch(r.group)}</div>`;
        lastGroup = r.group;
      }
      html += `
        <a class="site-search-hit" href="${r.href}" data-index="${i}">
          <span class="site-search-hit-icon">${BiteBookIcons.svg(r.icon)}</span>
          <span class="site-search-hit-text">
            <strong>${escapeHtmlSearch(r.label)}</strong>
            ${r.sub ? `<span>${escapeHtmlSearch(r.sub)}</span>` : ''}
          </span>
        </a>
      `;
    });
    panel.style.display = 'block';
    panel.innerHTML = html;
  }

  function setActive(next) {
    const hits = panel.querySelectorAll('.site-search-hit');
    if (!hits.length) return;
    activeIndex = (next + hits.length) % hits.length;
    hits.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    hits[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  function attach() {
    const host = document.getElementById('site-search');
    if (!host) return;
    // A page that doesn't load the storage layer can't search anything, so
    // show nothing rather than a box that throws on the first keystroke.
    if (typeof BiteBookStorage === 'undefined' || typeof formatDateLabel === 'undefined') {
      host.style.display = 'none';
      return;
    }

    host.innerHTML = `
      <div class="site-search-inner">
        <span class="site-search-icon">${BiteBookIcons.svg('search')}</span>
        <input type="search" id="site-search-input" class="site-search-input"
          placeholder="Search meals, people and places..." autocomplete="off"
          aria-label="Search meals, people and places">
        <div class="site-search-panel" id="site-search-panel" style="display: none;"></div>
      </div>
    `;

    input = document.getElementById('site-search-input');
    panel = document.getElementById('site-search-panel');

    let debounce = null;
    const run = () => {
      const query = input.value;
      ensureEntries().then(() => renderResults(search(query), query));
    };

    input.addEventListener('focus', () => { ensureEntries(); });
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(run, 120);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIndex + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIndex - 1); }
      else if (e.key === 'Enter') {
        const hits = panel.querySelectorAll('.site-search-hit');
        if (activeIndex >= 0 && hits[activeIndex]) {
          e.preventDefault();
          window.location.href = hits[activeIndex].getAttribute('href');
        }
      } else if (e.key === 'Escape') {
        input.value = '';
        renderResults([], '');
        input.blur();
      }
    });

    // A click inside the panel is a result being chosen; anywhere else means
    // the person has moved on, so get out of their way.
    document.addEventListener('click', (e) => {
      if (!host.contains(e.target)) {
        panel.style.display = 'none';
      }
    });
  }

  document.addEventListener('bitebook:ready', attach);

  return { search, attach };
})();
