// Logging streaks, with food-shaped names for the milestones.
//
// A streak counts DAYS THAT HAVE A MEAL ON THEM (an entry's "ate on" date),
// not days someone happened to open the app — so backfilling last weekend's
// dinner properly repairs last weekend's streak.
//
// Today counts as "not broken yet": until midnight, a run that ended
// yesterday is still alive, so nobody is told they lost a streak at 9am for a
// meal they haven't eaten.
const BiteBookStreak = (() => {
  const CELEBRATED_KEY = 'bitebook:streakCelebrated';

  // Ordered high to low so currentMilestone() can return the first match.
  const MILESTONES = [
    { days: 365, name: 'A Whole Year at the Table', icon: '🏆' },
    { days: 100, name: 'Legendary Larder', icon: '🌟' },
    { days: 50, name: 'Michelin Mood', icon: '⭐' },
    { days: 30, name: 'Head Chef Month', icon: '👨‍🍳' },
    { days: 21, name: 'Well Seasoned', icon: '🧂' },
    { days: 14, name: 'Slow-Cooked Fortnight', icon: '🥘' },
    { days: 10, name: 'Double Digits', icon: '🍩' },
    { days: 7, name: 'Full Course Week', icon: '🍱' },
    { days: 5, name: 'On the Boil', icon: '🔥' },
    { days: 3, name: 'Simmering', icon: '🍲' },
    { days: 2, name: 'Second Helping', icon: '🥄' },
    { days: 1, name: 'First Bite', icon: '🍪' },
  ];

  function shiftDay(dateStr, delta) {
    const d = parseDateInputValue(dateStr);
    d.setDate(d.getDate() + delta);
    return toDateInputValue(d);
  }

  function compute(dates) {
    const days = new Set(dates.filter(Boolean));
    const today = toDateInputValue(new Date());
    const yesterday = shiftDay(today, -1);

    // Count back from today if today is logged, otherwise from yesterday —
    // see the note at the top about not breaking a streak before bedtime.
    let anchor = null;
    if (days.has(today)) anchor = today;
    else if (days.has(yesterday)) anchor = yesterday;

    let current = 0;
    if (anchor) {
      let cursor = anchor;
      while (days.has(cursor)) {
        current += 1;
        cursor = shiftDay(cursor, -1);
      }
    }

    let longest = 0;
    let run = 0;
    let previous = null;
    Array.from(days).sort().forEach((day) => {
      run = (previous && shiftDay(previous, 1) === day) ? run + 1 : 1;
      if (run > longest) longest = run;
      previous = day;
    });

    return {
      current,
      longest,
      loggedToday: days.has(today),
      totalDays: days.size,
    };
  }

  function currentMilestone(streakDays) {
    return MILESTONES.find((m) => streakDays >= m.days) || null;
  }

  function nextMilestone(streakDays) {
    const ahead = MILESTONES.filter((m) => m.days > streakDays);
    return ahead.length ? ahead[ahead.length - 1] : null;
  }

  function getCelebrated() {
    try {
      return new Set(JSON.parse(localStorage.getItem(CELEBRATED_KEY) || '[]'));
    } catch (err) {
      return new Set();
    }
  }

  // A milestone is celebrated once, ever — reaching 7 days again next month
  // should feel like a return, not a repeat of the same confetti.
  function markCelebrated(days) {
    const seen = getCelebrated();
    seen.add(String(days));
    try {
      localStorage.setItem(CELEBRATED_KEY, JSON.stringify(Array.from(seen)));
    } catch (err) {
      // Refused storage just means the toast may appear once more later.
    }
  }

  function isNewMilestone(streakDays) {
    const milestone = currentMilestone(streakDays);
    if (!milestone || milestone.days !== streakDays) return null;
    return getCelebrated().has(String(milestone.days)) ? null : milestone;
  }

  function copyFor(streak) {
    const milestone = currentMilestone(streak.current);

    if (streak.current === 0) {
      if (streak.totalDays === 0) return null;
      return {
        icon: '🍳',
        title: 'No streak going right now',
        sub: streak.longest > 1
          ? `Your best run was ${streak.longest} days. Log something today and the pot's back on.`
          : 'Log a meal today and you have got one going.',
      };
    }

    const dayWord = streak.current === 1 ? 'day' : 'days';
    const sub = streak.loggedToday
      ? (nextMilestone(streak.current)
        ? `${nextMilestone(streak.current).days - streak.current} more ${nextMilestone(streak.current).days - streak.current === 1 ? 'day' : 'days'} to "${nextMilestone(streak.current).name}".`
        : 'Nothing left to unlock — you have cooked the whole book.')
      : 'Log today to keep it alive.';

    return {
      icon: milestone ? milestone.icon : '🔥',
      title: `${streak.current}-${dayWord} streak${milestone ? ` · ${milestone.name}` : ''}`,
      sub,
    };
  }

  function escapeHtmlStreak(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function render(containerId, dates) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const streak = compute(dates);
    const copy = copyFor(streak);
    if (!copy) {
      container.style.display = 'none';
      container.innerHTML = '';
      return streak;
    }

    container.style.display = 'flex';
    container.innerHTML = `
      <span class="streak-flame">${copy.icon}</span>
      <span class="streak-copy">
        <span class="streak-title">${escapeHtmlStreak(copy.title)}</span>
        <span class="streak-sub">${escapeHtmlStreak(copy.sub)}</span>
      </span>
    `;

    const fresh = isNewMilestone(streak.current);
    if (fresh) {
      markCelebrated(fresh.days);
      showToast(`${fresh.icon} ${fresh.days}-day streak — "${fresh.name}" unlocked!`);
    }

    return streak;
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'streak-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 400);
    }, 5000);
  }

  return { compute, currentMilestone, nextMilestone, render, MILESTONES };
})();
