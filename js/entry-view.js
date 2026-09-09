function escapeHtmlView(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function section(icon, label, innerHtml, editHref) {
  const editLink = editHref
    ? `<a href="${editHref}" class="story-section-edit" aria-label="Edit ${label}">✏️</a>`
    : '';
  return `
    <div class="story-section">
      <div class="story-section-label">${icon} ${label}${editLink}</div>
      ${innerHtml}
    </div>
  `;
}

function buildSharePanelHtml(directory, shareUserIds) {
  if (!directory.length) {
    return `<p class="field-sublabel">No one in your family or friends list yet — add them from your Profile page first.</p>`;
  }
  const chips = directory.map((p) => {
    const label = p.name || 'Unnamed';
    return `<button type="button" class="chip" aria-pressed="false" data-user-id="${escapeHtmlView(p.id)}">${p.avatar ? escapeHtmlView(p.avatar) + ' ' : '👤 '}${escapeHtmlView(label)}</button>`;
  }).join('');
  return `<div class="chip-grid" id="share-chip-grid">${chips}</div>`;
}

function buildStoryHtml(entry, ctx) {
  const { isOwner, directory, shareUserIds, ownerName } = ctx;
  const title = entry.food || 'Untitled entry';
  const mealLabel = mealTypeLabel(entry.mealType);
  const cuisLabel = cuisineLabel(entry.cuisine);
  const whenLabel = dateTimeSummaryLabel(entry);
  const photos = entry.photos || [];
  const heroPhoto = photos[0];

  const heroHtml = `
    <div class="story-hero">
      ${heroPhoto
        ? `<img class="story-hero-photo" src="${heroPhoto.url}" alt="">`
        : `<div class="story-hero-placeholder">🍽️</div>`}
      <div class="story-hero-overlay">
        <h1>${escapeHtmlView(title)}</h1>
        <div class="story-badges">
          ${mealLabel ? `<span class="story-badge">${mealLabel}</span>` : ''}
          ${cuisLabel ? `<span class="story-badge">${cuisLabel}</span>` : ''}
          ${whenLabel ? `<span class="story-badge">🕰️ ${escapeHtmlView(whenLabel)}</span>` : ''}
        </div>
      </div>
    </div>
  `;

  const sharedByHtml = !isOwner
    ? `<p class="shared-by-note">👥 Shared by ${escapeHtmlView(ownerName || 'a family member')}</p>`
    : '';

  const sharePanelHtml = isOwner
    ? `
      <button type="button" class="toggle-link" id="share-toggle-link">👥 Share with...</button>
      <div class="field-group" id="share-wrap" style="display: none; margin-top: 14px;">
        ${buildSharePanelHtml(directory, shareUserIds)}
        <p class="upload-status" id="share-status"></p>
      </div>
    `
    : '';

  const actionsHtml = `
    <div class="story-actions">
      ${isOwner ? `<a href="entry.html?id=${encodeURIComponent(entry.id)}" class="btn btn-back">${BiteBookIcons.svg('pencil')} Edit</a>` : ''}
      <button type="button" class="btn btn-back" id="log-again-btn">${BiteBookIcons.svg('repeat')} Log This Again</button>
      <button type="button" class="btn btn-back" id="share-btn">${BiteBookIcons.svg('share')} Share</button>
    </div>
    ${sharedByHtml}
    ${sharePanelHtml}
  `;

  const sections = [];
  const stepHref = (page) => (isOwner ? `${page}?id=${encodeURIComponent(entry.id)}` : null);

  const placeBits = [entry.placeName, entry.placeAddress].filter(Boolean).join(' — ');
  if (placeBits || entry.placeType) {
    sections.push(section('📍', 'Where', `
      <p>${escapeHtmlView(placeBits || '')}</p>
      ${entry.placeType ? `<div class="story-chip-row"><span class="story-static-chip">${placeTypeLabel(entry.placeType)}</span></div>` : ''}
    `, stepHref('entry-where.html')));
  }

  const companionText = companionSummaryLabel(entry);
  if (companionText) {
    sections.push(section('👥', 'Good Company', `<p>${escapeHtmlView(companionText)}</p>`, stepHref('entry-who.html')));
  }

  const makerText = makerSummaryLabel(entry);
  if (makerText) {
    sections.push(section('👩‍🍳', 'Made By', `<p>${escapeHtmlView(makerText)}</p>`, stepHref('entry-made.html')));
  }

  const reasonText = reasonSummaryLabel(entry);
  if (reasonText) {
    sections.push(section('🎈', 'The Occasion', `<p>${escapeHtmlView(reasonText)}</p>`, stepHref('entry-why.html')));
  }

  if (entry.ingredientsText || entry.ingredientsLink || entry.ingredientsFile) {
    let inner = '';
    if (entry.ingredientsText) inner += `<p>${escapeHtmlView(entry.ingredientsText)}</p>`;
    if (entry.ingredientsLink) {
      if (isSafeUrl(entry.ingredientsLink)) {
        inner += `<p><a href="${escapeHtmlView(entry.ingredientsLink)}" target="_blank" rel="noopener noreferrer">${escapeHtmlView(linkPlatformLabel(entry.ingredientsLink))} — open recipe ↗</a></p>`;
      } else {
        inner += `<p>🔗 ${escapeHtmlView(entry.ingredientsLink)} <em>(this link doesn't look safe, so it's not clickable)</em></p>`;
      }
    }
    if (entry.ingredientsFile) {
      const f = entry.ingredientsFile;
      inner += `<p><a href="${f.url}" download="${escapeHtmlView(f.name)}">${fileKindIcon(f.type)} ${escapeHtmlView(f.name)} — download</a></p>`;
    }
    sections.push(section('🥕', 'What Went Into It', inner, stepHref('entry-ingredients.html')));
  }

  const likedTypes = entry.likedQualities || [];
  if (likedTypes.length || entry.rating || entry.wouldEatAgain || entry.personalRank) {
    let inner = '';
    if (likedTypes.length) {
      inner += `<div class="story-chip-row">${likedTypes.map((q) => `<span class="story-static-chip">${likedQualityLabel(q)}</span>`).join('')}</div>`;
    }
    if (entry.rating) {
      inner += `<p style="margin-top:12px;" class="story-stars">${ratingStarsLabel(entry.rating)}</p>`;
    }
    if (entry.wouldEatAgain) {
      const freq = entry.eatAgainFrequency ? ` — ${frequencyLabel(entry.eatAgainFrequency)}` : '';
      inner += `<p style="margin-top:8px;">${eatAgainLabel(entry.wouldEatAgain)}${escapeHtmlView(freq)}</p>`;
    }
    if (entry.personalRank) {
      inner += `<div class="story-chip-row" style="margin-top:8px;"><span class="story-static-chip">${rankLabel(entry.personalRank)}</span></div>`;
    }
    sections.push(section('💛', 'Why They Loved It', inner, stepHref('entry-loved.html')));
  }

  if (entry.reflection) {
    sections.push(section('📝', 'In Their Own Words', `<p class="story-quote">${escapeHtmlView(entry.reflection)}</p>`, stepHref('entry-loved.html')));
  }

  if (photos.length > 1) {
    const gallery = photos.slice(1).map((p) => `<img src="${p.url}" alt="">`).join('');
    sections.push(section('📸', 'More Photos', `<div class="story-gallery">${gallery}</div>`, stepHref('entry-photos.html')));
  }

  const videos = entry.videos || [];
  if (videos.length) {
    const rows = videos.map((v) => {
      if (v.kind === 'file') {
        return `<p>🎬 <a href="${v.url}" download="${escapeHtmlView(v.name)}">${escapeHtmlView(v.name)} — download</a></p>`;
      }
      if (isSafeUrl(v.url)) {
        return `<p><a href="${escapeHtmlView(v.url)}" target="_blank" rel="noopener noreferrer">${escapeHtmlView(linkPlatformLabel(v.url))} — watch ↗</a></p>`;
      }
      return `<p>🔗 ${escapeHtmlView(v.url)} <em>(this link doesn't look safe, so it's not clickable)</em></p>`;
    }).join('');
    sections.push(section('🎬', 'Videos', rows, stepHref('entry-photos.html')));
  }

  return heroHtml + actionsHtml + sections.join('');
}

document.addEventListener('bitebook:ready', async () => {
  const container = document.getElementById('story-content');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const entry = id ? await BiteBookStorage.getEntry(id) : null;

  if (!entry) {
    container.innerHTML = `
      <div class="story-empty">
        <div class="empty-state-icon">🔍</div>
        <h3>Couldn't find that entry</h3>
        <p>It may have been deleted.</p>
        <a href="entries.html" class="btn btn-primary">Back to My Entries</a>
      </div>
    `;
    return;
  }

  const myId = BiteBookProfile.get().id;
  const isOwner = entry.ownerId === myId;
  const directory = await BiteBookStorage.listDirectory();
  const shareUserIds = isOwner ? await BiteBookStorage.getShareUserIds(entry.id) : new Set();
  const ownerName = isOwner ? null : (directory.find((p) => p.id === entry.ownerId) || {}).name;

  container.innerHTML = buildStoryHtml(entry, { isOwner, directory, shareUserIds, ownerName });

  document.getElementById('log-again-btn').addEventListener('click', async () => {
    const newId = await BiteBookStorage.duplicateForLogAgain(entry);
    window.location.href = `entry.html?id=${encodeURIComponent(newId)}`;
  });

  const shareBtn = document.getElementById('share-btn');
  shareBtn.addEventListener('click', () => {
    // innerHTML, not textContent — the button holds a drawn icon, and a click
    // can land on the icon itself, so e.target isn't reliably the button.
    const label = shareBtn.innerHTML;
    shareBtn.textContent = 'Preparing...';
    BiteBookShare.shareEntry(entry);
    setTimeout(() => { shareBtn.innerHTML = label; }, 1200);
  });

  const shareToggleLink = document.getElementById('share-toggle-link');
  if (shareToggleLink) {
    const shareWrap = document.getElementById('share-wrap');
    shareToggleLink.addEventListener('click', () => {
      shareWrap.style.display = shareWrap.style.display === 'none' ? 'block' : 'none';
    });

    const shareStatus = document.getElementById('share-status');
    document.querySelectorAll('#share-chip-grid .chip').forEach((chip) => {
      setChipSelected(chip, shareUserIds.has(chip.dataset.userId));
      chip.addEventListener('click', async () => {
        const userId = chip.dataset.userId;
        const nowSelected = !chip.classList.contains('selected');
        chip.disabled = true;
        const ok = nowSelected
          ? await BiteBookStorage.shareEntry(entry.id, userId)
          : await BiteBookStorage.unshareEntry(entry.id, userId);
        chip.disabled = false;
        if (ok) {
          setChipSelected(chip, nowSelected);
          shareStatus.textContent = '';
        } else {
          shareStatus.textContent = '⚠️ Something went wrong — try again.';
        }
      });
    });
  }
});
