const BiteBookProfile = (() => {
  const PROFILE_KEY = 'biteBookProfile';

  function get() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function save(profile) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear() {
    localStorage.removeItem(PROFILE_KEY);
  }

  return { get, save, clear };
})();
