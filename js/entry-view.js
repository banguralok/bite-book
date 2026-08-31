function escapeHtmlView(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function section(icon, label, innerHtml) {
  return `
    <div class="story-section">
      <div class="story-section-label">${icon} ${label}</div>
      ${innerHtml}
    </div>
  `;
}

function buildStoryHtml(entry) {
  const title = entry.food || 'Untitled entry';
  const mealLabel = mealTypeLabel(entry.mealType);
  const cuisLabel = cuisineLabel(entry.cuisine);
  const whenLabel = dateTimeSummaryLabel(entry);
  const photos = entry.photos || [];
  const heroPhoto = photos[0];

  const heroHtml = `
    <div class="story-hero">
      ${heroPhoto
        ? `<img class="story-hero-photo" src="${heroPhoto.dataUrl}" alt="">`
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

  const actionsHtml = `
    <div class="story-actions">
      <a href="entry.html?id=${encodeURIComponent(entry.id)}" class="btn btn-back">✏️ Edit</a>
      <button type="button" class="btn btn-back" id="log-again-btn">🔁 Log This Again</button>
      <button type="button" class="btn btn-back" id="share-btn">📤 Share</button>
    </div>
  `;

  const sections = [];

  const placeBits = [entry.placeName, entry.placeAddress].filter(Boolean).join(' — ');
  if (placeBits || entry.placeType) {
    sections.push(section('📍', 'Where', `
      <p>${escapeHtmlView(placeBits || '')}</p>
      ${entry.placeType ? `<div class="story-chip-row"><span class="story-static-chip">${placeTypeLabel(entry.placeType)}</span></div>` : ''}
    `));
  }

  const companionText = companionSummaryLabel(entry);
  if (companionText) {
    sections.push(section('👥', 'Good Company', `<p>${escapeHtmlView(companionText)}</p>`));
  }

  const makerText = makerSummaryLabel(entry);
  if (makerText) {
    sections.push(section('👩‍🍳', 'Made By', `<p>${escapeHtmlView(makerText)}</p>`));
  }

  const reasonText = reasonSummaryLabel(entry);
  if (reasonText) {
    sections.push(section('🎈', 'The Occasion', `<p>${escapeHtmlView(reasonText)}</p>`));
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
      inner += `<p><a href="${f.dataUrl}" download="${escapeHtmlView(f.name)}">${fileKindIcon(f.type)} ${escapeHtmlView(f.name)} — download</a></p>`;
    }
    sections.push(section('🥕', 'What Went Into It', inner));
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
    sections.push(section('💛', 'Why They Loved It', inner));
  }

  if (entry.reflection) {
    sections.push(section('📝', 'In Their Own Words', `<p class="story-quote">${escapeHtmlView(entry.reflection)}</p>`));
  }

  if (photos.length > 1) {
    const gallery = photos.slice(1).map((p) => `<img src="${p.dataUrl}" alt="">`).join('');
    sections.push(section('📸', 'More Photos', `<div class="story-gallery">${gallery}</div>`));
  }

  const videos = entry.videos || [];
  if (videos.length) {
    const rows = videos.map((v) => {
      if (v.kind === 'file') {
        return `<p>🎬 <a href="${v.dataUrl}" download="${escapeHtmlView(v.name)}">${escapeHtmlView(v.name)} — download</a></p>`;
      }
      if (isSafeUrl(v.url)) {
        return `<p><a href="${escapeHtmlView(v.url)}" target="_blank" rel="noopener noreferrer">${escapeHtmlView(linkPlatformLabel(v.url))} — watch ↗</a></p>`;
      }
      return `<p>🔗 ${escapeHtmlView(v.url)} <em>(this link doesn't look safe, so it's not clickable)</em></p>`;
    }).join('');
    sections.push(section('🎬', 'Videos', rows));
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
    img.onload = () => drawPhotoAndText(img);
    img.onerror = () => drawPhotoAndText(null);
    img.src = entry.photos[0].dataUrl;
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

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('story-content');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const entry = id ? BiteBookStorage.getEntry(id) : null;

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

  container.innerHTML = buildStoryHtml(entry);

  document.getElementById('log-again-btn').addEventListener('click', () => {
    const newId = BiteBookStorage.duplicateForLogAgain(entry);
    window.location.href = `entry.html?id=${encodeURIComponent(newId)}`;
  });

  document.getElementById('share-btn').addEventListener('click', (e) => {
    e.target.textContent = '📤 Preparing...';
    shareEntryAsImage(entry);
    setTimeout(() => { e.target.textContent = '📤 Share'; }, 1200);
  });
});
