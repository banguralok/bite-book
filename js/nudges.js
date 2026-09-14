// "Ideas for you" — the system suggesting something without being asked.
//
// Every idea must carry a REASON, and the reason has to be one a person would
// accept out loud: "Priya recommended this and Ayaan's birthday is Friday" is
// a reason; "you might like this" is a slot machine. If no rule fires, the
// section says nothing rather than padding itself — a suggestion nobody asked
// for has to earn its place every single time, and the fastest way to make an
// app feel naggy is to guarantee it always has something to say.
//
// Everything here is computed locally from entries and the wishlist. No AI
// call, so it costs nothing and works offline.
const BiteBookNudges = (() => {
  const OCCASION_WINDOW = 21;   // days ahead worth mentioning
  const STALE_DAYS = 45;        // a wish is "waiting" after this long
  const MAX_IDEAS = 6;

  function daysBetween(aStr, bStr) {
    return Math.round((parseDateInputValue(bStr) - parseDateInputValue(aStr)) / 86400000);
  }

  function today() {
    return toDateInputValue(new Date());
  }

  function cityOfEntry(entry) {
    if (entry.city) return entry.city;
    if (typeof cityFromSavedAddress === 'function') return cityFromSavedAddress(entry.placeAddress);
    return null;
  }

  // Where you have been eating lately — used to notice "you are in the same
  // town as something on your list".
  function recentCities(entries, days) {
    const cutoff = toDateInputValue(new Date(Date.now() - days * 86400000));
    const found = new Map();
    entries.forEach((e) => {
      if (!e.ateOn || e.ateOn < cutoff) return;
      const city = cityOfEntry(e);
      if (!city) return;
      const key = city.toLowerCase();
      found.set(key, { city, count: (found.get(key) || { count: 0 }).count + 1 });
    });
    return Array.from(found.values()).sort((a, b) => b.count - a.count);
  }

  // How often a cuisine normally comes round, and how long since the last one.
  // Only meaningful with a few data points — three is the floor, below which
  // "you usually" is a sentence about two coincidences.
  function cuisineRhythm(entries) {
    const byCuisine = new Map();
    entries.forEach((e) => {
      if (!e.cuisine || !e.ateOn) return;
      if (!byCuisine.has(e.cuisine)) byCuisine.set(e.cuisine, []);
      byCuisine.get(e.cuisine).push(e.ateOn);
    });

    const out = [];
    byCuisine.forEach((dates, cuisine) => {
      if (dates.length < 4) return;
      const sorted = dates.slice().sort();
      let total = 0;
      for (let i = 1; i < sorted.length; i += 1) total += daysBetween(sorted[i - 1], sorted[i]);
      const typical = Math.round(total / (sorted.length - 1));
      const since = daysBetween(sorted[sorted.length - 1], today());
      out.push({ cuisine, typical, since, last: sorted[sorted.length - 1] });
    });
    return out;
  }

  function upcomingOccasions(profile) {
    if (typeof BiteBookOccasions === 'undefined' || !profile) return [];
    return BiteBookOccasions.findUpcoming(profile, [])
      .filter((o) => o.daysAway <= OCCASION_WINDOW);
  }

  function whenLabel(days) {
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    return `in ${days} days`;
  }

  // ---------- the rules ----------
  // Each returns zero or more ideas. Weight decides the order; the numbers are
  // a judgement about which reason a person would act on soonest, not a score
  // from anything.

  // ONE occasion produces ONE idea. Taking the top two wishes and pinning the
  // same birthday to both printed the identical sentence twice, which reads
  // as the app padding rather than suggesting. Pick the single wish most
  // worth acting on: something a person actually recommended beats an
  // unattributed one, and older beats newer.
  function occasionRule(wishes, occasions) {
    if (!occasions.length || !wishes.length) return [];
    const soonest = occasions[0];
    const best = wishes.slice().sort((a, b) => {
      const named = (!!b.recommendedBy) - (!!a.recommendedBy);
      if (named !== 0) return named;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    })[0];

    return [{
      weight: 100 - soonest.daysAway,
      wish: best,
      headline: best.title,
      reason: best.recommendedBy
        ? `${soonest.label} is ${whenLabel(soonest.daysAway)} — and ${best.recommendedBy} said you had to try this.`
        : `${soonest.label} is ${whenLabel(soonest.daysAway)}. This has been waiting on your list.`,
      tag: 'An occasion coming up',
    }];
  }

  function cityRule(wishes, entries) {
    const cities = recentCities(entries, 30);
    if (!cities.length) return [];
    const here = cities[0].city.toLowerCase();
    return wishes
      .filter((w) => w.city && w.city.toLowerCase() === here)
      .map((wish) => ({
        weight: 90,
        wish,
        headline: wish.title,
        reason: wish.recommendedBy
          ? `You've been eating around ${cities[0].city} lately, and ${wish.recommendedBy} put this one on your list.`
          : `You've been eating around ${cities[0].city} lately, and this is on your list there.`,
        tag: "You're in the right town",
      }));
  }

  function rhythmRule(wishes, entries) {
    const overdue = cuisineRhythm(entries)
      .filter((r) => r.since > r.typical * 2 && r.since > 14)
      .sort((a, b) => (b.since / b.typical) - (a.since / a.typical));
    if (!overdue.length) return [];

    const top = overdue[0];
    const name = cuisineLabel(top.cuisine).replace(/^[^ ]+ /, '') || top.cuisine;
    const matching = wishes.filter((w) => (w.note || '').toLowerCase().includes(name.toLowerCase())
      || (w.title || '').toLowerCase().includes(name.toLowerCase()));

    const base = {
      weight: 70,
      tag: 'It has been a while',
      reason: `You normally have ${name} about every ${top.typical} days. It's been ${top.since}.`,
    };
    if (matching.length) {
      return [Object.assign({}, base, { wish: matching[0], headline: matching[0].title })];
    }
    return [Object.assign({}, base, {
      wish: null,
      headline: `Something ${name}?`,
      reason: `${base.reason} Nothing ${name} is on your list — worth adding one.`,
    })];
  }

  function staleRule(wishes) {
    const now = today();
    return wishes
      .filter((w) => w.createdAt && daysBetween(toDateInputValue(new Date(w.createdAt)), now) > STALE_DAYS)
      .slice(0, 2)
      .map((wish) => {
        const days = daysBetween(toDateInputValue(new Date(wish.createdAt)), now);
        const months = Math.round(days / 30);
        return {
          weight: 40,
          wish,
          headline: wish.title,
          reason: wish.recommendedBy
            ? `${wish.recommendedBy} recommended this about ${months} month${months === 1 ? '' : 's'} ago and it's still waiting.`
            : `This has been on your list about ${months} month${months === 1 ? '' : 's'}.`,
          tag: 'Still waiting',
        };
      });
  }

  // ---------- putting them together ----------

  function build(entries, wishes, profile) {
    const open = (wishes || []).filter((w) => w.status === 'open');
    const mine = (entries || []).filter((e) => e.status === 'complete' && e.ateOn);
    if (!open.length && !mine.length) return [];

    const occasions = upcomingOccasions(profile);
    const ideas = []
      .concat(occasionRule(open, occasions))
      .concat(cityRule(open, mine))
      .concat(rhythmRule(open, mine))
      .concat(staleRule(open));

    // Two filters, because there are two ways to repeat yourself.
    // One idea per wish: the same restaurant arriving three times with three
    // different reasons reads as desperation, and only the strongest reason
    // was going to be acted on anyway.
    // One idea per REASON: two different restaurants under a word-for-word
    // identical sentence is worse — it makes the reasoning look fake.
    const seenWish = new Set();
    const seenReason = new Set();
    return ideas
      .sort((a, b) => b.weight - a.weight)
      .filter((idea) => {
        const wishKey = idea.wish ? idea.wish.id : `no-wish:${idea.headline}`;
        const reasonKey = idea.reason.trim().toLowerCase();
        if (seenWish.has(wishKey) || seenReason.has(reasonKey)) return false;
        seenWish.add(wishKey);
        seenReason.add(reasonKey);
        return true;
      })
      .slice(0, MAX_IDEAS);
  }

  function escapeHtmlNudge(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function render(containerId, ideas, onLog) {
    const host = document.getElementById(containerId);
    if (!host) return;

    if (!ideas.length) {
      host.style.display = 'none';
      host.innerHTML = '';
      return;
    }

    host.style.display = 'block';
    host.innerHTML = `
      <h2 class="chart-title" style="margin-bottom: 4px;">Ideas for you</h2>
      <p class="chart-sub">Worked out from your list, your calendar and how you actually eat.</p>
      <div class="idea-list">
        ${ideas.map((idea, i) => `
          <div class="idea-card">
            <span class="idea-tag">${escapeHtmlNudge(idea.tag)}</span>
            <strong class="idea-headline">${escapeHtmlNudge(idea.headline)}</strong>
            <p class="idea-reason">${escapeHtmlNudge(idea.reason)}</p>
            ${idea.wish ? `<button type="button" class="link-pill" data-idea="${i}">I'm going — start an entry</button>` : ''}
          </div>
        `).join('')}
      </div>
    `;

    host.querySelectorAll('[data-idea]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idea = ideas[Number(btn.dataset.idea)];
        if (idea && idea.wish && onLog) onLog(idea.wish, btn);
      });
    });
  }

  return { build, render, cuisineRhythm, recentCities };
})();
