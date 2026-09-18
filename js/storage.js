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
    ['drinks', 'drinks'],
    ['city', 'city'],
    ['country', 'country'],
    ['foodSource', 'food_source'],
    ['menuUrl', 'menu_url'],
    ['menuDishDescription', 'menu_dish_description'],
    ['status', 'status'],
    ['aiParsed', 'ai_parsed'],
    ['tripId', 'trip_id'],
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
      const caption = photo.caption || null;
      if (photo.path) {
        results.push({ path: photo.path, width: photo.width, height: photo.height, size: photo.size, caption });
      } else if (photo.dataUrl) {
        const path = await uploadMedia(entryId, photo.dataUrl, 'photo.jpg');
        results.push({ path, width: photo.width, height: photo.height, size: photo.size, caption });
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

  // ---------- inviting someone not yet on Bite Book ----------

  async function createInvite({ entryId, phone, email }) {
    const ownerId = await currentUserId();
    if (!ownerId) return null;
    const { data, error } = await supabaseClient
      .from('invites')
      .insert({
        entry_id: entryId,
        invited_by: ownerId,
        invited_phone: phone || null,
        invited_email: email || null,
        channel: phone ? 'sms' : 'email',
      })
      .select('id')
      .single();
    return (error || !data) ? null : data.id;
  }

  async function listInvitesForEntry(entryId) {
    const { data, error } = await supabaseClient
      .from('invites')
      .select('id, invited_phone, invited_email, channel, status')
      .eq('entry_id', entryId);
    return (error || !data) ? [] : data;
  }

  // ---------- cross-user duplicate detection ----------

  async function getOtherEntrySignatures() {
    const userId = await currentUserId();
    const { data, error } = await supabaseClient
      .from('entry_signatures')
      .select('id, owner_id, place_name, ate_on, coords, created_at')
      .neq('owner_id', userId);
    return (error || !data) ? [] : data;
  }

  async function getEntrySignature(entryId) {
    const { data, error } = await supabaseClient
      .from('entry_signatures')
      .select('id, owner_id, place_name, ate_on, coords, created_at')
      .eq('id', entryId)
      .maybeSingle();
    return (error || !data) ? null : data;
  }

  async function resolveDuplicateByRemovingMine(myEntryId, keepEntryId, grantShare) {
    const { error } = await supabaseClient.rpc('resolve_duplicate_by_removing_mine', {
      p_my_entry_id: myEntryId,
      p_keep_entry_id: keepEntryId,
      p_grant_share: grantShare,
    });
    return !error;
  }

  async function isConnectedByShare(entryIdA, entryIdB, otherOwnerId) {
    const userId = await currentUserId();
    const { data, error } = await supabaseClient
      .from('shares')
      .select('id')
      .in('entry_id', [entryIdA, entryIdB])
      .in('shared_with', [userId, otherOwnerId])
      .limit(1);
    return !error && data && data.length > 0;
  }

  async function reportPossibleDuplicate(myEntryId, otherOwnerId, otherEntryId, type, message) {
    const { error } = await supabaseClient.rpc('report_possible_duplicate', {
      p_my_entry_id: myEntryId,
      p_other_owner_id: otherOwnerId,
      p_other_entry_id: otherEntryId,
      p_type: type,
      p_message: message,
    });
    return !error;
  }

  async function getNotifications() {
    const { data, error } = await supabaseClient
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      type: row.type,
      entryId: row.entry_id,
      otherUserId: row.other_user_id,
      otherEntryId: row.other_entry_id,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    }));
  }

  async function countPendingNotifications() {
    const userId = await currentUserId();
    if (!userId) return 0;
    const { count, error } = await supabaseClient
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');
    return error ? 0 : (count || 0);
  }

  async function updateNotificationStatus(id, status) {
    const { error } = await supabaseClient
      .from('notifications')
      .update({ status })
      .eq('id', id);
    return !error;
  }

  // ---------- trips ----------

  function mapTripRow(row) {
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      startsOn: row.starts_on || null,
      endsOn: row.ends_on || null,
      city: row.city || null,
    };
  }

  async function listTrips() {
    const userId = await currentUserId();
    if (!userId) return [];
    const { data, error } = await supabaseClient
      .from('trips')
      .select('id, name, created_at, starts_on, ends_on, city')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    return (error || !data) ? [] : data.map(mapTripRow);
  }

  async function getTrip(id) {
    const { data, error } = await supabaseClient
      .from('trips')
      .select('id, name, created_at, starts_on, ends_on, city')
      .eq('id', id)
      .maybeSingle();
    return (error || !data) ? null : mapTripRow(data);
  }

  async function createTrip(name, opts) {
    const userId = await currentUserId();
    if (!userId) return null;
    const { data, error } = await supabaseClient
      .from('trips')
      .insert({
        id: newId(),
        owner_id: userId,
        name,
        starts_on: (opts && opts.startsOn) || null,
        ends_on: (opts && opts.endsOn) || null,
        city: (opts && opts.city) || null,
      })
      .select('id, name, created_at, starts_on, ends_on, city')
      .single();
    return (error || !data) ? null : mapTripRow(data);
  }

  async function deleteTrip(id) {
    const { error } = await supabaseClient.from('trips').delete().eq('id', id);
    return !error;
  }

  async function assignEntryToTrip(entryId, tripId) {
    const { error } = await supabaseClient
      .from('entries')
      .update({ trip_id: tripId })
      .eq('id', entryId);
    return !error;
  }

  // ---------- place notes ----------
  // A running note about a place ("always get the garlic naan"), not tied
  // to any one meal — see supabase/migrations/014_place_notes_and_trip_dates.sql.

  async function getPlaceNote(placeName) {
    const userId = await currentUserId();
    if (!userId || !placeName) return null;
    const { data, error } = await supabaseClient
      .from('place_notes')
      .select('note, updated_at')
      .eq('owner_id', userId)
      .eq('place_name', placeName)
      .maybeSingle();
    return (error || !data) ? null : { note: data.note, updatedAt: data.updated_at };
  }

  async function savePlaceNote(placeName, note) {
    const userId = await currentUserId();
    if (!userId || !placeName) return false;
    const trimmed = (note || '').trim();
    if (!trimmed) {
      const { error } = await supabaseClient
        .from('place_notes')
        .delete()
        .eq('owner_id', userId)
        .eq('place_name', placeName);
      return !error;
    }
    const { error } = await supabaseClient
      .from('place_notes')
      .upsert(
        { owner_id: userId, place_name: placeName, note: trimmed, updated_at: new Date().toISOString() },
        { onConflict: 'owner_id,place_name' }
      );
    return !error;
  }

  // ---------- recommendations ----------

  // The middle tier: what other households think, with nobody identifiable.
  // The three-household floor lives in the database (migration 011), not
  // here — a privacy rule enforced in the browser is a suggestion.
  async function recommendedPlaces(city) {
    const { data, error } = await supabaseClient.rpc('bb_recommend_places', {
      target_city: city || null,
    });
    if (error || !data) return [];
    return data.map((r) => ({
      placeName: r.place_name,
      city: r.city,
      country: r.country,
      cuisine: r.cuisine,
      households: Number(r.households),
      meals: Number(r.meals),
      avgRating: Number(r.avg_rating),
    }));
  }

  // ---------- want to try (wishlist) ----------

  function mapWishRow(row) {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      placeName: row.place_name,
      city: row.city || null,
      recommendedBy: row.recommended_by,
      note: row.note,
      status: row.status,
      entryId: row.entry_id,
      createdAt: row.created_at,
    };
  }

  async function listWishes() {
    const userId = await currentUserId();
    if (!userId) return [];
    const { data, error } = await supabaseClient
      .from('wishlist')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    return (error || !data) ? [] : data.map(mapWishRow);
  }

  async function createWish(wish) {
    const userId = await currentUserId();
    if (!userId) return null;
    const { data, error } = await supabaseClient
      .from('wishlist')
      .insert({
        id: newId(),
        owner_id: userId,
        kind: wish.kind || 'place',
        title: wish.title,
        place_name: wish.placeName || null,
        city: wish.city || null,
        recommended_by: wish.recommendedBy || null,
        note: wish.note || null,
      })
      .select('*')
      .single();
    return (error || !data) ? null : mapWishRow(data);
  }

  async function deleteWish(id) {
    const { error } = await supabaseClient.from('wishlist').delete().eq('id', id);
    return !error;
  }

  // Turns a wish into a real draft entry and links the two, so the list can
  // later show that a recommendation actually paid off rather than just
  // losing the row. A dish fills in the food; a place fills in where.
  async function logWish(wish) {
    const now = new Date().toISOString();
    const entry = {
      id: newId(),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      ateOn: toDateInputValue(new Date()),
    };
    if (wish.kind === 'dish') {
      entry.food = wish.title;
      if (wish.placeName) entry.placeName = wish.placeName;
    } else {
      entry.placeName = wish.title;
    }
    const saved = await saveEntry(entry);
    if (!saved) return null;

    const { error } = await supabaseClient
      .from('wishlist')
      .update({ status: 'done', entry_id: entry.id, updated_at: now })
      .eq('id', wish.id);
    if (error) return null;
    return entry.id;
  }

  async function reopenWish(id) {
    const { error } = await supabaseClient
      .from('wishlist')
      .update({ status: 'open', entry_id: null, updated_at: new Date().toISOString() })
      .eq('id', id);
    return !error;
  }

  return {
    newId,
    getCurrentUserId: currentUserId,
    recommendedPlaces,
    listWishes,
    createWish,
    deleteWish,
    logWish,
    reopenWish,
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
    createInvite,
    listInvitesForEntry,
    getOtherEntrySignatures,
    getEntrySignature,
    isConnectedByShare,
    reportPossibleDuplicate,
    resolveDuplicateByRemovingMine,
    getNotifications,
    countPendingNotifications,
    updateNotificationStatus,
    listTrips,
    getTrip,
    createTrip,
    deleteTrip,
    assignEntryToTrip,
    getPlaceNote,
    savePlaceNote,
  };
})();
