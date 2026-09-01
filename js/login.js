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

  function setMode(next) {
    mode = next;
    showStatus('', false);
    if (mode === 'password') {
      passwordWrap.style.display = 'block';
      loginBtn.textContent = 'Sign In';
      toggleBtn.textContent = '✉️ Email me a link instead';
      helpEl.textContent = "Bite Book is invite-only. Sign in with the password you set, or email yourself a one-time link if you haven't set one yet.";
    } else {
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
    else sendLink();
  }

  toggleBtn.addEventListener('click', () => setMode(mode === 'password' ? 'link' : 'password'));
  loginBtn.addEventListener('click', submit);
  [emailInput, passwordInput].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  });
});
