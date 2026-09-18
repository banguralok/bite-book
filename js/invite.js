// Inviting someone who isn't a Bite Book user yet.
//
// No SMS/email provider and no app-store listing exist for this app (it's a
// PWA), so this module never sends anything itself — it composes the
// message and hands off to the recipient's own Messages/Mail app via
// sms:/mailto: links, the same "hand off to the OS, don't build it
// ourselves" idea already used for the entry share button in
// js/share-card.js. Contact picking itself lives in js/contacts.js (shared
// with tagging a companion from your phone's contacts on entry-who.html) —
// this just asks for one.
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
    return typeof BiteBookContacts !== 'undefined' && BiteBookContacts.isSupported();
  }

  async function pickContact() {
    if (!isContactPickerSupported()) return null;
    const [contact] = await BiteBookContacts.pick({ multiple: false });
    return contact || null;
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
