// Reached only from the link Supabase emails via resetPasswordForEmail()
// (see the "Forgot your password?" flow in js/login.js). The Supabase
// client parses that link's recovery token from the URL and establishes a
// session automatically on load — this page just waits to see whether that
// happened before showing the form, rather than assuming it always will
// (a stale/reused/expired link, or someone just typing this URL in by hand,
// shouldn't show a form that can only fail).
document.addEventListener('DOMContentLoaded', async () => {
  const helpEl = document.getElementById('reset-help');
  const formWrap = document.getElementById('reset-form-wrap');
  const actionsWrap = document.getElementById('reset-actions-wrap');
  const fallbackWrap = document.getElementById('reset-fallback-wrap');
  const statusEl = document.getElementById('reset-status');
  const passwordInput = document.getElementById('reset-password');
  const confirmWrap = document.getElementById('reset-confirm-wrap');
  const confirmInput = document.getElementById('reset-password-confirm');
  const strengthHint = document.getElementById('reset-strength-hint');
  const resetBtn = document.getElementById('reset-btn');

  BiteBookPwToggle.attach(passwordInput);
  BiteBookPwToggle.attach(confirmInput);

  function showStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', !!isError);
  }

  function showForm() {
    helpEl.textContent = 'Pick a new password below.';
    formWrap.style.display = 'block';
    confirmWrap.style.display = 'block';
    actionsWrap.style.display = 'flex';
    fallbackWrap.style.display = 'none';
  }

  function showFallback() {
    helpEl.textContent = "This reset link is invalid or has expired — ask for a new one from the sign-in page.";
    formWrap.style.display = 'none';
    confirmWrap.style.display = 'none';
    actionsWrap.style.display = 'none';
    fallbackWrap.style.display = 'block';
  }

  passwordInput.addEventListener('input', () => {
    const label = BiteBookPasswordPolicy.strengthLabel(passwordInput.value);
    strengthHint.textContent = label ? `Strength: ${label}` : '';
  });

  resetBtn.addEventListener('click', async () => {
    const password = passwordInput.value;
    const check = BiteBookPasswordPolicy.validate(password);
    if (!check.ok) {
      showStatus(check.reason, true);
      return;
    }
    if (password !== confirmInput.value) {
      showStatus("Those two passwords don't match.", true);
      return;
    }
    resetBtn.disabled = true;
    showStatus('', false);
    const { error } = await supabaseClient.auth.updateUser({ password });
    resetBtn.disabled = false;
    if (error) {
      showStatus(`Couldn't set password: ${error.message}`, true);
    } else {
      showStatus('✅ Password updated — taking you to your journal...', false);
      setTimeout(() => { window.location.href = 'entries.html'; }, 1200);
    }
  });

  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    showForm();
  } else {
    showFallback();
  }

  // Defensive: if the recovery session takes a moment longer to establish
  // than the check above, catch it when it actually arrives instead of
  // leaving the fallback showing.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) {
      showForm();
    }
  });
});
