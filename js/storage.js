const BiteBookStorage = (() => {
  const STORAGE_KEY = 'biteBookEntries';
  const RANKING_KEY = 'biteBookRankingOrder';

  function readAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      return true;
    } catch (e) {
      return false;
    }
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'e-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }

  function getEntry(id) {
    const entries = readAll();
    return entries[id] || null;
  }

  function saveEntry(entry) {
    const entries = readAll();
    entries[entry.id] = entry;
    return writeAll(entries);
  }

  function deleteEntry(id) {
    const entries = readAll();
    delete entries[id];
    writeAll(entries);
  }

  function listEntries() {
    const entries = readAll();
    return Object.values(entries).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }

  function exportAllAsJson() {
    let profile = null;
    try {
      const raw = localStorage.getItem('biteBookProfile');
      profile = raw ? JSON.parse(raw) : null;
    } catch (e) {
      profile = null;
    }
    return JSON.stringify(
      { exportedAt: new Date().toISOString(), entries: readAll(), profile },
      null,
      2
    );
  }

  function isSafeImportUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
  }

  function sanitizeIncomingEntry(entry) {
    if (entry && entry.ingredientsLink && !isSafeImportUrl(entry.ingredientsLink)) {
      entry.ingredientsLink = null;
    }
    if (entry && Array.isArray(entry.videos)) {
      entry.videos = entry.videos.filter(
        (v) => v && (v.kind !== 'link' || isSafeImportUrl(v.url))
      );
    }
    return entry;
  }

  function importFromJson(jsonString, mode) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      return { ok: false, error: 'That file isn\'t valid — it doesn\'t look like a Bite Book export.' };
    }
    const incoming = parsed && parsed.entries;
    if (!incoming || typeof incoming !== 'object') {
      return { ok: false, error: 'That file isn\'t valid — it doesn\'t look like a Bite Book export.' };
    }
    Object.values(incoming).forEach(sanitizeIncomingEntry);
    const current = mode === 'replace' ? {} : readAll();
    const merged = { ...current, ...incoming };
    const success = writeAll(merged);
    if (!success) {
      return { ok: false, error: "That didn't fit in your browser's storage." };
    }
    if (parsed.profile && typeof parsed.profile === 'object') {
      try {
        localStorage.setItem('biteBookProfile', JSON.stringify(parsed.profile));
      } catch (e) {
        // profile import is best-effort; entries already saved successfully
      }
    }
    return { ok: true, count: Object.keys(incoming).length };
  }

  function duplicateForLogAgain(source) {
    const carriedFields = [
      'food', 'mealType', 'mealTypeAutoPicked', 'cuisine',
      'placeName', 'placeAddress', 'placeType', 'placeSource', 'coords',
      'madeBy', 'madeByName',
      'ingredientsText', 'ingredientsLink', 'ingredientsFile',
    ];
    const now = new Date().toISOString();
    const fresh = { id: newId(), status: 'draft', createdAt: now, updatedAt: now };
    carriedFields.forEach((key) => {
      if (source[key] !== undefined) fresh[key] = source[key];
    });
    saveEntry(fresh);
    return fresh.id;
  }

  function getRankingOrder() {
    try {
      const raw = localStorage.getItem(RANKING_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setRankingOrder(orderedIds) {
    try {
      localStorage.setItem(RANKING_KEY, JSON.stringify(orderedIds));
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    newId,
    getEntry,
    saveEntry,
    deleteEntry,
    listEntries,
    exportAllAsJson,
    importFromJson,
    duplicateForLogAgain,
    getRankingOrder,
    setRankingOrder,
  };
})();
