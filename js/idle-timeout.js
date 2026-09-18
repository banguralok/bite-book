// Auto sign-out after a stretch with no interaction — common session-timeout
// guidance (OWASP's session management advice) puts 15-30 minutes as the
// normal idle window for an ordinary app; this uses the short end of that.
//
// "Last activity" lives in localStorage, not a variable, for two reasons:
// it survives the tab being closed and reopened (so a session that sat idle
// overnight is caught the moment the app is opened again, not 15 minutes
// after), and it's shared across every open tab (so switching between two
// Bite Book tabs you're both using doesn't get either one logged out from
// under you).
const BiteBookIdleTimeout = (() => {
  const LIMIT_MS = 15 * 60 * 1000;
  const CHECK_INTERVAL_MS = 30 * 1000;
  const WRITE_THROTTLE_MS = 5 * 1000;
  const STORAGE_KEY = 'bb_last_activity';
  const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel'];

  let lastWrite = 0;
  let intervalId = null;
  let started = false;

  function readLastActivity() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : Date.now();
  }

  function touch() {
    const t = Date.now();
    if (t - lastWrite < WRITE_THROTTLE_MS) return;
    lastWrite = t;
    try { localStorage.setItem(STORAGE_KEY, String(t)); } catch (e) {}
  }

  function onVisible() {
    if (document.visibilityState === 'visible') check();
  }

  function check() {
    if (Date.now() - readLastActivity() >= LIMIT_MS) forceLogout();
  }

  function forceLogout() {
    stop();
    if (typeof signOut === 'function') signOut('login.html?reason=idle');
  }

  function stop() {
    started = false;
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    ACTIVITY_EVENTS.forEach((evt) => document.removeEventListener(evt, touch));
    document.removeEventListener('visibilitychange', onVisible);
  }

  function start() {
    if (started) return;
    started = true;
    // Found already stale on arrival (tab reopened after sitting closed, or
    // the OS suspended a background tab) counts the same as watching the
    // clock run out while sitting here.
    if (Date.now() - readLastActivity() >= LIMIT_MS) {
      forceLogout();
      return;
    }
    touch();
    ACTIVITY_EVENTS.forEach((evt) => document.addEventListener(evt, touch, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    intervalId = setInterval(check, CHECK_INTERVAL_MS);
  }

  return { start };
})();
