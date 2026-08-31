document.addEventListener('DOMContentLoaded', () => {
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
  let photos = [];
  let videos = [];

  function buildEntry(extra) {
    const existing = BiteBookStorage.getEntry(entryId) || {};
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

  function saveNow(extra) {
    const entry = buildEntry(extra);
    if (!createdAt) createdAt = entry.createdAt;
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
        <img src="${photo.dataUrl}" alt="">
        <button type="button" class="photo-tile-remove" data-index="${index}" aria-label="Remove this photo">✕</button>
      `;
      photoGrid.insertBefore(tile, photoAddTile);
    });
    photoGrid.querySelectorAll('.photo-tile-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        photos.splice(Number(btn.dataset.index), 1);
        renderPhotos();
        saveNow();
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
      if (!file.type.startsWith('image/')) continue;

      try {
        const compressed = await compressImageFile(file, { maxBytes: MAX_PHOTO_BYTES });
        const previous = photos.slice();
        photos.push(compressed);
        const ok = saveNow();
        if (ok) {
          flashAutosaveBadge(autosaveHint, true);
          renderPhotos();
        } else {
          photos = previous;
          photoStatus.textContent = "⚠️ That didn't fit in your browser's storage — try removing another photo first.";
          photoStatus.classList.add('error');
          break;
        }
      } catch (e) {
        photoStatus.textContent = '⚠️ Something went wrong with that photo — mind trying another?';
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
      btn.addEventListener('click', () => {
        videos.splice(Number(btn.dataset.index), 1);
        renderVideos();
        saveNow();
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
    reader.onload = () => {
      const previous = videos.slice();
      videos.push({ kind: 'file', name: file.name, type: file.type, size: file.size, dataUrl: reader.result });
      const ok = saveNow();
      if (ok) {
        flashAutosaveBadge(autosaveHint, true);
        renderVideos();
      } else {
        videos = previous;
        videoStatus.textContent = "⚠️ That didn't fit in your browser's storage — try a link instead.";
        videoStatus.classList.add('error');
      }
    };
    reader.onerror = () => {
      videoStatus.textContent = '⚠️ Something went wrong reading that clip — mind trying again?';
      videoStatus.classList.add('error');
    };
    reader.readAsDataURL(file);
  });

  function addVideoLink() {
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
    saveNow();
    flashAutosaveBadge(autosaveHint, true);
  }

  videoLinkAddBtn.addEventListener('click', () => addVideoLink());
  videoLinkInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addVideoLink();
    }
  });

  function restoreFromStorage() {
    const existing = BiteBookStorage.getEntry(entryId);
    if (existing) {
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
    restoreFromStorage();
  }

  continueBtn.addEventListener('click', () => {
    saveNow({ status: 'complete' });
    savedToast.classList.add('visible');
    continueBtn.disabled = true;
    setTimeout(() => {
      window.location.href = 'entries.html';
    }, 900);
  });
});
