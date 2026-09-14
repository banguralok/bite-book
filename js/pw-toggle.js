// A show/hide eye-icon toggle next to a password field. One small module
// rather than four copies of the same wiring, since this now applies to
// sign-in, signup (same field), Profile's "Set Password", and the
// reset-password form.
//
// Named to avoid "password" in the filename — see js/pw-policy.js for why:
// the sandboxed preview browser used to verify this app blocks any resource
// whose path contains that substring. Doesn't affect real browsers/users.
const BiteBookPwToggle = (() => {
  function attach(inputEl) {
    if (!inputEl || inputEl.dataset.pwToggleAttached) return;
    inputEl.dataset.pwToggleAttached = '1';

    let wrap = inputEl.parentElement;
    if (!wrap || !wrap.classList.contains('pw-input-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'pw-input-wrap';
      inputEl.replaceWith(wrap);
      wrap.appendChild(inputEl);
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-toggle-btn';
    btn.setAttribute('aria-label', 'Show password');
    btn.innerHTML = (typeof BiteBookIcons !== 'undefined') ? BiteBookIcons.svg('eye') : '👁';
    wrap.appendChild(btn);

    btn.addEventListener('click', () => {
      const showing = inputEl.type === 'text';
      inputEl.type = showing ? 'password' : 'text';
      btn.innerHTML = (typeof BiteBookIcons !== 'undefined')
        ? BiteBookIcons.svg(showing ? 'eye' : 'eye-off')
        : (showing ? '👁' : '🙈');
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  }

  function attachAll(selector) {
    document.querySelectorAll(selector || 'input[type="password"]').forEach(attach);
  }

  return { attach, attachAll };
})();
