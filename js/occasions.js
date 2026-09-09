// Upcoming-occasion reminders.
//
// On This Day looks backwards — "here's what you ate a year ago today". This
// looks forwards: "someone's birthday is in three days, and here's what you
// ate for it last time." It runs entirely off the birthdays and anniversaries
// already saved on the Profile page, so it needs no new table and no server.
//
// True push notifications would need a scheduler and Web Push, neither of
// which this app has. An in-app banner is the honest version of the same idea
// — it can only speak when someone opens Bite Book, and it says so by simply
// being part of the page rather than pretending to be a notification.
const BiteBookOccasions = (() => {
  const LOOKAHEAD_DAYS = 14;
  const DISMISSED_KEY = 'bitebook:occasionsDismissed';

  function getDismissed() {
    try {
      return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'));
    } catch (err) {
      return new Set();
    }
  }

  function dismiss(key) {
    const dismissed = getDismissed();
    dismissed.add(key);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(dismissed)));
    } catch (err) {
      // Private browsing can refuse localStorage. The banner simply comes
      // back on the next visit, which is a much smaller problem than a crash.
    }
  }

  // Feb 29 falls back to Mar 1 in a non-leap year, which is what the built-in
  // Date rollover does on its own. Close enough for a reminder.
  function nextOccurrence(monthDay, today) {
    const [m, d] = monthDay.split('-').map(Number);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let date = new Date(today.getFullYear(), m - 1, d);
    if (date < todayMidnight) date = new Date(today.getFullYear() + 1, m - 1, d);
    return date;
  }

  function daysBetween(from, to) {
    return Math.round((to - from) / 86400000);
  }

  function collectOccasions(profile) {
    const out = [];
    if (!profile) return out;
    if (profile.birthday) {
      out.push({ icon: '🎂', label: 'Your birthday', monthDay: monthDayOf(profile.birthday) });
    }
    if (profile.anniversary) {
      out.push({ icon: '💍', label: 'Your anniversary', monthDay: monthDayOf(profile.anniversary) });
    }
    (profile.familyMembers || []).forEach((member) => {
      const who = familyMemberDisplayName(member);
      if (!who) return;
      if (member.birthday) {
        out.push({ icon: '🎂', label: `${who}'s birthday`, monthDay: monthDayOf(member.birthday) });
      }
      if (member.anniversary) {
        out.push({ icon: '💍', label: `${who}'s anniversary`, monthDay: monthDayOf(member.anniversary) });
      }
    });
    return out.filter((o) => o.monthDay);
  }

  // The most recent complete meal logged on that same month and day in an
  // earlier year — "what we did last time" is the whole point of the reminder.
  function lastTimeEntry(entries, monthDay) {
    const matches = entries.filter((e) => (
      e.status === 'complete' && e.ateOn && monthDayOf(e.ateOn) === monthDay
    ));
    matches.sort((a, b) => (a.ateOn < b.ateOn ? 1 : -1));
    return matches[0] || null;
  }

  function findUpcoming(profile, entries) {
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dismissed = getDismissed();

    return collectOccasions(profile)
      .map((occasion) => {
        const date = nextOccurrence(occasion.monthDay, today);
        const daysAway = daysBetween(todayMidnight, date);
        return {
          ...occasion,
          date,
          daysAway,
          key: `${occasion.label}:${date.getFullYear()}`,
          lastTime: lastTimeEntry(entries, occasion.monthDay),
        };
      })
      .filter((o) => o.daysAway >= 0 && o.daysAway <= LOOKAHEAD_DAYS && !dismissed.has(o.key))
      .sort((a, b) => a.daysAway - b.daysAway);
  }

  function whenLabel(daysAway) {
    if (daysAway === 0) return 'Today';
    if (daysAway === 1) return 'Tomorrow';
    return `In ${daysAway} days`;
  }

  function escapeHtmlOccasion(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function render(containerId, profile, entries) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const upcoming = findUpcoming(profile, entries);
    if (upcoming.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.style.display = 'flex';
    container.innerHTML = upcoming.map((o) => {
      const photo = o.lastTime && o.lastTime.photos && o.lastTime.photos[0];
      const thumb = photo
        ? `<img class="on-this-day-photo" src="${photo.url}" alt="">`
        : `<div class="on-this-day-photo-placeholder">${o.icon}</div>`;

      const meta = o.lastTime
        ? `Last time: ${[o.lastTime.food, o.lastTime.placeName].filter(Boolean).join(' at ')}`
        : 'Nothing logged for it yet — this could be the year.';

      const action = o.lastTime
        ? `<a class="link-pill" href="entry-view.html?id=${encodeURIComponent(o.lastTime.id)}">See it</a>`
        : `<a class="link-pill" href="smart-entry.html">Plan it</a>`;

      return `
        <div class="on-this-day-card">
          ${thumb}
          <div class="on-this-day-info">
            <span class="on-this-day-label">${o.icon} ${escapeHtmlOccasion(whenLabel(o.daysAway))}</span>
            <strong>${escapeHtmlOccasion(o.label)}</strong>
            <span class="on-this-day-meta">${escapeHtmlOccasion(meta)}</span>
          </div>
          <div class="on-this-day-actions">
            ${action}
            <button type="button" class="dedupe-banner-dismiss" data-dismiss-occasion="${escapeHtmlOccasion(o.key)}" aria-label="Dismiss this reminder">✕</button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-dismiss-occasion]').forEach((btn) => {
      btn.addEventListener('click', () => {
        dismiss(btn.dataset.dismissOccasion);
        render(containerId, profile, entries);
      });
    });
  }

  return { findUpcoming, render };
})();
