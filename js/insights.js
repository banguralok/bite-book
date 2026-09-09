// The beta scorecard, inside the app.
//
// Every number here comes from a `security definer` function in
// supabase/migrations/006_admin_insights.sql that gates itself on
// bb_is_admin(). A non-admin who loads this page by typing the URL gets empty
// results from the database, not just a hidden page — the lock is in the
// database, and the check below is only there to explain that politely.
function escapeHtmlInsights(str) {
  const div = document.createElement('div');
  div.textContent = (str === null || str === undefined) ? '' : String(str);
  return div.innerHTML;
}

function tile(value, label) {
  return `
    <div class="stat-tile">
      <div class="stat-tile-value">${escapeHtmlInsights(value)}</div>
      <div class="stat-tile-label">${escapeHtmlInsights(label)}</div>
    </div>
  `;
}

function table(headers, rows) {
  if (!rows.length) {
    return `<tbody><tr><td class="insights-empty">Nothing recorded yet.</td></tr></tbody>`;
  }
  const head = `<thead><tr>${headers.map((h) => `<th>${escapeHtmlInsights(h)}</th>`).join('')}</tr></thead>`;
  const body = rows.map((cells) => (
    `<tr>${cells.map((c) => `<td>${escapeHtmlInsights(c)}</td>`).join('')}</tr>`
  )).join('');
  return `${head}<tbody>${body}</tbody>`;
}

function dash(value) {
  return (value === null || value === undefined || value === '') ? '—' : value;
}

