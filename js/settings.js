// Deliberately separate from BiteBookProfile/biteBookProfile — this holds the
// Gemini API key, which must never end up in exportAllAsJson()'s backup file.
const BiteBookSettings = (() => {
  const SETTINGS_KEY = 'biteBookSettings';

  function get() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function save(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch (e) {
      return false;
    }
  }

  return { get, save };
})();
