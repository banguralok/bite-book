document.addEventListener('DOMContentLoaded', () => {
  // A password-reset link that lands here instead of on reset-password.html
  // (see js/auth.js) would otherwise just sign in silently below — bail out
  // to the real reset flow before anything else runs.
  if (redirectIfPasswordRecovery()) return;

  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const passwordWrap = document.getElementById('password-wrap');
  const passwordConfirmWrap = document.getElementById('password-confirm-wrap');
  const passwordConfirmInput = document.getElementById('login-password-confirm');
  const loginBtn = document.getElementById('login-btn');
  const toggleBtn = document.getElementById('toggle-mode-btn');
  const statusEl = document.getElementById('login-status');
  const helpEl = document.getElementById('login-help');
  const forgotPasswordWrap = document.getElementById('forgot-password-wrap');
  const forgotPasswordBtn = document.getElementById('forgot-password-btn');
  const passwordStrengthHint = document.getElementById('password-strength-hint');

  BiteBookPwToggle.attach(passwordInput);
  BiteBookPwToggle.attach(passwordConfirmInput);

  let mode = 'password';
  const inviteId = new URLSearchParams(window.location.search).get('invite');

  // If an invite id is on the URL, claim it right after authenticating — this
  // covers both "brand new signup" and "already had an account, just signed
  // in" with the same call, and works whether or not it resolves to a share
  // (a stale/already-claimed invite just falls back to the normal target).
  async function resolveRedirect(fallback) {
    if (!inviteId) return fallback;
    const { data } = await supabaseClient.rpc('claim_pending_invites', { p_invite_id: inviteId });
    const claimedEntryId = data && data[0] && data[0].claimed_entry_id;
    return claimedEntryId ? `entry-view.html?id=${encodeURIComponent(claimedEntryId)}` : fallback;
  }

  function showStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', !!isError);
  }

  // Self-signup replaces invite-by-email for now, while a beta group
  // signs up directly from a shared URL — magic-link invites have a
  // free-tier send-rate limit that can't be worked around on demand.
  // The magic-link mode (setMode('link') / sendLink()) is left intact
  // below, just not reachable from the UI, so it's a one-line change to
  // bring back once invite-by-email is wanted again.
  function setMode(next) {
    mode = next;
    showStatus('', false);
    passwordStrengthHint.textContent = '';
    passwordConfirmInput.value = '';
    passwordConfirmWrap.style.display = mode === 'signup' ? 'block' : 'none';
    forgotPasswordWrap.style.display = mode === 'password' ? 'block' : 'none';
    if (mode === 'password') {
      passwordWrap.style.display = 'block';
      loginBtn.textContent = 'Sign In';
      toggleBtn.textContent = "✨ New here? Create an account";
      helpEl.textContent = 'Sign in with your password.';
    } else if (mode === 'signup') {
      passwordWrap.style.display = 'block';
      loginBtn.textContent = 'Create Account';
      toggleBtn.textContent = '🔑 Already have an account? Sign in';
      helpEl.textContent = `Pick a password (${BiteBookPasswordPolicy.MIN_LENGTH}+ characters) to create your Bite Book account.`;
    } else {
      // link mode — kept for later, not wired to any visible toggle right now.
      passwordWrap.style.display = 'none';
      loginBtn.textContent = '✉️ Send Me a Link';
      toggleBtn.textContent = '🔑 Use my password instead';
      helpEl.textContent = "We'll email a one-time sign-in link — no password needed.";
    }
  }

  passwordInput.addEventListener('input', () => {
    if (mode !== 'signup') return;
    const label = BiteBookPasswordPolicy.strengthLabel(passwordInput.value);
    passwordStrengthHint.textContent = label ? `Strength: ${label}` : '';
  });

  async function forgotPassword() {
    const email = emailInput.value.trim();
    if (!email) {
      showStatus('Enter your email above first, then tap "Forgot your password?" again.', true);
      return;
    }
    forgotPasswordBtn.disabled = true;
    showStatus('', false);
    const redirectTo = `${window.location.origin}${window.location.pathname.replace('login.html', 'reset-password.html')}`;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    forgotPasswordBtn.disabled = false;
    if (error) {
      const detail = error.status === 429
        ? "Too many attempts — Supabase's free tier rate-limits these emails. Wait a few minutes and try again."
        : `Couldn't send a reset email (${error.status || '?'}: ${error.message || 'unknown error'}).`;
      showStatus(detail, true);
    } else {
      showStatus('✅ Check your email for a password reset link.', false);
    }
  }

  forgotPasswordBtn.addEventListener('click', forgotPassword);

  // Already signed in? Skip straight past this page.
  supabaseClient.auth.getSession().then(async ({ data }) => {
    if (data.session) {
      const params = new URLSearchParams(window.location.search);
      window.location.href = await resolveRedirect(params.get('redirect') || 'entries.html');
    }
  });

  if (inviteId) {
    setMode('signup');
    helpEl.textContent = "👋 You've been invited to see a food memory on Bite Book! Create an account to view it.";
  } else if (new URLSearchParams(window.location.search).get('reason') === 'idle') {
    showStatus("You were signed out after 15 minutes of inactivity. Sign back in to pick up where you left off.", false);
  }

  async function signInWithPassword() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return;

    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    showStatus('', false);

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      showStatus(`Couldn't sign in: ${error.message}`, true);
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    } else {
      const params = new URLSearchParams(window.location.search);
      window.location.href = await resolveRedirect(params.get('redirect') || 'entries.html');
    }
  }

  async function signUp() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = passwordConfirmInput.value;
    if (!email || !password) return;
    const check = BiteBookPasswordPolicy.validate(password, email);
    if (!check.ok) {
      showStatus(check.reason, true);
      return;
    }
    if (password !== confirmPassword) {
      showStatus("Those two passwords don't match.", true);
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Creating account...';
    showStatus('', false);

    const { data, error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
      showStatus(`Couldn't create that account: ${error.message}`, true);
      loginBtn.disabled = false;
      loginBtn.textContent = 'Create Account';
      return;
    }

    if (data.session) {
      // No email confirmation required on this project — go straight in.
      const next = await resolveRedirect('entries.html');
      window.location.href = `profile.html?welcome=1&next=${encodeURIComponent(next)}`;
    } else {
      showStatus('✅ Account created — check your email to confirm before signing in.', false);
      loginBtn.disabled = false;
      loginBtn.textContent = 'Create Account';
    }
  }

  async function sendLink() {
    const email = emailInput.value.trim();
    if (!email) return;

    loginBtn.disabled = true;
    loginBtn.textContent = 'Sending...';
    showStatus('', false);

    const redirectTo = `${window.location.origin}${window.location.pathname.replace('login.html', 'entries.html')}`;

    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      const detail = error.status === 429
        ? "Too many attempts — Supabase's free tier rate-limits sign-in emails. Wait a few minutes and try again."
        : `Couldn't send a link (${error.status || '?'}: ${error.message || 'unknown error'}). Check the email, or check Supabase's Auth logs for detail.`;
      showStatus(detail, true);
      loginBtn.disabled = false;
      loginBtn.textContent = '✉️ Send Me a Link';
    } else {
      showStatus('✅ Check your email for a sign-in link.', false);
      loginBtn.textContent = '✉️ Link Sent';
    }
  }

  function submit() {
    if (mode === 'password') signInWithPassword();
    else if (mode === 'signup') signUp();
    else sendLink();
  }

  toggleBtn.addEventListener('click', () => setMode(mode === 'password' ? 'signup' : 'password'));
  loginBtn.addEventListener('click', submit);
  [emailInput, passwordInput, passwordConfirmInput].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  });
});
