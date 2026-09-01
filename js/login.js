document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('login-email');
  const loginBtn = document.getElementById('login-btn');
  const statusEl = document.getElementById('login-status');

  function showStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', !!isError);
  }

  // Already signed in? Skip straight past this page.
  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) {
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get('redirect') || 'entries.html';
    }
  });

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
      showStatus(
        "Couldn't send a link — double check the email, or make sure it's the one Bite Book was shared with.",
        true
      );
      loginBtn.disabled = false;
      loginBtn.textContent = '✉️ Send Me a Link';
    } else {
      showStatus('✅ Check your email for a sign-in link.', false);
      loginBtn.textContent = '✉️ Link Sent';
    }
  }

  loginBtn.addEventListener('click', sendLink);
  emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendLink();
  });
});