document.addEventListener('bitebook:ready', async () => {
  const loadingEl = document.getElementById('insights-loading');
  const deniedEl = document.getElementById('insights-denied');
  const bodyEl = document.getElementById('insights-body');
  const errorEl = document.getElementById('insights-error');

  const profile = BiteBookProfile.get();
  if (!profile || !profile.isAdmin) {
    loadingEl.style.display = 'none';
    deniedEl.style.display = 'block';
    return;
  }

  async function rpc(name) {
    const { data, error } = await supabaseClient.rpc(name);
    if (error) throw error;
    return data || [];
  }

  let overview, retention, funnel, people, weekly, pages;
  try {
    [overview, retention, funnel, people, weekly, pages] = await Promise.all([
      rpc('admin_overview'),
      rpc('admin_retention'),
      rpc('admin_funnel'),
      rpc('admin_people'),
      rpc('admin_weekly'),
      rpc('admin_pages'),
    ]);
  } catch (err) {
    loadingEl.style.display = 'none';
    bodyEl.style.display = 'block';
    errorEl.textContent = `⚠️ Couldn't load the numbers: ${err.message || err}. If this is the first time, run supabase/migrations/006_admin_insights.sql in the Supabase SQL editor.`;
    errorEl.classList.add('error');
    return;
  }

  loadingEl.style.display = 'none';
  bodyEl.style.display = 'block';

  // ---------- headline ----------
  const o = overview[0] || {};
  document.getElementById('insights-overview').innerHTML = [
    tile(dash(o.people), 'People signed up'),
    tile(dash(o.people_with_entries), 'Have logged a meal'),
    tile(dash(o.entries), 'Entries in total'),
    tile(dash(o.entries_last_7), 'Entries this week'),
    tile(dash(o.active_last_7), 'Opened it (7 days)'),
    tile(dash(o.active_last_30), 'Opened it (30 days)'),
  ].join('');

  // ---------- retention ----------
  document.getElementById('insights-retention').innerHTML = retention.map((r) => tile(
    r.pct === null ? '—' : `${r.pct}%`,
    `Back after ${r.window_days} days (${r.returned} of ${r.cohort})`
  )).join('') || tile('—', 'Nobody has been here long enough yet');

  // ---------- funnel ----------
  const top = funnel.length ? Math.max(...funnel.map((f) => Number(f.people) || 0)) : 0;
  document.getElementById('insights-funnel').innerHTML = funnel.map((f) => {
    const count = Number(f.people) || 0;
    const width = top > 0 ? Math.max(4, Math.round((count / top) * 100)) : 4;
    return `
      <div class="insights-bar-row">
        <span class="insights-bar-label">${escapeHtmlInsights(f.step)}</span>
        <span class="insights-bar-track"><span class="insights-bar-fill" style="width: ${width}%;"></span></span>
        <span class="insights-bar-value">${count}</span>
      </div>
    `;
  }).join('') || '<p class="insights-empty">Nothing recorded yet.</p>';

  // ---------- per person ----------
  document.getElementById('insights-people').innerHTML = table(
    ['Person', 'Entries', 'First', 'Last', 'Days opened', 'Came back, logged nothing', '% pure remember', 'Last seen'],
    people.map((p) => [
      dash(p.name) === '—' ? '(no name set)' : p.name,
      p.entries,
      dash(p.first_entry),
      dash(p.last_entry),
      p.days_opened,
      p.days_opened_without_logging,
      p.pct_pure_remember === null ? '—' : `${p.pct_pure_remember}%`,
      dash(p.last_seen),
    ])
  );

  // ---------- people and plans ----------
  // Loaded separately from the six reports above: if migration 009 hasn't
  // been run, this section says so on its own instead of taking the whole
  // page down with it.
  const rolesEl = document.getElementById('insights-roles');
  const rolesStatus = document.getElementById('roles-status');

  async function renderRoles() {
    let rows;
    try {
      rows = await rpc('admin_list_roles');
    } catch (err) {
      rolesEl.innerHTML = '';
      rolesStatus.textContent = `⚠️ Plans aren't set up yet — run supabase/migrations/009_roles.sql in the Supabase SQL editor. (${err.message || err})`;
      rolesStatus.classList.add('error');
      return;
    }

    if (!rows.length) {
      rolesEl.innerHTML = `<tbody><tr><td class="insights-empty">Nobody has signed up yet.</td></tr></tbody>`;
      return;
    }

    const head = `<thead><tr><th>Person</th><th>Joined</th><th>Entries</th><th>Plan</th></tr></thead>`;
    const body = rows.map((r) => {
      const name = r.name ? escapeHtmlInsights(r.name) : '(no name set)';
      const admin = r.is_admin ? ' <span class="role-admin-badge">admin</span>' : '';
      const options = [['general', 'Free'], ['power', 'Power']]
        .map(([value, label]) => `<option value="${value}"${r.role === value ? ' selected' : ''}>${label}</option>`)
        .join('');
      return `<tr>
        <td>${name}${admin}</td>
        <td>${escapeHtmlInsights(dash(r.joined))}</td>
        <td>${escapeHtmlInsights(r.entries)}</td>
        <td><select class="role-select" data-user="${escapeHtmlInsights(r.user_id)}">${options}</select></td>
      </tr>`;
    }).join('');
    rolesEl.innerHTML = `${head}<tbody>${body}</tbody>`;

    rolesEl.querySelectorAll('.role-select').forEach((select) => {
      const previous = select.value;
      select.addEventListener('change', async () => {
        select.disabled = true;
        rolesStatus.classList.remove('error');
        rolesStatus.textContent = 'Saving...';
        const { error } = await supabaseClient.rpc('admin_set_role', {
          target_user: select.dataset.user,
          new_role: select.value,
        });
        select.disabled = false;
        if (error) {
          // Put the dropdown back where it was rather than leaving it
          // showing a plan that was never saved.
          select.value = previous;
          rolesStatus.textContent = `⚠️ Couldn't change that: ${error.message || error}`;
          rolesStatus.classList.add('error');
          return;
        }
        rolesStatus.textContent = '✅ Saved.';
        await renderRoles();
      });
    });
  }

  renderRoles();

  // ---------- weekly ----------
  document.getElementById('insights-weekly').innerHTML = table(
    ['Week beginning', 'People who opened it', 'Sessions', 'Entries created'],
    weekly.map((w) => [w.week, w.people_opened, w.sessions, w.entries])
  );

  // ---------- pages ----------
  document.getElementById('insights-pages').innerHTML = table(
    ['Page', 'Views', 'People'],
    pages.map((p) => [dash(p.page), p.views, p.people])
  );
});
