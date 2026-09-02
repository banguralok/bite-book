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
      ${isOwner ? `<a href="entry.html?id=${encodeURIComponent(entry.id)}" class="btn btn-back">✏️ Edit</a>` : ''}
      <button type="button" class="btn btn-back" id="log-again-btn">🔁 Log This Again</button>
      <button type="button" class="btn btn-back" id="share-btn">📤 Share</button>
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

function shareEntryAsImage(entry) {
  const canvas = document.createElement('canvas');
  const W = 900, H = 1100;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#fff8ef');
  grad.addColorStop(1, '#ffe3cf');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const drawPhotoAndText = (photoImg) => {
    const padding = 50;
    let y = padding;

    if (photoImg) {
      const photoH = 480;
      const scale = Math.max(W / photoImg.width, photoH / photoImg.height);
      const sw = (W) / scale;
      const sh = photoH / scale;
      const sx = (photoImg.width - sw) / 2;
      const sy = (photoImg.height - sh) / 2;
      ctx.save();
      ctx.beginPath();
      const r = 28;
      ctx.moveTo(padding + r, y);
      ctx.arcTo(W - padding, y, W - padding, y + photoH, r);
      ctx.arcTo(W - padding, y + photoH, padding, y + photoH, r);
      ctx.arcTo(padding, y + photoH, padding, y, r);
      ctx.arcTo(padding, y, W - padding, y, r);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(photoImg, sx, sy, sw, sh, padding, y, W - padding * 2, photoH);
      ctx.restore();
      y += photoH + 40;
    } else {
      y += 20;
    }

    ctx.fillStyle = '#4a352a';
    ctx.font = '700 52px Georgia, serif';
    wrapText(ctx, entry.food || 'A Food Memory', padding, y + 10, W - padding * 2, 58);
    y += 90;

    ctx.font = '400 26px Georgia, serif';
    ctx.fillStyle = '#7a6559';
    const facts = [];
    const when = dateTimeSummaryLabel(entry);
    if (when) facts.push(`🕰️ ${when}`);
    if (entry.placeName) facts.push(`📍 ${entry.placeName}`);
    const companion = companionSummaryLabel(entry);
    if (companion) facts.push(`👥 ${companion}`);
    const maker = makerSummaryLabel(entry);
    if (maker) facts.push(`👩‍🍳 ${maker}`);
    if (entry.rating) facts.push(ratingStarsLabel(entry.rating));

    facts.forEach((line) => {
      ctx.fillText(line, padding, y);
      y += 42;
    });

    if (entry.reflection) {
      y += 20;
      ctx.font = 'italic 400 26px Georgia, serif';
      ctx.fillStyle = '#4a352a';
      y = wrapText(ctx, `"${entry.reflection}"`, padding, y, W - padding * 2, 36);
    }

    ctx.font = '700 24px Nunito, sans-serif';
    ctx.fillStyle = '#f0672c';
    ctx.fillText('🍜 Bite Book', padding, H - 40);

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(entry.food || 'bite-book-entry').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  if (entry.photos && entry.photos[0]) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => drawPhotoAndText(img);
    img.onerror = () => drawPhotoAndText(null);
    img.src = entry.photos[0].url;
  } else {
    drawPhotoAndText(null);
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = words[i] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
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

  document.getElementById('share-btn').addEventListener('click', (e) => {
    e.target.textContent = '📤 Preparing...';
    shareEntryAsImage(entry);
    setTimeout(() => { e.target.textContent = '📤 Share'; }, 1200);
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
