// One password rule, used everywhere a password gets set (signup, "Set
// Password" on Profile, and the reset-password page) so a future policy
// change can't miss a spot the way the old inline `length < 8` check was
// duplicated in two places already.
//
// Follows NIST SP 800-63B (the guidance OWASP and most current advice
// defers to) rather than the older "must contain a symbol" convention it
// explicitly moved away from: favor length over forced composition rules,
// screen against known-weak passwords instead, and never require periodic
// rotation (nothing here does). The Supabase project should also have its
// own minimum length raised to match and "Leaked password protection"
// turned on (Authentication > Settings > Password) — this module is the
// client-side half of that, not a replacement for it; a request that
// bypasses this UI entirely still has to pass Supabase's own check.
const BiteBookPasswordPolicy = (() => {
  const MIN_LENGTH = 10;

  // Only entries 10+ characters matter here — anything shorter is already
  // caught by MIN_LENGTH. Sourced from well-known common/breached password
  // lists, not exhaustive (Supabase's "Leaked password protection" toggle
  // is the real, authoritative version of this check).
  const COMMON_PASSWORDS = new Set([
    'password123', 'password1234', '1234567890', '123456789012',
    'qwertyuiop', 'qwertyuiop123', '1qaz2wsx3edc', 'iloveyou123',
    'welcome123', 'welcome12345', 'abcd123456', 'admin12345',
    'admin123456', 'letmein123', 'football123', 'baseball123',
    'trustno1234', 'changeme123', 'passw0rd123', 'temppass123',
    'sunshine123', 'princess123', 'dragon123456', 'monkey123456',
    'bitebook123', 'bitebook1234',
  ]);

  function validate(password, email) {
    const value = password || '';
    if (value.length < MIN_LENGTH) {
      return { ok: false, reason: `Use at least ${MIN_LENGTH} characters.` };
    }
    if (COMMON_PASSWORDS.has(value.toLowerCase())) {
      return { ok: false, reason: 'That password is too common — pick something less guessable.' };
    }
    const localPart = (email || '').split('@')[0];
    if (localPart && value.toLowerCase() === localPart.toLowerCase()) {
      return { ok: false, reason: "Your password can't be the same as your email name." };
    }
    return { ok: true, reason: null };
  }

  // A rough, non-blocking hint — length-driven (matches the "length beats
  // complexity" guidance above), not a judgment on character variety.
  function strengthLabel(password) {
    const len = (password || '').length;
    if (len < MIN_LENGTH) return null;
    if (len >= 16) return 'Strong';
    if (len >= 12) return 'Good';
    return 'Fair';
  }

  return { MIN_LENGTH, validate, strengthLabel };
})();
