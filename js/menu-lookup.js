// "Find this on their menu" — the picker.
//
// The rule this whole component exists to enforce: a dish name that came off
// the web is a SUGGESTION until a person picks it, and once picked it stays
// traceable to the page it came from. Nothing here writes to an entry on its
// own; mount() hands the chosen dish back to the caller and the caller
// decides what to do with it.
//
// Exactly one dish can be chosen. That is structural rather than policed —
// the options are real radio inputs in one named group, so the browser
// enforces it and screen readers and keyboards get the right behaviour
// without any of it being reimplemented.
const BiteBookMenuLookup = (() => {
  let counter = 0;

  function escapeHtmlMenu(str) {
    const div = document.createElement('div');
    div.textContent = (str === null || str === undefined) ? '' : String(str);
    return div.innerHTML;
  }

  const CONFIDENCE_LABEL = {
    high: 'Close match',
    medium: 'Possible match',
    low: 'Long shot',
  };

  function resultHtml(result, groupName) {
    const bits = [];

    if (result.dishes.length === 0) {
      bits.push(`<p class="menu-note">${escapeHtmlMenu(result.note || "Couldn't find a menu for this place.")}</p>`);
    } else {
      bits.push(`<p class="menu-note">${escapeHtmlMenu(result.note || 'Pick the one you actually had.')}</p>`);
      bits.push('<div class="menu-options" role="radiogroup" aria-label="Dishes from the menu">');
      result.dishes.forEach((dish, i) => {
        const id = `${groupName}-${i}`;
        bits.push(`
          <label class="menu-option" for="${id}">
            <input type="radio" name="${groupName}" id="${id}" value="${i}">
            <span class="menu-option-body">
              <span class="menu-option-name">${escapeHtmlMenu(dish.name)}</span>
              ${dish.description ? `<span class="menu-option-desc">${escapeHtmlMenu(dish.description)}</span>` : ''}
              <span class="menu-option-conf">${escapeHtmlMenu(CONFIDENCE_LABEL[dish.confidence] || 'Possible match')}</span>
            </span>
          </label>
        `);
      });
      bits.push('</div>');
    }

    // Where it came from, always shown. A name with no traceable source is
    // exactly the thing this feature is supposed to avoid.
    const sources = (result.sources || []).slice(0, 4);
    if (result.menuUrl || sources.length) {
      const links = [];
      if (result.menuUrl) {
        links.push(`<a href="${escapeHtmlMenu(result.menuUrl)}" target="_blank" rel="noopener noreferrer">The menu it used ↗</a>`);
      }
      sources.forEach((src) => {
        if (src.uri === result.menuUrl) return;
        links.push(`<a href="${escapeHtmlMenu(src.uri)}" target="_blank" rel="noopener noreferrer">${escapeHtmlMenu(src.title)} ↗</a>`);
      });
      if (links.length) {
        bits.push(`<p class="menu-sources">Found on: ${links.join(' · ')}</p>`);
      }
    }

    bits.push('<p class="menu-caution">These come from the web, so check the name looks right before you keep it.</p>');
    return bits.join('');
  }

  // opts: { getPlace(), getDescription(), getPhoto(), onPick(dish, result), onClear() }
  function mount(hostId, opts) {
    const host = document.getElementById(hostId);
    if (!host) return null;

    counter += 1;
    const groupName = `menu-dish-${counter}`;

    host.innerHTML = `
      <button type="button" class="toggle-link" id="${groupName}-btn">
        ${BiteBookIcons.svg('search')} Find this on their menu
      </button>
      <p class="upload-status" id="${groupName}-status"></p>
      <div class="menu-results" id="${groupName}-results" style="display: none;"></div>
    `;

    const btn = document.getElementById(`${groupName}-btn`);
    const status = document.getElementById(`${groupName}-status`);
    const results = document.getElementById(`${groupName}-results`);

    function setAvailability() {
      const place = opts.getPlace() || {};
      const ready = !!(place.name && String(place.name).trim());
      btn.disabled = !ready;
      btn.title = ready
        ? "Search this restaurant's own menu"
        : 'Add where you ate first — a menu needs a restaurant';
      host.style.display = ready ? 'block' : 'none';
    }

    btn.addEventListener('click', async () => {
      const place = opts.getPlace() || {};
      const description = (opts.getDescription && opts.getDescription()) || '';
      const photo = (opts.getPhoto && opts.getPhoto()) || null;

      btn.disabled = true;
      const label = btn.innerHTML;
      btn.textContent = 'Reading their menu...';
      status.textContent = '';
      status.classList.remove('error');
      results.style.display = 'none';

      let result;
      try {
        result = await BiteBookAI.findMenuMatches(place, description, photo);
      } catch (err) {
        status.textContent = BiteBookAI.friendlyErrorMessage(err);
        status.classList.add('error');
        btn.innerHTML = label;
        btn.disabled = false;
        return;
      }

      btn.innerHTML = label;
      btn.disabled = false;

      results.innerHTML = resultHtml(result, groupName);
      results.style.display = 'block';

      results.querySelectorAll(`input[name="${groupName}"]`).forEach((input) => {
        input.addEventListener('change', () => {
          const dish = result.dishes[Number(input.value)];
          if (dish && opts.onPick) opts.onPick(dish, result);
        });
      });

      if (typeof BiteBookTrack !== 'undefined') {
        BiteBookTrack.event('menu_lookup', { found: result.dishes.length });
      }
    });

    setAvailability();
    return { refresh: setAvailability };
  }

  return { mount };
})();
