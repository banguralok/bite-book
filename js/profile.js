// Supabase-backed. `get()` stays synchronous by design — the rest of
// the app (labels.js, geo.js, entry-who.js, etc.) reads profile data
// synchronously in many places, and rewriting every call site to
// async would be a much larger, riskier change than this app needs
// right now. Instead: load() fetches once and caches; get() just
// reads the cache. js/partials.js calls load() right after a
// successful requireAuth() and only THEN signals 'bitebook:ready',
// which every page-controller script waits for before touching
// BiteBookProfile.get() — see that file for the ordering guarantee.
const BiteBookProfile = (() => {
  let cached = null;

  async function load() {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) {
      cached = null;
      return null;
    }
    const userId = sessionData.session.user.id;
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    cached = (error || !data) ? null : {
      name: data.name,
      avatar: data.avatar,
      birthday: data.birthday,
      anniversary: data.anniversary,
      homeAddress: data.home_address,
      homeCoords: data.home_coords,
      familyMembers: data.family_members || [],
      updatedAt: data.updated_at,
      email: sessionData.session.user.email,
    };
    return cached;
  }

  function get() {
    return cached;
  }

  async function save(profile) {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) return false;
    const userId = sessionData.session.user.id;
    const nowIso = new Date().toISOString();

    const { error } = await supabaseClient
      .from('profiles')
      .update({
        name: profile.name,
        avatar: profile.avatar,
        birthday: profile.birthday,
        anniversary: profile.anniversary,
        home_address: profile.homeAddress,
        home_coords: profile.homeCoords,
        family_members: profile.familyMembers || [],
        updated_at: nowIso,
      })
      .eq('id', userId);

    if (!error) {
      cached = { ...profile, updatedAt: nowIso, email: sessionData.session.user.email };
    }
    return !error;
  }

  return { load, get, save };
})();
