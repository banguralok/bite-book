function setChipSelected(chip, isSelected) {
  chip.classList.toggle('selected', isSelected);
  chip.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
}

// Used by js/step-nav.js (jump directly to any step while editing) and
// entry-view.js (per-section edit links). Kept separate from
// entries-list.js's STEP_SEQUENCE, which needs "is this step done"
// predicates for resuming drafts — a different concern from navigation.
const WIZARD_STEPS = [
  { page: 'entry.html', icon: '🍽️', label: 'What' },
  { page: 'entry-when.html', icon: '🕰️', label: 'When' },
  { page: 'entry-where.html', icon: '📍', label: 'Where' },
  { page: 'entry-who.html', icon: '👥', label: 'Who' },
  { page: 'entry-made.html', icon: '👩‍🍳', label: 'Made By' },
  { page: 'entry-why.html', icon: '🎈', label: 'Why' },
  { page: 'entry-ingredients.html', icon: '🥕', label: 'Ingredients' },
  { page: 'entry-loved.html', icon: '💛', label: 'Loved It' },
  { page: 'entry-photos.html', icon: '📸', label: 'Photos' },
];

const FAMILY_RELATIONSHIP_LABELS = {
  mom: '👩 Mom',
  dad: '👨 Dad',
  spouse: '💑 Spouse / Partner',
  brother: '👦 Brother',
  sister: '👧 Sister',
  son: '👶 Son',
  daughter: '👶 Daughter',
  grandparent: '👴 Grandparent',
};

function familyRelationshipLabel(value) {
  if (!value) return '';
  return FAMILY_RELATIONSHIP_LABELS[value] || `✏️ ${value}`;
}

function familyMemberDisplayName(member) {
  if (!member) return '';
  if (member.name) return member.name;
  return familyRelationshipLabel(member.relationship).replace(/^[^ ]+ /, '');
}

function monthDayOf(dateStr) {
  return dateStr && dateStr.length >= 10 ? dateStr.slice(5, 10) : null;
}

// Checks whether a given YYYY-MM-DD date matches a saved birthday/anniversary
// (own or a family member's), ignoring year. Returns null if nothing matches.
function monthDayLabel(dateStr) {
  if (!dateStr) return '';
  const date = parseDateInputValue(dateStr);
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

function findMatchingOccasion(dateStr) {
  const profile = (typeof BiteBookProfile !== 'undefined') ? BiteBookProfile.get() : null;
  const target = monthDayOf(dateStr);
  if (!profile || !target) return null;

  if (monthDayOf(profile.birthday) === target) {
    return { reason: 'birthday', label: 'your birthday' };
  }
  if (monthDayOf(profile.anniversary) === target) {
    return { reason: 'anniversary', label: 'your anniversary' };
  }

  const members = profile.familyMembers || [];
  for (const m of members) {
    if (monthDayOf(m.birthday) === target) {
      return { reason: 'birthday', label: `${familyMemberDisplayName(m)}'s birthday` };
    }
  }
  for (const m of members) {
    if (monthDayOf(m.anniversary) === target) {
      return { reason: 'anniversary', label: `${familyMemberDisplayName(m)}'s anniversary` };
    }
  }
  return null;
}

function guessMealTypeFromTime() {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'high-tea';
  if (hour >= 18 && hour < 22) return 'dinner';
  return 'supper';
}

function guessTimeOfDayFromTime() {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 7) return 'early-morning';
  if (hour >= 7 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  if (hour >= 20 && hour < 23) return 'night';
  return 'late-night';
}

// Free, instant, client-side duplicate-place detection — no API call, so it
// doesn't burn the user's rate-limited Gemini key and doesn't depend on the
// AI proxy landing first. The AI-powered check in js/ai.js stays available
// as an opt-in deeper pass for trickier name variants this can't catch.
const PLACE_NAME_NOISE_WORDS = ['restaurant', 'cafe', 'café', 'diner', 'grill', 'kitchen', 'eatery', 'bar', 'bistro', 'the'];

function normalizePlaceName(name) {
  let n = (name || '').toLowerCase().trim();
  n = n.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = n.split(' ').filter((w) => w && !PLACE_NAME_NOISE_WORDS.includes(w));
  return words.join(' ');
}

function findLikelyDuplicatePlaceNames(placeNames) {
  const unique = Array.from(new Set((placeNames || []).filter(Boolean)));
  const normalized = unique
    .map((name) => ({ name, norm: normalizePlaceName(name) }))
    .filter((p) => p.norm);

  const groups = [];
  const used = new Set();

  for (let i = 0; i < normalized.length; i++) {
    if (used.has(normalized[i].name)) continue;
    const group = [normalized[i].name];
    used.add(normalized[i].name);
    for (let j = i + 1; j < normalized.length; j++) {
      if (used.has(normalized[j].name)) continue;
      const a = normalized[i].norm;
      const b = normalized[j].norm;
      const isMatch = a === b || (a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b));
      if (isMatch) {
        group.push(normalized[j].name);
        used.add(normalized[j].name);
      }
    }
    if (group.length > 1) {
      const suggestedName = [...group].sort((x, y) => y.length - x.length)[0];
      groups.push({ names: group, suggestedName });
    }
  }

  return groups;
}

function isSafeUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

function normalizeLinkInput(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  return `https://${trimmed}`;
}

function flashAutosaveBadge(el, success) {
  if (!el) return;
  clearTimeout(el._flashTimer);
  if (success) {
    el.textContent = '💾 Saved';
    el.classList.remove('error');
    el.classList.add('visible');
    el._flashTimer = setTimeout(() => el.classList.remove('visible'), 1600);
  } else {
    el.textContent = "⚠️ Not saved";
    el.classList.add('visible', 'error');
    el._flashTimer = setTimeout(() => {
      el.classList.remove('visible', 'error');
      el.textContent = '💾 Saved';
    }, 4000);
  }
}

const MEAL_TYPE_LABELS = {
  'breakfast': '🍳 Breakfast',
  'lunch': '🍲 Lunch',
  'high-tea': '☕ High Tea',
  'dinner': '🍽️ Dinner',
  'supper': '🌙 Supper',
  'snack': '🍪 Snack',
  'light-munching': '🍿 Just Munching',
};

const CUISINE_LABELS = {
  'indian-home': '🏠 Indian, Homemade',
  'indian-restaurant': '🍛 Indian, Restaurant',
  'italian': '🍝 Italian',
  'chinese': '🥡 Chinese',
  'thai': '🌶️ Thai',
  'mexican': '🌮 Mexican',
  'japanese': '🍣 Japanese',
  'mediterranean': '🥙 Mediterranean',
  'american': '🍔 American',
  'continental': '🍞 Continental',
};

const TIME_OF_DAY_LABELS = {
  'early-morning': '🌅 Early Morning',
  'morning': '🌤️ Morning',
  'midday': '☀️ Midday',
  'afternoon': '🌇 Afternoon',
  'evening': '🌆 Evening',
  'night': '🌃 Night',
  'late-night': '🌙 Late Night',
};

const PLACE_TYPE_LABELS = {
  'home': '🏠 Home',
  'restaurant': '🍽️ Restaurant / Café',
  'someone-else': '🏡 Someone Else\'s Place',
  'work-school': '🏫 Work / School',
  'on-the-go': '🚗 On the Go',
  'travel': '✈️ Travelling',
};

const COMPANION_TYPE_LABELS = {
  'solo': '🧍 Just Me',
  'family': '👨‍👩‍👧‍👦 Family',
  'friends': '👫 Friends',
  'someone-special': '💑 Someone Special',
  'classmates-coworkers': '👥 Classmates / Coworkers',
  'big-group': '🎉 A Big Group',
  'other': '✏️ Someone Else',
};

function companionTypeLabel(value) {
  if (!value) return '';
  return COMPANION_TYPE_LABELS[value] || `✏️ ${value}`;
}

function resolveFamilyMemberNames(familyIds) {
  if (!familyIds || familyIds.length === 0) return [];
  const profile = (typeof BiteBookProfile !== 'undefined') ? BiteBookProfile.get() : null;
  const members = (profile && profile.familyMembers) || [];
  return familyIds
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean)
    .map((m) => familyMemberDisplayName(m));
}

function companionSummaryLabel(entry) {
  const types = entry.companionTypes || (entry.companionType ? [entry.companionType] : []);
  if (types.length === 0) return '';
  const base = types.map((t) => companionTypeLabel(t)).join(' + ');
  const familyNames = resolveFamilyMemberNames(entry.companionFamilyIds);
  const extras = [...familyNames, entry.companionDetail, entry.companionNames]
    .filter(Boolean)
    .join(', ');
  return extras ? `${base} (${extras})` : base;
}

const MAKER_TYPE_LABELS = {
  'me': '🙋 I Made It Myself',
  'mom': '👩‍🍳 Mom',
  'dad': '👨‍🍳 Dad',
  'grandparent': '👵 Grandma / Grandpa',
  'other-family': '👨‍👩‍👧 Another Family Member',
  'chef-restaurant': '🧑‍🍳 A Chef / Restaurant',
  'store-bought': '🏪 Store-Bought / Packaged',
};

