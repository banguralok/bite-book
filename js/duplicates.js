// Cross-user duplicate detection: catches the case where two different
// people (now that entries can be shared) log what's actually the same
// real-world meal. Runs client-side using the narrow entry_signatures
// view (place/date/owner only — see supabase/migrations/003) so it never
// needs to see another user's private entry content to spot an overlap.
// See supabase/migrations/003_duplicate_detection.sql for the schema.

const DUPLICATE_DATE_WINDOW_DAYS = 1;
const DUPLICATE_COORDS_METERS = 1500;

function datesLikelySame(a, b) {
  if (!a || !b) return false;
  const diffMs = Math.abs(new Date(a) - new Date(b));
  return diffMs <= DUPLICATE_DATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function coordsLikelySame(a, b) {
  if (!a || !b || typeof a.lat !== 'number' || typeof b.lat !== 'number') return true;
  if (typeof distanceMeters !== 'function') return true;
  return distanceMeters(a.lat, a.lon, b.lat, b.lon) <= DUPLICATE_COORDS_METERS;
}

function placesLikelySame(nameA, nameB) {
  if (!nameA || !nameB) return false;
  const a = normalizePlaceName(nameA);
  const b = normalizePlaceName(nameB);
  if (!a || !b) return false;
  return a === b || (a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b));
}

function pairKey(idA, idB) {
  return [idA, idB].sort().join('|');
}

async function maybeReportMissingDetails(mine, otherOwnerId, otherEntryId, coveredKeys) {
  const key = `missing:${pairKey(mine.id, otherEntryId)}`;
  if (coveredKeys.has(key)) return;

  const theirs = await BiteBookStorage.getEntry(otherEntryId);
  if (!theirs) return; // no read access yet — nothing to compare, nothing lost

  const keep = new Date(mine.createdAt) <= new Date(theirs.createdAt) ? mine : theirs;
  const other = keep === mine ? theirs : mine;

  const missing = [];
  if ((other.photos || []).length > (keep.photos || []).length) missing.push('photos');
  if (!keep.ingredientsText && !keep.ingredientsLink && !keep.ingredientsFile
    && (other.ingredientsText || other.ingredientsLink || other.ingredientsFile)) missing.push('ingredients');
  if (!keep.reflection && other.reflection) missing.push('a reflection');
  if (missing.length === 0) return;

  await BiteBookStorage.reportPossibleDuplicate(
    mine.id,
    otherOwnerId,
    otherEntryId,
    'missing_details',
    `One of these two similar entries is missing details (${missing.join(', ')}) that the other one has — worth checking before you decide which to keep.`
  );
  coveredKeys.add(key);
}

async function checkForCrossUserDuplicates(myAllEntries) {
  const myId = await BiteBookStorage.getCurrentUserId();
  if (!myId) return;

  const myOwn = myAllEntries.filter((e) => e.ownerId === myId && e.status === 'complete' && e.placeName);
  if (myOwn.length === 0) return;

  const otherSignatures = await BiteBookStorage.getOtherEntrySignatures();
  if (otherSignatures.length === 0) return;

  const existing = await BiteBookStorage.getNotifications();
  const coveredKeys = new Set();
  existing.forEach((n) => {
    if (n.otherEntryId) coveredKeys.add(`${n.type === 'missing_details' ? 'missing' : 'dup'}:${pairKey(n.entryId, n.otherEntryId)}`);
  });

  for (const mine of myOwn) {
    for (const sig of otherSignatures) {
      if (!sig.place_name) continue;
      if (!placesLikelySame(mine.placeName, sig.place_name)) continue;
      if (!datesLikelySame(mine.ateOn, sig.ate_on)) continue;
      if (!coordsLikelySame(mine.coords, sig.coords)) continue;

      const key = `dup:${pairKey(mine.id, sig.id)}`;
      if (coveredKeys.has(key)) continue;
      coveredKeys.add(key);

      const connected = await BiteBookStorage.isConnectedByShare(mine.id, sig.id, sig.owner_id);
      const type = connected ? 'possible_duplicate' : 'possible_duplicate_unshared';
      const message = `Possible duplicate — two entries for ${mine.placeName} around ${mine.ateOn || 'the same time'}. The earlier one is treated as the main entry.`;

      await BiteBookStorage.reportPossibleDuplicate(mine.id, sig.owner_id, sig.id, type, message);

      if (connected) {
        await maybeReportMissingDetails(mine, sig.owner_id, sig.id, coveredKeys);
      }
    }
  }
}
