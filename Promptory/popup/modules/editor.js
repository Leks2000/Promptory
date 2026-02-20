// Promptory Popup - Editor Module
// Prompt editor modal, image handling, save logic

window.Promptory = window.Promptory || {};

(function(P) {
'use strict';

const state = P.state;
const t = P.t.bind(P);
const escapeHtml = P.escapeHtml;
const showToast = P.showToast;
const saveData = P.saveData;
const debounce = P.debounce;
const closeModal = P.closeModal;
const supabaseMsg = P.supabaseMsg;

let pendingImageFile = null;

const DRAFT_KEY = 'editorDraft';
const FOLDER_DRAFT_KEY = 'folderEditorDraft';

// Save prompt editor draft to chrome.storage.local
function _saveDraft(editingId) {
  try {
    const title = document.getElementById('pe-title')?.value || '';
    const text = document.getElementById('pe-text')?.value || '';
    const desc = document.getElementById('pe-desc')?.value || '';
    const folderId = document.getElementById('pe-folder')?.value || '';
    const platform = document.getElementById('pe-platform')?.value || 'universal';
    const tags = Array.from(document.querySelectorAll('#pe-tags-list [data-tag]')).map(el => el.dataset.tag);
    const imageUrl = document.getElementById('pe-image-url')?.value || '';
    // Only save if there's meaningful content
    if (title || text) {
      chrome.storage.local.set({ [DRAFT_KEY]: { editingId: editingId || null, title, text, desc, folderId, platform, tags, imageUrl, savedAt: Date.now() } });
    }
  } catch (e) { /* silent */ }
}

function _clearDraft() {
  try { chrome.storage.local.remove(DRAFT_KEY); } catch (e) { /* silent */ }
}

function _hasDraftChanges(editingId, prompt) {
  const title = document.getElementById('pe-title')?.value?.trim() || '';
  const text = document.getElementById('pe-text')?.value?.trim() || '';
  if (editingId && prompt) {
    // Editing: check if anything changed from original
    return title !== (prompt.title || '') || text !== (prompt.text || '');
  }
  // New prompt: check if user typed anything
  return title.length > 0 || text.length > 0;
}

// Restore draft into editor fields
function _restoreDraft(draft) {
  if (!draft) return;
  const titleEl = document.getElementById('pe-title');
  const textEl = document.getElementById('pe-text');
  const descEl = document.getElementById('pe-desc');
  const folderEl = document.getElementById('pe-folder');
  const platformEl = document.getElementById('pe-platform');
  const imageUrlEl = document.getElementById('pe-image-url');
  if (titleEl && draft.title) titleEl.value = draft.title;
  if (textEl && draft.text) textEl.value = draft.text;
  if (descEl && draft.desc) descEl.value = draft.desc;
  if (folderEl && draft.folderId) folderEl.value = draft.folderId;
  if (platformEl && draft.platform) platformEl.value = draft.platform;
  if (imageUrlEl && draft.imageUrl) imageUrlEl.value = draft.imageUrl;
  // Restore tags
  if (draft.tags && draft.tags.length > 0) {
    const tagsList = document.getElementById('pe-tags-list');
    if (tagsList) {
      tagsList.innerHTML = '';
      draft.tags.forEach(tag => {
        const el = document.createElement('span');
        el.className = 'tag tag-removable';
        el.dataset.tag = tag;
        el.innerHTML = `#${escapeHtml(tag)} <span class="tag-remove" data-remove-tag="${escapeHtml(tag)}">&times;</span>`;
        tagsList.appendChild(el);
      });
    }
  }
}

// Check for saved draft and offer to restore
P.checkAndRestoreDraft = async function(opts) {
  return new Promise(resolve => {
    chrome.storage.local.get([DRAFT_KEY], (result) => {
      const draft = result[DRAFT_KEY];
      if (!draft || !draft.savedAt) { resolve(false); return; }
      // Drafts older than 1 hour are discarded
      if (Date.now() - draft.savedAt > 3600000) { _clearDraft(); resolve(false); return; }
      if (draft.title || draft.text) {
        // Ask user if they want to restore
        const msg = P.getLang() === 'ru'
          ? 'У вас есть несохранённый черновик. Восстановить?'
          : 'You have an unsaved draft. Restore it?';
        if (confirm(msg)) {
          P.analyticsTrackDraftRestored('prompt');
          P.openPromptEditor(draft.editingId, opts);
          // Restore draft values after modal opens
          setTimeout(() => _restoreDraft(draft), 100);
          resolve(true);
        } else {
          _clearDraft();
          resolve(false);
        }
      } else {
        _clearDraft();
        resolve(false);
      }
    });
  });
};

// ==================== OPEN PROMPT EDITOR ====================
P.openPromptEditor = function(promptId = null, opts = {}) {
  const {
    canCreatePrompt,
    getEffectiveLimit,
    resolveImageUrl,
    isSupabaseStorageUrl,
    syncPromptToSupabase,
    getSuppressRender,
    setSuppressRender,
    afterSave
  } = opts;

  if (!promptId && canCreatePrompt && !canCreatePrompt()) {
    showToast(t('freeLimitReached', getEffectiveLimit()), 'error');
    return;
  }

  // Analytics: track editor open
  P.analyticsTrackPromptEditorOpen(!!promptId, promptId);
  pendingImageFile = null;
  const prompt = promptId ? state.prompts.find(p => p.id === promptId) : null;
  const isEdit = !!prompt;
  const hasImage = prompt?.imageUrl;
  const imageUrlValid = hasImage && (prompt.imageUrl.startsWith('http') || prompt.imageUrl.startsWith('data:') || prompt.imageUrl.startsWith('supabase-storage://'));

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'prompt-editor-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width:600px;">
      <div class="modal-header"><h2 class="modal-title">${isEdit ? t('editPrompt') : t('newPrompt')}</h2><button class="btn btn-icon btn-ghost close-modal-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label required">${t('title')}</label><input type="text" id="pe-title" placeholder="${t('titlePlaceholder')}" value="${prompt ? escapeHtml(prompt.title) : ''}"><span class="form-error" id="pe-title-err" style="display:none;">${t('titleRequired')}</span></div>
        <div class="form-group"><label class="form-label required">${t('promptText')}</label><textarea id="pe-text" placeholder="${t('promptTextPlaceholder')}" rows="8">${prompt ? escapeHtml(prompt.text) : ''}</textarea><span class="form-error" id="pe-text-err" style="display:none;">${t('textRequired')}</span><span class="form-hint" id="pe-vars-hint" style="display:none;">${t('variables')}: <span id="pe-vars-list"></span></span></div>
        <div class="form-group"><label class="form-label">${t('description')}</label><textarea id="pe-desc" placeholder="${t('descriptionOptional')}" rows="2">${prompt ? escapeHtml(prompt.description || '') : ''}</textarea></div>
        <div class="form-group">
          <label class="form-label">${t('image') || 'Image'}</label>
          <div class="image-upload-container" id="pe-image-container">
            <div class="image-upload-preview" id="pe-image-preview" style="display:${imageUrlValid ? 'block' : 'none'};position:relative;">
              ${imageUrlValid ? `<img id="pe-image-el" alt="Preview" style="max-width:100%;max-height:150px;border-radius:var(--radius-md);object-fit:cover;display:block;" onerror="this.parentElement.style.display='none';document.getElementById('pe-image-zone').style.display='flex';">
              <div class="image-loading-indicator" id="pe-image-loading" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--text-tertiary);font-size:12px;">Loading...</div>` : ''}
              <button class="btn btn-sm btn-ghost image-remove-btn" id="pe-image-remove" style="position:absolute;top:4px;right:4px;background:var(--bg-primary);" title="${t('remove') || 'Remove'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
            </div>
            <div class="image-upload-zone" id="pe-image-zone" style="display:${imageUrlValid ? 'none' : 'flex'};align-items:center;justify-content:center;padding:20px;border:2px dashed var(--border);border-radius:var(--radius-md);cursor:pointer;transition:all 0.2s;">
              <div style="text-align:center;color:var(--text-tertiary);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin:0 auto 8px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <div style="font-size:var(--font-size-xs);">${t('clickToUpload') || 'Click to upload image'}</div>
                <div style="font-size:10px;margin-top:4px;">PNG, JPG (max 2MB)</div>
              </div>
            </div>
            <input type="file" id="pe-image-input" accept="image/png,image/jpeg,image/gif,image/webp" style="display:none;">
          </div>
          <input type="hidden" id="pe-image-url" value="${prompt?.imageUrl || ''}">
        </div>
        <div class="form-group"><label class="form-label">${t('folder')}</label><select id="pe-folder"><option value="">${t('uncategorized')}</option>${state.folders.map(f => `<option value="${f.id}" ${prompt?.folderId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">${t('tags')}</label><div id="pe-tags-container"><div class="tags" id="pe-tags-list">${(prompt?.tags || []).map(tg => `<span class="tag tag-removable" data-tag="${escapeHtml(tg)}">#${escapeHtml(tg)} <span class="tag-remove" data-remove-tag="${escapeHtml(tg)}">&times;</span></span>`).join('')}</div><input type="text" id="pe-tag-input" placeholder="${t('addTagPlaceholder')}" style="margin-top:8px;"></div></div>
        <div class="form-group"><label class="form-label">${t('platform')}</label><select id="pe-platform"><option value="universal" ${!prompt || prompt.platform === 'universal' ? 'selected' : ''}>${t('universal')}</option><option value="chatgpt" ${prompt?.platform === 'chatgpt' ? 'selected' : ''}>ChatGPT</option><option value="claude" ${prompt?.platform === 'claude' ? 'selected' : ''}>Claude</option><option value="gemini" ${prompt?.platform === 'gemini' ? 'selected' : ''}>Gemini</option><option value="perplexity" ${prompt?.platform === 'perplexity' ? 'selected' : ''}>Perplexity</option></select></div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        ${isEdit ? `<button class="btn btn-danger" id="pe-delete-btn">${t('delete')}</button>` : '<div></div>'}
        <div style="display:flex;gap:8px;"><button class="btn btn-ghost close-modal-btn">${t('cancel')}</button><button class="btn btn-primary ripple" id="pe-save-btn">${isEdit ? t('saveChanges') : t('createPrompt')}</button></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);
  document.getElementById('pe-title').focus();

  // Async: resolve and load image from Supabase Storage
  if (imageUrlValid && prompt?.imageUrl && resolveImageUrl) {
    const imgEl = document.getElementById('pe-image-el');
    const loadingIndicator = document.getElementById('pe-image-loading');
    if (imgEl) {
      resolveImageUrl(prompt.imageUrl).then(resolvedUrl => {
        if (resolvedUrl && imgEl) {
          imgEl.src = resolvedUrl;
          imgEl.onload = () => { if (loadingIndicator) loadingIndicator.style.display = 'none'; };
          imgEl.onerror = () => {
            const preview = document.getElementById('pe-image-preview');
            const zone = document.getElementById('pe-image-zone');
            if (preview) preview.style.display = 'none';
            if (zone) zone.style.display = 'flex';
          };
        }
      }).catch(() => {
        const preview = document.getElementById('pe-image-preview');
        const zone = document.getElementById('pe-image-zone');
        if (preview) preview.style.display = 'none';
        if (zone) zone.style.display = 'flex';
      });
    }
  }

  const textArea = document.getElementById('pe-text');
  textArea.addEventListener('input', debounce(_updateVarsDisplay, 300));
  _updateVarsDisplay();

  // Image upload handling
  const imageZone = document.getElementById('pe-image-zone');
  const imageInput = document.getElementById('pe-image-input');
  const imagePreview = document.getElementById('pe-image-preview');
  const imageRemove = document.getElementById('pe-image-remove');

  imageZone?.addEventListener('click', () => imageInput.click());
  imageZone?.addEventListener('dragover', (e) => { e.preventDefault(); imageZone.style.borderColor = 'var(--accent)'; });
  imageZone?.addEventListener('dragleave', () => { imageZone.style.borderColor = 'var(--border)'; });
  imageZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    imageZone.style.borderColor = 'var(--border)';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) _handleImageSelect(file);
  });

  imageInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) _handleImageSelect(file);
  });

  imageRemove?.addEventListener('click', (e) => {
    e.stopPropagation();
    pendingImageFile = null;
    document.getElementById('pe-image-url').value = '';
    imagePreview.style.display = 'none';
    imagePreview.innerHTML = `<button class="btn btn-sm btn-ghost image-remove-btn" id="pe-image-remove" style="position:absolute;top:4px;right:4px;background:var(--bg-primary);" title="${t('remove') || 'Remove'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
    imageZone.style.display = 'flex';
  });

  document.getElementById('pe-tag-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); _addTag(e.target.value.trim()); e.target.value = ''; P.analyticsTrackPromptFieldEdit('tags', !!promptId, promptId); }
  });
  document.getElementById('pe-tags-list').addEventListener('click', (e) => {
    const removeTag = e.target.dataset.removeTag || e.target.closest('[data-remove-tag]')?.dataset.removeTag;
    if (removeTag) document.querySelector(`#pe-tags-list [data-tag="${removeTag}"]`)?.remove();
  });
  // Auto-save draft periodically and on input
  const draftSave = debounce(() => {
    _saveDraft(promptId);
    // Analytics: track draft save during editing
    P.analyticsTrackPromptDraftSave(!!promptId, promptId);
  }, 1000);
  // Field-level analytics tracking + draft save
  document.getElementById('pe-title')?.addEventListener('input', () => { draftSave(); P.analyticsTrackPromptFieldEdit('title', !!promptId, promptId); });
  document.getElementById('pe-text')?.addEventListener('input', () => { draftSave(); P.analyticsTrackPromptFieldEdit('text', !!promptId, promptId); });
  document.getElementById('pe-desc')?.addEventListener('input', () => { draftSave(); P.analyticsTrackPromptFieldEdit('description', !!promptId, promptId); });
  document.getElementById('pe-folder')?.addEventListener('change', () => { draftSave(); P.analyticsTrackPromptFieldEdit('folder', !!promptId, promptId); });
  document.getElementById('pe-platform')?.addEventListener('change', () => { draftSave(); P.analyticsTrackPromptFieldEdit('platform', !!promptId, promptId); });

  // Close with confirmation if there are unsaved changes
  const confirmAndClose = () => {
    const hadChanges = _hasDraftChanges(promptId, prompt);
    if (hadChanges) {
      const msg = P.getLang() === 'ru'
        ? 'У вас есть несохранённые изменения. Закрыть без сохранения? (черновик будет сохранён)'
        : 'You have unsaved changes. Close without saving? (draft will be saved)';
      if (!confirm(msg)) return;
      _saveDraft(promptId); // Save draft before closing
    } else {
      _clearDraft(); // No changes, clear any old draft
    }
    // Analytics: track editor close without saving
    P.analyticsTrackPromptEditorClose(!!promptId, promptId, hadChanges);
    closeModal('prompt-editor-modal');
  };

  document.getElementById('pe-save-btn').addEventListener('click', () => {
    _clearDraft(); // Clear draft on successful save
    _savePrompt(promptId, opts);
  });
  document.getElementById('pe-delete-btn')?.addEventListener('click', async () => {
    if (opts.deletePrompt) await opts.deletePrompt(promptId);
    _clearDraft();
    closeModal('prompt-editor-modal');
  });
  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', confirmAndClose));
  modal.addEventListener('click', (e) => { if (e.target === modal) confirmAndClose(); });
  const escHandler = (e) => { if (e.key === 'Escape') { confirmAndClose(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
};

// ==================== IMAGE HANDLING ====================
function _handleImageSelect(file) {
  if (file.size > 2 * 1024 * 1024) {
    showToast(t('imageTooLarge') || 'Image too large (max 2MB)', 'error');
    return;
  }
  const needsCompression = file.size > 500 * 1024;

  const processImage = (dataUrl) => {
    const preview = document.getElementById('pe-image-preview');
    const zone = document.getElementById('pe-image-zone');
    preview.innerHTML = `
      <img src="${dataUrl}" alt="Preview" style="max-width:100%;max-height:150px;border-radius:var(--radius-md);object-fit:cover;display:block;" onerror="this.style.display='none';">
      <button class="btn btn-sm btn-ghost image-remove-btn" id="pe-image-remove" style="position:absolute;top:4px;right:4px;background:var(--bg-primary);" title="${t('remove') || 'Remove'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
    preview.style.display = 'block';
    preview.style.position = 'relative';
    zone.style.display = 'none';
    document.getElementById('pe-image-remove')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      pendingImageFile = null;
      document.getElementById('pe-image-url').value = '';
      preview.style.display = 'none';
      zone.style.display = 'flex';
    });
  };

  if (needsCompression) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        const maxDim = 1200;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        let quality = 0.8;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 500 * 1024 * 1.37 && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        canvas.toBlob((blob) => {
          if (blob) {
            pendingImageFile = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
          } else {
            pendingImageFile = file;
          }
          processImage(dataUrl);
        }, 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    pendingImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => processImage(e.target.result);
    reader.readAsDataURL(file);
  }
}

// ==================== VARIABLES DISPLAY ====================
function _updateVarsDisplay() {
  const text = document.getElementById('pe-text')?.value || '';
  const vars = [...new Set((text.match(/\{([^}]+)\}/g) || []).map(m => m.slice(1, -1)))];
  const hint = document.getElementById('pe-vars-hint');
  const list = document.getElementById('pe-vars-list');
  if (hint && list) {
    if (vars.length > 0) { list.innerHTML = vars.map(v => `<span class="tag">{${escapeHtml(v)}}</span>`).join(' '); hint.style.display = 'block'; }
    else { hint.style.display = 'none'; }
  }
}

// ==================== ADD TAG ====================
function _addTag(tag) {
  if (!tag) return;
  tag = tag.replace(/^#/, '');
  const existing = Array.from(document.querySelectorAll('#pe-tags-list [data-tag]')).map(el => el.dataset.tag);
  if (existing.includes(tag)) return;
  const el = document.createElement('span');
  el.className = 'tag tag-removable';
  el.dataset.tag = tag;
  el.innerHTML = `#${escapeHtml(tag)} <span class="tag-remove" data-remove-tag="${escapeHtml(tag)}">&times;</span>`;
  document.getElementById('pe-tags-list').appendChild(el);
}

// ==================== SAVE PROMPT ====================
async function _savePrompt(editingId, opts) {
  const {
    canCreatePrompt,
    getEffectiveLimit,
    syncPromptToSupabase,
    uploadImageToStorage,
    setSuppressRender,
    afterSave
  } = opts;

  const title = document.getElementById('pe-title')?.value.trim();
  const text = document.getElementById('pe-text')?.value.trim();
  const desc = document.getElementById('pe-desc')?.value.trim();
  const folderId = document.getElementById('pe-folder')?.value || null;
  const platform = document.getElementById('pe-platform')?.value || 'universal';
  const tags = Array.from(document.querySelectorAll('#pe-tags-list [data-tag]')).map(el => el.dataset.tag);
  let imageUrl = document.getElementById('pe-image-url')?.value || null;

  let hasError = false;
  if (!title) { document.getElementById('pe-title-err').style.display = 'block'; hasError = true; } else { document.getElementById('pe-title-err').style.display = 'none'; }
  if (!text) { document.getElementById('pe-text-err').style.display = 'block'; hasError = true; } else { document.getElementById('pe-text-err').style.display = 'none'; }
  if (hasError) return;

  const saveBtn = document.getElementById('pe-save-btn');
  saveBtn.classList.add('loading');

  // Upload image if there's a pending file
  if (pendingImageFile && state.session && state.user && uploadImageToStorage) {
    try {
      const uploadedUrl = await uploadImageToStorage(pendingImageFile, editingId || crypto.randomUUID());
      if (uploadedUrl) imageUrl = uploadedUrl;
    } catch (e) {
      console.error('Image upload failed:', e);
      showToast(t('imageUploadFailed') || 'Image upload failed', 'error');
    }
  }

  const variables = [...new Set((text.match(/\{([^}]+)\}/g) || []).map(m => m.slice(1, -1)))];
  let previousFolderId = null;
  if (editingId) {
    const p = state.prompts.find(x => x.id === editingId);
    if (p) {
      previousFolderId = p.folderId || null;
      Object.assign(p, { title, text, description: desc, folderId, platform, tags, variables, imageUrl, updatedAt: Date.now() });
      if (syncPromptToSupabase) syncPromptToSupabase(p);
      // Analytics: track prompt updated (only fires on successful save)
      P.analyticsTrackPromptUpdated(p);
    }
  } else {
    if (canCreatePrompt && !canCreatePrompt()) { showToast(t('freeLimitReached', getEffectiveLimit()), 'error'); saveBtn.classList.remove('loading'); return; }
    const newP = { id: crypto.randomUUID(), title, text, description: desc, folderId, platform, tags, variables, imageUrl, isFavorite: false, useCount: 0, createdAt: Date.now(), updatedAt: Date.now() };
    state.prompts.unshift(newP);
    if (syncPromptToSupabase) syncPromptToSupabase(newP);
    // Analytics: track prompt created (only fires on successful save)
    P.analyticsTrackPromptCreated(newP);
  }

  if (setSuppressRender) setSuppressRender(true);
  await saveData('prompts', state.prompts);
  if (setSuppressRender) setSuppressRender(false);

  saveBtn.classList.remove('loading');
  pendingImageFile = null;
  showToast(editingId ? t('promptUpdated') : t('promptCreated'), 'success');
  closeModal('prompt-editor-modal');

  if (afterSave) afterSave(editingId, previousFolderId, folderId);
}

// ==================== IMAGE UPLOAD TO STORAGE ====================
P.uploadImageToStorage = async function(file, promptId) {
  if (!state.session || !state.user) return null;
  const fileExt = file.name.split('.').pop().toLowerCase();
  const fileName = `${state.user.id}/${promptId}.${fileExt}`;

  const base64 = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  });

  try {
    const res = await supabaseMsg({
      action: 'uploadToStorage',
      bucket: 'Lib_img',
      path: fileName,
      file: base64,
      contentType: file.type
    });
    if (res?.error) { console.error('Storage upload error:', res.error); return null; }
    return res?.data?.publicUrl || null;
  } catch (e) {
    console.error('Storage upload exception:', e);
    return null;
  }
};

})(window.Promptory);
