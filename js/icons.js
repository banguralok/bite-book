// A small drawn icon set for the places people look at constantly — the top
// nav, the main action buttons, the empty states.
//
// Deliberately NOT a wholesale emoji purge: emoji inside a meal card, a story
// section or a streak badge are part of Bite Book's voice and they stay. What
// gets replaced is the furniture, where an emoji sitting next to the real
// logo reads as a placeholder.
//
// Every icon is one 24x24 outline drawn in currentColor, so it inherits the
// colour and size of whatever text it sits beside and needs no extra CSS at
// the call site. Static markup asks for one with <span data-icon="book"></span>
// and hydrate() fills it in; code that builds HTML can call svg() directly.
const BiteBookIcons = (() => {
  const PATHS = {
    book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v14H6.5A1.5 1.5 0 0 0 5 18.5z"/><path d="M5 18.5A1.5 1.5 0 0 1 6.5 17H19v4H6.5A1.5 1.5 0 0 1 5 19.5z"/>',
    bolt: '<path d="M13 3 5 13.5h5.5L11 21l8-10.5h-5.5z"/>',
    form: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    sparkle: '<path d="M11 3.5 12.6 9l5.4 1.6L12.6 12.2 11 17.8 9.4 12.2 4 10.6 9.4 9z"/><path d="M18.5 3v3.4M20.2 4.7h-3.4"/>',
    bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9"/><path d="M10.3 19a2 2 0 0 0 3.4 0"/>',
    exit: '<path d="M14 3h3.5A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5H14"/><path d="M10 16.5 5.5 12 10 7.5"/><path d="M5.5 12H16"/>',
    chart: '<path d="M4 20h16"/><path d="M7.5 20v-5.5M12 20V7M16.5 20v-8.5"/>',
    trophy: '<path d="M8 3.5h8V9a4 4 0 0 1-8 0z"/><path d="M8 5H5.6a2.4 2.4 0 0 0 .6 4.8"/><path d="M16 5h2.4a2.4 2.4 0 0 1-.6 4.8"/><path d="M12 13v4"/><path d="M9 20.5h6"/><path d="M10.5 17h3l.7 3.5h-4.4z"/>',
    suitcase: '<rect x="3" y="7" width="18" height="13.5" rx="2.5"/><path d="M9 7V5.2A2.2 2.2 0 0 1 11.2 3h1.6A2.2 2.2 0 0 1 15 5.2V7"/><path d="M3 13h18"/>',
    chat: '<path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5H9l-5 3 1.3-4.3A7.5 7.5 0 0 1 3 11.5 7.5 7.5 0 0 1 10.5 4h3A7.5 7.5 0 0 1 21 11.5z"/>',
    download: '<path d="M12 3.5v11.5"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4 20h16"/>',
    upload: '<path d="M12 20V8.5"/><path d="M7.5 13 12 8.5 16.5 13"/><path d="M4 4h16"/>',
    share: '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5.5 12.5V19a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-6.5"/>',
    pencil: '<path d="M4 20h4.2L20 8.2a2.9 2.9 0 0 0-4.2-4.2L4 15.8z"/><path d="M14.5 5.5 18.5 9.5"/>',
    repeat: '<path d="M17 2.5 20.5 6 17 9.5"/><path d="M20.5 6H8.5A4.5 4.5 0 0 0 4 10.5V12"/><path d="M7 21.5 3.5 18 7 14.5"/><path d="M3.5 18h12a4.5 4.5 0 0 0 4.5-4.5V12"/>',
    trash: '<path d="M4 6.5h16"/><path d="M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5"/><path d="M6 6.5 7 20a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 20l1-13.5"/><path d="M10 10.5v6.5M14 10.5v6.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8 20.5 20.5"/>',
    plate: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
    hourglass: '<path d="M7 3h10M7 21h10"/><path d="M7 3v3.6L12 12 7 17.4V21"/><path d="M17 3v3.6L12 12l5 5.4V21"/>',
    bookmark: '<path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2L5.5 20.5v-16a1 1 0 0 1 1-1z"/>',
    star: '<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4M16 3v4"/>',
    person: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.5a7.2 7.2 0 0 1 14.4 0"/>',
    pin: '<path d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10.5" r="2.6"/>',
    check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  };

  function svg(name, extraClass) {
    const inner = PATHS[name];
    if (!inner) return '';
    const cls = extraClass ? `icn ${extraClass}` : 'icn';
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;
  }

  // Fills every <span data-icon="..."> under `root`. Safe to call repeatedly —
  // a span that already has its icon is left alone, so a page that re-renders
  // part of itself doesn't end up with icons nested inside icons.
  function hydrate(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-icon]').forEach((el) => {
      if (el.getAttribute('data-icon-done') === '1') return;
      const markup = svg(el.getAttribute('data-icon'), el.getAttribute('data-icon-class') || '');
      if (!markup) return;
      el.innerHTML = markup;
      el.setAttribute('data-icon-done', '1');
    });
  }

  document.addEventListener('bitebook:ready', () => hydrate());
  document.addEventListener('DOMContentLoaded', () => hydrate());

  return { svg, hydrate, names: Object.keys(PATHS) };
})();
