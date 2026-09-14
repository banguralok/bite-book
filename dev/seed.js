// Seed data for local development. NEVER loaded by the deployed site.
//
// Three features need shapes that a three-week-old beta cannot possibly have:
// multi-year history, trips across several cities and countries, wishlist
// items recommended by different people, and enough households logging the
// same restaurants for an aggregate recommendation to mean anything. So this
// invents them.
//
// It is deliberately NOT random. A fixed pseudo-random sequence means the
// same dataset every run, so a test that passes today passes tomorrow and a
// screenshot can be compared against yesterday's. Random fixtures produce
// tests that fail once a fortnight for no reason anybody can reproduce.
(function () {
  const ME = '11111111-1111-1111-1111-111111111111';

  // Deterministic: same seed, same sequence, forever.
  let s = 20260911;
  function rnd() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  }
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;

  const HOUSEHOLDS = [
    { id: ME, name: 'Alok' },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Priya' },
    { id: '33333333-3333-3333-3333-333333333333', name: 'Ayaan' },
    { id: '44444444-4444-4444-4444-444444444444', name: 'The Mehtas' },
    { id: '55555555-5555-5555-5555-555555555555', name: 'The Rays' },
  ];

  // Places, with the city and country they sit in. Several are shared across
  // households on purpose — that is what makes the aggregate tier testable.
  const PLACES = [
    { name: 'Saffron', city: 'Edison', country: 'United States', cuisine: 'indian-restaurant', type: 'restaurant' },
    { name: 'Dosa Corner', city: 'Iselin', country: 'United States', cuisine: 'indian-restaurant', type: 'restaurant' },
    { name: 'Ippudo', city: 'New York', country: 'United States', cuisine: 'japanese', type: 'restaurant' },
    { name: 'Via Carota', city: 'New York', country: 'United States', cuisine: 'italian', type: 'restaurant' },
    { name: 'Thai Basil', city: 'Edison', country: 'United States', cuisine: 'thai', type: 'restaurant' },
    { name: 'Home', city: 'Edison', country: 'United States', cuisine: 'indian-home', type: 'home' },
    { name: "Mum's kitchen", city: 'Kolkata', country: 'India', cuisine: 'indian-home', type: 'someone-else' },
    { name: 'Peter Cat', city: 'Kolkata', country: 'India', cuisine: 'indian-restaurant', type: 'restaurant' },
    { name: 'Flurys', city: 'Kolkata', country: 'India', cuisine: 'continental', type: 'restaurant' },
    { name: 'Bukhara', city: 'Delhi', country: 'India', cuisine: 'indian-restaurant', type: 'restaurant' },
    { name: 'Trattoria da Enzo', city: 'Rome', country: 'Italy', cuisine: 'italian', type: 'restaurant' },
    { name: 'Pizzarium', city: 'Rome', country: 'Italy', cuisine: 'italian', type: 'restaurant' },
    { name: 'Sushi Saito', city: 'Tokyo', country: 'Japan', cuisine: 'japanese', type: 'restaurant' },
    { name: 'Afuri', city: 'Tokyo', country: 'Japan', cuisine: 'japanese', type: 'restaurant' },
  ];

  const DISHES = {
    'indian-restaurant': ['Butter Chicken', 'Rogan Josh', 'Chicken Chettinad', 'Dal Makhani', 'Biryani', 'Tandoori Platter'],
    'indian-home': ["Mum's mutton curry", 'Khichdi', 'Aloo Paratha', 'Rajma Chawal', 'Fish Curry'],
    japanese: ['Tonkotsu Ramen', 'Chirashi Don', 'Tsukemen', 'Omakase'],
    italian: ['Cacio e Pepe', 'Carbonara', 'Margherita', 'Amatriciana', 'Tiramisu'],
    thai: ['Green Curry', 'Pad See Ew', 'Crab Curry', 'Som Tam'],
    continental: ['English Breakfast', 'Club Sandwich', 'Rum Ball'],
  };

  const DRINKS = ['mango lassi', 'filter coffee', 'green tea', 'nimbu pani', 'house red', 'masala chai', 'sparkling water', 'espresso'];
  const TIMES = ['morning', 'midday', 'afternoon', 'evening', 'night'];
  const MEALS = { morning: 'breakfast', midday: 'lunch', afternoon: 'high-tea', evening: 'dinner', night: 'supper' };

  // Trips: each one is a real span in a real city, so the year view has
  // something to show and the place breakdown isn't all one town.
  const TRIPS = [
    { id: 't-rome-2024', owner: ME, name: 'Rome, October 2024', city: 'Rome', from: '2024-10-05', to: '2024-10-11' },
    { id: 't-kol-2024', owner: ME, name: 'Kolkata, December 2024', city: 'Kolkata', from: '2024-12-20', to: '2024-12-30' },
    { id: 't-tokyo-2025', owner: ME, name: 'Tokyo, April 2025', city: 'Tokyo', from: '2025-04-12', to: '2025-04-19' },
    { id: 't-kol-2025', owner: ME, name: 'Kolkata, December 2025', city: 'Kolkata', from: '2025-12-22', to: '2025-12-31' },
    { id: 't-delhi-2026', owner: ME, name: 'Delhi, March 2026', city: 'Delhi', from: '2026-03-08', to: '2026-03-12' },
  ];

  function iso(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function addDays(dateStr, n) {
    const [y, m, dd] = dateStr.split('-').map(Number);
    const d = new Date(y, m - 1, dd);
    d.setDate(d.getDate() + n);
    return iso(d);
  }

  // Special days, so "everyday vs occasion" has both halves across years.
  const OCCASION_DAYS = [];
  [2024, 2025, 2026].forEach((y) => {
    OCCASION_DAYS.push({ date: `${y}-09-12`, reason: 'birthday' });
    OCCASION_DAYS.push({ date: `${y}-09-19`, reason: 'birthday' });
    OCCASION_DAYS.push({ date: `${y}-02-14`, reason: 'anniversary' });
    OCCASION_DAYS.push({ date: `${y}-12-25`, reason: 'celebration' });
    OCCASION_DAYS.push({ date: `${y}-11-01`, reason: 'festival' });
  });
  const occasionFor = (date) => (OCCASION_DAYS.find((o) => o.date === date) || {}).reason || null;

  const entries = [];
  let n = 0;

  function makeEntry(owner, date, place, opts) {
    opts = opts || {};
    const cuisine = opts.cuisine || place.cuisine;
    const time = opts.time || pick(TIMES);
    const reason = occasionFor(date);
    n += 1;
    return {
      id: `seed-${n}`,
      owner_id: owner,
      food: opts.food || pick(DISHES[cuisine] || DISHES['indian-home']),
      meal_type: MEALS[time],
      meal_type_auto_picked: false,
      cuisine,
      ate_on: date,
      time_mode: 'fuzzy',
      time_of_day: time,
      exact_time: null,
      place_name: place.name,
      place_address: `${place.name}, ${place.city}`,
      place_type: place.type,
      place_source: 'geolocation',
      coords: null,
      city: place.city,
      country: place.country,
      companion_types: reason ? ['family'] : [pick(['family', 'solo', 'friends'])],
      companion_family_ids: chance(0.5) ? ['f1'] : [],
      companion_names: chance(0.4) ? pick(['Priya', 'Ayaan', 'Dev', 'The Mehtas']) : null,
      made_by: place.type === 'home' ? 'me' : 'restaurant',
      made_by_name: place.type === 'someone-else' ? 'Mum' : null,
      reason,
      occasion_date: reason ? date : null,
      ingredients_text: null,
      ingredients_link: null,
      ingredients_file: null,
      drinks: chance(0.55) ? pick(DRINKS) : null,
      liked_qualities: ['flavour'],
      liked_other: null,
      rating: reason ? 5 : (3 + Math.floor(rnd() * 3)),
      would_eat_again: 'yes',
      eat_again_frequency: null,
      personal_rank: null,
      reflection: reason ? 'One of those meals you remember the room for, not just the food.' : null,
      photos: [],
      videos: [],
      status: 'complete',
      ai_parsed: false,
      trip_id: opts.tripId || null,
      food_source: null,
      menu_url: null,
      menu_dish_description: null,
      created_at: new Date(`${date}T19:00:00Z`).toISOString(),
      updated_at: new Date(`${date}T19:00:00Z`).toISOString(),
    };
  }

  // ---- three years of ordinary eating, for the owner ----
  const homePlaces = PLACES.filter((p) => p.country === 'United States');
  ['2024', '2025', '2026'].forEach((year) => {
    const lastDay = year === '2026' ? '2026-09-11' : `${year}-12-31`;
    let cursor = `${year}-01-01`;
    while (cursor <= lastDay) {
      // Roughly every other day, with weekends busier — a believable rhythm
      // rather than a flat line, so the heat map has texture.
      const dow = new Date(cursor + 'T00:00:00').getDay();
      const p = (dow === 0 || dow === 6) ? 0.75 : 0.42;
      if (chance(p)) {
        entries.push(makeEntry(ME, cursor, pick(homePlaces)));
        if (chance(0.18)) entries.push(makeEntry(ME, cursor, pick(homePlaces), { time: 'midday' }));
      }
      cursor = addDays(cursor, 1);
    }
  });

  // ---- the special days themselves ----
  // Placed, not rolled: a fixture whose whole job is to exercise the
  // "everyday vs occasion" comparison cannot leave a year with no occasions
  // in it because a random number came up short.
  OCCASION_DAYS.forEach((o) => {
    if (o.date > '2026-09-11') return;
    const place = pick(homePlaces.concat(PLACES.filter((p2) => p2.name === 'Saffron')));
    entries.push(makeEntry(ME, o.date, place, { time: 'evening' }));
  });

  // ---- trips: dense clusters away from home ----
  TRIPS.forEach((trip) => {
    const tripPlaces = PLACES.filter((p) => p.city === trip.city);
    let cursor = trip.from;
    while (cursor <= trip.to) {
      entries.push(makeEntry(trip.owner, cursor, pick(tripPlaces), { tripId: trip.id, time: 'evening' }));
      if (chance(0.7)) {
        entries.push(makeEntry(trip.owner, cursor, pick(tripPlaces), { tripId: trip.id, time: 'midday' }));
      }
      cursor = addDays(cursor, 1);
    }
  });

  // ---- the other households ----
  // Their job is to make the aggregate recommendation tier real: several of
  // them eat at the same places, so those places clear the "three different
  // households" bar while the ones only Alok visits deliberately do not.
  const SHARED = PLACES.filter((p) => ['Saffron', 'Ippudo', 'Thai Basil', 'Dosa Corner', 'Via Carota'].includes(p.name));
  const SOLO = PLACES.filter((p) => ['Flurys', 'Bukhara'].includes(p.name));
  HOUSEHOLDS.slice(1).forEach((house, i) => {
    ['2025', '2026'].forEach((year) => {
      const lastDay = year === '2026' ? '2026-09-11' : '2025-12-31';
      let cursor = `${year}-0${1 + (i % 3)}-01`;
      while (cursor <= lastDay) {
        if (chance(0.22)) entries.push(makeEntry(house.id, cursor, pick(SHARED)));
        cursor = addDays(cursor, 1);
      }
    });
  });
  // One place only Alok has ever been, to prove the k-anonymity cut works.
  SOLO.forEach((p) => entries.push(makeEntry(ME, '2025-12-26', p, { tripId: 't-kol-2025' })));

  // ---- the wishlist: recommended by real people, near and far ----
  const WISHES = [
    { id: 'w-1', kind: 'place', title: 'Thai Basil', place_name: null, city: 'Edison',
      recommended_by: 'Priya', note: 'said the crab curry is the best she has had', created: '2026-03-02' },
    { id: 'w-2', kind: 'dish', title: "Mum's mutton curry", place_name: "Mum's kitchen", city: 'Kolkata',
      recommended_by: 'Ayaan', note: 'he still talks about the one from last Christmas', created: '2026-01-18' },
    { id: 'w-3', kind: 'place', title: 'Pizzarium', place_name: null, city: 'Rome',
      recommended_by: 'The Mehtas', note: 'the potato one, apparently', created: '2025-09-30' },
    { id: 'w-4', kind: 'place', title: 'Bukhara', place_name: null, city: 'Delhi',
      recommended_by: 'Dev', note: 'dal that takes 18 hours', created: '2026-02-11' },
    { id: 'w-5', kind: 'dish', title: 'Omakase at Sushi Saito', place_name: 'Sushi Saito', city: 'Tokyo',
      recommended_by: 'Priya', note: 'book months ahead', created: '2026-05-04' },
  ];

  window.__BITEBOOK_SEED__ = {
    me: ME,
    households: HOUSEHOLDS,
    places: PLACES,
    entries,
    trips: TRIPS.map((t) => ({ id: t.id, owner_id: t.owner, name: t.name, created_at: `${t.from}T00:00:00Z` })),
    wishes: WISHES.map((w) => ({
      id: w.id, owner_id: ME, kind: w.kind, title: w.title, place_name: w.place_name,
      city: w.city, recommended_by: w.recommended_by, note: w.note,
      status: 'open', entry_id: null, created_at: `${w.created}T00:00:00Z`,
    })),
  };
})();
