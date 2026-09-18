// Shared wrapper around the browser's Contact Picker API — Chrome/Android
// only, feature-detected everywhere it's offered, same pattern as voice
// capture in Smart Entry (`window.SpeechRecognition`). Two callers use this
// today: inviting someone new (js/invite.js, one contact at a time) and
// tagging who you ate with from your phone's contacts (js/entry-who.js,
// several at once) — same underlying native picker, different use of the
// names it hands back.
const BiteBookContacts = (() => {
  function isSupported() {
    return 'contacts' in navigator && 'ContactsManager' in window;
  }

  // Never throws — a cancelled picker or an unsupported browser both just
  // mean "fall back to typing it in," not an error worth surfacing.
  async function pick({ multiple = false } = {}) {
    if (!isSupported()) return [];
    try {
      const contacts = await navigator.contacts.select(['name', 'tel', 'email'], { multiple });
      return (contacts || []).map((c) => ({
        name: (c.name && c.name[0]) || '',
        tel: (c.tel && c.tel[0]) || '',
        email: (c.email && c.email[0]) || '',
      }));
    } catch (e) {
      return [];
    }
  }

  return { isSupported, pick };
})();
