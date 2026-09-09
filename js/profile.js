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

    // Who am I allowed to be: admin flag and plan, in one call
    // (migration 009). Neither is a column on `profiles` — the profiles
    // policy is "owner has full access", so either one would be writable by
    // any signed-in person from their own browser console. Both live in
    // tables a person can only read.
    //
    // If 009 hasn't been run yet, fall back to the admin check alone so the
    // Insights link doesn't vanish; everyone is simply 'general', which is
    // the default anyway and gates nothing while enforcement is off.
    let isAdmin = false;
    let role = 'general';
    try {
      const { data: access, error: accessError } = await supabaseClient.rpc('bb_my_access');
      if (accessError) throw accessError;
      const row = Array.isArray(access) ? access[0] : access;
      isAdmin = !!(row && row.is_admin);
      role = (row && row.role) || 'general';
    } catch (err) {
      try {
        const { data: adminRow } = await supabaseClient
          .from('admins')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();
        isAdmin = !!adminRow;
      } catch (err2) {
        isAdmin = false;
      }
    }
    if (typeof BiteBookRoles !== 'undefined') BiteBookRoles.set(role, isAdmin);

    cached = (error || !data) ? null : {
      id: userId,
      isAdmin,
      role,
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
      // isAdmin is never part of what gets saved — it is not a profile column
      // at all — so carry the loaded value forward rather than losing it.
      const wasAdmin = cached ? cached.isAdmin : false;
      const wasRole = cached ? cached.role : 'general';
      cached = { ...profile, isAdmin: wasAdmin, role: wasRole, updatedAt: nowIso, email: sessionData.session.user.email };
    }
    return !error;
  }

  return { load, get, save };
})();
