document.addEventListener('bitebook:ready', async () => {
  const photoGrid = document.getElementById('photo-grid');
  const photoAddTile = document.getElementById('photo-add-tile');
  const photoInput = document.getElementById('photo-input');
  const photoStatus = document.getElementById('photo-status');
  const videoList = document.getElementById('video-list');
  const videoUploadBtn = document.getElementById('video-upload-btn');
  const videoInput = document.getElementById('video-input');
  const videoLinkInput = document.getElementById('video-link-input');
  const videoLinkAddBtn = document.getElementById('video-link-add-btn');
  const videoStatus = document.getElementById('video-status');
  const backBtn = document.getElementById('back-btn');
  const continueBtn = document.getElementById('continue-btn');
  const savedToast = document.getElementById('saved-toast');
  const autosaveHint = document.getElementById('autosave-hint');

  const MAX_PHOTOS = 6;
  const MAX_PHOTO_BYTES = 700 * 1024;
  const MAX_VIDEOS = 4;
  const MAX_VIDEO_FILE_BYTES = 3 * 1024 * 1024;

  let entryId = null;
  let createdAt = null;
  let cachedEntry = null;
  let photos = [];
  let videos = [];

  function buildEntry(extra) {
    const existing = cachedEntry || {};
    const now = new Date().toISOString();
    return {
      ...existing,
      id: entryId,
      photos,
      videos,
      createdAt: createdAt || existing.createdAt || now,
      updatedAt: now,
      ...(extra || {}),
    };
  }

  async function saveNow(extra) {
    const entry = buildEntry(extra);
    if (!createdAt) createdAt = entry.createdAt;
    cachedEntry = entry;
    return BiteBookStorage.saveEntry(entry);
  }

  function escapeHtmlLocal(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderPhotos() {
    photoGrid.querySelectorAll('.photo-tile').forEach((el) => el.remove());
    photos.forEach((photo, index) => {
      const tile = document.createElement('div');
      tile.className = 'photo-tile';
      tile.innerHTML = `
        <img src="${photo.url || photo.dataUrl}" alt="">
        <button type="button" class="photo-tile-remove" data-index="${index}" aria-label="Remove this photo">✕</button>
      `;
      photoGrid.insertBefore(tile, photoAddTile);
    });
    photoGrid.querySelectorAll('.photo-tile-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        photos.splice(Number(btn.dataset.index), 1);
        renderPhotos();
        await saveNow();
      });
    });
    photoAddTile.style.display = photos.length >= MAX_PHOTOS ? 'none' : 'flex';
  }

  photoAddTile.addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', async () => {
    const files = Array.from(photoInput.files || []);
    photoInput.value = '';
    if (files.length === 0) return;

    photoStatus.textContent = '';
    photoStatus.classList.remove('error');

    for (const file of files) {
      if (photos.length >= MAX_PHOTOS) {
        photoStatus.textContent = `You've reached the ${MAX_PHOTOS}-photo limit for this entry.`;
        photoStatus.classList.add('error');
        break;
      }
      // Some browsers report an empty MIME type for formats like HEIC/HEIF
      // (common for iPhone photos) — fall back to the file extension rather
      // than silently skipping the file when file.type comes back blank.
      const looksLikeImage = file.type
        ? file.type.startsWith('image/')
        : /\.(heic|heif|jpe?g|png|gif|webp|bmp|tiff?)$/i.test(file.name);
      if (!looksLikeImage) continue;

      if (isHeicFile(file)) {
        photoStatus.textContent = 'Converting HEIC photo...';
        photoStatus.classList.remove('error');
      }

      try {
        const decodable = await normalizeToDecodableImage(file);
        const compressed = await compressImageFile(decodable, { maxBytes: MAX_PHOTO_BYTES });
        const previous = photos.slice();
        photos.push(compressed);
        const ok = await saveNow();
        if (ok) {
          flashAutosaveBadge(autosaveHint, true);
          renderPhotos();
          photoStatus.textContent = '';
          photoStatus.classList.remove('error');
        } else {
          photos = previous;
          photoStatus.textContent = "⚠️ That didn't upload — check your connection and try again.";
          photoStatus.classList.add('error');
          break;
        }
      } catch (e) {
        console.error('Photo upload failed:', e);
        photoStatus.textContent = `⚠️ Couldn't process that photo: ${e && e.message ? e.message : 'unknown error'}. Try another photo, or check the browser console for detail.`;
        photoStatus.classList.add('error');
      }
    }
  });

  function renderVideos() {
    videoList.innerHTML = '';
    videos.forEach((video, index) => {
      const row = document.createElement('div');
      row.className = 'video-row';
      const icon = video.kind === 'file' ? '🎬' : linkPlatformLabel(video.url).split(' ')[0];
      const name = video.kind === 'file' ? video.name : video.url;
      row.innerHTML = `
        <div class="video-row-icon">${icon}</div>
        <span class="video-row-name">${escapeHtmlLocal(name)}</span>
        <button type="button" class="video-row-remove" data-index="${index}" aria-label="Remove this video">✕</button>
      `;
      videoList.appendChild(row);
    });
    videoList.querySelectorAll('.video-row-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        videos.splice(Number(btn.dataset.index), 1);
        renderVideos();
        await saveNow();
      });
    });
    const atMax = videos.length >= MAX_VIDEOS;
    videoUploadBtn.disabled = atMax;
    videoLinkAddBtn.disabled = atMax;
  }

  videoUploadBtn.addEventListener('click', () => videoInput.click());

  videoInput.addEventListener('change', () => {
    const file = videoInput.files && videoInput.files[0];
    videoInput.value = '';
    if (!file) return;

    videoStatus.textContent = '';
    videoStatus.classList.remove('error');

    if (videos.length >= MAX_VIDEOS) {
      videoStatus.textContent = `You've reached the ${MAX_VIDEOS}-video limit for this entry.`;
      videoStatus.classList.add('error');
      return;
    }
    if (file.size > MAX_VIDEO_FILE_BYTES) {
      videoStatus.textContent = '⚠️ That clip is a bit too big (max 3MB) — try a shorter one, or paste a link instead.';
      videoStatus.classList.add('error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const previous = videos.slice();
      videos.push({ kind: 'file', name: file.name, type: file.type, size: file.size, dataUrl: reader.result });
      const ok = await saveNow();
      if (ok) {
        flashAutosaveBadge(autosaveHint, true);
        renderVideos();
      } else {
        videos = previous;
        videoStatus.textContent = "⚠️ That didn't upload — try a link instead.";
        videoStatus.classList.add('error');
      }
    };
    reader.onerror = () => {
      videoStatus.textContent = '⚠️ Something went wrong reading that clip — mind trying again?';
      videoStatus.classList.add('error');
    };
    reader.readAsDataURL(file);
  });

  async function addVideoLink() {
    let url = videoLinkInput.value.trim();
    if (!url) return;
    if (videos.length >= MAX_VIDEOS) {
      videoStatus.textContent = `You've reached the ${MAX_VIDEOS}-video limit for this entry.`;
      videoStatus.classList.add('error');
      return;
    }
    const safe = normalizeLinkInput(url);
    if (!safe) {
      videoStatus.textContent = "⚠️ That doesn't look like a valid link — try pasting the full web address.";
      videoStatus.classList.add('error');
      return;
    }
    videos.push({ kind: 'link', url: safe });
    videoLinkInput.value = '';
    videoStatus.textContent = '';
    videoStatus.classList.remove('error');
    renderVideos();
    const ok = await saveNow();
    flashAutosaveBadge(autosaveHint, ok);
  }

  videoLinkAddBtn.addEventListener('click', () => addVideoLink());
  videoLinkInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addVideoLink();
    }
  });

  async function restoreFromStorage() {
    const existing = await BiteBookStorage.getEntry(entryId);
    if (existing) {
      cachedEntry = existing;
      createdAt = existing.createdAt;
      photos = existing.photos || [];
      videos = existing.videos || [];
    }
    renderPhotos();
    renderVideos();
  }

  function resolveEntryId() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
      window.location.href = 'entry.html';
      return null;
    }
    return id;
  }

  entryId = resolveEntryId();
  if (entryId) {
    backBtn.href = `entry-loved.html?id=${encodeURIComponent(entryId)}`;
    await restoreFromStorage();
  }

  continueBtn.addEventListener('click', async () => {
    await saveNow({ status: 'complete' });
    savedToast.classList.add('visible');
    continueBtn.disabled = true;
    setTimeout(() => {
      window.location.href = 'entries.html';
    }, 700);
  });
});
