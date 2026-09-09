// Plans: General (free) and Power (paid). Admin is separate and already
// exists — an admin is a person who can see Insights, not a plan.
//
// THE GATE IS OFF. ENFORCE is false, so can() returns true for everything
// and nobody loses a feature today. That is deliberate, and it is the whole
// point of building this now: the machinery, the labels and the admin
// controls exist, so switching the boundary on later is a one-line change
// rather than a rebuild. Turning it on before there is real billing would
// only degrade the app for the handful of beta families whose honest
// feedback is worth more than their money.
//
// The boundary itself comes from the pricing already printed in the family
// deck — free is a solo journal, paid is up to 8 people — so the product and
// the pricing page say the same thing rather than contradicting each other.
const BiteBookRoles = (() => {
  // Flip to true only when billing exists and someone can actually pay.
  // Everything below is already wired for it; nothing else needs changing.
  //
  // Deliberately a variable with a setter rather than a constant. An
  // inactive code path is exactly where bugs hide, so the gated experience
  // has to be reachable to be tested at all — and it lets you see what a
  // free account looks like from the browser console before ever charging
  // anyone: BiteBookRoles.setEnforce(true), then reload to go back.
  let enforce = false;

  function setEnforce(value) {
    enforce = !!value;
    return enforce;
  }

  function isEnforcing() {
    return enforce;
  }

  const PLANS = {
    general: { label: 'Free', blurb: 'Your own journal, just for you', seats: 1 },
    power: { label: 'Power', blurb: 'Share with up to 8 people', seats: 8 },
    admin: { label: 'Admin', blurb: 'Everything, plus Insights', seats: 8 },
  };

  // The paid side of the line. Everything not listed here is free forever,
  // which includes all of the logging, browsing, searching, stats, trips,
  // rankings and Year in Review — the journal itself is never paywalled.
  const PAID_FEATURES = {
    'share-entry': 'Sharing a meal with someone',
    'family-members': 'Adding family members',
    'circle': 'Your Bite Book circle',
    'extra-seats': 'More than one person on the account',
  };

  let current = null;   // 'general' | 'power' | 'admin'
  let loaded = false;

  function set(role, isAdmin) {
    current = isAdmin ? 'admin' : (role || 'general');
    loaded = true;
    return current;
  }

  function get() {
    return current || 'general';
  }

  function plan() {
    return PLANS[get()] || PLANS.general;
  }

  function isPaid() {
    return get() === 'power' || get() === 'admin';
  }

  function seats() {
    return plan().seats;
  }

  // The single question the rest of the app asks. While ENFORCE is false
  // this is always true — call sites can be written now and will simply
  // start meaning something on the day the flag flips.
  function can(feature) {
    if (!enforce) return true;
    if (!Object.prototype.hasOwnProperty.call(PAID_FEATURES, feature)) return true;
    return isPaid();
  }

  // What to tell someone who can't do it. Returns null when they can, so a
  // call site reads: const why = BiteBookRoles.blockedReason('share-entry');
  function blockedReason(feature) {
    if (can(feature)) return null;
    const what = PAID_FEATURES[feature] || 'This';
    return `${what} is part of the Power plan — up to 8 people on one account.`;
  }

  function isLoaded() {
    return loaded;
  }

  return {
    PLANS, PAID_FEATURES,
    set, get, plan, isPaid, seats, can, blockedReason, isLoaded,
    setEnforce, isEnforcing,
  };
})();
