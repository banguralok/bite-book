// "Where should we eat?" — three tiers, each clearly labelled as what it is.
//
// The labelling is the feature, not decoration. A recommendation from your
// sister, a statistic from strangers, and a guess off the open web are three
// completely different kinds of claim, and an app that blends them into one
// ranked list is quietly lying about how much any of them is worth.
//
// Tier 2 never names anyone. The three-household floor is enforced in the
// database (migration 011), not here — a privacy rule written in JavaScript
// is a suggestion, since anyone can open the console and ignore it.
function escapeHtmlRec(str) {
  const div = document.createElement('div');
  div.textContent = (str === null || str === undefined) ? '' : String(str);
  return div.innerHTML;
}

function recCard(opts) {
  return `
    <div class="rec-card">
      <div class="rec-card-main">
        <strong class="rec-name">${escapeHtmlRec(opts.name)}</strong>
        ${opts.meta ? `<span class="rec-meta">${escapeHtmlRec(opts.meta)}</span>` : ''}
        ${opts.why ? `<p class="rec-why">${escapeHtmlRec(opts.why)}</p>` : ''}
        ${opts.link ? `<a class="rec-source" href="${escapeHtmlRec(opts.link.href)}" ${opts.link.external ? 'target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtmlRec(opts.link.label)}</a>` : ''}
      </div>
    </div>
  `;
}

function emptyRec(hostId, message) {
  const host = document.getElementById(hostId);
  if (host) host.innerHTML = `<p class="chart-empty">${escapeHtmlRec(message)}</p>`;
}

document.addEventListener('bitebook:ready', async () => {
  const cityInput = document.getElementById('rec-city');
  const wantInput = document.getElementById('rec-want');
  const goBtn = document.getElementById('rec-go');
  const status = document.getElementById('rec-status');
  const webHost = document.getElementById('rec-web');

  const myId = await BiteBookStorage.getCurrentUserId();
  const allVisible = await BiteBookStorage.listEntries();
  const wishes = await BiteBookStorage.listWishes();

  // Default the town to wherever they have been eating most recently, so the
  // page is useful before anyone types anything.
  const recent = (typeof BiteBookNudges !== 'undefined')
    ? BiteBookNudges.recentCities(allVisible.filter((e) => e.ownerId === myId), 45)
    : [];
  if (recent.length) cityInput.value = recent[0].city;

  function cityOf(entry) {
    if (entry.city) return entry.city;
    if (typeof cityFromSavedAddress === 'function') return cityFromSavedAddress(entry.placeAddress);
    return null;
  }

  // ---------- tier 1: your circle ----------
  // Two sources, both of which are somebody you know actually vouching:
  // a meal they shared with you and rated well, and a wish they put on your
  // list. Your own repeat visits count too — past you is in the circle.
  function renderCircle(city) {
    const host = document.getElementById('rec-circle');
    const wanted = (city || '').trim().toLowerCase();

    const directory = new Map();
    const cards = [];

    const shared = allVisible.filter((e) => (
      e.ownerId !== myId && e.status === 'complete' && e.placeName && (e.rating || 0) >= 4
      && (!wanted || String(cityOf(e) || '').toLowerCase() === wanted)
    ));
    const bySharedPlace = new Map();
    shared.forEach((e) => {
      const key = e.placeName.toLowerCase();
      if (!bySharedPlace.has(key)) bySharedPlace.set(key, { place: e.placeName, city: cityOf(e), best: e });
      const rec = bySharedPlace.get(key);
      if (e.rating > rec.best.rating) rec.best = e;
    });
    bySharedPlace.forEach((rec) => {
      cards.push(recCard({
        name: rec.place,
        meta: [rec.city, ratingStarsLabel(rec.best.rating)].filter(Boolean).join(' · '),
        why: 'Shared with you by someone in your circle.',
        link: { href: `entry-view.html?id=${encodeURIComponent(rec.best.id)}`, label: 'See their meal' },
      }));
    });

    wishes.filter((w) => w.status === 'open' && w.recommendedBy
      && (!wanted || String(w.city || '').toLowerCase() === wanted))
      .forEach((w) => {
        cards.push(recCard({
          name: w.title,
          meta: [w.city, 'on your list'].filter(Boolean).join(' · '),
          why: `${w.recommendedBy} recommended it${w.note ? ` — ${w.note}` : ''}.`,
          link: { href: 'wishlist.html', label: 'Open your list' },
        }));
      });

    const mineByPlace = new Map();
    allVisible.filter((e) => (
      e.ownerId === myId && e.status === 'complete' && e.placeName && (e.rating || 0) >= 4
      // "Where should we eat?" never means your own kitchen. Home is the
      // most-visited place in almost any journal, so without this it wins
      // the list every time and makes the whole page look broken.
      && e.placeType !== 'home'
      && (!wanted || String(cityOf(e) || '').toLowerCase() === wanted)
    )).forEach((e) => {
      const key = e.placeName.toLowerCase();
      if (!mineByPlace.has(key)) mineByPlace.set(key, { place: e.placeName, city: cityOf(e), visits: 0, total: 0 });
      const rec = mineByPlace.get(key);
      rec.visits += 1;
      rec.total += e.rating;
    });
    Array.from(mineByPlace.values())
      .filter((r) => r.visits >= 2)
      .sort((a, b) => (b.total / b.visits) - (a.total / a.visits) || b.visits - a.visits)
      .slice(0, 4)
      .forEach((r) => {
        cards.push(recCard({
          name: r.place,
          meta: [r.city, `${r.visits} visits`, ratingStarsLabel(Math.round(r.total / r.visits))].filter(Boolean).join(' · '),
          why: "You've been back more than once and rated it well.",
          link: { href: `entries.html?place=${encodeURIComponent(r.place)}`, label: 'Your meals there' },
        }));
      });

    if (!cards.length) {
      emptyRec('rec-circle', wanted
        ? `Nobody in your circle has logged anywhere in ${city} yet.`
        : 'Nothing from your circle yet — this fills up as people share meals and add to your list.');
      return;
    }
    host.innerHTML = `<div class="rec-list">${cards.slice(0, 8).join('')}</div>`;
  }

  // ---------- tier 2: other households, in aggregate ----------
  async function renderAggregate(city) {
    const host = document.getElementById('rec-aggregate');
    host.innerHTML = '<p class="chart-empty">Looking…</p>';

    let rows;
    try {
      rows = await BiteBookStorage.recommendedPlaces(city);
    } catch (err) {
      emptyRec('rec-aggregate', "Couldn't reach the shared ratings. If this is the first time, run supabase/migrations/011_recommendations.sql.");
      return;
    }

    if (!rows.length) {
      emptyRec('rec-aggregate', city
        ? `No place in ${city} has been logged by three different households yet. Below three it would say more about one family than about the restaurant, so nothing is shown.`
        : 'No place has been logged by three different households yet.');
      return;
    }

    host.innerHTML = `<div class="rec-list">${rows.map((r) => recCard({
      name: r.placeName,
      meta: [r.city, r.cuisine ? cuisineLabel(r.cuisine).replace(/^[^ ]+ /, '') : null,
        `${r.avgRating} average`].filter(Boolean).join(' · '),
      why: `Logged by ${r.households} different Bite Book households, ${r.meals} meals between them.`,
    })).join('')}</div>`;
  }

  // ---------- tier 3: the open web ----------
  async function renderWeb(city, want) {
    webHost.innerHTML = '<p class="chart-empty">Searching the web…</p>';
    let result;
    try {
      result = await BiteBookAI.findPlacesOnTheWeb(city, want);
    } catch (err) {
      webHost.innerHTML = `<p class="chart-empty">${escapeHtmlRec(BiteBookAI.friendlyErrorMessage(err))}</p>`;
      return;
    }

    if (!result.places.length) {
      webHost.innerHTML = `<p class="chart-empty">${escapeHtmlRec(result.note || 'Nothing useful came back.')}</p>`;
      return;
    }

    const sources = (result.sources || []).slice(0, 4)
      .map((s) => `<a href="${escapeHtmlRec(s.uri)}" target="_blank" rel="noopener noreferrer">${escapeHtmlRec(s.title)} ↗</a>`)
      .join(' · ');

    webHost.innerHTML = `
      <div class="rec-list">${result.places.map((p) => recCard({
        name: p.name,
        meta: p.cuisine,
        why: p.why,
      })).join('')}</div>
      ${sources ? `<p class="menu-sources">Found on: ${sources}</p>` : ''}
      <p class="menu-caution">From a web search, not from anyone you know. Worth checking it still exists before you set off.</p>
    `;
  }

  async function run() {
    const city = cityInput.value.trim();
    const want = wantInput.value.trim();
    status.textContent = '';
    status.classList.remove('error');
    renderCircle(city);
    await renderAggregate(city);
    // The web tier stays behind a button on purpose: it is the only tier that
    // costs an AI call, and the two free ones usually answer the question.
    webHost.innerHTML = `<button type="button" class="toggle-link" id="rec-web-btn"><span data-icon="search"></span> Search the web too</button>`;
    BiteBookIcons.hydrate(webHost);
    document.getElementById('rec-web-btn').addEventListener('click', () => renderWeb(city, want));
  }

  goBtn.addEventListener('click', run);
  cityInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  wantInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

  document.getElementById('rec-web-btn').addEventListener('click', () => {
    renderWeb(cityInput.value.trim(), wantInput.value.trim());
  });

  run();
});
