// A stand-in for Supabase, for local development only. NEVER deployed.
//
// It replaces window.supabase before js/supabase-config.js runs, so the whole
// app talks to an in-memory copy of dev/seed.js instead of a real database.
// Nothing here reaches the network and nothing can reach the real project.
//
// Why not just point at a second Supabase project? Because the point of this
// harness is to test features that need three years of history across four
// countries and five households. Creating that for real would mean 1,200 rows
// of invented meals sitting in a live database forever, and they would end up
// in the Insights numbers that exist to measure whether REAL people come back.
//
// Filters are really applied (eq / in / order / limit), because a stub that
// ignores them makes every test pass whether the query is right or not.
(function () {
  const seed = window.__BITEBOOK_SEED__;
  if (!seed) {
    console.error('[demo] dev/seed.js must load before dev/fake-supabase.js');
    return;
  }

  const ME = seed.me;

  const TABLES = {
    profiles: [{
      id: ME, name: 'Alok', avatar: '😋',
      birthday: '1975-09-12', anniversary: '2001-02-14',
      home_address: 'Edison, New Jersey', home_coords: null,
      family_members: [
        { id: 'f1', relationship: 'son', name: 'Ayaan', birthday: '2004-09-19', anniversary: null },
        { id: 'f2', relationship: 'spouse', name: 'Priya', birthday: '1978-06-02', anniversary: '2001-02-14' },
      ],
      ranking_order: [], created_at: '2024-01-01T00:00:00Z', updated_at: new Date().toISOString(),
    }],
    admins: [{ user_id: ME }],
    user_roles: [{ user_id: ME, role: 'power', granted_by: ME, updated_at: new Date().toISOString() }],
    profile_directory: seed.households.map((h) => ({ id: h.id, name: h.name, avatar: '🧑' })),
    entries: seed.entries.slice(),
    trips: seed.trips.slice(),
    wishlist: seed.wishes.slice(),
    shares: [],
    notifications: [],
    events: [],
    entry_signatures: [],
  };

  // Row Level Security, imitated: the app should only ever see its own rows
  // plus anything explicitly shared. Without this the demo would show one
  // household five families' meals and every "is this scoped right" test
  // would pass for the wrong reason.
  function visible(table, rows) {
    if (table !== 'entries') return rows;
    const sharedIds = new Set(TABLES.shares.filter((s) => s.shared_with === ME).map((s) => s.entry_id));
    return rows.filter((r) => r.owner_id === ME || sharedIds.has(r.id));
  }

  function matches(row, filters) {
    return filters.every((f) => {
      const value = row[f.col];
      if (f.op === 'eq') return String(value) === String(f.val);
      if (f.op === 'neq') return String(value) !== String(f.val);
      if (f.op === 'in') return (f.val || []).map(String).includes(String(value));
      if (f.op === 'is') return f.val === null ? (value === null || value === undefined) : value === f.val;
      if (f.op === 'gte') return value >= f.val;
      if (f.op === 'lte') return value <= f.val;
      return true;
    });
  }

  function query(table) {
    const filters = [];
    let order = null;
    let limit = null;
    let pending = null;
    let mode = 'select';

    const api = {
      select() { return api; },
      eq(col, val) { filters.push({ col, val, op: 'eq' }); return api; },
      neq(col, val) { filters.push({ col, val, op: 'neq' }); return api; },
      in(col, val) { filters.push({ col, val, op: 'in' }); return api; },
      is(col, val) { filters.push({ col, val, op: 'is' }); return api; },
      gte(col, val) { filters.push({ col, val, op: 'gte' }); return api; },
      lte(col, val) { filters.push({ col, val, op: 'lte' }); return api; },
      not() { return api; },
      filter() { return api; },
      order(col, opts) { order = { col, asc: !(opts && opts.ascending === false) }; return api; },
      limit(n) { limit = n; return api; },

      insert(payload) {
        mode = 'insert';
        const rows = Array.isArray(payload) ? payload : [payload];
        pending = rows.map((r) => Object.assign({
          status: table === 'wishlist' ? 'open' : r.status,
          created_at: new Date().toISOString(),
        }, r));
        TABLES[table] = (TABLES[table] || []).concat(pending);
        return api;
      },
      upsert(payload) {
        mode = 'upsert';
        const rows = Array.isArray(payload) ? payload : [payload];
        rows.forEach((r) => {
          const list = TABLES[table] || (TABLES[table] = []);
          const i = list.findIndex((x) => x.id === r.id);
          if (i >= 0) list[i] = Object.assign({}, list[i], r);
          else list.push(r);
        });
        pending = rows;
        return api;
      },
      update(payload) { mode = 'update'; pending = payload; return api; },
      delete() { mode = 'delete'; return api; },

      single() {
        const rows = api._run();
        const row = rows[0] || null;
        return Promise.resolve({ data: row, error: row ? null : { message: 'no rows' } });
      },
      maybeSingle() {
        return Promise.resolve({ data: api._run()[0] || null, error: null });
      },
      then(res, rej) {
        const rows = api._run();
        return Promise.resolve({ data: rows, error: null, count: rows.length }).then(res, rej);
      },

      _run() {
        const list = TABLES[table] || [];
        if (mode === 'update') {
          const hit = list.filter((r) => matches(r, filters));
          hit.forEach((r) => Object.assign(r, pending));
          return hit;
        }
        if (mode === 'delete') {
          const keep = list.filter((r) => !matches(r, filters));
          const removed = list.filter((r) => matches(r, filters));
          TABLES[table] = keep;
          return removed;
        }
        if (mode === 'insert' || mode === 'upsert') return pending || [];

        let rows = visible(table, list).filter((r) => matches(r, filters));
        if (order) {
          rows = rows.slice().sort((a, b) => {
            const x = a[order.col];
            const y = b[order.col];
            if (x === y) return 0;
            return (x > y ? 1 : -1) * (order.asc ? 1 : -1);
          });
        }
        if (limit) rows = rows.slice(0, limit);
        return rows;
      },
    };
    return api;
  }

  // ---- aggregate recommendations, the same rule the real view uses ----
  // A place only appears once at least three DIFFERENT households have
  // logged it, and only counts and averages come back — never who, never
  // when, never anyone's notes.
  function placeReputation(city) {
    const byPlace = new Map();
    TABLES.entries.forEach((e) => {
      if (e.status !== 'complete' || !e.place_name || !e.rating) return;
      if (city && String(e.city || '').toLowerCase() !== String(city).toLowerCase()) return;
      const key = e.place_name.trim().toLowerCase();
      if (!byPlace.has(key)) {
        byPlace.set(key, { place_name: e.place_name, city: e.city, country: e.country, cuisine: e.cuisine, owners: new Set(), ratings: [] });
      }
      const rec = byPlace.get(key);
      rec.owners.add(e.owner_id);
      rec.ratings.push(e.rating);
    });
    return Array.from(byPlace.values())
      .filter((r) => r.owners.size >= 3)
      .map((r) => ({
        place_name: r.place_name,
        city: r.city,
        country: r.country,
        cuisine: r.cuisine,
        households: r.owners.size,
        meals: r.ratings.length,
        avg_rating: Math.round((r.ratings.reduce((a, b) => a + b, 0) / r.ratings.length) * 10) / 10,
      }))
      .sort((a, b) => b.avg_rating - a.avg_rating || b.households - a.households);
  }

  const RPC = {
    bb_my_access: () => [{ is_admin: true, role: 'power' }],
    bb_recommend_places: (args) => placeReputation(args && args.target_city),
    admin_overview: () => [{
      people: seed.households.length,
      people_with_entries: seed.households.length,
      entries: TABLES.entries.length,
      entries_last_7: 6, active_last_7: 3, active_last_30: 5,
    }],
    admin_retention: () => [
      { window_days: 7, cohort: 5, returned: 4, pct: 80 },
      { window_days: 30, cohort: 5, returned: 3, pct: 60 },
    ],
    admin_funnel: () => [
      { step_order: 1, step: 'Opened Bite Book', people: 5 },
      { step_order: 2, step: 'Opened a new-entry page', people: 5 },
      { step_order: 3, step: 'Started an entry', people: 5 },
      { step_order: 4, step: 'Finished an entry', people: 5 },
      { step_order: 5, step: 'Shared something', people: 2 },
    ],
    admin_people: () => seed.households.map((h) => ({
      name: h.name,
      entries: TABLES.entries.filter((e) => e.owner_id === h.id).length,
      first_entry: '2024-01-03', last_entry: '2026-09-11',
      days_opened: 40, days_opened_without_logging: 17, pct_pure_remember: 43, last_seen: '2026-09-11',
    })),
    admin_weekly: () => [{ week: '2026-09-07', people_opened: 4, sessions: 11, entries: 6 }],
    admin_pages: () => [{ page: 'entries.html', views: 210, people: 5 }],
    admin_list_roles: () => seed.households.map((h, i) => ({
      user_id: h.id, name: h.name, role: i === 0 ? 'power' : 'general',
      is_admin: i === 0, entries: TABLES.entries.filter((e) => e.owner_id === h.id).length,
      joined: '2024-01-01',
    })),
    admin_set_role: () => 'power',
  };

  const session = { user: { id: ME, email: 'alok@example.com' }, access_token: 'demo' };

  window.supabase = {
    createClient() {
      return {
        auth: {
          getSession: () => Promise.resolve({ data: { session }, error: null }),
          getUser: () => Promise.resolve({ data: { user: session.user }, error: null }),
          signOut: () => Promise.resolve({ error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
          updateUser: () => Promise.resolve({ data: {}, error: null }),
        },
        from: (t) => query(t),
        rpc: (name, args) => {
          const fn = RPC[name];
          return Promise.resolve(fn
            ? { data: fn(args), error: null }
            : { data: null, error: { message: `no demo stub for ${name}` } });
        },
        storage: {
          from: () => ({
            createSignedUrl: () => Promise.resolve({ data: { signedUrl: '' }, error: null }),
            upload: () => Promise.resolve({ data: {}, error: null }),
          }),
        },
        functions: {
          invoke: (name, opts) => {
            const body = (opts && opts.body) || {};
            const grounded = Array.isArray(body.tools) && body.tools.some((t) => t && t.google_search);
            const prompt = (((body.contents || [])[0] || {}).parts || [])
              .map((p) => p.text || '').join(' ');

            // Two different grounded questions share one proxy: "what's on
            // this menu" and "where should we eat". Answering both with the
            // menu payload made the web tier silently return nothing.
            if (grounded && /deciding where to eat/i.test(prompt)) {
              return Promise.resolve({
                data: {
                  ok: true,
                  body: {
                    candidates: [{
                      content: { parts: [{ text: JSON.stringify({
                        note: 'Demo mode: canned results, not a real search.',
                        places: [
                          { name: 'Demo Thai House', why: 'Known for a crab curry people travel for.', cuisine: 'Thai' },
                          { name: 'The Demo Trattoria', why: 'Small room, short menu, very good pasta.', cuisine: 'Italian' },
                        ],
                      }) }] },
                      groundingMetadata: {
                        groundingChunks: [{ web: { uri: 'https://example-guide.test/best', title: 'example-guide.test' } }],
                      },
                    }],
                  },
                },
                error: null,
              });
            }

            if (grounded) {
              return Promise.resolve({
                data: {
                  ok: true,
                  body: {
                    candidates: [{
                      content: { parts: [{ text: JSON.stringify({
                        menuUrl: 'https://example-restaurant.test/menu',
                        note: 'Demo mode: this is canned, not a real search.',
                        dishes: [
                          { name: 'Murgh Makhani', description: 'Tandoori chicken in tomato and fenugreek', confidence: 'high' },
                          { name: 'Paneer Butter Masala', description: null, confidence: 'medium' },
                        ],
                      }) }] },
                      groundingMetadata: {
                        groundingChunks: [{ web: { uri: 'https://example-restaurant.test/menu', title: 'example-restaurant.test' } }],
                      },
                    }],
                  },
                },
                error: null,
              });
            }
            return Promise.resolve({
              data: { ok: true, body: { candidates: [{ content: { parts: [{ text: '{}' }] } }] } },
              error: null,
            });
          },
        },
      };
    },
  };

  const badge = () => {
    const el = document.createElement('div');
    el.textContent = 'DEMO DATA — not your real journal';
    el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:999;background:#4a352a;color:#fff8ef;'
      + 'font:700 12px Nunito,sans-serif;text-align:center;padding:5px;letter-spacing:.05em;';
    document.body.appendChild(el);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', badge);
  else badge();

  console.log(`[demo] ${TABLES.entries.length} seeded entries across ${seed.households.length} households`);
})();