function makerTypeLabel(value) {
  if (!value) return '';
  return MAKER_TYPE_LABELS[value] || `✏️ ${value}`;
}

function makerSummaryLabel(entry) {
  if (!entry.madeBy) return '';
  const base = makerTypeLabel(entry.madeBy);
  if (entry.madeByName) return `${base} (${entry.madeByName})`;
  return base;
}

const REASON_LABELS = {
  'birthday': '🎂 Birthday',
  'anniversary': '💍 Anniversary',
  'celebration': '🎉 Special Celebration',
  'comfort': '🥰 Comfort Food',
  'craving': '😋 Just Craved It',
  'requested': '🙏 Someone Asked For It',
  'everyday': '🍽️ Everyday Meal',
};

const DATE_RELEVANT_REASONS = ['birthday', 'anniversary', 'celebration', 'other'];

function reasonLabel(value) {
  if (!value) return '';
  return REASON_LABELS[value] || `✏️ ${value}`;
}

function reasonSummaryLabel(entry) {
  if (!entry.reason) return '';
  const base = reasonLabel(entry.reason);
  if (entry.occasionDate) return `${base} (${formatDateLabel(entry.occasionDate)})`;
  return base;
}

const LINK_PLATFORM_ICONS = [
  [/instagram\.com/i, '📸 Instagram'],
  [/(youtube\.com|youtu\.be)/i, '▶️ YouTube'],
  [/tiktok\.com/i, '🎵 TikTok'],
  [/pinterest\./i, '📌 Pinterest'],
  [/(facebook\.com|fb\.watch)/i, '📘 Facebook'],
  [/(twitter\.com|x\.com)/i, '🐦 X / Twitter'],
  [/reddit\.com/i, '👽 Reddit'],
];

function linkPlatformLabel(url) {
  if (!url) return '';
  const match = LINK_PLATFORM_ICONS.find(([pattern]) => pattern.test(url));
  return match ? match[1] : '🔗 Link';
}

function fileKindIcon(type) {
  if (!type) return '📎';
  if (type.startsWith('image/')) return '🖼️';
  if (type === 'application/pdf') return '📄';
  return '📎';
}

function ingredientsSummaryLabel(entry) {
  const parts = [];
  if (entry.ingredientsText) parts.push('📝 Notes');
  if (entry.ingredientsLink) parts.push(linkPlatformLabel(entry.ingredientsLink));
  if (entry.ingredientsFile) parts.push(`${fileKindIcon(entry.ingredientsFile.type)} Attached`);
  return parts.join(' + ');
}

function mediaSummaryLabel(entry) {
  const photos = entry.photos || [];
  const videos = entry.videos || [];
  const parts = [];
  if (photos.length) parts.push(`📸 ${photos.length} Photo${photos.length === 1 ? '' : 's'}`);
  if (videos.length) parts.push(`🎬 ${videos.length} Video${videos.length === 1 ? '' : 's'}`);
  return parts.join(' + ');
}

const LIKED_QUALITY_LABELS = {
  'delicious': '😋 Delicious Taste',
  'spice-level': '🌶️ Perfect Spice Level',
  'healthy': '🍃 Felt Healthy',
  'indulgent': '🧈 Rich & Indulgent',
  'comforting': '🥵 Warm & Comforting',
  'refreshing': '🧊 Refreshing',
  'texture': '💥 Great Texture',
  'sweet': '🧁 Perfectly Sweet',
  'nostalgic': '🏡 Tasted Like Home',
  'new': '🆕 Something New & Different',
  'love': '👨‍👩‍👧 Made With Love',
};

function likedQualityLabel(value) {
  if (!value) return '';
  return LIKED_QUALITY_LABELS[value] || `✏️ ${value}`;
}

function likedQualitiesSummaryLabel(entry) {
  const qualities = entry.likedQualities || [];
  if (qualities.length === 0) return '';
  const labels = qualities.map((q) => likedQualityLabel(q));
  if (labels.length <= 2) return labels.join(' + ');
  return `${labels.slice(0, 2).join(' + ')} +${labels.length - 2} more`;
}

