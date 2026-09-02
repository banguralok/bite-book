// Supabase-backed. See supabase/schema.sql for the entries table shape
// and supabase/migrations/002_ranking_and_photos.sql for the photos
// Storage bucket. RLS on `entries` already scopes every query to
// "your own rows, or rows explicitly shared with you" — no client-side
// filtering by owner needed here.
const BiteBookStorage = (() => {
  const PHOTOS_BUCKET = 'photos';

  // camelCase (JS) <-> snake_case (Postgres) — id/createdAt/updatedAt and
  // the media fields (photos/videos/ingredientsFile) are handled separately
  // below since they need more than a name change.
  const FIELD_MAP = [
    ['food', 'food'],
    ['mealType', 'meal_type'],
    ['mealTypeAutoPicked', 'meal_type_auto_picked'],
    ['cuisine', 'cuisine'],
    ['ateOn', 'ate_on'],
    ['timeMode', 'time_mode'],
    ['timeOfDay', 'time_of_day'],
    ['timeAutoPicked', 'time_auto_picked'],
    ['exactTime', 'exact_time'],
    ['placeName', 'place_name'],
    ['placeAddress', 'place_address'],
    ['placeType', 'place_type'],
    ['placeSource', 'place_source'],
    ['coords', 'coords'],
    ['companionTypes', 'companion_types'],
    ['companionFamilyIds', 'companion_family_ids'],
    ['companionNames', 'companion_names'],
    ['madeBy', 'made_by'],
    ['madeByName', 'made_by_name'],
    ['reason', 'reason'],
    ['occasionDate', 'occasion_date'],
    ['ingredientsText', 'ingredients_text'],
    ['ingredientsLink', 'ingredients_link'],
    ['likedQualities', 'liked_qualities'],
    ['likedOther', 'liked_other'],
    ['rating', 'rating'],
    ['wouldEatAgain', 'would_eat_again'],
    ['eatAgainFrequency', 'eat_again_frequency'],
    ['personalRank', 'personal_rank'],
    ['reflection', 'reflection'],
    ['status', 'status'],
    ['aiParsed', 'ai_parsed'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
  ];

  function newId() {
    return crypto.randomUUID();
  }

  async function currentUserId() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session ? data.session.user.id : null;
  }

  // ---------- media: upload (save) and signed-url resolution (fetch) ----------

  function dataUrlToBlob(dataUrl) {
    const [header, base64] = dataUrl.split(',');
    const mimeMatch = /data:(.*?);base64/.exec(header);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  }

  async function uploadMedia(entryId, dataUrl, filename) {
    const userId = await currentUserId();
    const blob = dataUrlToBlob(dataUrl);
    const path = `${userId}/${entryId}/${newId()}-${filename}`;
    const { error } = await supabaseClient.storage
      .from(PHOTOS_BUCKET)
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    return path;
  }

  async function resolveSignedUrl(path) {
    if (!path) return null;
    const { data, error } = await supabaseClient.storage
      .from(PHOTOS_BUCKET)
      .createSignedUrl(path, 3600);
    return error ? null : data.signedUrl;
  }

  async function preparePhotosForSave(entryId, photos) {
    const results = [];
    for (const photo of photos || []) {
      if (photo.path) {
        results.push({ path: photo.path, width: photo.width, height: photo.height, size: photo.size });
      } else if (photo.dataUrl) {
        const path = await uploadMedia(entryId, photo.dataUrl, 'photo.jpg');
        results.push({ path, width: photo.width, height: photo.height, size: photo.size });
      }
    }
    return results;
  }

  async function prepareVideosForSave(entryId, videos) {
    const results = [];
    for (const video of videos || []) {
      if (video.kind === 'link') {
        results.push(video);
      } else if (video.path) {
        results.push({ kind: 'file', name: video.name, type: video.type, size: video.size, path: video.path });
      } else if (video.dataUrl) {
        const path = await uploadMedia(entryId, video.dataUrl, video.name || 'video');
        results.push({ kind: 'file', name: video.name, type: video.type, size: video.size, path });
      }
    }
    return results;
  }

  async function prepareIngredientsFileForSave(entryId, file) {
    if (!file) return null;
    if (file.path) return { name: file.name, type: file.type, size: file.size, path: file.path };
    if (file.dataUrl) {
      const path = await uploadMedia(entryId, file.dataUrl, file.name || 'file');
      return { name: file.name, type: file.type, size: file.size, path };
    }
    return null;
  }

  async function resolvePhotosForDisplay(photos) {
    const results = [];
    for (const photo of photos || []) {
      results.push({ ...photo, url: await resolveSignedUrl(photo.path) });
    }
    return results;
  }

  async function resolveVideosForDisplay(videos) {
    const results = [];
    for (const video of videos || []) {
      if (video.kind === 'link') {
        results.push(video);
      } else {
        results.push({ ...video, url: await resolveSignedUrl(video.path) });
      }
    }
    return results;
  }

  async function resolveIngredientsFileForDisplay(file) {
    if (!file) return null;
    return { ...file, url: await resolveSignedUrl(file.path) };
  }

  // ---------- row <-> entry mapping ----------

  async function mapRowToEntry(row) {
    const entry = { id: row.id, ownerId: row.owner_id };
    FIELD_MAP.forEach(([camel, snake]) => {
      entry[camel] = row[snake] !== undefined ? row[snake] : null;
    });
    entry.photos = await resolvePhotosForDisplay(row.photos);
    entry.videos = await resolveVideosForDisplay(row.videos);
    entry.ingredientsFile = await resolveIngredientsFileForDisplay(row.ingredients_file);
    return entry;
  }

  async function mapEntryToRow(entry, ownerId) {
    const row = { id: entry.id, owner_id: ownerId };
    FIELD_MAP.forEach(([camel, snake]) => {
      if (entry[camel] !== undefined) row[snake] = entry[camel];
    });
    row.photos = await preparePhotosForSave(entry.id, entry.photos || []);
    row.videos = await prepareVideosForSave(entry.id, entry.videos || []);
    row.ingredients_file = await prepareIngredientsFileForSave(entry.id, entry.ingredientsFile);
    return row;
  }

  // ---------- CRUD ----------

  async function getEntry(id) {
    const { data, error } = await supabaseClient.from('entries').select('*').eq('id', id).single();
    if (error || !data) return null;
    return mapRowToEntry(data);
  }

  async function saveEntry(entry) {
    const ownerId = await currentUserId();
    if (!ownerId) return false;
    const row = await mapEntryToRow(entry, ownerId);
    const { error } = await supabaseClient.from('entries').upsert(row);
    return !error;
  }

  async function deleteEntry(id) {
    await supabaseClient.from('entries').delete().eq('id', id);
  }

  async function listEntries() {
    const { data, error } = await supabaseClient
      .from('entries')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error || !data) return [];
    return Promise.all(data.map(mapRowToEntry));
  }

  // ---------- export / import ----------

  async function exportAllAsJson() {
    const entries = await listEntries();
    const entriesById = {};
    entries.forEach((e) => { entriesById[e.id] = e; });
    const profile = (typeof BiteBookProfile !== 'undefined') ? BiteBookProfile.get() : null;
    return JSON.stringify(
      { exportedAt: new Date().toISOString(), entries: entriesById, profile },
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

  async function importFromJson(jsonString, mode) {
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

    const ownerId = await currentUserId();
    if (!ownerId) return { ok: false, error: 'You need to be signed in to import.' };

    if (mode === 'replace') {
      await supabaseClient.from('entries').delete().eq('owner_id', ownerId);
    }

    const entries = Object.values(incoming).map(sanitizeIncomingEntry);
    let successCount = 0;
    for (const entry of entries) {
      const row = await mapEntryToRow(entry, ownerId);
      const { error } = await supabaseClient.from('entries').upsert(row);
      if (!error) successCount += 1;
    }

    if (parsed.profile && typeof parsed.profile === 'object' && typeof BiteBookProfile !== 'undefined') {
      try {
        await BiteBookProfile.save(parsed.profile);
      } catch (e) {
        // profile import is best-effort; entries already saved successfully
      }
    }

    return { ok: true, count: successCount };
  }

  async function duplicateForLogAgain(source) {
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
    await saveEntry(fresh);
    return fresh.id;
  }

  // ---------- ranking order ----------

  async function getRankingOrder() {
    const userId = await currentUserId();
    if (!userId) return [];
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('ranking_order')
      .eq('id', userId)
      .single();
    return (error || !data) ? [] : (data.ranking_order || []);
  }

  async function setRankingOrder(orderedIds) {
    const userId = await currentUserId();
    if (!userId) return false;
    const { error } = await supabaseClient
      .from('profiles')
      .update({ ranking_order: orderedIds })
      .eq('id', userId);
    return !error;
  }

  // ---------- sharing ----------

  async function listDirectory() {
    const userId = await currentUserId();
    const { data, error } = await supabaseClient
      .from('profile_directory')
      .select('id, name, avatar');
    if (error || !data) return [];
    return data.filter((p) => p.id !== userId);
  }

  async function getShareUserIds(entryId) {
    const { data, error } = await supabaseClient
      .from('shares')
      .select('shared_with')
      .eq('entry_id', entryId);
    if (error || !data) return new Set();
    return new Set(data.map((row) => row.shared_with));
  }

  async function shareEntry(entryId, userId) {
    const ownerId = await currentUserId();
    if (!ownerId) return false;
    const { error } = await supabaseClient
      .from('shares')
      .insert({ entry_id: entryId, shared_with: userId, shared_by: ownerId });
    return !error;
  }

  async function unshareEntry(entryId, userId) {
    const { error } = await supabaseClient
      .from('shares')
      .delete()
      .eq('entry_id', entryId)
      .eq('shared_with', userId);
    return !error;
  }

  return {
    newId,
    getCurrentUserId: currentUserId,
    getEntry,
    saveEntry,
    deleteEntry,
    listEntries,
    exportAllAsJson,
    importFromJson,
    duplicateForLogAgain,
    getRankingOrder,
    setRankingOrder,
    listDirectory,
    getShareUserIds,
    shareEntry,
    unshareEntry,
  };
})();
