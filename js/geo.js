const RESTAURANT_PLACE_KINDS = [
  'restaurant', 'cafe', 'fast_food', 'bar', 'pub',
  'food_court', 'biergarten', 'ice_cream', 'canteen',
];

const OSM_CUISINE_TO_BITEBOOK = {
  indian: 'indian-restaurant',
  italian: 'italian',
  pizza: 'italian',
  chinese: 'chinese',
  thai: 'thai',
  mexican: 'mexican',
  japanese: 'japanese',
  sushi: 'japanese',
  mediterranean: 'mediterranean',
  american: 'american',
  burger: 'american',
};

async function reverseGeocodeLookup(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&extratags=1`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('geocode failed');
  return res.json();
}

function placeNameFromGeocode(data) {
  return (data.name) || (data.address && (data.address.amenity || data.address.shop)) || null;
}

function shortAddressFromGeocode(data) {
  const a = data.address || {};
  const parts = [a.road, a.suburb || a.city || a.town || a.village, a.state].filter(Boolean);
  return parts.length ? parts.join(', ') : data.display_name || '';
}

// Nominatim names the same thing four different ways depending on how built-up
// the area is, so try them in order of how specific they are. Used by the
// patterns page to group meals by place without re-parsing a free-text address.
function cityFromGeocode(data) {
  const a = (data && data.address) || {};
  return a.city || a.town || a.village || a.municipality || a.suburb || a.county || null;
}

function countryFromGeocode(data) {
  const a = (data && data.address) || {};
  return a.country || null;
}

// Best-effort fallback for entries logged before city/country were captured.
// shortAddressFromGeocode() writes "road, locality, state", so the middle
// piece is usually the town. A guess, and treated as one: anything this can't
// work out simply doesn't appear in the place breakdown.
function cityFromSavedAddress(address) {
  if (!address) return null;
  const parts = String(address).split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 2] || null;
  if (parts.length === 2) return parts[1] || null;
  return null;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Infers place type / maker / cuisine from a reverse-geocode result and the
// user's saved home location (if any). Never guesses "home" from OSM data
// alone — home only comes from proximity to the profile's saved coords.
function inferPlaceContext(geocodeData, coords) {
  const context = { placeType: null, madeBy: null, cuisine: null, isHome: false };

  const profile = (typeof BiteBookProfile !== 'undefined') ? BiteBookProfile.get() : null;
  if (profile && profile.homeCoords && coords) {
    const dist = distanceMeters(coords.lat, coords.lon, profile.homeCoords.lat, profile.homeCoords.lon);
    if (dist < 150) {
      context.placeType = 'home';
      context.isHome = true;
      return context;
    }
  }

  const address = geocodeData.address || {};
  const kind = address.amenity || geocodeData.type;
  if (RESTAURANT_PLACE_KINDS.includes(kind)) {
    context.placeType = 'restaurant';
    context.madeBy = 'chef-restaurant';
    const cuisineTag = geocodeData.extratags && geocodeData.extratags.cuisine;
    if (cuisineTag) {
      const firstTag = cuisineTag.split(';')[0].trim().toLowerCase();
      context.cuisine = OSM_CUISINE_TO_BITEBOOK[firstTag] || null;
    }
  }
  return context;
}