function ratingStarsLabel(rating) {
  if (!rating) return '';
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

const EAT_AGAIN_LABELS = {
  'yes': '😍 Absolutely',
  'maybe': '🤔 Maybe',
  'no': '🙅 Not Really',
};

function eatAgainLabel(value) {
  return EAT_AGAIN_LABELS[value] || '';
}

const FREQUENCY_LABELS = {
  'all-the-time': '🔁 All the Time',
  'every-week': '📅 Every Week',
  'every-month': '🗓️ Every Month',
  'special-occasions': '🎉 Special Occasions Only',
};

function frequencyLabel(value) {
  return FREQUENCY_LABELS[value] || '';
}

const RANK_LABELS = {
  'top': '🏆 Top of the List',
  'favorite': '⭐ One of My Favorites',
  'good': '👍 Pretty Good',
  'fine': '😐 It Was Fine',
  'not-for-me': '👎 Not For Me',
};

function rankLabel(value) {
  return RANK_LABELS[value] || '';
}

function placeTypeLabel(value) {
  if (!value) return '';
  return PLACE_TYPE_LABELS[value] || `✏️ ${value}`;
}

function mealTypeLabel(value) {
  return MEAL_TYPE_LABELS[value] || '';
}

function cuisineLabel(value) {
  if (!value) return '';
  return CUISINE_LABELS[value] || `✏️ ${value}`;
}

function timeOfDayLabel(value) {
  return TIME_OF_DAY_LABELS[value] || '';
}

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateInputValue(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const date = parseDateInputValue(dateStr);
  const today = new Date();
  const todayStr = toDateInputValue(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toDateInputValue(yesterday);

  const weekdayMonthDay = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (dateStr === todayStr) return `Today — ${weekdayMonthDay}`;
  if (dateStr === yesterdayStr) return `Yesterday — ${weekdayMonthDay}`;
  return weekdayMonthDay;
}

function placeSummaryLabel(entry) {
  return entry.placeName || '';
}

function dateTimeSummaryLabel(entry) {
  if (!entry.ateOn) return '';
  const dateLabel = formatDateLabel(entry.ateOn);
  if (entry.timeMode === 'exact' && entry.exactTime) {
    return `${dateLabel}, ${entry.exactTime}`;
  }
  if (entry.timeOfDay) {
    return `${dateLabel} · ${timeOfDayLabel(entry.timeOfDay)}`;
  }
  return dateLabel;
}

// Chrome/Firefox/Edge generally can't decode HEIC/HEIF natively (the format
// iPhones save photos in by default), so a plain <img>-based decode — what
// compressImageFile relies on — silently fails there. This converts to a
// JPEG blob first via heic2any (WASM libheif, no native codec needed), so
// the rest of the pipeline never has to know the original was HEIC.
function isHeicFile(file) {
  return /\.(heic|heif)$/i.test(file.name)
    || file.type === 'image/heic' || file.type === 'image/heif';
}

async function normalizeToDecodableImage(file) {
  if (!isHeicFile(file)) return file;
  if (typeof heic2any === 'undefined') {
    throw new Error('HEIC conversion library failed to load');
  }
  try {
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
    return Array.isArray(converted) ? converted[0] : converted;
  } catch (e) {
    const detail = (e && (e.message || e.code)) || 'unknown error';
    // libheif's WASM build only decodes standard 8-bit HEVC HEIC — newer
    // iPhones' HDR/10-bit capture mode produces a variant it can't read.
    // No in-browser library currently covers this; it's a real format gap,
    // not something fixable in app code.
    if (/not supported/i.test(detail)) {
      throw new Error(
        "This photo's format isn't supported by any in-browser HEIC converter — likely an HDR photo from a newer iPhone. " +
        "Convert it to JPEG on your phone first (share it out as JPEG), or in iPhone Settings go to Camera > Formats and " +
        "switch to \"Most Compatible\" so new photos save as JPEG directly."
      );
    }
    throw new Error(`HEIC conversion failed: ${detail}`);
  }
}

// Tries native <img> decode first (instant for normal formats, and some
// browsers have partial native HEIC support too), falling back to
// heic2any conversion only if that fails and the file is HEIC.
async function decodePhotoForUpload(file, compressOptions) {
  try {
    return await compressImageFile(file, compressOptions);
  } catch (nativeErr) {
    if (!isHeicFile(file)) throw nativeErr;
    const decodable = await normalizeToDecodableImage(file);
    return compressImageFile(decodable, compressOptions);
  }
}

function compressImageFile(file, options) {
  const maxDim = (options && options.maxDim) || 1024;
  const maxBytes = (options && options.maxBytes) || 700 * 1024;
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      let quality = 0.72;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      let estBytes = Math.round(dataUrl.length * 0.75);
      if (estBytes > maxBytes) {
        quality = 0.5;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        estBytes = Math.round(dataUrl.length * 0.75);
      }
      resolve({ dataUrl, width, height, size: estBytes });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}
