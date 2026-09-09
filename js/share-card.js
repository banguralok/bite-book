// Shareable cards — one for a single entry, one for a whole trip.
//
// Both paint a canvas and then hand the PNG to the OS share sheet where the
// browser supports it (Instagram, WhatsApp and Messages are all targets
// there), falling back to a plain download everywhere else.
//
// A photo served from private storage can taint the canvas when its CORS
// headers don't come back as expected, and toBlob() then throws instead of
// producing an image. Every card below is therefore drawn through render(),
// which redraws the same card without photos and shares that instead — a
// card with no picture beats a share button that silently does nothing.
const BiteBookShare = (() => {
  const W = 900;
  const H = 1100;
  const PAD = 50;
  const INK = '#4a352a';
  const INK_SOFT = '#7a6559';
  const BRAND = '#f0672c';

  function makeContext() {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#fff8ef');
    grad.addColorStop(1, '#ffe3cf');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    return { canvas, ctx };
  }

  function roundedClip(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.clip();
  }

  // Fills the box completely, cropping the overflow — the same behaviour as
  // CSS object-fit: cover, so a portrait phone photo never letterboxes.
  function drawCover(ctx, img, x, y, w, h, r) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.save();
    roundedClip(ctx, x, y, w, h, r);
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    ctx.restore();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(' ');
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

  // Never rejects: a photo that fails to load resolves to null and is simply
  // left out of the collage, so one broken image can't sink the whole card.
  function loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function loadImages(urls) {
    return Promise.all(urls.map(loadImage)).then((imgs) => imgs.filter(Boolean));
  }

  function safeFilename(name, fallback) {
    return `${String(name || fallback).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  }

  async function deliver(blob, filename, title, text, eventName) {
    if (!blob) return;

    const file = (typeof File !== 'undefined')
      ? new File([blob], filename, { type: 'image/png' })
      : null;

    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title, text });
        if (typeof BiteBookTrack !== 'undefined') {
          BiteBookTrack.event(eventName, { via: 'share_sheet' });
        }
        return;
      } catch (err) {
        // A dismissed share sheet is a decision, not a failure.
        if (err && err.name === 'AbortError') return;
        // Anything else: fall through to the download below.
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof BiteBookTrack !== 'undefined') {
      BiteBookTrack.event(eventName, { via: 'download' });
    }
  }

  // Finds where the text block should start when there is no photo to anchor
  // the top of the card. Draws the card once on a throwaway canvas with text
  // output disabled, purely to learn how tall it comes out, then centres that
  // height in the space above the footer. Without this, a card whose photo is
  // missing (or failed to load) leaves the bottom two thirds empty and reads
  // as broken rather than minimal.
  function centredStart(draw) {
    const scratch = document.createElement('canvas');
    scratch.width = W;
    scratch.height = H;
    const c = scratch.getContext('2d');
    c.fillText = () => {};
    const contentHeight = draw(c, [], PAD) - PAD;
    const available = (H - 110) - PAD;
    return Math.max(PAD, PAD + Math.round((available - contentHeight) / 2));
  }

  // draw(ctx, images, startY) paints one complete card and returns the y it
  // finished at. Called a second time with an empty image list if the first
  // canvas came out tainted.
  function render(draw, images, filename, title, text, eventName) {
    const attempt = (imgs, isRetry) => {
      const startY = imgs.length ? PAD : centredStart(draw);
      const { canvas, ctx } = makeContext();
      draw(ctx, imgs, startY);
      try {
        canvas.toBlob((blob) => deliver(blob, filename, title, text, eventName), 'image/png');
      } catch (err) {
        if (isRetry) return;
        attempt([], true);
      }
    };
    attempt(images, false);
  }

  function drawFooter(ctx) {
    ctx.font = '700 24px Nunito, sans-serif';
    ctx.fillStyle = BRAND;
    ctx.fillText('🍜 Bite Book', PAD, H - 40);
  }

  // ---------- one entry ----------

  function drawEntryCard(entry) {
    return (ctx, images, startY) => {
      let y = startY;
      const photo = images[0];

      if (photo) {
        const photoH = 480;
        drawCover(ctx, photo, PAD, y, W - PAD * 2, photoH, 28);
        y += photoH + 40;
      } else {
        y += 20;
      }

      ctx.fillStyle = INK;
      ctx.font = '700 52px Georgia, serif';
      wrapText(ctx, entry.food || 'A Food Memory', PAD, y + 10, W - PAD * 2, 58);
      y += 90;

      ctx.font = '400 26px Georgia, serif';
      ctx.fillStyle = INK_SOFT;
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
        ctx.fillText(line, PAD, y);
        y += 42;
      });

      if (entry.reflection) {
        y += 20;
        ctx.font = 'italic 400 26px Georgia, serif';
        ctx.fillStyle = INK;
        y = wrapText(ctx, `"${entry.reflection}"`, PAD, y, W - PAD * 2, 36);
      }

      drawFooter(ctx);
      return y;
    };
  }

  async function shareEntry(entry) {
    const url = entry.photos && entry.photos[0] && entry.photos[0].url;
    const images = url ? await loadImages([url]) : [];
    render(
      drawEntryCard(entry),
      images,
      safeFilename(entry.food, 'bite-book-entry'),
      entry.food || 'Bite Book',
      `${entry.food || 'A meal'} — from my Bite Book`,
      'entry_shared'
    );
  }

  // ---------- a whole trip ----------

  // Up to four photos, laid out to suit however many actually loaded, so a
  // trip with one picture doesn't get three empty boxes.
  function drawCollage(ctx, images, x, y, w, h) {
    const gap = 14;
    const r = 22;
    if (images.length === 1) {
      drawCover(ctx, images[0], x, y, w, h, r);
      return;
    }
    if (images.length === 2) {
      const halfW = (w - gap) / 2;
      drawCover(ctx, images[0], x, y, halfW, h, r);
      drawCover(ctx, images[1], x + halfW + gap, y, halfW, h, r);
      return;
    }
    if (images.length === 3) {
      const bigW = w * 0.58 - gap / 2;
      const smallW = w - bigW - gap;
      const smallH = (h - gap) / 2;
      drawCover(ctx, images[0], x, y, bigW, h, r);
      drawCover(ctx, images[1], x + bigW + gap, y, smallW, smallH, r);
      drawCover(ctx, images[2], x + bigW + gap, y + smallH + gap, smallW, smallH, r);
      return;
    }
    const cellW = (w - gap) / 2;
    const cellH = (h - gap) / 2;
    drawCover(ctx, images[0], x, y, cellW, cellH, r);
    drawCover(ctx, images[1], x + cellW + gap, y, cellW, cellH, r);
    drawCover(ctx, images[2], x, y + cellH + gap, cellW, cellH, r);
    drawCover(ctx, images[3], x + cellW + gap, y + cellH + gap, cellW, cellH, r);
  }

  function tripFacts(entries) {
    const places = new Set(entries.map((e) => e.placeName).filter(Boolean));
    const dates = entries.map((e) => e.ateOn).filter(Boolean).sort();
    const cuisineCounts = {};
    entries.forEach((e) => {
      if (e.cuisine) cuisineCounts[e.cuisine] = (cuisineCounts[e.cuisine] || 0) + 1;
    });
    const topCuisine = Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1])[0];
    const rated = entries.filter((e) => e.rating).sort((a, b) => b.rating - a.rating);
    return {
      meals: entries.length,
      places: places.size,
      firstDate: dates[0] || null,
      lastDate: dates[dates.length - 1] || null,
      topCuisine: topCuisine ? topCuisine[0] : null,
      best: rated[0] || null,
    };
  }

  function tripDateRangeLabel(facts) {
    if (!facts.firstDate) return '';
    if (facts.firstDate === facts.lastDate) return formatDateLabel(facts.firstDate).replace(/^.*— /, '');
    const from = parseDateInputValue(facts.firstDate);
    const to = parseDateInputValue(facts.lastDate);
    const sameYear = from.getFullYear() === to.getFullYear();
    const fromLabel = from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const toLabel = to.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    return sameYear ? `${fromLabel} – ${toLabel}` : `${from.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${toLabel}`;
  }

  function drawTripCard(trip, entries) {
    const facts = tripFacts(entries);
    return (ctx, images, startY) => {
      let y = startY;

      if (images.length) {
        const collageH = 460;
        drawCollage(ctx, images, PAD, y, W - PAD * 2, collageH);
        y += collageH + 44;
      } else {
        y += 30;
      }

      ctx.fillStyle = INK_SOFT;
      ctx.font = '600 24px Nunito, sans-serif';
      ctx.fillText('✈️ THE TRIP STORY', PAD, y);
      y += 46;

      ctx.fillStyle = INK;
      ctx.font = '700 54px Georgia, serif';
      y = wrapText(ctx, trip.name || 'A Trip', PAD, y, W - PAD * 2, 60);
      y += 6;

      const range = tripDateRangeLabel(facts);
      if (range) {
        ctx.font = '400 27px Georgia, serif';
        ctx.fillStyle = INK_SOFT;
        ctx.fillText(range, PAD, y);
        y += 46;
      }

      ctx.font = '400 27px Georgia, serif';
      ctx.fillStyle = INK_SOFT;
      const lines = [];
      lines.push(`🍽️ ${facts.meals} meal${facts.meals === 1 ? '' : 's'} · 📍 ${facts.places} place${facts.places === 1 ? '' : 's'}`);
      if (facts.topCuisine) lines.push(`🥘 Mostly ${cuisineLabel(facts.topCuisine)}`);
      if (facts.best) {
        lines.push(`⭐ Best bite: ${facts.best.food || 'one of them'}${facts.best.placeName ? ` at ${facts.best.placeName}` : ''}`);
      }
      lines.forEach((line) => {
        y = wrapText(ctx, line, PAD, y, W - PAD * 2, 38);
        y += 6;
      });

      drawFooter(ctx);
      return y;
    };
  }

  async function shareTrip(trip, entries) {
    const urls = entries
      .map((e) => e.photos && e.photos[0] && e.photos[0].url)
      .filter(Boolean)
      .slice(0, 4);
    const images = urls.length ? await loadImages(urls) : [];
    const facts = tripFacts(entries);
    render(
      drawTripCard(trip, entries),
      images,
      safeFilename(trip.name, 'bite-book-trip'),
      trip.name || 'Bite Book',
      `${trip.name || 'Our trip'} — ${facts.meals} meal${facts.meals === 1 ? '' : 's'} from my Bite Book`,
      'trip_shared'
    );
  }

  return { shareEntry, shareTrip };
})();
