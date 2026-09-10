// Your Patterns — the heat map page.
//
// Colour is doing two different jobs here and they use two different palettes,
// which is the whole reason this page looks calm rather than busy:
//
//   MAGNITUDE (how much) → one orange hue, light to dark. Every heat cell and
//   every ranked bar uses it. A bar's length already says which is biggest, so
//   the bars are all ONE colour — colouring them by value would spend the
//   identity channel re-stating what length shows.
//
//   IDENTITY (which cuisine) → five fixed hues in a fixed order, never cycled.
//   A sixth cuisine folds into "Other" in grey rather than inventing a hue that
//   nobody could tell from the first five.
//
// Both palettes were checked with a validator rather than by eye: the ramp for
// monotone lightness, visible step gaps and a light end that clears the cream
// background; the five hues for colourblind separation, chroma and contrast.
// The hexes live in css/style.css as --heat-* and --cat-* so they are stated
// once. Don't nudge them by hand — re-run the checks.
//
// Everything is clickable. That is the point of the page: it is a way INTO the
// meals, not a wall of numbers about them.
const BiteBookPatterns = (() => {
  const TIME_BUCKETS = ['early-morning', 'morning', 'midday', 'afternoon', 'evening', 'night', 'late-night'];
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MAX_CUISINE_SERIES = 5;

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = (str === null || str === undefined) ? '' : String(str);
    return div.innerHTML;
  }

  // ---------- reading an entry ----------

  // timeOfDay is the recorded answer; exactTime and mealType are fallbacks, so
  // an entry logged through Quick Log still lands somewhere sensible.
  function timeBucketOf(entry) {
    if (entry.timeOfDay && TIME_BUCKETS.includes(entry.timeOfDay)) return entry.timeOfDay;
    if (entry.exactTime) {
      const hour = Number(String(entry.exactTime).slice(0, 2));
      if (!Number.isNaN(hour)) {
        if (hour < 7) return 'early-morning';
        if (hour < 11) return 'morning';
        if (hour < 14) return 'midday';
        if (hour < 17) return 'afternoon';
        if (hour < 21) return 'evening';
        if (hour < 23) return 'night';
        return 'late-night';
      }
    }
    const byMeal = {
      breakfast: 'morning', lunch: 'midday', 'high-tea': 'afternoon',
      dinner: 'evening', supper: 'night', snack: 'afternoon', 'light-munching': 'afternoon',
    };
    return byMeal[entry.mealType] || null;
  }

  function cityOf(entry) {
    if (entry.city) return entry.city;
    if (typeof cityFromSavedAddress === 'function') return cityFromSavedAddress(entry.placeAddress);
    return null;
  }

  // Splits "coffee and a lassi" into two drinks. A blunt rule, but it beats
  // treating the whole phrase as one thing nobody will ever match again.
  function drinksOf(entry) {
    if (!entry.drinks) return [];
    return String(entry.drinks)
      .split(/[,;]| and /i)
      .map((d) => d.trim())
      .filter(Boolean);
  }

  // ---------- counting ----------

  function tally(entries, keyFn) {
    const counts = new Map();
    entries.forEach((e) => {
      const raw = keyFn(e);
      const keys = Array.isArray(raw) ? raw : [raw];
      keys.filter(Boolean).forEach((k) => {
        const label = String(k).trim();
        if (!label) return;
        const id = label.toLowerCase();
        const existing = counts.get(id);
        counts.set(id, { label: existing ? existing.label : label, count: (existing ? existing.count : 0) + 1 });
      });
    });
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }

  // Five fixed levels, by count rather than by quantile — a quantile scale
  // would make "one meal" look dark on a quiet month, which is a lie.
  function heatLevel(count) {
    if (!count) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count === 3) return 3;
    if (count === 4) return 4;
    return 5;
  }

  // ---------- shared chart furniture ----------

  const tip = () => document.getElementById('chart-tip');

  function bindTip(el, text) {
    const show = (e) => {
      const t = tip();
      t.textContent = text;
      t.classList.add('visible');
      const r = el.getBoundingClientRect();
      t.style.left = `${Math.round(r.left + r.width / 2)}px`;
      t.style.top = `${Math.round(r.top + window.scrollY - 10)}px`;
    };
    const hide = () => tip().classList.remove('visible');
    el.addEventListener('mouseenter', show);
    el.addEventListener('focus', show);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('blur', hide);
  }

  // Every chart ships a table twin, so no value is reachable only by hovering.
  function tableToggle(hostEl, headers, rows) {
    const wrap = document.createElement('div');
    wrap.className = 'chart-table-wrap';
    wrap.innerHTML = `
      <button type="button" class="toggle-link chart-table-btn">Show the numbers</button>
      <div class="insights-table-wrap chart-table" style="display: none;">
        <table class="insights-table">
          <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    `;
    const btn = wrap.querySelector('.chart-table-btn');
    const table = wrap.querySelector('.chart-table');
    btn.addEventListener('click', () => {
      const open = table.style.display !== 'none';
      table.style.display = open ? 'none' : 'block';
      btn.textContent = open ? 'Show the numbers' : 'Hide the numbers';
    });
    hostEl.appendChild(wrap);
  }

  function emptyNote(hostEl, message) {
    hostEl.innerHTML = `<p class="chart-empty">${esc(message)}</p>`;
  }

  // ---------- ranked bars ----------
  // One hue for every bar. Length is the comparison; colour would be noise.

  function renderRanked(hostId, rows, opts) {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = '';
    if (!rows.length) {
      emptyNote(host, opts.empty);
      return;
    }

    const top = rows.slice(0, 8);
    const max = top[0].count;
    const chart = document.createElement('div');
    chart.className = 'bar-rows';
    top.forEach((row) => {
      const pct = Math.max(2, Math.round((row.count / max) * 100));
      const item = document.createElement('a');
      item.className = 'bar-row';
      item.href = opts.hrefFor(row);
      const shown = opts.displayFor ? opts.displayFor(row) : row.label;
      item.innerHTML = `
        <span class="bar-row-label">${esc(shown)}</span>
        <span class="bar-row-track"><span class="bar-row-fill" style="width: ${pct}%;"></span></span>
        <span class="bar-row-value">${row.count}</span>
      `;
      bindTip(item, `${shown} — ${row.count} ${row.count === 1 ? 'meal' : 'meals'}`);
      chart.appendChild(item);
    });
    host.appendChild(chart);
    tableToggle(host, [opts.header, 'Meals'],
      rows.map((r) => [opts.displayFor ? opts.displayFor(r) : r.label, r.count]));
  }

  // ---------- the calendar heat map ----------

  function renderCalendar(hostId, entries, year) {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = '';

    const perDay = new Map();
    entries.forEach((e) => {
      if (!e.ateOn) return;
      perDay.set(e.ateOn, (perDay.get(e.ateOn) || 0) + 1);
    });

    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    // Back up to the Sunday on or before 1 January so every column is a full week.
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() - cursor.getDay());

    const columns = [];
    const monthMarks = [];
    let lastMonth = -1;
    while (cursor <= end) {
      const column = [];
      for (let d = 0; d < 7; d += 1) {
        const inYear = cursor >= start && cursor <= end;
        const key = toDateInputValue(cursor);
        column.push(inYear ? { key, date: new Date(cursor), count: perDay.get(key) || 0 } : null);
        cursor.setDate(cursor.getDate() + 1);
      }
      const firstReal = column.find(Boolean);
      if (firstReal && firstReal.date.getMonth() !== lastMonth) {
        lastMonth = firstReal.date.getMonth();
        monthMarks.push({ index: columns.length, label: MONTH_SHORT[lastMonth] });
      }
      columns.push(column);
    }

    const grid = document.createElement('div');
    grid.className = 'cal-heat';
    grid.innerHTML = `
      <div class="cal-months">${monthMarks.map((m) => `<span class="cal-month" style="grid-column: ${m.index + 1};">${m.label}</span>`).join('')}</div>
      <div class="cal-body">
        <div class="cal-daynames">${[1, 3, 5].map((i) => `<span style="grid-row: ${i + 1};">${DAY_NAMES[i]}</span>`).join('')}</div>
        <div class="cal-cells" id="${hostId}-cells"></div>
      </div>
    `;
    host.appendChild(grid);

    const cells = grid.querySelector('.cal-cells');
    cells.style.gridTemplateColumns = `repeat(${columns.length}, 1fr)`;
    grid.querySelector('.cal-months').style.gridTemplateColumns = `repeat(${columns.length}, 1fr)`;

    columns.forEach((column, colIndex) => {
      column.forEach((day, rowIndex) => {
        if (!day) {
          const blank = document.createElement('span');
          blank.className = 'cal-cell cal-cell-void';
          blank.style.gridColumn = colIndex + 1;
          blank.style.gridRow = rowIndex + 1;
          cells.appendChild(blank);
          return;
        }
        const level = heatLevel(day.count);
        const cell = document.createElement(day.count ? 'a' : 'span');
        cell.className = `cal-cell heat-${level}`;
        cell.style.gridColumn = colIndex + 1;
        cell.style.gridRow = rowIndex + 1;
        if (day.count) {
          cell.href = `entries.html?date=${encodeURIComponent(day.key)}`;
          cell.setAttribute('aria-label', `${formatDateLabel(day.key)}: ${day.count} logged`);
        }
        bindTip(cell, day.count
          ? `${formatDateLabel(day.key)} — ${day.count} logged`
          : `${formatDateLabel(day.key)} — nothing logged`);
        cells.appendChild(cell);
      });
    });

    const legend = document.createElement('div');
    legend.className = 'heat-legend';
    legend.innerHTML = `
      <span>Nothing</span>
      ${[0, 1, 2, 3, 4, 5].map((l) => `<span class="heat-swatch heat-${l}"></span>`).join('')}
      <span>5 or more</span>
    `;
    host.appendChild(legend);

    const busiest = Array.from(perDay.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    tableToggle(host, ['Day', 'Logged'], busiest.map(([k, v]) => [formatDateLabel(k), v]));
  }

  // ---------- day of week × time of day ----------

  function renderRhythm(hostId, entries) {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = '';

    const counts = new Map();
    let any = false;
    entries.forEach((e) => {
      const bucket = timeBucketOf(e);
      if (!bucket || !e.ateOn) return;
      const day = parseDateInputValue(e.ateOn).getDay();
      const key = `${day}|${bucket}`;
      counts.set(key, (counts.get(key) || 0) + 1);
      any = true;
    });

    if (!any) {
      emptyNote(host, 'Nothing logged with a time on it yet.');
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'rhythm-grid';
    grid.style.gridTemplateColumns = `auto repeat(${TIME_BUCKETS.length}, 1fr)`;

    grid.appendChild(document.createElement('span'));
    TIME_BUCKETS.forEach((bucket) => {
      const head = document.createElement('span');
      head.className = 'rhythm-head';
      head.textContent = timeOfDayLabel(bucket).replace(/^[^ ]+ /, '');
      grid.appendChild(head);
    });

    const rows = [];
    DAY_NAMES.forEach((dayName, dayIndex) => {
      const label = document.createElement('span');
      label.className = 'rhythm-day';
      label.textContent = dayName;
      grid.appendChild(label);

      TIME_BUCKETS.forEach((bucket) => {
        const count = counts.get(`${dayIndex}|${bucket}`) || 0;
        const cell = document.createElement('span');
        cell.className = `rhythm-cell heat-${heatLevel(count)}`;
        cell.tabIndex = 0;
        const readable = timeOfDayLabel(bucket).replace(/^[^ ]+ /, '');
        cell.setAttribute('aria-label', `${dayName}, ${readable}: ${count}`);
        bindTip(cell, `${dayName} · ${readable} — ${count} ${count === 1 ? 'meal' : 'meals'}`);
        grid.appendChild(cell);
        if (count) rows.push([dayName, readable, count]);
      });
    });

    host.appendChild(grid);
    tableToggle(host, ['Day', 'Time', 'Meals'], rows.sort((a, b) => b[2] - a[2]));
  }

  // ---------- cuisine, month by month ----------

  function renderCuisineMonths(hostId, entries) {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = '';

    const withCuisine = entries.filter((e) => e.cuisine && e.ateOn);
    if (withCuisine.length === 0) {
      emptyNote(host, "No cuisines recorded yet — they're filled in on the first step of an entry.");
      return;
    }

    // Five hues is the honest ceiling; the tail becomes "Other" rather than a
    // sixth colour nobody could distinguish.
    const ranked = tally(withCuisine, (e) => e.cuisine);
    const named = ranked.slice(0, MAX_CUISINE_SERIES).map((r) => r.label);
    const seriesKeys = named.concat(ranked.length > MAX_CUISINE_SERIES ? ['__other'] : []);

    const months = new Map();
    withCuisine.forEach((e) => {
      const d = parseDateInputValue(e.ateOn);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months.has(key)) months.set(key, {});
      const bucket = months.get(key);
      const seriesKey = named.includes(e.cuisine) ? e.cuisine : '__other';
      bucket[seriesKey] = (bucket[seriesKey] || 0) + 1;
    });

    const monthKeys = Array.from(months.keys()).sort();
    const max = Math.max(...monthKeys.map((k) => Object.values(months.get(k)).reduce((a, b) => a + b, 0)));

    const seriesLabel = (key) => (key === '__other' ? 'Other' : cuisineLabel(key).replace(/^[^ ]+ /, ''));
    const seriesClass = (key) => (key === '__other' ? 'cat-other' : `cat-${seriesKeys.indexOf(key) + 1}`);

    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    legend.innerHTML = seriesKeys.map((key) => `
      <span class="legend-item"><span class="legend-swatch ${seriesClass(key)}"></span>${esc(seriesLabel(key))}</span>
    `).join('');
    host.appendChild(legend);

    const chart = document.createElement('div');
    chart.className = 'stack-chart';
    monthKeys.forEach((key) => {
      const bucket = months.get(key);
      const total = Object.values(bucket).reduce((a, b) => a + b, 0);
      const col = document.createElement('div');
      col.className = 'stack-col';
      const [y, m] = key.split('-');

      const stack = document.createElement('div');
      stack.className = 'stack-bar';
      stack.style.height = `${Math.max(4, Math.round((total / max) * 100))}%`;
      seriesKeys.forEach((sk) => {
        const value = bucket[sk] || 0;
        if (!value) return;
        const seg = document.createElement('span');
        seg.className = `stack-seg ${seriesClass(sk)}`;
        seg.style.flexGrow = String(value);
        seg.tabIndex = 0;
        seg.setAttribute('aria-label', `${seriesLabel(sk)}, ${MONTH_SHORT[Number(m) - 1]} ${y}: ${value}`);
        bindTip(seg, `${MONTH_SHORT[Number(m) - 1]} ${y} · ${seriesLabel(sk)} — ${value}`);
        stack.appendChild(seg);
      });

      col.appendChild(stack);
      const label = document.createElement('span');
      label.className = 'stack-label';
      label.textContent = MONTH_SHORT[Number(m) - 1];
      col.appendChild(label);
      chart.appendChild(col);
    });
    host.appendChild(chart);

    const rows = [];
    monthKeys.forEach((key) => {
      const [y, m] = key.split('-');
      seriesKeys.forEach((sk) => {
        const v = months.get(key)[sk];
        if (v) rows.push([`${MONTH_SHORT[Number(m) - 1]} ${y}`, seriesLabel(sk), v]);
      });
    });
    tableToggle(host, ['Month', 'Kind of food', 'Meals'], rows);
  }

  return {
    timeBucketOf, cityOf, drinksOf, tally, heatLevel,
    renderRanked, renderCalendar, renderRhythm, renderCuisineMonths, esc,
  };
})();

