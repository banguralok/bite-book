// Inviting someone who isn't a Bite Book user yet.
//
// No SMS/email provider and no app-store listing exist for this app (it's a
// PWA), so this module never sends anything itself — it composes the
// message and hands off to the recipient's own Messages/Mail app via
// sms:/mailto: links, the same "hand off to the OS, don't build it
// ourselves" idea already used for the entry share button in
// js/share-card.js. The Contact Picker API (Chrome/Android only) is offered
// where the browser actually supports it; everywhere else the caller simply
// doesn't render the button, same feature-detect pattern as voice capture
// in Smart Entry.
const BiteBookInvite = (() => {
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function buildMessage({ senderName, food, url }) {
    const who = senderName || 'Someone';
    const what = food ? ` — "${food}"` : '';
    return `${who} saved a food memory on Bite Book${what}. See it here: ${url}`;
  }

  function isContactPickerSupported() {
    return 'contacts' in navigator && 'ContactsManager' in window;
  }

  // Never throws — the native picker can be cancelled or unsupported, and
  // either case should just mean "fall back to typing it in", not an error.
  async function pickContact() {
    if (!isContactPickerSupported()) return null;
    try {
      const [contact] = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: false });
      if (!contact) return null;
      return {
        name: (contact.name && contact.name[0]) || '',
        tel: (contact.tel && contact.tel[0]) || '',
        email: (contact.email && contact.email[0]) || '',
      };
    } catch (e) {
      return null;
    }
  }

  function send({ phone, email, message }) {
    const body = encodeURIComponent(message);
    if (phone) {
      const sep = isIOS() ? '&' : '?';
      window.location.href = `sms:${encodeURIComponent(phone)}${sep}body=${body}`;
    } else if (email) {
      const subject = encodeURIComponent('A food memory on Bite Book');
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
    }
  }

  return { buildMessage, isContactPickerSupported, pickContact, send };
})();
