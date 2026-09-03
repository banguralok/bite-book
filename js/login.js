document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const passwordWrap = document.getElementById('password-wrap');
  const loginBtn = document.getElementById('login-btn');
  const toggleBtn = document.getElementById('toggle-mode-btn');
  const statusEl = document.getElementById('login-status');
  const helpEl = document.getElementById('login-help');

  let mode = 'password';

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
    if (mode === 'password') {
      passwordWrap.style.display = 'block';
      loginBtn.textContent = 'Sign In';
      toggleBtn.textContent = "✨ New here? Create an account";
      helpEl.textContent = 'Sign in with your password.';
    } else if (mode === 'signup') {
      passwordWrap.style.display = 'block';
      loginBtn.textContent = 'Create Account';
      toggleBtn.textContent = '🔑 Already have an account? Sign in';
      helpEl.textContent = 'Pick a password (8+ characters) to create your Bite Book account.';
    } else {
      // link mode — kept for later, not wired to any visible toggle right now.
      passwordWrap.style.display = 'none';
      loginBtn.textContent = '✉️ Send Me a Link';
      toggleBtn.textContent = '🔑 Use my password instead';
      helpEl.textContent = "We'll email a one-time sign-in link — no password needed.";
    }
  }

  // Already signed in? Skip straight past this page.
  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) {
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get('redirect') || 'entries.html';
    }
  });

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
      window.location.href = params.get('redirect') || 'entries.html';
    }
  }

  async function signUp() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return;
    if (password.length < 8) {
      showStatus('Password needs to be at least 8 characters.', true);
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
      window.location.href = 'profile.html?welcome=1';
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
  [emailInput, passwordInput].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  });
});
