document.addEventListener('bitebook:ready', () => {
  const textInput = document.getElementById('ingredients-text');
  const linkInput = document.getElementById('ingredients-link');
  const linkBadge = document.getElementById('link-platform-badge');
  const fileUploadBtn = document.getElementById('file-upload-btn');
  const fileInput = document.getElementById('file-input');
  const filePreview = document.getElementById('file-preview');
  const filePreviewThumb = document.getElementById('file-preview-thumb');
  const filePreviewIcon = document.getElementById('file-preview-icon');
  const filePreviewName = document.getElementById('file-preview-name');
  const fileRemoveBtn = document.getElementById('file-remove-btn');
  const uploadStatus = document.getElementById('upload-status');
  const backBtn = document.getElementById('back-btn');
  const continueBtn = document.getElementById('continue-btn');
  const savedToast = document.getElementById('saved-toast');
  const autosaveHint = document.getElementById('autosave-hint');

  const MAX_FILE_BYTES = 1.5 * 1024 * 1024;

  let entryId = null;
  let createdAt = null;
  let currentFile = null;

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function buildEntry() {
    const existing = BiteBookStorage.getEntry(entryId) || {};
    const now = new Date().toISOString();
    return {
      ...existing,
      id: entryId,
      ingredientsText: textInput.value.trim() || null,
      ingredientsLink: normalizeLinkInput(linkInput.value),
      ingredientsFile: currentFile,
      createdAt: createdAt || existing.createdAt || now,
      updatedAt: now,
    };
  }

  function saveNow() {
    const entry = buildEntry();
    if (!createdAt) createdAt = entry.createdAt;
    const ok = BiteBookStorage.saveEntry(entry);
    flashAutosaveBadge(autosaveHint, ok);
    return ok;
  }

  const scheduleSave = debounce(saveNow, 500);

  function showUploadStatus(message, isError) {
    uploadStatus.textContent = message;
    uploadStatus.classList.toggle('error', !!isError);
  }

  function renderFilePreview() {
    if (!currentFile) {
      filePreview.classList.remove('visible');
      return;
    }
    filePreview.classList.add('visible');
    filePreviewName.textContent = currentFile.name;
    if (currentFile.type && currentFile.type.startsWith('image/')) {
      filePreviewThumb.src = currentFile.dataUrl;
      filePreviewThumb.style.display = 'block';
      filePreviewIcon.style.display = 'none';
    } else {
      filePreviewThumb.style.display = 'none';
      filePreviewIcon.style.display = 'flex';
      filePreviewIcon.textContent = fileKindIcon(currentFile.type);
    }
  }

  textInput.addEventListener('input', () => scheduleSave());

  linkInput.addEventListener('input', () => {
    linkBadge.textContent = linkInput.value.trim() ? linkPlatformLabel(linkInput.value.trim()) : '';
    linkBadge.classList.toggle('visible', !!linkInput.value.trim());
    scheduleSave();
  });

  linkInput.addEventListener('blur', () => {
    const value = linkInput.value.trim();
    if (value && !/^https?:\/\//i.test(value)) {
      linkInput.value = `https://${value}`;
      scheduleSave();
    }
  });

  fileUploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      showUploadStatus('⚠️ That file is a bit too big (max 1.5MB) — try a smaller one, or use a link instead.', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const previousFile = currentFile;
      currentFile = { name: file.name, type: file.type, size: file.size, dataUrl: reader.result };
      const ok = saveNow();
      if (ok) {
        renderFilePreview();
        showUploadStatus(`✅ "${file.name}" attached.`, false);
      } else {
        currentFile = previousFile;
        showUploadStatus("⚠️ That didn't fit in your browser's storage — try a smaller file, or use a link instead.", true);
      }
    };
    reader.onerror = () => {
      showUploadStatus('⚠️ Something went wrong reading that file — mind trying again?', true);
    };
    reader.readAsDataURL(file);
  });

  fileRemoveBtn.addEventListener('click', () => {
    currentFile = null;
    renderFilePreview();
    showUploadStatus('', false);
    scheduleSave();
  });

  function restoreFromStorage() {
    const existing = BiteBookStorage.getEntry(entryId);
    if (!existing) return;
    createdAt = existing.createdAt;

    if (existing.ingredientsText) textInput.value = existing.ingredientsText;
    if (existing.ingredientsLink) {
      linkInput.value = existing.ingredientsLink;
      linkBadge.textContent = linkPlatformLabel(existing.ingredientsLink);
      linkBadge.classList.add('visible');
    }
    if (existing.ingredientsFile) {
      currentFile = existing.ingredientsFile;
      renderFilePreview();
    }
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
    backBtn.href = `entry-why.html?id=${encodeURIComponent(entryId)}`;
    restoreFromStorage();
  }

  continueBtn.addEventListener('click', () => {
    saveNow();
    savedToast.classList.add('visible');
    continueBtn.disabled = true;
    setTimeout(() => {
      window.location.href = `entry-loved.html?id=${encodeURIComponent(entryId)}`;
    }, 500);
  });

  document.getElementById('finish-later-btn').addEventListener('click', () => {
    saveNow();
    window.location.href = 'entries.html';
  });

});
