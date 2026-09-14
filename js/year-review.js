// Year in Review — the calendar year, as a story.
//
// Deliberately a December moment rather than a rolling twelve months: it
// surfaces on its own from 15 December to 31 January, the way a wrapped-up
// year should, and stays quiet the rest of the time.
//
// The page itself is openable any time at year.html?year=2026, and the year
// picker lists every year with entries in it. That is not a hedge against
// the decision above — it is what makes the thing testable and demonstrable
// in September, when it would otherwise be three months of nothing.
//
// Everything here is computed from your own completed entries. Meals other
// people shared with you are not your year.
const BiteBookYear = (() => {
  const BANNER_FROM_MONTH = 11;   // December (0-indexed)
  const BANNER_FROM_DAY = 15;
  const BANNER_UNTIL_MONTH = 0;   // through the end of January
  const DISMISS_KEY = 'bitebook:yearBannerDismissed';

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  function escapeHtmlYear(str) {
    const div = document.createElement('div');
    div.textContent = (str === null || str === undefined) ? '' : String(str);
    return div.innerHTML;
  }

  function mineAndComplete(entries, myId) {
    return entries.filter((e) => (
      e.status === 'complete' && e.ateOn && (!myId || e.ownerId === myId)
    ));
  }

  function yearsWithEntries(entries) {
    const years = new Set(entries.map((e) => e.ateOn.slice(0, 4)));
    return Array.from(years).sort().reverse();
  }

  // Counts occurrences of a key across entries and returns the winner with
  // its count. Ties break on whichever was seen first, which is arbitrary but
  // stable — better than a result that changes between two page loads.
  function topOf(entries, keyFn) {
    const counts = new Map();
    entries.forEach((e) => {
      const raw = keyFn(e);
      const keys = Array.isArray(raw) ? raw : [raw];
      keys.filter(Boolean).forEach((k) => {
        const norm = String(k).trim();
        if (!norm) return;
        const existing = counts.get(norm.toLowerCase());
        counts.set(norm.toLowerCase(), {
          label: existing ? existing.label : norm,
          count: (existing ? existing.count : 0) + 1,
        });
      });
    });
    let best = null;
    counts.forEach((v) => { if (!best || v.count > best.count) best = v; });
    return best;
  }

  function companionNamesOf(entry) {
    const names = (typeof resolveFamilyMemberNames === 'function')
      ? resolveFamilyMemberNames(entry.companionFamilyIds)
      : [];
    const freeText = (entry.companionNames || '')
      .split(/[,&]| and /i)
      .map((s) => s.trim())
      .filter(Boolean);
    return names.concat(freeText);
  }

  function compute(entries, year, myId) {
    const all = mineAndComplete(entries, myId);
    const inYear = all.filter((e) => e.ateOn.slice(0, 4) === String(year));
    const byDate = inYear.slice().sort((a, b) => (a.ateOn < b.ateOn ? -1 : 1));

    const rated = inYear.filter((e) => e.rating);
    const avgRating = rated.length
      ? Math.round((rated.reduce((sum, e) => sum + e.rating, 0) / rated.length) * 10) / 10
      : null;

    const monthCounts = new Array(12).fill(0);
    inYear.forEach((e) => { monthCounts[parseDateInputValue(e.ateOn).getMonth()] += 1; });
    let busiestMonth = null;
    monthCounts.forEach((count, i) => {
      if (count > 0 && (!busiestMonth || count > busiestMonth.count)) {
        busiestMonth = { month: MONTH_NAMES[i], count };
      }
    });

    const streak = (typeof BiteBookStreak !== 'undefined')
      ? BiteBookStreak.compute(inYear.map((e) => e.ateOn))
      : { longest: 0 };

    const bestRated = rated.slice().sort((a, b) => (
      b.rating - a.rating || (a.ateOn < b.ateOn ? 1 : -1)
    ))[0] || null;

    return {
      year: String(year),
      meals: inYear.length,
      days: new Set(inYear.map((e) => e.ateOn)).size,
      places: new Set(inYear.map((e) => e.placeName).filter(Boolean).map((p) => p.toLowerCase())).size,
      cuisines: new Set(inYear.map((e) => e.cuisine).filter(Boolean)).size,
      trips: new Set(inYear.map((e) => e.tripId).filter(Boolean)).size,
      avgRating,
      longestStreak: streak.longest,
      topDish: topOf(inYear, (e) => e.food),
      topPlace: topOf(inYear, (e) => e.placeName),
      topCuisine: topOf(inYear, (e) => e.cuisine),
      topCompanion: topOf(inYear, companionNamesOf),
      busiestMonth,
      bestRated,
      firstMeal: byDate[0] || null,
      lastMeal: byDate[byDate.length - 1] || null,
      photos: inYear.map((e) => e.photos && e.photos[0]).filter(Boolean).slice(0, 6),
      entries: inYear,
    };
  }

  // ---------- the December banner ----------

  function bannerYear(today) {
    const m = today.getMonth();
    const d = today.getDate();
    if (m === BANNER_FROM_MONTH && d >= BANNER_FROM_DAY) return today.getFullYear();
    if (m === BANNER_UNTIL_MONTH) return today.getFullYear() - 1;
    return null;
  }

  function renderBanner(containerId, entries, myId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const year = bannerYear(new Date());
    let dismissed = null;
    try { dismissed = localStorage.getItem(DISMISS_KEY); } catch (err) { dismissed = null; }

    if (!year || dismissed === String(year)) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    const stats = compute(entries, year, myId);
    if (stats.meals === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.style.display = 'flex';
    container.innerHTML = `
      <div class="on-this-day-card">
        <div class="on-this-day-photo-placeholder">${BiteBookIcons.svg('calendar')}</div>
        <div class="on-this-day-info">
          <span class="on-this-day-label">Your year in food</span>
          <strong>${escapeHtmlYear(year)} — ${stats.meals} meal${stats.meals === 1 ? '' : 's'} worth remembering</strong>
          <span class="on-this-day-meta">${escapeHtmlYear(stats.places)} place${stats.places === 1 ? '' : 's'}, ${escapeHtmlYear(stats.days)} day${stats.days === 1 ? '' : 's'} with something logged</span>
        </div>
        <div class="on-this-day-actions">
          <a class="link-pill" href="year.html?year=${encodeURIComponent(year)}">See your year</a>
          <button type="button" class="dedupe-banner-dismiss" id="year-banner-dismiss" aria-label="Dismiss">✕</button>
        </div>
      </div>
    `;

    document.getElementById('year-banner-dismiss').addEventListener('click', () => {
      try { localStorage.setItem(DISMISS_KEY, String(year)); } catch (err) { /* fine */ }
      container.style.display = 'none';
    });
  }

  // ---------- the page ----------

  function tile(value, label) {
    return `<div class="stat-tile">
      <div class="stat-tile-value">${escapeHtmlYear(value)}</div>
      <div class="stat-tile-label">${escapeHtmlYear(label)}</div>
    </div>`;
  }

  function highlight(icon, label, headline, sub, href) {
    const inner = `
      <div class="on-this-day-photo-placeholder">${BiteBookIcons.svg(icon)}</div>
      <div class="on-this-day-info">
        <span class="on-this-day-label">${escapeHtmlYear(label)}</span>
        <strong>${escapeHtmlYear(headline)}</strong>
        ${sub ? `<span class="on-this-day-meta">${escapeHtmlYear(sub)}</span>` : ''}
      </div>
    `;
    return href
      ? `<a class="on-this-day-card" href="${href}">${inner}</a>`
      : `<div class="on-this-day-card">${inner}</div>`;
  }

  function renderPage(stats, availableYears) {
    const picker = document.getElementById('year-picker');
    if (picker) {
      picker.innerHTML = availableYears.map((y) => `
        <button type="button" class="chip small${y === stats.year ? ' selected' : ''}"
          aria-pressed="${y === stats.year}" data-year="${escapeHtmlYear(y)}">${escapeHtmlYear(y)}</button>
      `).join('');
      picker.querySelectorAll('[data-year]').forEach((chip) => {
        chip.addEventListener('click', () => {
          window.location.href = `year.html?year=${encodeURIComponent(chip.dataset.year)}`;
        });
      });
    }

    document.getElementById('year-heading').textContent = `Your ${stats.year} in food`;

    const emptyEl = document.getElementById('year-empty');
    const bodyEl = document.getElementById('year-body');
    if (stats.meals === 0) {
      emptyEl.style.display = 'block';
      bodyEl.style.display = 'none';
      return;
    }
    emptyEl.style.display = 'none';
    bodyEl.style.display = 'block';

    document.getElementById('year-tiles').innerHTML = [
      tile(stats.meals, 'Meals remembered'),
      tile(stats.days, 'Days with something logged'),
      tile(stats.places, 'Different places'),
      tile(stats.cuisines, 'Kinds of food'),
      tile(stats.avgRating === null ? '—' : stats.avgRating, 'Average rating'),
      tile(stats.longestStreak, 'Longest run of days'),
    ].join('');

    const cards = [];
    if (stats.topDish) {
      cards.push(highlight('plate', 'The dish you kept coming back to', stats.topDish.label,
        `Logged ${stats.topDish.count} time${stats.topDish.count === 1 ? '' : 's'}`));
    }
    if (stats.topPlace) {
      cards.push(highlight('pin', 'Your place of the year', stats.topPlace.label,
        `${stats.topPlace.count} visit${stats.topPlace.count === 1 ? '' : 's'}`));
    }
    if (stats.topCuisine) {
      cards.push(highlight('chart', 'What you reached for most', cuisineLabel(stats.topCuisine.label),
        `${stats.topCuisine.count} meal${stats.topCuisine.count === 1 ? '' : 's'}`));
    }
    if (stats.topCompanion) {
      cards.push(highlight('person', 'Who you ate with most', stats.topCompanion.label,
        `${stats.topCompanion.count} meal${stats.topCompanion.count === 1 ? '' : 's'} together`));
    }
    if (stats.busiestMonth) {
      cards.push(highlight('calendar', 'Your busiest month', stats.busiestMonth.month,
        `${stats.busiestMonth.count} meal${stats.busiestMonth.count === 1 ? '' : 's'} logged`));
    }
    if (stats.bestRated) {
      cards.push(highlight('star', 'The best thing you ate', stats.bestRated.food || 'One of them',
        [stats.bestRated.placeName, ratingStarsLabel(stats.bestRated.rating)].filter(Boolean).join(' · '),
        `entry-view.html?id=${encodeURIComponent(stats.bestRated.id)}`));
    }
    if (stats.trips > 0) {
      cards.push(highlight('suitcase', 'Trips with meals in them', `${stats.trips}`,
        'Each one has its own story', 'trips.html'));
    }
    if (stats.firstMeal) {
      cards.push(highlight('book', 'How the year started', stats.firstMeal.food || 'An untitled meal',
        formatDateLabel(stats.firstMeal.ateOn),
        `entry-view.html?id=${encodeURIComponent(stats.firstMeal.id)}`));
    }
    document.getElementById('year-highlights').innerHTML = cards.join('');

    const strip = document.getElementById('year-photos');
    if (stats.photos.length) {
      strip.style.display = 'grid';
      strip.innerHTML = stats.photos.map((p) => `<img src="${p.url}" alt="">`).join('');
    } else {
      strip.style.display = 'none';
    }
  }

  document.addEventListener('bitebook:ready', async () => {
    if (!document.getElementById('year-body')) return; // not the year page

    const myId = await BiteBookStorage.getCurrentUserId();
    const entries = await BiteBookStorage.listEntries();
    const mine = mineAndComplete(entries, myId);
    const years = yearsWithEntries(mine);

    const params = new URLSearchParams(window.location.search);
    const requested = params.get('year');
    const year = requested || years[0] || String(new Date().getFullYear());

    const stats = compute(entries, year, myId);
    renderPage(stats, years.length ? years : [year]);

    const shareBtn = document.getElementById('year-share-btn');
    shareBtn.disabled = stats.meals === 0;
    shareBtn.addEventListener('click', async () => {
      if (stats.meals === 0) return;
      shareBtn.disabled = true;
      const label = shareBtn.innerHTML;
      shareBtn.textContent = 'Preparing...';
      try {
        await BiteBookShare.shareYear(stats);
      } finally {
        setTimeout(() => {
          shareBtn.innerHTML = label;
          shareBtn.disabled = false;
        }, 1200);
      }
    });
  });

  return { compute, renderBanner, bannerYear, yearsWithEntries };
})();