// ---------- the page ----------

document.addEventListener('bitebook:ready', async () => {
  const P = BiteBookPatterns;
  const rangeChips = document.getElementById('range-chips');
  const placeGroup = document.getElementById('place-filter-group');
  const placeFilter = document.getElementById('place-filter');
  const tiles = document.getElementById('pattern-tiles');
  const emptyEl = document.getElementById('pattern-empty');
  const tabs = document.querySelectorAll('#lens-tabs .lens-tab');
  const panels = {
    rhythm: document.getElementById('lens-rhythm'),
    what: document.getElementById('lens-what'),
    where: document.getElementById('lens-where'),
  };

  const myId = await BiteBookStorage.getCurrentUserId();
  const all = (await BiteBookStorage.listEntries())
    .filter((e) => e.ownerId === myId && e.status === 'complete' && e.ateOn);

  if (all.length === 0) {
    emptyEl.style.display = 'block';
    document.getElementById('pattern-filters').style.display = 'none';
    document.getElementById('lens-tabs').style.display = 'none';
    Object.values(panels).forEach((p) => { p.hidden = true; });
    return;
  }

  const years = Array.from(new Set(all.map((e) => e.ateOn.slice(0, 4)))).sort().reverse();
  let range = years[0];
  let place = 'all';

  rangeChips.innerHTML = years.map((y) => `
    <button type="button" class="chip small${y === range ? ' selected' : ''}" aria-pressed="${y === range}" data-range="${y}">${y}</button>
  `).join('') + `<button type="button" class="chip small" aria-pressed="false" data-range="all">All time</button>`;

  const cities = P.tally(all, (e) => P.cityOf(e));
  if (cities.length > 1) {
    placeGroup.style.display = 'flex';
    placeFilter.innerHTML = '<option value="all">Everywhere</option>'
      + cities.map((c) => `<option value="${P.esc(c.label)}">${P.esc(c.label)} (${c.count})</option>`).join('');
  }

  function slice() {
    return all.filter((e) => {
      if (range !== 'all' && e.ateOn.slice(0, 4) !== range) return false;
      if (place !== 'all' && String(P.cityOf(e) || '').toLowerCase() !== place.toLowerCase()) return false;
      return true;
    });
  }

  function tile(value, label) {
    return `<div class="stat-tile">
      <div class="stat-tile-value">${P.esc(value)}</div>
      <div class="stat-tile-label">${P.esc(label)}</div>
    </div>`;
  }

  function renderAll() {
    const entries = slice();

    // Six, not four: the tile grid fits three across at this width, so four
    // leaves a lone tile stranded on its own row.
    tiles.innerHTML = [
      tile(entries.length, 'Meals'),
      tile(new Set(entries.map((e) => e.ateOn)).size, 'Days with something'),
      tile(P.tally(entries, (e) => e.placeName).length, 'Places'),
      tile(P.tally(entries, (e) => e.cuisine).length, 'Kinds of food'),
      tile(P.tally(entries, (e) => P.cityOf(e)).length, 'Towns'),
      tile(P.tally(entries, (e) => P.drinksOf(e)).length, 'Drinks noted'),
    ].join('');

    const yearForCalendar = range === 'all' ? years[0] : range;
    P.renderCalendar('calendar-heat', entries, Number(yearForCalendar));
    P.renderRhythm('rhythm-grid', entries);

    P.renderRanked('top-foods', P.tally(entries, (e) => e.food), {
      header: 'Dish',
      empty: 'Nothing logged in this period.',
      hrefFor: (r) => `entries.html?q=${encodeURIComponent(r.label)}`,
    });

    P.renderRanked('top-drinks', P.tally(entries, (e) => P.drinksOf(e)), {
      header: 'Drink',
      empty: "No drinks recorded yet — there's a drinks box on the 'what went into it' step.",
      hrefFor: (r) => `entries.html?q=${encodeURIComponent(r.label)}`,
    });

    P.renderCuisineMonths('cuisine-months', entries);

    P.renderRanked('top-cities', P.tally(entries, (e) => P.cityOf(e)), {
      header: 'Town or city',
      empty: 'No towns recorded yet. Meals logged with your location from now on will show up here.',
      hrefFor: (r) => `entries.html?city=${encodeURIComponent(r.label)}`,
    });

    P.renderRanked('top-countries', P.tally(entries, (e) => e.country), {
      header: 'Country',
      empty: 'No countries recorded yet. Meals logged with your location from now on will show up here.',
      hrefFor: (r) => `entries.html?country=${encodeURIComponent(r.label)}`,
    });

    // Tallied on the raw reason key, not its label, so the link below filters
    // on something stable rather than on display text with an emoji stripped off.
    P.renderRanked('top-occasions', P.tally(entries, (e) => e.reason), {
      header: 'Occasion',
      empty: 'No occasions recorded yet.',
      displayFor: (r) => reasonLabel(r.label).replace(/^[^ ]+ /, '') || r.label,
      hrefFor: (r) => `entries.html?occasion=${encodeURIComponent(r.label)}`,
    });
  }

  rangeChips.querySelectorAll('[data-range]').forEach((chip) => {
    chip.addEventListener('click', () => {
      range = chip.dataset.range;
      rangeChips.querySelectorAll('.chip').forEach((c) => setChipSelected(c, c === chip));
      renderAll();
    });
  });

  placeFilter.addEventListener('change', () => {
    place = placeFilter.value;
    renderAll();
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle('selected', on);
        t.setAttribute('aria-selected', String(on));
      });
      Object.keys(panels).forEach((key) => { panels[key].hidden = key !== tab.dataset.lens; });
    });
  });

  renderAll();
});
