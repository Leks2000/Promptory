// Promptory Popup - Main Controller
// Performance-optimized, i18n-enabled, 3 hotkey slots
// Uses Promptory.* modules (utils.js, state.js, offline.js) as single source of truth

(function() {
'use strict';

// ==================== STYLED CONFIRM MODAL ====================
// Replaces native confirm() with a beautiful styled modal
function showStyledConfirm(title, message, confirmText, cancelText) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    overlay.innerHTML = `
      <div class="confirm-modal">
        <div class="confirm-modal-title">${title}</div>
        <div class="confirm-modal-text">${message}</div>
        <div class="confirm-modal-actions">
          <button class="btn btn-primary ripple" id="styled-confirm-ok">${confirmText || 'OK'}</button>
          <button class="btn btn-ghost" id="styled-confirm-cancel">${cancelText || (P?.getLang?.() === 'ru' ? '\u041e\u0442\u043c\u0435\u043d\u0430' : 'Cancel')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    
    const cleanup = (result) => {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };
    
    overlay.querySelector('#styled-confirm-ok').addEventListener('click', () => cleanup(true));
    overlay.querySelector('#styled-confirm-cancel').addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
  });
}

// ==================== MODULE ALIASES (single source of truth: popup/modules/*) ====================
const P = window.Promptory;
const state = P.state; // Shared state object — modules and popup.js reference the SAME object

// Expose showStyledConfirm on P so modules can use it
P.showStyledConfirm = showStyledConfirm;

// Config constants
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
const FREE_PROMPT_LIMIT = CONFIG.FREE_PROMPT_LIMIT;
const MAX_ANIM_ITEMS = CONFIG.MAX_ANIM_ITEMS;
const SETTINGS_PROMPT_SELECT_LIMIT = CONFIG.SETTINGS_PROMPT_SELECT_LIMIT;
const LIBRARY_PAGE_SIZE = CONFIG.LIBRARY_PAGE_SIZE;

// Utility aliases — all defined once in modules/utils.js
const t = P.t.bind(P);
const loadLocale = P.loadLocale.bind(P);
const escapeHtml = P.escapeHtml;
const showToast = P.showToast;
const saveData = P.saveData;
const formatDate = P.formatDate;
const truncate = P.truncate;
const debounce = P.debounce;
const isRateLimited = P.isRateLimited;
const supabaseMsg = P.supabaseMsg;
const supabaseMsgWithRetry = P.supabaseMsgWithRetry;
const parseSupabaseError = P.parseSupabaseError;
const isAuthError = P.isAuthError;
const closeModal = P.closeModal;

// State aliases — all defined once in modules/state.js
const getSettingsPromptPool = P.getSettingsPromptPool.bind(P);
const getSettingsPromptOptions = P.getSettingsPromptOptions.bind(P);
const getEffectiveLimit = P.getEffectiveLimit.bind(P);
const canCreatePrompt = P.canCreatePrompt.bind(P);
const getPromptsRemaining = P.getPromptsRemaining.bind(P);
const applyTheme = P.applyTheme.bind(P);

// CSV line parser (from modules/prompts.js)
const parseCSVLine = P.parseCSVLine;

// ==================== IMAGE URL RESOLVER ====================
// Resolves Supabase Storage URLs to displayable URLs (handles private buckets)
// Uses LRU-limited cache from modules/explore.js (max 100 entries)
const imageCache = P.imageCache;

function isSupabaseStorageUrl(url) {
  if (!url) return false;
  return url.includes('supabase.co/storage/v1/') || url.startsWith('supabase-storage://');
}

function extractStoragePath(url) {
  if (!url) return null;
  // supabase-storage://Lib_img/user-id/file.jpg
  if (url.startsWith('supabase-storage://')) {
    return url.replace('supabase-storage://', '');
  }
  // https://xxx.supabase.co/storage/v1/object/public/Lib_img/...
  const publicMatch = url.match(/\/storage\/v1\/object\/(?:public|authenticated)\/(.+)$/);
  if (publicMatch) return publicMatch[1];
  // https://xxx.supabase.co/storage/v1/object/sign/Lib_img/...?token=...
  const signMatch = url.match(/\/storage\/v1\/object\/sign\/(.+?)\?/);
  if (signMatch) return signMatch[1];
  return null;
}

async function resolveImageUrl(url) {
  if (!url) return null;
  // Data URLs are already displayable
  if (url.startsWith('data:')) return url;
  // Non-Supabase URLs can be used directly
  if (!isSupabaseStorageUrl(url)) return url;
  
  // Check cache first
  if (imageCache.has(url)) {
    const cached = imageCache.get(url);
    // Signed URLs expire; check if still valid (1h buffer)
    if (cached.expires > Date.now()) return cached.url;
    imageCache.delete(url);
  }
  
  // Need to resolve through background script
  const storagePath = extractStoragePath(url);
  if (!storagePath) return url;
  
  const parts = storagePath.split('/');
  const bucket = parts[0];
  const path = parts.slice(1).join('/');
  
  try {
    // Get a signed URL from background (valid for 1 hour)
    const res = await supabaseMsg({ action: 'getSignedUrl', bucket, path, expiresIn: 3600 });
    if (res?.data?.signedUrl) {
      imageCache.set(url, { url: res.data.signedUrl, expires: Date.now() + 3500000 });
      return res.data.signedUrl;
    }
    // Fallback: get image as data URL
    const dataRes = await supabaseMsg({ action: 'getImageAsDataUrl', bucket, path });
    if (dataRes?.data?.dataUrl) {
      imageCache.set(url, { url: dataRes.data.dataUrl, expires: Date.now() + 3500000 });
      return dataRes.data.dataUrl;
    }
  } catch (e) {
    console.warn('Failed to resolve image URL:', e);
  }
  return url; // Return original as fallback
}

// Load image into an <img> element, resolving Supabase URLs
async function loadImageIntoElement(imgEl, url) {
  if (!url || !imgEl) return;
  const resolvedUrl = await resolveImageUrl(url);
  if (resolvedUrl && imgEl) {
    imgEl.src = resolvedUrl;
  }
}

function renderLimitBanner() {
  const existing = document.getElementById('limit-banner');
  if (existing) existing.remove();
  if (state.isPremium) return; // Pro users never see limit banner
  const effectiveLimit = getEffectiveLimit();
  if (effectiveLimit === Infinity) return;
  const remaining = Math.max(0, effectiveLimit - state.prompts.length);
  if (remaining > 5) return;
  const banner = document.createElement('div');
  banner.id = 'limit-banner';
  banner.className = 'limit-banner';
  const tierLabel = state.user ? 'Free' : 'Guest';
  const upgradeLabel = state.user ? (t('upgrade') || 'Upgrade') : (t('signInForMore') || 'Sign in for more');
  const upgradeBtn = `<button class="btn btn-sm btn-primary limit-upgrade-btn" id="limit-upgrade-btn">${upgradeLabel}</button>`;
  banner.innerHTML = remaining === 0
    ? `<div class="limit-banner-content"><span class="limit-banner-text">${t('freeLimitBanner')}</span></div><div class="limit-banner-actions"><span class="limit-banner-count">${state.prompts.length}/${effectiveLimit}</span>${upgradeBtn}</div>`
    : `<div class="limit-banner-content"><span class="limit-banner-text">${t('remainingOnFree', remaining)}</span></div><div class="limit-banner-actions"><span class="limit-banner-count">${state.prompts.length}/${effectiveLimit}</span>${upgradeBtn}</div>`;
  // Insert limit banner only in the Prompts tab
  const promptsTab = document.getElementById('prompts-tab');
  if (promptsTab) promptsTab.insertBefore(banner, promptsTab.firstChild);
  
  // Add click handler for upgrade button
  document.getElementById('limit-upgrade-btn')?.addEventListener('click', () => {
    if (state.user) {
      showUpgradeModal();
    } else {
      // Guest user: prompt to sign in
      P.openSettingsModal({
        renderExplore, renderPrompts, renderFolders, renderFavorites,
        renderLimitBanner, syncAllData, loadLibraryPrompts, checkPremiumStatus,
        showUpgradeModal, loadAdminDashboard, loadPendingReports, renderModerationPanel,
        parseCSVLine, setSuppressRender: (v) => { _suppressStorageRender = v; },
        updateStaticTexts, FREE_PROMPT_LIMIT, SETTINGS_PROMPT_SELECT_LIMIT
      });
    }
  });
}

// ==================== DATA LOADING ====================
// Data loading and migration are handled by P.loadData (modules/state.js)
// This is a local alias for convenience
const loadData = P.loadData.bind(P);

// ==================== TABS ====================
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const target = document.getElementById(`${btn.dataset.tab}-tab`);
      if (target) target.classList.add('active');
      if (btn.dataset.tab === 'stats') renderStats();
      
      // When switching to folders tab, re-render to sort by prompt count and hide empty
      if (btn.dataset.tab === 'folders') {
        renderFolders();
      }
      // When switching to prompts tab, re-render to sort folders and hide empty
      if (btn.dataset.tab === 'prompts') {
        renderPrompts();
      }
      
      // Analytics: track tab switch
      P.analyticsTrackTabSwitch(btn.dataset.tab);
      
      // Update search filters for current tab (if enabled)
      if (searchFilters) {
        searchFilters.setCurrentTab(btn.dataset.tab);
      }
    });
    // Keyboard: Arrow Left/Right to navigate between tabs
    btn.addEventListener('keydown', (e) => {
      const tabs = Array.from(document.querySelectorAll('.tab-btn'));
      const idx = tabs.indexOf(btn);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const nextIdx = e.key === 'ArrowRight' 
          ? (idx + 1) % tabs.length 
          : (idx - 1 + tabs.length) % tabs.length;
        tabs[nextIdx].focus();
        tabs[nextIdx].click();
      }
    });
  });
}

// ==================== USAGE TRACKING ====================
async function trackUsage(prompt, action = 'insert', platform = null) {
  if (!state.session || !state.user) return;
  try {
    await supabaseMsg({
      action: 'supabaseRequest', method: 'POST', path: 'rpc/record_usage',
      body: { p_prompt_id: prompt.id, p_prompt_title: prompt.title, p_platform: platform || 'unknown', p_action: action }
    });
  } catch (e) { /* silent */ }
}

// ==================== VIRTUAL SCROLLING (200+ prompts) ====================
// VirtualFolderRenderer is defined in modules/prompts.js
const VirtualFolderRenderer = P.VirtualFolderRenderer;

// Track active virtual renderers for cleanup
let _activeVirtualRenderers = [];

// ==================== PROMPTS (optimized with batched rendering) ====================
let _renderPromptsRAF = null;
function renderPrompts() {
  // Batch renders via requestAnimationFrame to avoid layout thrashing
  if (_renderPromptsRAF) cancelAnimationFrame(_renderPromptsRAF);
  _renderPromptsRAF = requestAnimationFrame(_renderPromptsImmediate);
}
function _renderPromptsImmediate() {
  _renderPromptsRAF = null;
  const list = document.getElementById('prompts-list');
  if (!list) return;
  
  // Cleanup previous virtual renderers
  _activeVirtualRenderers.forEach(vr => vr.destroy());
  _activeVirtualRenderers = [];
  
  const prompts = state.prompts;
  const folders = state.folders;

  if (prompts.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-title">${t('noPromptsTitle')}</div><div class="empty-state-text">${t('noPromptsText')}</div><button class="btn btn-primary ripple" id="empty-create-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>${t('createPrompt')}</button></div>`;
    document.getElementById('empty-create-btn')?.addEventListener('click', () => openPromptEditor());
    return;
  }

  const grouped = {};
  const uncategorized = [];
  prompts.forEach(p => {
    if (p.folderId) { (grouped[p.folderId] = grouped[p.folderId] || []).push(p); }
    else uncategorized.push(p);
  });

  // Sort folders: folders with prompts first (by count desc), empty folders at bottom
  const sortedFolders = [...folders].sort((a, b) => {
    const countA = (grouped[a.id] || []).length;
    const countB = (grouped[b.id] || []).length;
    return countB - countA;
  });

  // Build with DocumentFragment for performance
  const frag = document.createDocumentFragment();
  
  // Uncategorized (My prompts) always first if it has prompts
  if (uncategorized.length > 0) {
    frag.appendChild(buildFolderSection({ id: null, name: t('uncategorized') }, uncategorized));
  }
  
  sortedFolders.forEach(f => {
    const fp = grouped[f.id] || [];
    // Show ALL folders (including empty ones), collapsed by default
    frag.appendChild(buildFolderSection(f, fp));
  });

  list.innerHTML = '';
  list.appendChild(frag);
  attachPromptCardListeners();
  renderLimitBanner();
  
  // Load prompt card thumbnails if showPromptImages is enabled
  if (state.settings.showPromptImages) {
    _loadPromptCardThumbnails(list);
  }
}

function buildFolderSection(folder, prompts) {
  const fId = folder.id || 'uncategorized';
  const storedState = localStorage.getItem(`pv-folder-${fId}`);
  // All folders collapsed by default unless user explicitly expanded them
  const expanded = storedState === 'true';
  const section = document.createElement('div');
  section.className = `folder-section ${expanded ? 'expanded' : ''}`;
  section.dataset.folderId = fId;
  
  const headerHtml = `
    <div class="folder-header" data-toggle-folder="${fId}" role="button" tabindex="0" aria-expanded="${expanded}" aria-label="${escapeHtml(folder.name)} folder, ${prompts.length} prompts">
      <div class="folder-info">
        <span class="folder-arrow" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></span>
        <span class="folder-name">${escapeHtml(folder.name)}</span>
      </div>
      <span class="folder-count" aria-label="${prompts.length} prompts">${prompts.length}</span>
    </div>`;
  
  section.innerHTML = headerHtml + '<div class="folder-content"></div>';
  
  // Use virtual scrolling for large folders
  const contentEl = section.querySelector('.folder-content');
  if (expanded && prompts.length > 0) {
    const vr = new VirtualFolderRenderer(contentEl, prompts, renderPromptCard);
    vr.init();
    _activeVirtualRenderers.push(vr);
  } else if (prompts.length > 0) {
    contentEl.innerHTML = prompts.map((p, i) => renderPromptCard(p, i)).join('');
  } else if (expanded) {
    contentEl.innerHTML = `<div style="font-size:var(--font-size-xs);color:var(--text-tertiary);padding:var(--space-3) var(--space-2);text-align:center;">${t('noPromptsInFolder') || 'No prompts in this folder'}</div>`;
  }
  
  return section;
}

// Track which cards have already been rendered (to skip entrance animation on re-render)
const _renderedCardIds = new Set();
let _isFirstRender = true;

// Load mini thumbnails for prompt cards with images (async, non-blocking)
function _loadPromptCardThumbnails(container) {
  const thumbEls = container.querySelectorAll('.prompt-card-thumbnail[data-prompt-img]');
  thumbEls.forEach(el => {
    const imageUrl = el.dataset.promptImg;
    if (!imageUrl) return;
    
    if (imageUrl.startsWith('data:') || (!isSupabaseStorageUrl(imageUrl) && imageUrl.startsWith('http'))) {
      el.style.backgroundImage = `url('${imageUrl}')`;
    } else if (isSupabaseStorageUrl(imageUrl)) {
      resolveImageUrl(imageUrl).then(resolvedUrl => {
        if (resolvedUrl) {
          el.style.backgroundImage = `url('${resolvedUrl}')`;
        }
      }).catch(() => {});
    }
  });
}

function renderPromptCard(prompt, idx) {
  const isNew = _isFirstRender || !_renderedCardIds.has(prompt.id);
  const enterClass = isNew && idx < MAX_ANIM_ITEMS ? ' card-entering' : '';
  const delay = isNew && idx < MAX_ANIM_ITEMS ? `style="animation-delay:${idx * 35}ms"` : '';
  _renderedCardIds.add(prompt.id);
  const tagsHtml = prompt.tags?.length
    ? `<div class="tags">${prompt.tags.slice(0, 3).map(tg => `<span class="tag">#${escapeHtml(tg)}</span>`).join('')}${prompt.tags.length > 3 ? `<span class="tag">+${prompt.tags.length - 3}</span>` : ''}</div>`
    : '';
  // Show mini image thumbnail if setting is enabled and prompt has an image
  const showImages = state.settings.showPromptImages;
  const hasImage = showImages && prompt.imageUrl;
  const imageHtml = hasImage 
    ? `<div class="prompt-card-thumbnail" data-prompt-img="${escapeHtml(prompt.imageUrl)}"></div>`
    : '';
  // Card click = copy. Actions: fav, edit, insert, menu. Added glare-card for premium hover effect
  // Keyboard: tabindex + role for accessibility; draggable for drag-and-drop
  return `
    <div class="prompt-card glare-card${enterClass}" data-prompt-id="${prompt.id}" ${delay} title="${t('clickToCopy') || 'Click to copy'}" tabindex="0" role="button" aria-label="${escapeHtml(prompt.title)} - ${t('clickToCopy')}" draggable="true">
      <div class="prompt-card-header">
        ${imageHtml}
        <div class="prompt-title">${escapeHtml(truncate(prompt.title, 60))}</div>
        <div class="prompt-actions">
          <button class="prompt-action-btn ${prompt.isFavorite ? 'active' : ''}" data-action="toggle-fav" data-id="${prompt.id}" title="${prompt.isFavorite ? t('removeFromFavorites') : t('addToFavorites')}" aria-label="${prompt.isFavorite ? t('removeFromFavorites') : t('addToFavorites')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${prompt.isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </button>
          <button class="prompt-action-btn" data-action="edit" data-id="${prompt.id}" title="${t('edit')}" aria-label="${t('edit')} ${escapeHtml(prompt.title)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="prompt-action-btn" data-action="insert" data-id="${prompt.id}" title="${t('insertToPage')}" aria-label="${t('insertToPage')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          </button>
          <button class="prompt-action-btn" data-action="menu" data-id="${prompt.id}" title="${t('more')}" aria-label="${t('more')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
        </div>
      </div>
      ${tagsHtml}
      <div class="prompt-meta"><span class="prompt-stat">${t('usedTimes', prompt.useCount || 0)}</span></div>
    </div>`;
}

// Move a prompt card between folder sections in the DOM (no full re-render)
function _movePromptCardInDOM(promptId, targetSection, targetFolderId) {
  const card = document.querySelector(`.prompt-card[data-prompt-id="${promptId}"]`);
  if (!card) { renderPrompts(); return; }
  
  const sourceSectionEl = card.closest('.folder-section');
  const targetContent = targetSection.querySelector('.folder-content');
  if (!targetContent) { renderPrompts(); return; }
  
  // Animate card exit from old position
  card.classList.add('card-exiting');
  card.addEventListener('animationend', function onExit() {
    card.removeEventListener('animationend', onExit);
    card.classList.remove('card-exiting');
    
    // Clear empty-folder hint from target if it exists
    const emptyHint = targetContent.querySelector('div[style*="text-align:center"]');
    if (emptyHint && !emptyHint.classList.contains('prompt-card')) {
      emptyHint.remove();
    }
    
    // Move card to target folder content
    targetContent.appendChild(card);
    
    // Briefly animate entering
    card.classList.add('card-entering');
    card.style.animationDelay = '0ms';
    card.addEventListener('animationend', function onEnter() {
      card.removeEventListener('animationend', onEnter);
      card.classList.remove('card-entering');
      card.style.animationDelay = '';
    }, { once: true });
    
    // Update source folder section: update count, show empty hint if no prompts left
    if (sourceSectionEl) {
      const sourceContent = sourceSectionEl.querySelector('.folder-content');
      const sourceCount = sourceSectionEl.querySelector('.folder-count');
      const remaining = sourceContent ? sourceContent.querySelectorAll('.prompt-card').length : 0;
      if (sourceCount) sourceCount.textContent = remaining;
      // Show empty hint if folder has no more prompts (don't remove the folder!)
      if (remaining === 0 && sourceContent && sourceSectionEl.classList.contains('expanded')) {
        sourceContent.innerHTML = `<div style="font-size:var(--font-size-xs);color:var(--text-tertiary);padding:var(--space-3) var(--space-2);text-align:center;">${t('noPromptsInFolder') || 'No prompts in this folder'}</div>`;
      }
    }
    
    // Update target folder count
    const targetCount = targetSection.querySelector('.folder-count');
    if (targetCount) {
      const count = targetContent.querySelectorAll('.prompt-card').length;
      targetCount.textContent = count;
    }
    
    // Ensure target section is expanded
    targetSection.classList.add('expanded');
    localStorage.setItem(`pv-folder-${targetFolderId === 'uncategorized' ? 'uncategorized' : targetFolderId}`, 'true');
  }, { once: true });
}

// Update folder card counts on the Folders tab without re-rendering
function _updateFolderCounts() {
  const folderCards = document.querySelectorAll('#folders-list .folder-card[data-folder-id]');
  folderCards.forEach(card => {
    const folderId = card.dataset.folderId;
    const count = state.prompts.filter(p => p.folderId === folderId).length;
    const countEl = card.querySelector('.folder-card-count');
    if (countEl) {
      countEl.textContent = `${count} ${count !== 1 ? t('promptsWord') : t('promptWord')}`;
    }
  });
}

function attachPromptCardListeners() {
  // Use event delegation on the list instead of individual listeners
  const list = document.getElementById('prompts-list');
  
  // Keyboard: Enter to copy prompt
  list.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Folder header toggle via keyboard
      const folderHeader = e.target.closest('[data-toggle-folder]');
      if (folderHeader) {
        e.preventDefault();
        folderHeader.click();
        return;
      }
      const card = e.target.closest('.prompt-card');
      if (card && !e.target.closest('.prompt-action-btn')) {
        e.preventDefault();
        copyPrompt(card.dataset.promptId);
      }
    }
  };
  
  // Drag-and-drop: prompts between folders
  list.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.prompt-card');
    if (!card) return;
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', card.dataset.promptId);
    e.dataTransfer.effectAllowed = 'move';
  });
  
  list.addEventListener('dragend', (e) => {
    const card = e.target.closest('.prompt-card');
    if (card) card.classList.remove('dragging');
    // Remove all drag-over highlights
    document.querySelectorAll('.folder-section.drag-over').forEach(s => s.classList.remove('drag-over'));
  });
  
  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const folderSection = e.target.closest('.folder-section');
    // Clear all and highlight current
    document.querySelectorAll('.folder-section.drag-over').forEach(s => s.classList.remove('drag-over'));
    if (folderSection) folderSection.classList.add('drag-over');
  });
  
  list.addEventListener('dragleave', (e) => {
    const folderSection = e.target.closest('.folder-section');
    if (folderSection && !folderSection.contains(e.relatedTarget)) {
      folderSection.classList.remove('drag-over');
    }
  });
  
  list.addEventListener('drop', async (e) => {
    e.preventDefault();
    document.querySelectorAll('.folder-section.drag-over').forEach(s => s.classList.remove('drag-over'));
    
    const promptId = e.dataTransfer.getData('text/plain');
    if (!promptId) return;
    
    const folderSection = e.target.closest('.folder-section');
    if (!folderSection) return;
    
    const targetFolderId = folderSection.dataset.folderId;
    const newFolderId = targetFolderId === 'uncategorized' ? null : targetFolderId;
    
    const prompt = state.prompts.find(p => p.id === promptId);
    if (!prompt) return;
    
    // Don't move if already in this folder
    if ((prompt.folderId || null) === newFolderId) return;
    
    prompt.folderId = newFolderId;
    prompt.updatedAt = Date.now();
    _suppressStorageRender = true;
    await saveData('prompts', state.prompts);
    _suppressStorageRender = false;
    
    const folderName = newFolderId 
      ? (state.folders.find(f => f.id === newFolderId)?.name || t('uncategorized'))
      : t('uncategorized');
    showToast(`Moved to ${folderName}`, 'success');
    // Smart DOM update: move card between folder sections instead of full re-render
    _movePromptCardInDOM(promptId, folderSection, targetFolderId);
    // Re-render Folders tab to ensure counts are always correct
    renderFolders();
    syncPromptToSupabase(prompt);
  });
  
  list.onclick = async (e) => {
    // Folder toggle
    const folderHeader = e.target.closest('[data-toggle-folder]');
    if (folderHeader) {
      const fId = folderHeader.dataset.toggleFolder;
      const section = document.querySelector(`[data-folder-id="${fId}"]`);
      if (section) {
        const expanded = section.classList.toggle('expanded');
        localStorage.setItem(`pv-folder-${fId}`, expanded);
        folderHeader.setAttribute('aria-expanded', String(expanded));
        // Show empty hint when expanding an empty folder
        if (expanded) {
          const contentEl = section.querySelector('.folder-content');
          if (contentEl && contentEl.children.length === 0) {
            contentEl.innerHTML = `<div style="font-size:var(--font-size-xs);color:var(--text-tertiary);padding:var(--space-3) var(--space-2);text-align:center;">${t('noPromptsInFolder') || 'No prompts in this folder'}</div>`;
          }
        }
      }
      return;
    }
    // Action buttons
    const actionBtn = e.target.closest('.prompt-action-btn');
    if (actionBtn) {
      e.stopPropagation();
      const action = actionBtn.dataset.action;
      const id = actionBtn.dataset.id;
      if (action === 'toggle-fav') await toggleFavorite(id);
      else if (action === 'copy') await copyPrompt(id);
      else if (action === 'edit') openPromptEditor(id);
      else if (action === 'insert') await insertPromptToPage(id);
      else if (action === 'menu') showContextMenu(actionBtn, id);
      return;
    }
    // Card click -> copy prompt text (single unified action)
    const card = e.target.closest('.prompt-card');
    if (card && !e.target.closest('.prompt-action-btn')) {
      copyPrompt(card.dataset.promptId);
    }
  };
}

async function toggleFavorite(id) {
  const p = state.prompts.find(x => x.id === id);
  if (!p) return;
  p.isFavorite = !p.isFavorite;
  p.updatedAt = Date.now();
  _suppressStorageRender = true;
  await saveData('prompts', state.prompts);
  _suppressStorageRender = false;
  showToast(p.isFavorite ? t('addedToFavorites') : t('removedFromFavorites'), 'success');
  // Analytics: track favorite toggle
  P.analyticsTrackPromptFavoriteToggle(id, p.isFavorite);
  // In-place update for prompts list; only re-render favorites tab (it's simpler)
  updatePromptCardFavorite(id, p.isFavorite);
  renderFavorites();
  syncPromptToSupabase(p);
}

// ==================== IN-PLACE UI UPDATES (prevent full re-render flicker) ====================
// Update a prompt card's useCount without re-rendering the entire list
function updatePromptCardUseCount(promptId, useCount) {
  const card = document.querySelector(`.prompt-card[data-prompt-id="${promptId}"]`);
  if (!card) return false;
  const stat = card.querySelector('.prompt-stat');
  if (stat) stat.textContent = t('usedTimes', useCount);
  return true;
}

// Update a prompt card's favorite state in-place
function updatePromptCardFavorite(promptId, isFavorite) {
  // Update in prompts list
  const cards = document.querySelectorAll(`.prompt-card[data-prompt-id="${promptId}"]`);
  cards.forEach(card => {
    const favBtn = card.querySelector('[data-action="toggle-fav"]');
    if (favBtn) {
      favBtn.classList.toggle('active', isFavorite);
      favBtn.title = isFavorite ? t('removeFromFavorites') : t('addToFavorites');
      const svg = favBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isFavorite ? 'currentColor' : 'none');
    }
  });
}

// Update a prompt card's text content in-place (title, tags, useCount, favorite)
// Returns true if the card was updated in-place, false if a full re-render is needed
function updatePromptCardInPlace(promptId, prompt) {
  const card = document.querySelector(`.prompt-card[data-prompt-id="${promptId}"]`);
  if (!card) return false;
  
  // Update title text
  const titleEl = card.querySelector('.prompt-title');
  if (titleEl) titleEl.textContent = truncate(prompt.title, 60);
  
  // Update tags
  const existingTags = card.querySelector('.tags');
  const header = card.querySelector('.prompt-card-header');
  if (prompt.tags?.length) {
    const tagsHtml = `<div class="tags">${prompt.tags.slice(0, 3).map(tg => `<span class="tag">#${escapeHtml(tg)}</span>`).join('')}${prompt.tags.length > 3 ? `<span class="tag">+${prompt.tags.length - 3}</span>` : ''}</div>`;
    if (existingTags) {
      existingTags.outerHTML = tagsHtml;
    } else if (header) {
      header.insertAdjacentHTML('afterend', tagsHtml);
    }
  } else if (existingTags) {
    existingTags.remove();
  }
  
  // Update useCount
  const stat = card.querySelector('.prompt-stat');
  if (stat) stat.textContent = t('usedTimes', prompt.useCount || 0);
  
  // Update favorite button state
  updatePromptCardFavorite(promptId, prompt.isFavorite);
  
  return true;
}

// Update a folder name in-place without re-rendering
function updateFolderNameInPlace(folderId, newName) {
  const section = document.querySelector(`.folder-section[data-folder-id="${folderId}"]`);
  if (!section) return false;
  const nameEl = section.querySelector('.folder-name');
  if (nameEl) nameEl.textContent = newName;
  return true;
}

// Flag to suppress storage listener re-renders during our own saves
let _suppressStorageRender = false;

// copyPromptText is aliased from P.copyPromptText (modules/utils.js)
const copyPromptText = P.copyPromptText;

async function copyPrompt(id) {
  const p = state.prompts.find(x => x.id === id);
  if (!p) return;
  const ok = await copyPromptText(p.text);
  if (ok) {
    p.useCount = (p.useCount || 0) + 1;
    p.updatedAt = Date.now();
    _suppressStorageRender = true;
    await saveData('prompts', state.prompts);
    _suppressStorageRender = false;
    showToast(t('copiedToClipboard'), 'success');
    // Analytics: track prompt copy
    P.analyticsTrackPromptCopied(id);
    // In-place update instead of full re-render
    updatePromptCardUseCount(id, p.useCount);
    trackUsage(p, 'copy');
    syncPromptToSupabase(p);
  } else {
    showToast(t('failedToCopy'), 'error');
  }
}

async function insertPromptToPage(id) {
  const p = state.prompts.find(x => x.id === id);
  if (!p) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No tab');
    await chrome.tabs.sendMessage(tab.id, { action: 'insertPrompt', text: p.text, variables: p.variables || [] });
    p.useCount = (p.useCount || 0) + 1;
    p.updatedAt = Date.now();
    _suppressStorageRender = true;
    await saveData('prompts', state.prompts);
    _suppressStorageRender = false;
    showToast(t('promptInserted'), 'success');
    // Analytics: track prompt insertion
    P.analyticsTrackPromptInserted(p, new URL(tab.url || '').hostname.replace('www.', '') || 'unknown');
    P.analyticsTrackPromptUsed(p, new URL(tab.url || '').hostname.replace('www.', '') || 'unknown');
    // In-place update instead of full re-render
    updatePromptCardUseCount(id, p.useCount);
    const platform = new URL(tab.url || '').hostname.replace('www.', '') || 'unknown';
    trackUsage(p, 'insert', platform);
    syncPromptToSupabase(p); // Continuous sync
  } catch {
    await navigator.clipboard.writeText(p.text);
    p.useCount = (p.useCount || 0) + 1;
    p.updatedAt = Date.now();
    _suppressStorageRender = true;
    await saveData('prompts', state.prompts);
    _suppressStorageRender = false;
    showToast(t('copiedClipboardNotSupported'), 'success');
    // In-place update instead of full re-render
    updatePromptCardUseCount(id, p.useCount);
    trackUsage(p, 'clipboard');
    syncPromptToSupabase(p); // Continuous sync
  }
}

// ==================== CONTEXT MENU ====================
let activeContextMenu = null;

function showContextMenu(anchorEl, promptId) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <div class="context-menu-item" data-ctx="edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>${t('edit')}</div>
    <div class="context-menu-item" data-ctx="copy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>${t('copy')}</div>
    <div class="context-menu-item" data-ctx="insert"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>${t('insert')}</div>
    ${state.user ? `<div class="context-menu-item share" data-ctx="share"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>${t('shareToLibrary')}</div>` : ''}
    <div class="context-menu-divider"></div>
    <div class="context-menu-item danger" data-ctx="delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>${t('delete')}</div>`;
  document.body.appendChild(menu);
  const rect = anchorEl.getBoundingClientRect();
  menu.style.position = 'fixed';
  // Force layout calculation to get accurate menu dimensions
  menu.style.visibility = 'hidden';
  menu.style.display = 'block';
  const menuHeight = menu.offsetHeight;
  const menuWidth = menu.offsetWidth || 200;
  menu.style.visibility = '';
  
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const spaceAbove = rect.top - 8;
  
  // If not enough space below, show above the anchor
  if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
    menu.style.top = `${Math.max(4, rect.top - menuHeight - 4)}px`;
  } else {
    // Show below, but clamp to viewport
    menu.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 4)}px`;
  }
  menu.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - menuWidth - 4))}px`;
  activeContextMenu = menu;

  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', async () => {
      const action = item.dataset.ctx;
      closeContextMenu();
      if (action === 'edit') openPromptEditor(promptId);
      else if (action === 'copy') await copyPrompt(promptId);
      else if (action === 'insert') await insertPromptToPage(promptId);
      else if (action === 'share') await shareToLibrary(promptId);
      else if (action === 'delete') await deletePrompt(promptId);
    });
  });
  
  // Close on click outside
  const clickOutsideHandler = (e) => {
    if (activeContextMenu && !activeContextMenu.contains(e.target)) {
      closeContextMenu();
    }
  };
  setTimeout(() => document.addEventListener('click', clickOutsideHandler, { once: true }), 10);
  
  // Close on scroll (fix for context menu staying visible when scrolling)
  const scrollHandler = () => {
    closeContextMenu();
  };
  const content = document.querySelector('.content');
  if (content) {
    content.addEventListener('scroll', scrollHandler, { once: true });
  }
  document.addEventListener('scroll', scrollHandler, { once: true, capture: true });
}

function closeContextMenu() {
  if (activeContextMenu) { activeContextMenu.remove(); activeContextMenu = null; }
}

// ==================== FOLDER CONTEXT MENU ====================
function showFolderContextMenu(anchorEl, folderId) {
  closeContextMenu();
  const folder = state.folders.find(f => f.id === folderId);
  if (!folder) return;
  
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <div class="context-menu-item" data-ctx="create-prompt"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>${t('createPrompt') || 'Create Prompt'}</div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" data-ctx="edit-folder"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>${t('edit')}</div>
    <div class="context-menu-item danger" data-ctx="delete-folder"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>${t('delete')}</div>`;
  document.body.appendChild(menu);
  
  const rect = anchorEl.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.visibility = 'hidden';
  menu.style.display = 'block';
  const menuHeight = menu.offsetHeight;
  const menuWidth = menu.offsetWidth || 200;
  menu.style.visibility = '';
  
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const spaceAbove = rect.top - 8;
  
  if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
    menu.style.top = `${Math.max(4, rect.top - menuHeight - 4)}px`;
  } else {
    menu.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 4)}px`;
  }
  menu.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - menuWidth - 4))}px`;
  activeContextMenu = menu;
  
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', async () => {
      const action = item.dataset.ctx;
      closeContextMenu();
      if (action === 'create-prompt') {
        // Open prompt editor with this folder pre-selected
        openPromptEditorInFolder(folderId);
      } else if (action === 'edit-folder') {
        openFolderEditor(folderId);
      } else if (action === 'delete-folder') {
        const f = state.folders.find(x => x.id === folderId);
        if (!f) return;
        const count = state.prompts.filter(p => p.folderId === folderId).length;
        if (!confirm(t('deleteFolderConfirm', f.name) + (count ? '\n' + t('promptsMovedToUncategorized', count) : ''))) return;
        state.folders = state.folders.filter(x => x.id !== folderId);
        state.prompts.forEach(p => { if (p.folderId === folderId) p.folderId = null; });
        _suppressStorageRender = true;
        await saveData('folders', state.folders);
        await saveData('prompts', state.prompts);
        _suppressStorageRender = false;
        showToast(t('folderDeleted'), 'success');
        // Analytics: track folder deletion
        P.analyticsTrackFolderDeleted(folderId);
        renderFolders();
        renderPrompts();
        syncFolderDeleteToSupabase(folderId);
      }
    });
  });
  
  const clickOutsideHandler = (e) => {
    if (activeContextMenu && !activeContextMenu.contains(e.target)) {
      closeContextMenu();
    }
  };
  setTimeout(() => document.addEventListener('click', clickOutsideHandler, { once: true }), 10);
}

// Open prompt editor with folder pre-selected
function openPromptEditorInFolder(folderId) {
  P.openPromptEditor(null, {
    canCreatePrompt,
    getEffectiveLimit,
    resolveImageUrl,
    isSupabaseStorageUrl,
    syncPromptToSupabase,
    uploadImageToStorage: P.uploadImageToStorage,
    deletePrompt,
    setSuppressRender: (v) => { _suppressStorageRender = v; },
    afterSave: (editingId, prevFolderId, newFolderId) => {
      requestAnimationFrame(() => { renderPrompts(); renderFavorites(); renderFolders(); });
    }
  });
  // Pre-select the folder in the editor after it opens
  setTimeout(() => {
    const folderSelect = document.getElementById('pe-folder');
    if (folderSelect) folderSelect.value = folderId;
  }, 50);
}

async function deletePrompt(id) {
  if (!confirm(t('deletePromptConfirm'))) return;
  state.prompts = state.prompts.filter(p => p.id !== id);
  _suppressStorageRender = true;
  await saveData('prompts', state.prompts);
  _suppressStorageRender = false;
  showToast(t('promptDeleted'), 'success');
  // Analytics: track prompt deleted
  P.analyticsTrackPromptDeleted(id);
  P.analyticsTrackPromptDeletedEvent(id);
  renderPrompts();
  renderFavorites();
  syncPromptDeleteToSupabase(id);
}

// ==================== SHARE TO LIBRARY ====================
async function shareToLibrary(promptId) {
  const p = state.prompts.find(x => x.id === promptId);
  if (!p) return;
  if (!state.user || !state.session) { showToast(t('signInToShare'), 'error'); return; }

  let selectedImageData = null;
  // Check if prompt already has an uploaded image
  const promptHasImage = p.imageUrl && (p.imageUrl.startsWith('http') || p.imageUrl.startsWith('data:') || p.imageUrl.startsWith('supabase-storage://'));
  let useExistingImage = promptHasImage;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'share-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <div class="modal-header"><h2 class="modal-title">${t('shareToPublicLibrary')}</h2><button class="btn btn-icon btn-ghost close-modal-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">${t('title')}</label><input type="text" id="share-title" value="${escapeHtml(p.title)}"></div>
        <div class="form-group"><label class="form-label">${t('description')}</label><textarea id="share-desc" rows="2" placeholder="${t('descriptionPlaceholder')}">${escapeHtml(p.description || '')}</textarea></div>
        <div class="form-group"><label class="form-label">${t('category')}</label><select id="share-category"><option value="general">${t('catGeneral')}</option><option value="business">${t('catBusiness')}</option><option value="development">${t('catDevelopment')}</option><option value="marketing">${t('catMarketing')}</option><option value="creative">${t('catCreative')}</option><option value="learning">${t('catLearning')}</option><option value="ai">${t('catAI')}</option></select></div>
        <div class="form-group">
          <label class="form-label">${t('coverImage') || 'Cover Image'} <span style="color:var(--text-tertiary);font-weight:normal;">(${t('optional') || 'optional'})</span></label>
          <div class="image-upload-area" id="share-image-upload">
            <div class="image-upload-placeholder" id="share-image-placeholder" style="display:${promptHasImage ? 'none' : 'flex'};">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>${t('clickToUpload') || 'Click to upload image'}</span>
              <span style="font-size:10px;color:var(--text-tertiary);">PNG, JPG (max 500KB)</span>
            </div>
            <img id="share-image-preview" class="image-preview" style="display:${promptHasImage ? 'block' : 'none'};" />
            <button class="btn btn-icon btn-sm image-remove-btn" id="share-image-remove" style="display:${promptHasImage ? 'flex' : 'none'};" title="${t('remove') || 'Remove'}">×</button>
          </div>
          <input type="file" id="share-image-input" accept="image/png,image/jpeg,image/jpg" style="display:none;">
        </div>
        <div style="padding:10px;background:var(--bg-tertiary);border-radius:var(--radius-md);margin-top:8px;"><div style="font-size:var(--font-size-xs);color:var(--text-tertiary);line-height:1.5;">${t('shareDisclaimer')}</div></div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost close-modal-btn">${t('cancel')}</button><button class="btn btn-primary ripple" id="share-confirm-btn">${t('share')}</button></div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);

  // If prompt already has an image, load it into preview
  if (promptHasImage) {
    const previewEl = document.getElementById('share-image-preview');
    if (previewEl) {
      resolveImageUrl(p.imageUrl).then(resolvedUrl => {
        if (resolvedUrl && previewEl) {
          previewEl.src = resolvedUrl;
        }
      }).catch(() => {
        // Can't resolve - hide preview, show placeholder
        previewEl.style.display = 'none';
        const ph = document.getElementById('share-image-placeholder');
        const rm = document.getElementById('share-image-remove');
        if (ph) ph.style.display = 'flex';
        if (rm) rm.style.display = 'none';
        useExistingImage = false;
      });
    }
  }

  // Image upload handling
  const imageUpload = document.getElementById('share-image-upload');
  const imageInput = document.getElementById('share-image-input');
  const imagePlaceholder = document.getElementById('share-image-placeholder');
  const imagePreview = document.getElementById('share-image-preview');
  const imageRemove = document.getElementById('share-image-remove');

  imageUpload.addEventListener('click', (e) => {
    if (e.target.closest('#share-image-remove')) return;
    imageInput.click();
  });

  imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file size (500KB max)
    if (file.size > 500 * 1024) {
      showToast(t('imageTooLarge') || 'Image too large (max 500KB)', 'error');
      return;
    }
    
    // Read and preview
    const reader = new FileReader();
    reader.onload = (e) => {
      selectedImageData = e.target.result;
      useExistingImage = false; // User uploaded a new image, don't use existing
      imagePreview.src = selectedImageData;
      imagePreview.style.display = 'block';
      imagePlaceholder.style.display = 'none';
      imageRemove.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  });

  imageRemove.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedImageData = null;
    useExistingImage = false;
    imagePreview.style.display = 'none';
    imagePlaceholder.style.display = 'flex';
    imageRemove.style.display = 'none';
    imageInput.value = '';
  });

  document.getElementById('share-confirm-btn').addEventListener('click', async () => {
    const title = document.getElementById('share-title').value.trim();
    const desc = document.getElementById('share-desc').value.trim();
    const category = document.getElementById('share-category').value;
    if (!title) { showToast(t('titleRequired'), 'error'); return; }
    const btn = document.getElementById('share-confirm-btn');
    btn.classList.add('loading');
    
    try {
      // Determine image URL: use existing prompt image, new upload, or null
      let imageUrl = null;
      
      if (selectedImageData) {
        // User selected a new image — upload it
        try {
          const contentTypeMatch = selectedImageData.match(/^data:(.+?);base64,/);
          const contentType = contentTypeMatch ? contentTypeMatch[1] : 'image/png';
          const ext = contentType.split('/')[1] || 'png';
          const fileName = `${state.user.id}/${Date.now()}_cover.${ext}`;
          
          const uploadRes = await supabaseMsg({
            action: 'supabaseRequest',
            method: 'POST',
            path: `storage/v1/object/Lib_img/${fileName}`,
            body: selectedImageData,
            isFile: true,
            contentType: contentType
          });
          
          if (!uploadRes?.error) {
            imageUrl = uploadRes?.data?.signedUrl || uploadRes?.data?.publicUrl || `${SUPABASE_URL}/storage/v1/object/public/Lib_img/${fileName}`;
            console.log('✅ Image uploaded:', imageUrl);
          } else {
            console.warn('⚠️ Image upload failed:', uploadRes.error);
          }
        } catch (imgErr) {
          console.warn('⚠️ Image upload error:', imgErr);
        }
      } else if (useExistingImage && p.imageUrl) {
        // Use the existing image from the prompt (no re-upload needed)
        // Resolve supabase-storage:// URLs to public URLs for library
        if (p.imageUrl.startsWith('supabase-storage://') || isSupabaseStorageUrl(p.imageUrl)) {
          // Try to get a public URL for the existing image
          const storagePath = extractStoragePath(p.imageUrl);
          if (storagePath) {
            const parts = storagePath.split('/');
            const bucket = parts[0];
            const path = parts.slice(1).join('/');
            imageUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
          } else {
            imageUrl = p.imageUrl;
          }
        } else {
          imageUrl = p.imageUrl;
        }
        console.log('✅ Using existing prompt image:', imageUrl);
      }
      
      // Share prompt to library using RPC function (bypasses RLS issues with SECURITY DEFINER)
      const res = await supabaseMsg({ 
        action: 'supabaseRequest', 
        method: 'POST', 
        path: 'rpc/share_prompt_to_library',
        body: {
          p_title: title,
          p_text: p.text,
          p_description: desc,
          p_author: state.user.name || state.user.email.split('@')[0],
          p_tags: p.tags || [],
          p_variables: p.variables || [],
          p_category: category,
          p_image_url: imageUrl
        }
      });
      
      if (res?.error) {
        throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
      }
      
      // Check RPC response for success
      const rpcResult = Array.isArray(res?.data) ? res.data[0] : res?.data;
      if (rpcResult && rpcResult.success === false) {
        throw new Error(rpcResult.error || 'Failed to share prompt');
      }
      
      showToast(t('promptShared'), 'success');
      // Analytics: track prompt published to library
      P.analyticsTrackLibraryPublish(promptId);
      closeModal('share-modal');
      loadLibraryPrompts();
    } catch (e) { 
      console.error('Share error:', e);
      showToast(t('failedToShare') + ': ' + (e.message || ''), 'error'); 
    }
    btn.classList.remove('loading');
  });
  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => closeModal('share-modal')));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal('share-modal'); });
}

// ==================== PROMPT EDITOR ====================
// Delegated to modules/editor.js — P.openPromptEditor
let pendingImageFile = null; // For image upload (kept for backward compat)

function openPromptEditor(promptId = null) {
  P.openPromptEditor(promptId, {
    canCreatePrompt,
    getEffectiveLimit,
    resolveImageUrl,
    isSupabaseStorageUrl,
    syncPromptToSupabase,
    uploadImageToStorage: P.uploadImageToStorage,
    deletePrompt,
    setSuppressRender: (v) => { _suppressStorageRender = v; },
    afterSave: (editingId, prevFolderId, newFolderId) => {
      if (editingId) {
        const updatedPrompt = state.prompts.find(x => x.id === editingId);
        const folderChanged = (prevFolderId || 'uncategorized') !== (newFolderId || 'uncategorized');
        if (folderChanged || !updatedPrompt || !updatePromptCardInPlace(editingId, updatedPrompt)) {
          requestAnimationFrame(() => { renderPrompts(); renderFavorites(); });
        } else {
          renderFavorites();
        }
      } else {
        requestAnimationFrame(() => { renderPrompts(); renderFavorites(); });
      }
    }
  });
}
// (Editor implementation is in modules/editor.js)
// The following old inline code has been replaced by the module delegation above.
// ==================== PLACEHOLDER ====================
void 0; // intentional no-op

// ==================== FOLDERS (optimized with RAF batching) ====================
let _renderFoldersRAF = null;
function renderFolders() {
  if (_renderFoldersRAF) cancelAnimationFrame(_renderFoldersRAF);
  _renderFoldersRAF = requestAnimationFrame(_renderFoldersImmediate);
}
function _renderFoldersImmediate() {
  _renderFoldersRAF = null;
  const list = document.getElementById('folders-list');
  if (!list) return;
  const folders = state.folders;
  if (folders.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-title">${t('noFoldersTitle')}</div><div class="empty-state-text">${t('noFoldersText')}</div></div>`;
    return;
  }
  list.innerHTML = '';
  
  // Sort folders by prompt count (descending) — folders with more prompts first
  const sortedFoldersForTab = [...folders].sort((a, b) => {
    const countA = state.prompts.filter(p => p.folderId === a.id).length;
    const countB = state.prompts.filter(p => p.folderId === b.id).length;
    return countB - countA;
  });
  
  list.innerHTML += sortedFoldersForTab.map((f, i) => {
    const count = state.prompts.filter(p => p.folderId === f.id).length;
    const enterClass = _isFirstRender || !_renderedCardIds.has('folder-' + f.id) ? ' card-entering' : '';
    const delay = enterClass && i < MAX_ANIM_ITEMS ? `style="animation-delay:${i * 30}ms"` : '';
    _renderedCardIds.add('folder-' + f.id);
    return `<div class="folder-card${enterClass}" data-folder-id="${f.id}" data-folder-click="${f.id}" ${delay}><div class="folder-card-left"><div class="folder-details"><div class="folder-card-name">${escapeHtml(f.name)}</div><div class="folder-card-count">${count} ${count !== 1 ? t('promptsWord') : t('promptWord')}</div></div></div><div class="folder-card-actions"><button class="prompt-action-btn folder-menu-btn" data-folder-menu="${f.id}" title="${t('more') || 'More'}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg></button></div></div>`;
  }).join('');
  
  // Show folder limit banner for free/guest users
  const folderLimit = P.getEffectiveFolderLimit();
  if (folderLimit !== Infinity && folders.length >= folderLimit) {
    list.innerHTML += `<div class="folder-limit-banner"><span class="folder-limit-text">${t('folderLimitReached') || 'Folder limit reached. Upgrade for more folders.'}</span></div>`;
  }

  // Click on folder card to navigate to prompts in that folder
  document.querySelectorAll('[data-folder-click]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.prompt-action-btn')) return;
      const folderId = card.dataset.folderClick;
      // Switch to prompts tab
      document.querySelector('[data-tab="prompts"]').click();
      
      setTimeout(() => {
        const sections = document.querySelectorAll('.folder-section');
        let targetSection = null;
        
        // Collapse all folders EXCEPT the target one
        sections.forEach(s => {
          if (s.dataset.folderId === folderId) {
            // This is the target - expand it
            s.classList.add('expanded');
            localStorage.setItem(`pv-folder-${folderId}`, 'true');
            s.setAttribute('aria-expanded', 'true');
            targetSection = s;
            
            // Highlight animation
            s.classList.add('folder-highlight');
            setTimeout(() => s.classList.remove('folder-highlight'), 2000);
          } else {
            // Collapse all other folders
            s.classList.remove('expanded');
            localStorage.setItem(`pv-folder-${s.dataset.folderId}`, 'false');
            s.setAttribute('aria-expanded', 'false');
          }
        });
        
        // Scroll to target smoothly - use 'start' to show it at top
        // but add offset so previous folders are still visible
        if (targetSection) {
          const rect = targetSection.getBoundingClientRect();
          const headerOffset = 120; // Account for header + search + tabs
          const scrollPosition = window.scrollY + rect.top - headerOffset;
          
          window.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
          });
        }
      }, 150);
    });
  });

  // Three-dot menu for folders
  document.querySelectorAll('[data-folder-menu]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showFolderContextMenu(btn, btn.dataset.folderMenu);
    });
  });
}

function openFolderEditor(folderId = null) {
  const folder = folderId ? state.folders.find(f => f.id === folderId) : null;
  const isEdit = !!folder;

  // Analytics: track folder editor open
  P.analyticsTrackFolderEditorOpen(isEdit, folderId);
  
  // Free tier folder limit (only for new folders, not editing)
  if (!isEdit && !P.canCreateFolder()) {
    const folderLimit = P.getEffectiveFolderLimit();
    showToast(t('folderLimitReached') || `Folder limit reached (${folderLimit}). Upgrade for more.`, 'error');
    // Track limit hit
    P.analyticsTrackLimitHit('folders');
    return;
  }
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'folder-editor-modal';
  modal.innerHTML = `
    <div class="modal"><div class="modal-header"><h2 class="modal-title">${isEdit ? t('editFolder') : t('newFolderTitle')}</h2><button class="btn btn-icon btn-ghost close-modal-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="modal-body"><div class="form-group"><label class="form-label required">${t('folderName')}</label><input type="text" id="fe-name" placeholder="${t('folderNamePlaceholder')}" value="${folder ? escapeHtml(folder.name) : ''}"><span class="form-error" id="fe-name-err" style="display:none;">${t('nameRequired')}</span></div></div>
      <div class="modal-footer"><button class="btn btn-ghost close-modal-btn">${t('cancel')}</button><button class="btn btn-primary ripple" id="fe-save-btn">${isEdit ? t('saveChanges') : t('createPrompt')}</button></div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);
  document.getElementById('fe-name').focus();

  document.getElementById('fe-save-btn').addEventListener('click', async () => {
    const name = document.getElementById('fe-name').value.trim();
    if (!name) { document.getElementById('fe-name-err').style.display = 'block'; return; }
    // Clear folder draft on save
    try { chrome.storage.local.remove('folderEditorDraft'); } catch (e) { /* silent */ }
    if (folderId) { const f = state.folders.find(x => x.id === folderId); if (f) { f.name = name; f.updatedAt = Date.now(); syncFolderToSupabase(f); P.analyticsTrackFolderUpdated(f); } }
    else { const newF = { id: crypto.randomUUID(), name, createdAt: Date.now(), updatedAt: Date.now() }; state.folders.push(newF); syncFolderToSupabase(newF); P.analyticsTrackFolderCreated(newF); P.analyticsTrackFolderCreatedEvent(newF); }
    _suppressStorageRender = true;
    await saveData('folders', state.folders);
    _suppressStorageRender = false;
    showToast(folderId ? t('folderUpdated') : t('folderCreated'), 'success');
    closeModal('folder-editor-modal');
    // For edits: try in-place name update (no flicker). Full re-render only for new folders
    if (folderId) {
      if (!updateFolderNameInPlace(folderId, name)) {
        renderFolders();
      }
      // Also update folder name in prompts list
      renderPrompts();
    } else {
      renderFolders();
      // Also re-render prompts so new folder section appears immediately
      renderPrompts();
    }
  });
  
  // Save folder draft on input and confirm before closing if changed
  const nameInput = document.getElementById('fe-name');
  const saveFolderDraft = () => {
    const val = nameInput?.value || '';
    if (val) {
      try { chrome.storage.local.set({ folderEditorDraft: { folderId: folderId || null, name: val, savedAt: Date.now() } }); } catch (e) { /* silent */ }
      // Analytics: track folder draft save during editing
      P.analyticsTrackFolderDraftSave(!!folderId, folderId);
    }
  };
  nameInput?.addEventListener('input', debounce(saveFolderDraft, 500));
  
  const confirmAndCloseFolder = async () => {
    const currentName = nameInput?.value?.trim() || '';
    const originalName = folder ? folder.name : '';
    const hadChanges = currentName && currentName !== originalName;
    if (hadChanges) {
      const titleText = P.getLang() === 'ru' ? 'Несохранённые изменения' : 'Unsaved Changes';
      const msg = P.getLang() === 'ru'
        ? 'У вас есть несохранённые изменения. Закрыть без сохранения? (черновик будет сохранён)'
        : 'You have unsaved changes. Close without saving? (draft will be saved)';
      const okText = P.getLang() === 'ru' ? 'Закрыть' : 'Close';
      const cancelBtnText = P.getLang() === 'ru' ? 'Отмена' : 'Cancel';
      const confirmed = await showStyledConfirm(titleText, msg, okText, cancelBtnText);
      if (!confirmed) return;
      saveFolderDraft();
    } else {
      try { chrome.storage.local.remove('folderEditorDraft'); } catch (e) { /* silent */ }
    }
    // Analytics: track folder editor close without saving
    P.analyticsTrackFolderEditorClose(!!folderId, folderId, hadChanges);
    closeModal('folder-editor-modal');
  };
  
  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', confirmAndCloseFolder));
  modal.addEventListener('click', (e) => { if (e.target === modal) confirmAndCloseFolder(); });
}

// ==================== FAVORITES (optimized with RAF batching) ====================
let _renderFavoritesRAF = null;
function renderFavorites() {
  if (_renderFavoritesRAF) cancelAnimationFrame(_renderFavoritesRAF);
  _renderFavoritesRAF = requestAnimationFrame(_renderFavoritesImmediate);
}
function _renderFavoritesImmediate() {
  _renderFavoritesRAF = null;
  const list = document.getElementById('favorites-list');
  if (!list) return;
  const favorites = state.prompts.filter(p => p.isFavorite);
  if (favorites.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-title">${t('noFavoritesTitle')}</div><div class="empty-state-text">${t('noFavoritesText')}</div><button class="btn btn-secondary ripple" id="fav-browse-btn">${t('browsePrompts')}</button></div>`;
    document.getElementById('fav-browse-btn')?.addEventListener('click', () => document.querySelector('[data-tab="prompts"]').click());
    return;
  }
  // Independent favorites component — no dependency on prompt-card/folder classes
  let html = `<div class="favorites-header"><span class="favorites-header-title">${t('favorites')}</span><span class="favorites-count">${favorites.length}</span></div>`;
  html += '<div class="favorites-items">';
  html += favorites.map((p, i) => {
    const enterClass = _isFirstRender || !_renderedCardIds.has('fav-' + p.id) ? ' card-entering' : '';
    const delay = enterClass && i < MAX_ANIM_ITEMS ? `style="animation-delay:${i * 30}ms"` : '';
    _renderedCardIds.add('fav-' + p.id);
    return `<div class="fav-card${enterClass}" data-prompt-id="${p.id}" ${delay} tabindex="0" role="button" aria-label="${escapeHtml(p.title)} - ${t('clickToCopy')}">
      <div class="fav-card-header">
        <div class="fav-card-title">${escapeHtml(truncate(p.title, 50))}</div>
        <div class="fav-card-actions">
          <button class="prompt-action-btn" data-fav-copy="${p.id}" title="${t('copy')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
          <button class="prompt-action-btn" data-fav-insert="${p.id}" title="${t('insertToPage')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg></button>
          <button class="prompt-action-btn active" data-fav-remove="${p.id}" title="${t('removeFromFavorites')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></button>
        </div>
      </div>
      <div class="fav-card-meta"><span>${t('usedTimes', p.useCount || 0)}</span><span>${formatDate(p.updatedAt)}</span></div>
    </div>`;
  }).join('');
  html += '</div>';
  list.innerHTML = html;
  // Event delegation on the favorites list
  list.onclick = (e) => {
    const copyBtn = e.target.closest('[data-fav-copy]');
    if (copyBtn) { e.stopPropagation(); copyPrompt(copyBtn.dataset.favCopy); return; }
    const insertBtn = e.target.closest('[data-fav-insert]');
    if (insertBtn) { e.stopPropagation(); insertPromptToPage(insertBtn.dataset.favInsert); return; }
    const removeBtn = e.target.closest('[data-fav-remove]');
    if (removeBtn) { e.stopPropagation(); toggleFavorite(removeBtn.dataset.favRemove); return; }
    const card = e.target.closest('.fav-card');
    if (card && !e.target.closest('.prompt-action-btn')) { copyPrompt(card.dataset.promptId); }
  };
}

// ==================== EXPLORE ====================
let _libraryPage = 0;
let _libraryHasMore = true;
let _libraryLoading = false;

async function loadLibraryPrompts(append = false) {
  // Library prompts should be visible to authenticated users only
  if (!state.session || !state.user) {
    console.log('📚 Skipping library load - not authenticated');
    state.libraryError = null;
    renderExplore();
    return;
  }

  if (_libraryLoading) return;
  _libraryLoading = true;
  
  if (!append) {
    _libraryPage = 0;
    _libraryHasMore = true;
    // Show skeleton immediately if no cached data
    if (state.libraryPrompts.length === 0) renderExplore();
  }

  console.log('📚 Loading library prompts page', _libraryPage);
  state.libraryError = null;
  
  const offset = _libraryPage * LIBRARY_PAGE_SIZE;

  const queries = [
    `library_prompts?select=id,title,text,description,author,author_id,tags,likes,downloads,category,is_featured,image_url,created_at&is_approved=eq.true&order=created_at.desc.nullslast&limit=${LIBRARY_PAGE_SIZE}&offset=${offset}`,
    `library_prompts?select=id,title,text,description,author,author_id,tags,likes,downloads,category,is_featured,image_url&is_approved=eq.true&limit=${LIBRARY_PAGE_SIZE}&offset=${offset}`,
    `library_prompts?is_approved=eq.true&order=likes.desc&limit=${LIBRARY_PAGE_SIZE}&offset=${offset}`
  ];

  let lastError = null;
  let loaded = false;

  for (const path of queries) {
    try {
      const res = await supabaseMsgWithRetry({ action: 'supabaseRequest', method: 'GET', path });

      if (res?.data && Array.isArray(res.data)) {
        const sanitize = P.sanitizeLibraryText;
        const newItems = res.data.map(p => ({
          id: p.id,
          title: sanitize(p.title),
          text: sanitize(p.text),
          description: sanitize(p.description),
          author: sanitize(p.author),
          authorId: p.author_id,
          tags: (p.tags || []).map(t => sanitize(t)),
          likes: p.likes || 0,
          downloads: p.downloads || 0,
          category: sanitize(p.category || 'general'),
          isFeatured: p.is_featured,
          imageUrl: p.image_url || null
        }));
        
        if (append) {
          // Avoid duplicates
          const existingIds = new Set(state.libraryPrompts.map(p => p.id));
          const unique = newItems.filter(p => !existingIds.has(p.id));
          state.libraryPrompts = [...state.libraryPrompts, ...unique];
        } else {
          state.libraryPrompts = newItems;
        }
        
        _libraryHasMore = newItems.length >= LIBRARY_PAGE_SIZE;
        console.log('📚 Loaded', newItems.length, 'library prompts, total:', state.libraryPrompts.length);
        _suppressStorageRender = true;
        saveData('libraryPromptsCache', state.libraryPrompts);
        _suppressStorageRender = false;
        loaded = true;
        break;
      }

      if (res?.error) {
        lastError = res.error;
        console.warn('📚 Library query failed:', path, parseSupabaseError(res.error));
      }
    } catch (e) {
      lastError = e;
      console.warn('📚 Library query threw:', path, e);
    }
  }

  if (!loaded && lastError) {
    const errorText = parseSupabaseError(lastError);
    state.libraryError = errorText;

    if (isAuthError(lastError)) {
      state.session = null;
      state.user = null;
      await saveData('session', null);
      await saveData('user', null);
      showToast(t('signInToExplore'), 'error');
    }
  }

  // Load user likes and reports (only on first page)
  if (!append) {
    try {
      const likesRes = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: 'library_likes?select=prompt_id' });
      if (likesRes?.data) state.userLikes = new Set(likesRes.data.map(l => l.prompt_id));
    } catch (e) { /* silent */ }

    try {
      const reportsRes = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: 'prompt_reports?select=prompt_id' });
      if (reportsRes?.data) state.userReports = new Set(reportsRes.data.map(r => r.prompt_id));
    } catch (e) { /* silent */ }
  }

  _libraryLoading = false;
  renderExplore();
}

let flippedCards = new Set();

// Category colors for visual distinction (no emoji - clean gradient only)
const CATEGORY_COLORS = {
  'business': { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  'development': { bg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  'marketing': { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  'creative': { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  'learning': { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  'ai': { bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  'general': { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
};

function renderExplore() {
  const list = document.getElementById('explore-list');
  if (!list) return;
  
  // Only authenticated users can view the library
  if (!state.user || !state.session) {
    list.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-title">${t('signInToExplore')}</div><div class="empty-state-text">${t('discoverPrompts')}</div><button class="btn btn-primary ripple" id="explore-signin-btn">${t('signIn')}</button></div>`;
    document.getElementById('explore-signin-btn')?.addEventListener('click', () => document.getElementById('settings-btn').click());
    return;
  }
  
  // Show skeleton while loading
  if (state.libraryPrompts.length === 0 && !state.libraryError && _libraryLoading) {
    list.innerHTML = Array.from({ length: 4 }, () =>
      `<div class="skeleton-explore-card"><div class="skeleton-explore-thumb skeleton"></div><div class="skeleton-explore-body"><div class="skeleton skeleton-text w-80"></div><div class="skeleton skeleton-text w-40"></div></div></div>`
    ).join('');
    return;
  }
  
  if (state.libraryPrompts.length === 0) {
    const debugHint = state.libraryError
      ? `<div class="empty-state-text" style="margin-top:8px;font-size:12px;opacity:.75;">Library load error: ${escapeHtml(truncate(state.libraryError, 160))}</div>`
      : '';
    list.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-title">${t('noPublicPrompts')}</div><div class="empty-state-text">${t('beFirstToShare')}</div>${debugHint}</div>`;
    return;
  }
  
  // Render library cards with flip effect
  list.innerHTML = state.libraryPrompts.map((p, i) => {
    const isFlipped = flippedCards.has(p.id);
    const isLiked = state.userLikes.has(p.id);
    const isReported = state.userReports.has(p.id);
    const isNew = _isFirstRender || !_renderedCardIds.has('explore-' + p.id);
    const enterClass = isNew ? ' card-entering' : '';
    const delay = isNew && i < MAX_ANIM_ITEMS ? `style="animation-delay:${i * 50}ms"` : '';
    _renderedCardIds.add('explore-' + p.id);
    const categoryInfo = CATEGORY_COLORS[p.category] || CATEGORY_COLORS['general'];
    
    // Thumbnail: use image_url if available, otherwise category gradient (no emoji)
    // For Supabase storage images, we'll load them asynchronously after render
    const hasStorageImage = p.imageUrl && isSupabaseStorageUrl(p.imageUrl);
    const hasDirectImage = p.imageUrl && !isSupabaseStorageUrl(p.imageUrl);
    const thumbnailStyle = hasDirectImage 
      ? `background-image: url('${escapeHtml(p.imageUrl)}'); background-size: cover; background-position: center;`
      : `background: ${categoryInfo.bg};`;
    const thumbnailContent = '';
    
    return `<div class="explore-card-wrapper${enterClass}" data-explore-id="${p.id}" ${delay}>
      <div class="explore-card ${isFlipped ? 'flipped' : ''}">
        <div class="explore-card-front">
          <div class="explore-card-thumbnail${hasStorageImage ? ' needs-image-load' : ''}" ${hasStorageImage ? `data-image-url="${escapeHtml(p.imageUrl)}"` : ''} style="${thumbnailStyle}">
            ${thumbnailContent}
            <div class="explore-card-category-badge">${escapeHtml(p.category || 'general')}</div>
            <div class="explore-front-gradient"></div>
            <div class="explore-front-title">${escapeHtml(truncate(p.title, 42))}</div>
          </div>
        </div>
        <div class="explore-card-back">
          <div class="explore-card-back-header">
            <div class="explore-card-back-title">${escapeHtml(truncate(p.title, 40))}</div>
          </div>
          <div class="explore-card-code">${escapeHtml(truncate(p.text, 200))}</div>
          <div class="explore-card-actions">
            <button class="btn btn-secondary btn-sm ripple" data-explore-copy="${p.id}">${t('copy')}</button>
            <button class="btn btn-primary btn-sm ripple" data-explore-save="${p.id}">${t('save')}</button>
          </div>
          <div class="explore-card-actions-row">
            <button class="explore-action-btn ${isLiked ? 'liked' : ''}" data-explore-like="${p.id}" title="${t('like')}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            <span class="explore-like-count" data-like-count="${p.id}">${p.likes}</span>
            ${state.user ? `<button class="explore-action-btn ${isReported ? 'reported' : ''}" data-explore-report="${p.id}" title="${isReported ? t('reported') : t('report')}" ${isReported ? 'disabled' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            </button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  // Event delegation for explore list
  list.onclick = async (e) => {
    const copyBtn = e.target.closest('[data-explore-copy]');
    if (copyBtn) { e.stopPropagation(); const p = state.libraryPrompts.find(x => x.id === copyBtn.dataset.exploreCopy); if (p) { const ok = await copyPromptText(p.text); showToast(ok ? t('copiedToClipboard') : t('failedToCopy'), ok ? 'success' : 'error'); } return; }
    const saveBtn = e.target.closest('[data-explore-save]');
    if (saveBtn) { 
      e.stopPropagation(); 
      if (!state.user) { showToast(t('signInToSave') || 'Sign in to save prompts', 'error'); return; }
      const id = saveBtn.dataset.exploreSave; 
      if (state.prompts.some(p => p.sourceId === id)) { showToast(t('alreadyInLibrary'), 'error'); return; } 
      if (!canCreatePrompt()) { showToast(t('freeLimitReached', getEffectiveLimit()), 'error'); P.analyticsTrackLimitHit('prompts'); return; } 
      const ep = state.libraryPrompts.find(x => x.id === id); 
      if (!ep) return; 
      state.prompts.unshift({ id: crypto.randomUUID(), sourceId: id, title: ep.title, text: ep.text, description: `From ${ep.author}`, tags: ep.tags || [], folderId: null, platform: 'universal', variables: [], isFavorite: false, useCount: 0, createdAt: Date.now(), updatedAt: Date.now() }); 
      await saveData('prompts', state.prompts); 
      showToast(t('savedToLibrary'), 'success'); 
      // Analytics: track library save
      P.analyticsTrackLibrarySave(id);
      supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'rpc/increment_download_count', body: { prompt_uuid: id } }); 
      renderPrompts();
      return; 
    }
    const likeBtn = e.target.closest('[data-explore-like]');
    if (likeBtn) { 
      e.stopPropagation(); 
      if (!state.user) { showToast(t('signInToLike') || 'Sign in to like prompts', 'error'); return; }
      const id = likeBtn.dataset.exploreLike;
      if (isRateLimited('like_' + id, 1500)) return;
      try { 
        const res = await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'rpc/toggle_library_like', body: { prompt_uuid: id } }); 
        if (res?.data) { 
          const result = Array.isArray(res.data) ? res.data[0] : res.data; 
          if (result.liked) state.userLikes.add(id); 
          else state.userLikes.delete(id); 
          // Analytics: track library like
          P.analyticsTrackLibraryLike(id, result.liked);
          const lp = state.libraryPrompts.find(x => x.id === id); 
          if (lp) lp.likes = result.likes; 
          updateExploreLikeUI(id, result.liked, result.likes); 
        } 
      } catch { showToast(t('failedToLike'), 'error'); } 
      return; 
    }
    const reportBtn = e.target.closest('[data-explore-report]');
    if (reportBtn) { e.stopPropagation(); if (isRateLimited('report', 3000)) return; if (!state.userReports.has(reportBtn.dataset.exploreReport)) openReportModal(reportBtn.dataset.exploreReport); return; }
    // Card flip on click - only for touch devices (hover handles desktop)
    // On desktop: cards flip on hover (CSS handles this)
    // On mobile/touch: cards flip on tap (JS handles this)
    const wrapper = e.target.closest('.explore-card-wrapper');
    if (wrapper && !e.target.closest('button')) {
      const card = wrapper.querySelector('.explore-card');
      const id = wrapper.dataset.exploreId;
      
      // Only toggle flip class on touch devices (no hover support)
      if (!window.matchMedia('(hover: hover)').matches) {
        if (flippedCards.has(id)) { 
          card.classList.remove('flipped'); 
          flippedCards.delete(id);
        } else { 
          // First close any other flipped cards for better UX
          document.querySelectorAll('.explore-card.flipped').forEach(otherCard => {
            const otherId = otherCard.closest('.explore-card-wrapper')?.dataset.exploreId;
            if (otherId && otherId !== id) {
              otherCard.classList.remove('flipped');
              flippedCards.delete(otherId);
            }
          });
          card.classList.add('flipped'); 
          flippedCards.add(id);
        }
        e.stopPropagation();
      }
    }
  };
  
  // Lazy load images from private Supabase Storage using IntersectionObserver
  // Use large rootMargin to preload images well before they scroll into view
  const imageElements = list.querySelectorAll('.explore-card-thumbnail.needs-image-load');
  if (imageElements.length > 0 && 'IntersectionObserver' in window) {
    const imgObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          imgObserver.unobserve(el);
          const imageUrl = el.dataset.imageUrl;
          if (imageUrl) {
            resolveImageUrl(imageUrl).then(resolvedUrl => {
              if (resolvedUrl) {
                el.style.cssText = `background-image: url('${resolvedUrl}'); background-size: cover; background-position: center;`;
              }
            }).catch(() => {});
          }
        }
      });
    }, { rootMargin: '400px' });
    imageElements.forEach(el => imgObserver.observe(el));
    
    // Eagerly preload first 4 images immediately (visible without scrolling)
    const eagerLoadCount = Math.min(4, imageElements.length);
    for (let i = 0; i < eagerLoadCount; i++) {
      const el = imageElements[i];
      imgObserver.unobserve(el);
      const imageUrl = el.dataset.imageUrl;
      if (imageUrl) {
        resolveImageUrl(imageUrl).then(resolvedUrl => {
          if (resolvedUrl) {
            el.style.cssText = `background-image: url('${resolvedUrl}'); background-size: cover; background-position: center;`;
            el.classList.remove('needs-image-load');
          }
        }).catch(() => {});
      }
    }
  } else {
    imageElements.forEach(async (el) => {
      const imageUrl = el.dataset.imageUrl;
      if (imageUrl) {
        try {
          const resolvedUrl = await resolveImageUrl(imageUrl);
          if (resolvedUrl) {
            el.style.cssText = `background-image: url('${resolvedUrl}'); background-size: cover; background-position: center;`;
          }
        } catch (e) { /* silent */ }
      }
    });
  }
  
  // Add "Load More" button for pagination
  if (_libraryHasMore) {
    const loadMoreContainer = document.createElement('div');
    loadMoreContainer.className = 'explore-load-more';
    loadMoreContainer.innerHTML = `<button class="btn btn-secondary btn-sm ripple" id="explore-load-more-btn">${_libraryLoading ? (t('loading') || 'Loading...') : (t('loadMore') || 'Load More')}</button>`;
    list.appendChild(loadMoreContainer);

    document.getElementById('explore-load-more-btn')?.addEventListener('click', () => {
      if (!_libraryLoading) {
        _libraryPage++;
        loadLibraryPrompts(true);
      }
    });
  }
}


function updateExploreLikeUI(promptId, liked, likes) {
  const wrapper = document.querySelector(`.explore-card-wrapper[data-explore-id="${promptId}"]`);
  if (!wrapper) return;
  const likeBtn = wrapper.querySelector('[data-explore-like]');
  const countEl = wrapper.querySelector(`[data-like-count="${promptId}"]`);
  if (likeBtn) {
    likeBtn.classList.toggle('liked', !!liked);
    const icon = likeBtn.querySelector('svg');
    if (icon) icon.setAttribute('fill', liked ? 'currentColor' : 'none');
  }
  if (countEl) countEl.textContent = String(likes ?? 0);
}

function updateExploreReportUI(promptId) {
  const wrapper = document.querySelector(`.explore-card-wrapper[data-explore-id="${promptId}"]`);
  if (!wrapper) return;
  const reportBtn = wrapper.querySelector('[data-explore-report]');
  if (!reportBtn) return;
  reportBtn.classList.add('reported');
  reportBtn.setAttribute('disabled', 'true');
  reportBtn.setAttribute('title', t('reported'));
}

// ==================== REPORT MODAL ====================
function openReportModal(promptId) {
  const reasons = [t('reportInappropriate'), t('reportSpam'), t('reportNSFW'), t('reportCopyright'), t('reportLowQuality'), t('reportOther')];
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'report-modal';
  modal.innerHTML = `
    <div class="modal"><div class="modal-header"><h2 class="modal-title">${t('reportPrompt')}</h2><button class="btn btn-icon btn-ghost close-modal-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="modal-body"><div class="form-group"><label class="form-label">${t('reasonForReporting')}</label><div class="report-reasons">${reasons.map((r, i) => `<label class="report-reason-option ${i === 0 ? 'selected' : ''}" data-reason="${escapeHtml(r)}"><input type="radio" name="report-reason" value="${escapeHtml(r)}" ${i === 0 ? 'checked' : ''}><span class="report-reason-label">${escapeHtml(r)}</span></label>`).join('')}</div></div><div class="form-group"><label class="form-label">${t('additionalDetails')}</label><textarea id="report-details" rows="3" placeholder="${t('provideMoreContext')}"></textarea></div></div>
      <div class="modal-footer"><button class="btn btn-ghost close-modal-btn">${t('cancel')}</button><button class="btn btn-danger ripple" id="report-submit-btn">${t('submitReport')}</button></div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);
  modal.querySelectorAll('.report-reason-option').forEach(opt => {
    opt.addEventListener('click', () => { modal.querySelectorAll('.report-reason-option').forEach(o => o.classList.remove('selected')); opt.classList.add('selected'); opt.querySelector('input').checked = true; });
  });
  document.getElementById('report-submit-btn').addEventListener('click', async () => {
    if (isRateLimited('report_submit', 5000)) return;
    const reason = modal.querySelector('input[name="report-reason"]:checked')?.value;
    const details = document.getElementById('report-details')?.value.trim();
    if (!reason) return;
    const btn = document.getElementById('report-submit-btn');
    btn.classList.add('loading');
    try {
      const res = await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'prompt_reports', body: { user_id: state.user.id, prompt_id: promptId, reason, details: details || null } });
      if (res?.error) {
        const errorMsg = parseSupabaseError(res.error);
        console.error('Report error:', errorMsg);
        throw new Error(errorMsg);
      }
      state.userReports.add(promptId);
      updateExploreReportUI(promptId);
      showToast(t('reportSubmitted'), 'success');
      closeModal('report-modal');
    } catch (e) {
      const errorMsg = e.message || String(e);
      console.error('Report submission failed:', errorMsg);
      if (errorMsg.includes('duplicate') || errorMsg.includes('23505')) { 
        showToast(t('alreadyReported'), 'error'); 
        state.userReports.add(promptId); 
        updateExploreReportUI(promptId); 
      } else if (errorMsg.includes('not authenticated') || errorMsg.includes('jwt') || errorMsg.includes('401')) {
        showToast(t('signInRequired') || 'Please sign in to report', 'error');
      } else if (errorMsg.includes('permission') || errorMsg.includes('RLS') || errorMsg.includes('policy')) {
        showToast(t('permissionDenied') || 'Permission denied. Please try again.', 'error');
      } else {
        // Show specific error message to user
        showToast(`${t('failedToReport')}: ${truncate(errorMsg, 100)}`, 'error');
      }
    }
    btn.classList.remove('loading');
  });
  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => closeModal('report-modal')));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal('report-modal'); });
}

// ==================== STATISTICS ====================
function renderStats() {
  const container = document.getElementById('stats-content');
  if (!container) return;
  
  // Show skeleton if prompts haven't loaded yet
  if (state.prompts.length === 0 && !_initRenderDone) {
    container.innerHTML = `<div class="stats-dashboard">
      <div class="skeleton-stats-overview"><div class="skeleton skeleton-stat-card"></div><div class="skeleton skeleton-stat-card"></div><div class="skeleton skeleton-stat-card"></div></div>
      <div class="skeleton skeleton-chart"></div>
      <div class="skeleton skeleton-list-item"></div><div class="skeleton skeleton-list-item"></div><div class="skeleton skeleton-list-item"></div>
    </div>`;
    return;
  }

  const totalPrompts = state.prompts.length;
  const totalUses = state.prompts.reduce((s, p) => s + (p.useCount || 0), 0);
  const totalFavorites = state.prompts.filter(p => p.isFavorite).length;
  const topPrompts = [...state.prompts].sort((a, b) => (b.useCount || 0) - (a.useCount || 0)).slice(0, 5).filter(p => (p.useCount || 0) > 0);
  const tagMap = {};
  state.prompts.forEach(p => (p.tags || []).forEach(tg => { tagMap[tg] = (tagMap[tg] || 0) + 1; }));
  const topTags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const now = Date.now();
  const dayMs = 86400000;
  const dailyUses = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - (i + 1) * dayMs;
    const dayEnd = now - i * dayMs;
    const dayLabel = new Date(dayEnd).toLocaleDateString(P.getLang() === 'ru' ? 'ru' : 'en', { weekday: 'short' });
    const count = state.prompts.reduce((s, p) => { if (p.updatedAt && p.updatedAt >= dayStart && p.updatedAt < dayEnd && (p.useCount || 0) > 0) return s + 1; return s; }, 0);
    dailyUses.push({ label: dayLabel, count });
  }
  const maxDaily = Math.max(...dailyUses.map(d => d.count), 1);
  const platformMap = {};
  state.prompts.forEach(p => { const pl = p.platform || 'universal'; platformMap[pl] = (platformMap[pl] || 0) + (p.useCount || 0); });
  const platforms = Object.entries(platformMap).sort((a, b) => b[1] - a[1]);
  const maxPlatform = Math.max(...platforms.map(p => p[1]), 1);

  container.innerHTML = `<div class="stats-dashboard">
    <div class="stats-overview"><div class="stat-card" style="animation:floatUp 400ms var(--ease-out-expo) forwards;animation-delay:0ms;"><div class="stat-card-value">${totalPrompts}</div><div class="stat-card-label">${t('totalPrompts')}</div></div><div class="stat-card" style="animation:floatUp 400ms var(--ease-out-expo) forwards;animation-delay:80ms;opacity:0;"><div class="stat-card-value">${totalUses}</div><div class="stat-card-label">${t('totalUses')}</div></div><div class="stat-card" style="animation:floatUp 400ms var(--ease-out-expo) forwards;animation-delay:160ms;opacity:0;"><div class="stat-card-value">${totalFavorites}</div><div class="stat-card-label">${t('favoritesCount')}</div></div></div>
    <div class="stats-section"><div class="stats-section-title">${t('activityLast7Days')}</div><div class="usage-chart">${dailyUses.map(d => `<div class="chart-bar-wrap"><div class="chart-bar" style="height:${Math.max((d.count / maxDaily) * 80, 2)}px;" title="${d.count}"></div><div class="chart-bar-label">${d.label}</div></div>`).join('')}</div></div>
    <div class="stats-section"><div class="stats-section-title">${t('mostUsedPrompts')}</div>${topPrompts.length > 0 ? topPrompts.map((p, i) => `<div class="top-prompt-item"><span class="top-prompt-rank">${i + 1}</span><span class="top-prompt-name">${escapeHtml(truncate(p.title, 30))}</span><span class="top-prompt-uses">${p.useCount} ${t('uses')}</span></div>`).join('') : `<div style="font-size:var(--font-size-xs);color:var(--text-tertiary);padding:8px 0;">${t('noUsageData')}</div>`}</div>
    ${platforms.length > 0 ? `<div class="stats-section"><div class="stats-section-title">${t('usageByPlatform')}</div><div class="platform-stats">${platforms.map(([name, count]) => `<div class="platform-stat-row"><span class="platform-stat-name">${escapeHtml(name)}</span><div class="platform-stat-bar-bg"><div class="platform-stat-bar" style="width:${(count / maxPlatform) * 100}%;"></div></div><span class="platform-stat-count">${count}</span></div>`).join('')}</div></div>` : ''}
    ${topTags.length > 0 ? `<div class="stats-section"><div class="stats-section-title">${t('topTags')}</div><div class="tags" style="flex-wrap:wrap;">${topTags.map(([tag, count]) => `<span class="tag">#${escapeHtml(tag)} (${count})</span>`).join('')}</div></div>` : ''}
    ${!state.isPremium ? `<div class="stats-section" style="border-color:rgba(var(--accent-rgb),0.3);"><div class="stats-section-title">${state.user ? t('freePlan') : (t('guestPlan') || 'Guest Plan')}</div><div style="font-size:var(--font-size-sm);color:var(--text-secondary);line-height:1.6;">${t('promptsUsed', state.prompts.length, getEffectiveLimit())}<div style="margin-top:8px;height:6px;background:var(--bg-tertiary);border-radius:var(--radius-full);overflow:hidden;"><div style="height:100%;width:${Math.min((state.prompts.length / getEffectiveLimit()) * 100, 100)}%;background:${state.prompts.length >= getEffectiveLimit() ? 'var(--error)' : 'var(--accent-gradient)'};border-radius:var(--radius-full);transition:width 500ms var(--ease-out-expo);"></div></div><div style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-top:8px;">${state.user ? t('upgradeInfo') : (t('signInForMoreInfo') || 'Sign in with Google for 100 prompts, or upgrade to Pro for unlimited.')}</div></div></div>` : ''}
  </div>`;
}

// ==================== SETTINGS (delegated to modules/settings.js) ====================
function openSettings() {
  P.openSettingsModal({
    renderExplore,
    renderPrompts,
    renderFolders,
    renderFavorites,
    renderLimitBanner,
    syncAllData,
    loadLibraryPrompts,
    checkPremiumStatus,
    showUpgradeModal,
    loadAdminDashboard,
    loadPendingReports,
    renderModerationPanel,
    parseCSVLine,
    setSuppressRender: (v) => { _suppressStorageRender = v; },
    updateStaticTexts,
    FREE_PROMPT_LIMIT,
    SETTINGS_PROMPT_SELECT_LIMIT
  });
}
// ==================== PREMIUM STATUS ====================
async function checkPremiumStatus() {
  if (!state.session || !state.user) return;
  try {
    // Use sync_user_on_login RPC for reliable premium status
    const syncRes = await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'rpc/sync_user_on_login', body: {} });
    if (syncRes?.data) {
      const syncData = Array.isArray(syncRes.data) ? syncRes.data[0] : syncRes.data;
      if (syncData && syncData.success !== false) {
        state.isPremium = syncData.is_premium || false;
        state.promptLimit = syncData.prompt_limit || FREE_PROMPT_LIMIT;
        await saveData('isPremium', state.isPremium);
        await saveData('promptLimit', state.promptLimit);
        console.log('✅ Premium status checked:', state.isPremium, 'Limit:', state.promptLimit);
      }
    }
    // Fetch is_admin status separately (not in sync_user_on_login)
    const profileRes = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: `profiles?id=eq.${state.user.id}&select=is_admin` });
    if (profileRes?.data?.[0]) {
      state.isAdmin = profileRes.data[0].is_admin || false;
      console.log('✅ Admin status:', state.isAdmin, 'Email:', state.user?.email);
      console.log('📋 Full profile data:', profileRes.data[0]);
    } else {
      console.warn('⚠️ No profile data found for user:', state.user?.id);
      console.warn('⚠️ Profile response:', profileRes);
    }
  } catch (e) { /* silent */ }
}

// ==================== ADMIN MODERATION ====================
async function loadPendingReports() {
  if (!state.session || !state.user || !state.isAdmin) return;
  try {
    const res = await supabaseMsg({
      action: 'supabaseRequest',
      method: 'GET',
      path: 'prompt_reports?status=eq.pending&select=id,prompt_id,user_id,reason,details,created_at,library_prompts(id,title,text,author,author_id,category,likes,is_approved)&order=created_at.desc&limit=50'
    });
    if (res?.data && Array.isArray(res.data)) {
      state.pendingReports = res.data.filter(r => r.library_prompts); // Only reports with valid prompts
      console.log('📋 Loaded', state.pendingReports.length, 'pending reports');
    }
  } catch (e) {
    console.error('Failed to load reports:', e);
  }
}

async function moderateReport(reportId, action, promptId) {
  if (!state.session || !state.user || !state.isAdmin) {
    showToast(t('notAdmin'), 'error');
    return;
  }
  
  try {
    if (action === 'dismiss') {
      // Mark report as dismissed
      await supabaseMsg({
        action: 'supabaseRequest',
        method: 'PATCH',
        path: `prompt_reports?id=eq.${reportId}`,
        body: { status: 'dismissed', reviewed_at: new Date().toISOString(), reviewed_by: state.user.id }
      });
      showToast(t('reportDismissed'), 'success');
    } else if (action === 'hide') {
      // Hide prompt from library and mark report as actioned
      await supabaseMsg({
        action: 'supabaseRequest',
        method: 'PATCH',
        path: `library_prompts?id=eq.${promptId}`,
        body: { is_approved: false }
      });
      await supabaseMsg({
        action: 'supabaseRequest',
        method: 'PATCH',
        path: `prompt_reports?id=eq.${reportId}`,
        body: { status: 'actioned', reviewed_at: new Date().toISOString(), reviewed_by: state.user.id }
      });
      showToast(t('promptHidden'), 'success');
    } else if (action === 'delete') {
      // Delete prompt from library and mark report as actioned
      await supabaseMsg({
        action: 'supabaseRequest',
        method: 'DELETE',
        path: `library_prompts?id=eq.${promptId}`
      });
      await supabaseMsg({
        action: 'supabaseRequest',
        method: 'PATCH',
        path: `prompt_reports?prompt_id=eq.${promptId}`,
        body: { status: 'actioned', reviewed_at: new Date().toISOString(), reviewed_by: state.user.id }
      });
      showToast(t('promptDeletedFromLibrary'), 'success');
    } else if (action === 'approve') {
      // Keep prompt visible and dismiss all reports for it
      await supabaseMsg({
        action: 'supabaseRequest',
        method: 'PATCH',
        path: `prompt_reports?prompt_id=eq.${promptId}`,
        body: { status: 'dismissed', reviewed_at: new Date().toISOString(), reviewed_by: state.user.id }
      });
      showToast(t('reportDismissed'), 'success');
    }
    
    // Refresh reports list
    await loadPendingReports();
    renderModerationPanel();
    // Refresh library if we modified prompts
    if (action === 'hide' || action === 'delete') {
      loadLibraryPrompts();
    }
  } catch (e) {
    console.error('Moderation action failed:', e);
    showToast(t('failedToReport'), 'error');
  }
}

function renderModerationPanel() {
  const container = document.getElementById('moderation-panel-container');
  if (!container) return;
  
  if (!state.isAdmin) {
    container.innerHTML = '';
    return;
  }
  
  const reports = state.pendingReports || [];
  
  container.innerHTML = `
    <div class="moderation-panel">
      <div class="moderation-header">
        <div class="moderation-header-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          ${t('moderationPanel')}
          ${reports.length > 0 ? `<span class="moderation-badge">${reports.length}</span>` : ''}
        </div>
        <button class="btn btn-sm btn-ghost" id="refresh-reports-btn" title="${t('refreshReports')}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>
      <div class="moderation-list" id="moderation-list">
        ${reports.length === 0 ? `
          <div class="moderation-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
            <div>${t('noReportsFound')}</div>
          </div>
        ` : reports.map(r => {
          const prompt = r.library_prompts;
          return `
            <div class="moderation-item" data-report-id="${r.id}" data-prompt-id="${r.prompt_id}">
              <div class="moderation-prompt-title">${escapeHtml(truncate(prompt.title, 50))}</div>
              <div class="moderation-prompt-text">${escapeHtml(truncate(prompt.text, 200))}</div>
              <div class="moderation-report-info">
                <span class="moderation-tag reason">${escapeHtml(r.reason)}</span>
                <span class="moderation-tag author">${t('promptAuthor')}: ${escapeHtml(prompt.author || 'Unknown')}</span>
                <span class="moderation-tag">${t('promptCategory')}: ${escapeHtml(prompt.category || 'general')}</span>
                <span class="moderation-tag">${prompt.likes || 0} ${t('likes')}</span>
              </div>
              ${r.details ? `<div class="moderation-details">"${escapeHtml(truncate(r.details, 150))}"</div>` : ''}
              <div class="moderation-actions">
                <button class="btn btn-sm btn-approve" data-mod-action="approve" data-report-id="${r.id}" data-prompt-id="${r.prompt_id}">${t('approvePrompt')}</button>
                <button class="btn btn-sm btn-secondary" data-mod-action="dismiss" data-report-id="${r.id}">${t('dismissReport')}</button>
                <button class="btn btn-sm btn-hide" data-mod-action="hide" data-report-id="${r.id}" data-prompt-id="${r.prompt_id}">${t('hidePrompt')}</button>
                <button class="btn btn-sm btn-delete" data-mod-action="delete" data-report-id="${r.id}" data-prompt-id="${r.prompt_id}">${t('deleteFromLibrary')}</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  
  // Event listeners
  document.getElementById('refresh-reports-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refresh-reports-btn');
    btn.classList.add('loading');
    await loadPendingReports();
    renderModerationPanel();
    btn.classList.remove('loading');
  });
  
  container.querySelectorAll('[data-mod-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = btn.dataset.modAction;
      const reportId = btn.dataset.reportId;
      const promptId = btn.dataset.promptId;
      btn.classList.add('loading');
      await moderateReport(reportId, action, promptId);
      btn.classList.remove('loading');
    });
  });
}

// ==================== ADMIN ANALYTICS DASHBOARD ====================
async function loadAdminDashboard(daysBack = 30) {
  if (!state.session || !state.user || !state.isAdmin) return;
  
  const container = document.getElementById('admin-dashboard-container');
  if (!container) return;
  
  container.innerHTML = `<div class="admin-dashboard-loading"><div class="skeleton skeleton-stat-card"></div><div class="skeleton skeleton-chart"></div></div>`;
  
  try {
    // Try get_admin_stats first (full global admin stats)
    let res = await supabaseMsg({
      action: 'supabaseRequest',
      method: 'POST',
      path: 'rpc/get_admin_stats',
      body: { days_back: daysBack }
    });
    
    let isAdminStats = true;
    let data = null;
    
    // If get_admin_stats not found (PGRST202), fallback to get_usage_stats (per-user)
    if (res?.error) {
      const errStr = parseSupabaseError(res.error);
      const isMissing = errStr.includes('PGRST202') || errStr.includes('Could not find') || errStr.includes('schema cache');
      
      if (isMissing) {
        console.warn('get_admin_stats not found, falling back to get_usage_stats');
        isAdminStats = false;
        res = await supabaseMsg({
          action: 'supabaseRequest',
          method: 'POST',
          path: 'rpc/get_usage_stats',
          body: { days_back: daysBack }
        });
        
        if (res?.error) {
          container.innerHTML = `<div style="color:var(--error);font-size:var(--font-size-sm);padding:12px;">${t('adminDashboardError')}: ${escapeHtml(parseSupabaseError(res.error))}</div>`;
          return;
        }
      } else {
        container.innerHTML = `<div style="color:var(--error);font-size:var(--font-size-sm);padding:12px;">${t('adminDashboardError')}: ${escapeHtml(errStr)}</div>`;
        return;
      }
    }
    
    data = res?.data;
    if (!data || data.error) {
      container.innerHTML = `<div style="color:var(--error);font-size:var(--font-size-sm);padding:12px;">${data?.error || t('adminDashboardError')}</div>`;
      return;
    }
    
    // Migration notice if using fallback
    const migrationNotice = !isAdminStats ? `
      <div class="admin-dash-notice" style="background:var(--warning-bg, rgba(255,193,7,0.12));border:1px solid var(--warning, #ffc107);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:12px;font-size:var(--font-size-xs);color:var(--text-secondary);">
        <strong>&#9888; ${t('adminMigrationNeeded')}</strong><br>
        ${t('adminMigrationHint')}
      </div>` : '';
    
    // Build dashboard HTML — adapt to whichever RPC returned data
    if (isAdminStats) {
      // Full admin stats from get_admin_stats
      const dailyUsage = data.daily_usage || [];
      const maxDaily = Math.max(...dailyUsage.map(d => d.count), 1);
      const topPrompts = data.top_prompts_global || [];
      const platformStats = data.platform_stats || [];
      const maxPlatform = Math.max(...platformStats.map(p => p.count), 1);
      const topLibrary = data.top_library_prompts || [];
      
      container.innerHTML = `
        <div class="admin-dashboard">
          <div class="admin-dash-period">
            <select id="admin-dash-period-select" style="font-size:var(--font-size-xs);padding:4px 8px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);">
              <option value="7" ${daysBack === 7 ? 'selected' : ''}>7 ${t('days')}</option>
              <option value="30" ${daysBack === 30 ? 'selected' : ''}>30 ${t('days')}</option>
              <option value="90" ${daysBack === 90 ? 'selected' : ''}>90 ${t('days')}</option>
            </select>
          </div>
          
          <div class="admin-dash-overview">
            <div class="admin-dash-stat"><div class="admin-dash-stat-value">${data.total_users || 0}</div><div class="admin-dash-stat-label">${t('adminTotalUsers')}</div></div>
            <div class="admin-dash-stat"><div class="admin-dash-stat-value">${data.premium_users || 0}</div><div class="admin-dash-stat-label">${t('adminPremiumUsers')}</div></div>
            <div class="admin-dash-stat"><div class="admin-dash-stat-value">${data.unique_active_users || 0}</div><div class="admin-dash-stat-label">${t('adminActiveUsers')}</div></div>
            <div class="admin-dash-stat"><div class="admin-dash-stat-value">${data.total_uses || 0}</div><div class="admin-dash-stat-label">${t('adminTotalInserts')}</div></div>
          </div>
          
          <div class="admin-dash-overview">
            <div class="admin-dash-stat"><div class="admin-dash-stat-value">${data.total_prompts || 0}</div><div class="admin-dash-stat-label">${t('adminUserPrompts')}</div></div>
            <div class="admin-dash-stat"><div class="admin-dash-stat-value">${data.total_library_approved || 0}/${data.total_library_prompts || 0}</div><div class="admin-dash-stat-label">${t('adminLibraryPrompts')}</div></div>
            <div class="admin-dash-stat"><div class="admin-dash-stat-value">${data.total_reports_pending || 0}</div><div class="admin-dash-stat-label">${t('adminPendingReports')}</div></div>
          </div>
          
          ${dailyUsage.length > 0 ? `
          <div class="admin-dash-section">
            <div class="admin-dash-section-title">${t('adminDailyUsage')}</div>
            <div class="usage-chart">${dailyUsage.slice(0, 14).reverse().map(d => {
              const pct = Math.max((d.count / maxDaily) * 80, 2);
              const dateStr = new Date(d.date).toLocaleDateString(P.getLang() === 'ru' ? 'ru' : 'en', { month: 'short', day: 'numeric' });
              return `<div class="chart-bar-wrap"><div class="chart-bar" style="height:${pct}px;" title="${d.count} uses / ${d.unique_users} users"></div><div class="chart-bar-label">${dateStr}</div></div>`;
            }).join('')}</div>
          </div>` : ''}
          
          ${topPrompts.length > 0 ? `
          <div class="admin-dash-section">
            <div class="admin-dash-section-title">${t('adminTopPrompts')}</div>
            ${topPrompts.slice(0, 5).map((p, i) => `
              <div class="top-prompt-item"><span class="top-prompt-rank">${i + 1}</span><span class="top-prompt-name">${escapeHtml(truncate(p.title, 30))}</span><span class="top-prompt-uses">${p.uses} (${p.unique_users} ${t('adminUsers')})</span></div>
            `).join('')}
          </div>` : ''}
          
          ${platformStats.length > 0 ? `
          <div class="admin-dash-section">
            <div class="admin-dash-section-title">${t('usageByPlatform')}</div>
            <div class="platform-stats">${platformStats.map(p => `<div class="platform-stat-row"><span class="platform-stat-name">${escapeHtml(p.platform)}</span><div class="platform-stat-bar-bg"><div class="platform-stat-bar" style="width:${(p.count / maxPlatform) * 100}%;"></div></div><span class="platform-stat-count">${p.count}</span></div>`).join('')}</div>
          </div>` : ''}
          
          ${topLibrary.length > 0 ? `
          <div class="admin-dash-section">
            <div class="admin-dash-section-title">${t('adminTopLibrary')}</div>
            ${topLibrary.slice(0, 5).map((p, i) => `
              <div class="top-prompt-item"><span class="top-prompt-rank">${i + 1}</span><span class="top-prompt-name">${escapeHtml(truncate(p.title, 25))}</span><span class="top-prompt-uses">${p.likes || 0} likes</span></div>
            `).join('')}
          </div>` : ''}
        </div>
      `;
    } else {
      // Fallback: get_usage_stats (per-user stats only)
      const dailyStats = data.daily_stats || [];
      const maxDaily = Math.max(...dailyStats.map(d => d.count), 1);
      const topPrompts = data.top_prompts || [];
      const platformStats = data.by_platform || [];
      const maxPlatform = Math.max(...platformStats.map(p => p.count), 1);
      
      container.innerHTML = `
        <div class="admin-dashboard">
          ${migrationNotice}
          <div class="admin-dash-period">
            <select id="admin-dash-period-select" style="font-size:var(--font-size-xs);padding:4px 8px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);">
              <option value="7" ${daysBack === 7 ? 'selected' : ''}>7 ${t('days')}</option>
              <option value="30" ${daysBack === 30 ? 'selected' : ''}>30 ${t('days')}</option>
              <option value="90" ${daysBack === 90 ? 'selected' : ''}>90 ${t('days')}</option>
            </select>
          </div>
          
          <div class="admin-dash-overview">
            <div class="admin-dash-stat"><div class="admin-dash-stat-value">${data.total_uses || 0}</div><div class="admin-dash-stat-label">${t('adminTotalInserts')}</div></div>
          </div>
          
          ${dailyStats.length > 0 ? `
          <div class="admin-dash-section">
            <div class="admin-dash-section-title">${t('adminDailyUsage')}</div>
            <div class="usage-chart">${dailyStats.slice(0, 14).reverse().map(d => {
              const pct = Math.max((d.count / maxDaily) * 80, 2);
              const dateStr = new Date(d.date).toLocaleDateString(P.getLang() === 'ru' ? 'ru' : 'en', { month: 'short', day: 'numeric' });
              return `<div class="chart-bar-wrap"><div class="chart-bar" style="height:${pct}px;" title="${d.count} uses"></div><div class="chart-bar-label">${dateStr}</div></div>`;
            }).join('')}</div>
          </div>` : ''}
          
          ${topPrompts.length > 0 ? `
          <div class="admin-dash-section">
            <div class="admin-dash-section-title">${t('adminTopPrompts')}</div>
            ${topPrompts.slice(0, 5).map((p, i) => `
              <div class="top-prompt-item"><span class="top-prompt-rank">${i + 1}</span><span class="top-prompt-name">${escapeHtml(truncate(p.title, 30))}</span><span class="top-prompt-uses">${p.uses}</span></div>
            `).join('')}
          </div>` : ''}
          
          ${platformStats.length > 0 ? `
          <div class="admin-dash-section">
            <div class="admin-dash-section-title">${t('usageByPlatform')}</div>
            <div class="platform-stats">${platformStats.map(p => `<div class="platform-stat-row"><span class="platform-stat-name">${escapeHtml(p.platform)}</span><div class="platform-stat-bar-bg"><div class="platform-stat-bar" style="width:${(p.count / maxPlatform) * 100}%;"></div></div><span class="platform-stat-count">${p.count}</span></div>`).join('')}</div>
          </div>` : ''}
        </div>
      `;
    }
    
    // Period selector listener
    document.getElementById('admin-dash-period-select')?.addEventListener('change', (e) => {
      loadAdminDashboard(parseInt(e.target.value));
    });
    
  } catch (e) {
    console.error('Admin dashboard error:', e);
    container.innerHTML = `<div style="color:var(--error);font-size:var(--font-size-sm);padding:12px;">${t('adminDashboardError')}</div>`;
  }
}

// ==================== SEARCH (optimized) ====================
function initSearch() {
  const input = document.getElementById('search-input');
  let searchCache = null; // Cache lowercase versions for faster search
  let lastQuery = '';
  let hasSwitchedToPrompts = false; // Track if we've already switched to Prompts tab

  const debouncedSearch = debounce((q) => {
    if (q === lastQuery) return; // Skip if query hasn't changed
    lastQuery = q;

    // If typing and not on Prompts tab, switch to Prompts tab
    if (q.length > 0 && !hasSwitchedToPrompts) {
      const promptsTab = document.querySelector('[data-tab="prompts"]');
      if (promptsTab) {
        promptsTab.click();
        hasSwitchedToPrompts = true;
      }
    }

    // Reset flag when search is cleared (allow switching again next time)
    if (q.length === 0 && hasSwitchedToPrompts) {
      hasSwitchedToPrompts = false;
    }

    if (!q) {
      if (state.searchOriginalPrompts) { state.prompts = state.searchOriginalPrompts; state.searchOriginalPrompts = null; searchCache = null; }
      renderPrompts();
      return;
    }
    if (!state.searchOriginalPrompts) {
      state.searchOriginalPrompts = [...state.prompts];
      // Pre-compute lowercase search fields once (major perf win for large lists)
      searchCache = state.searchOriginalPrompts.map(p => ({
        prompt: p,
        title: p.title.toLowerCase(),
        desc: (p.description || '').toLowerCase(),
        tags: (p.tags || []).map(tg => tg.toLowerCase()),
        text: p.text.substring(0, 500).toLowerCase() // Only search first 500 chars of text
      }));
    }

    // Split query into tokens for multi-word search
    const tokens = q.split(/\s+/).filter(Boolean);

    // Use cached lowercase fields for faster filtering
    const filtered = searchCache.filter(c =>
      tokens.every(token =>
        c.title.includes(token) || c.desc.includes(token) ||
        c.tags.some(tg => tg.includes(token)) || c.text.includes(token)
      )
    );
    state.prompts = filtered.map(c => c.prompt);
    renderPrompts();
    // Analytics: track search
    P.analyticsTrackSearch(q, state.prompts.length);
    if (state.prompts.length === 0) {
      document.getElementById('prompts-list').innerHTML = `<div class="empty-state"><div class="empty-state-title">${t('noPromptsFound')}</div></div>`;
    }
  }, 150); // Faster debounce for snappy feel

  input.addEventListener('input', () => debouncedSearch(input.value.trim().toLowerCase()));
}

function generateUniqueCheckoutUrl(baseUrl, userEmail, userId) {
  // LemonSqueezy checkout URL format:
  // Base URL should be like: https://store.lemonsqueezy.com/buy/<variant_id>
  // Or: https://store.lemonsqueezy.com/checkout/buy/<variant_id>
  const params = new URLSearchParams();
  
  if (userEmail) {
    params.set('checkout[email]', userEmail);
  }
  
  if (userId) {
    params.set('checkout[custom][user_id]', userId);
  }
  
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${params.toString()}`;
}

// ==================== UPGRADE MODAL ====================
function showUpgradeModal() {
  // Analytics: track upgrade modal open
  P.analyticsTrackUpgradeModalOpen();
  const hasCheckoutUrl = CONFIG.LEMONSQUEEZY_CHECKOUT_URL && CONFIG.LEMONSQUEEZY_CHECKOUT_URL.length > 0;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'upgrade-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width:460px;">
      <div class="modal-header"><h2 class="modal-title">${t('upgradeToPremium')}</h2><button class="btn btn-icon btn-ghost close-modal-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="modal-body">
        <div class="upgrade-hero-compact">
          <div class="upgrade-star-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div class="upgrade-hero-text">
            <div class="upgrade-hero-title">${t('unlockPremium')}</div>
            <div class="upgrade-hero-subtitle">${t('proSubtitleShort')}</div>
          </div>
        </div>
        <div class="upgrade-features-list">
          <div class="upgrade-feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>${t('premiumFeature1')}</span></div>
          <div class="upgrade-feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>${t('premiumFeature2')}</span></div>
          <div class="upgrade-feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>${t('premiumFeature3')}</span></div>
          <div class="upgrade-feature-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>${t('premiumFeature4')}</span></div>
        </div>
        ${hasCheckoutUrl ? `
        <!-- Pricing Plans -->
        <div class="upgrade-pricing" style="display:flex;flex-direction:column;gap:8px;margin:16px 0;">
          <div class="upgrade-plan" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;" data-plan="monthly">
            <div><div style="font-weight:600;font-size:14px;">${t('planMonthly') || 'Monthly'}</div><div style="font-size:12px;color:var(--text-tertiary);">${t('planMonthlyDesc') || 'Billed monthly'}</div></div>
            <div style="font-weight:700;font-size:18px;color:var(--accent);">$${CONFIG.PRICE_MONTHLY}</div>
          </div>
          <div class="upgrade-plan" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg-secondary);border:2px solid var(--accent);border-radius:var(--radius-md);cursor:pointer;position:relative;" data-plan="yearly">
            <div style="position:absolute;top:-8px;right:12px;background:var(--accent);color:white;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;">${t('bestValue') || 'BEST VALUE'}</div>
            <div><div style="font-weight:600;font-size:14px;">${t('planYearly') || 'Yearly'}</div><div style="font-size:12px;color:var(--text-tertiary);">${t('planYearlyDesc') || '$2.08/month'}</div></div>
            <div style="font-weight:700;font-size:18px;color:var(--accent);">$${CONFIG.PRICE_YEARLY}</div>
          </div>
          <div class="upgrade-plan" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;" data-plan="lifetime">
            <div><div style="font-weight:600;font-size:14px;">${t('planLifetime') || 'Lifetime'}</div><div style="font-size:12px;color:var(--text-tertiary);">${t('planLifetimeDesc') || 'One-time payment'}</div></div>
            <div style="font-weight:700;font-size:18px;color:var(--accent);">$${CONFIG.PRICE_LIFETIME}</div>
          </div>
        </div>
        <button class="btn btn-primary btn-lg ripple upgrade-cta-btn" id="upgrade-buy-btn" style="width:100%;justify-content:center;gap:6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          ${t('upgradeToPro')}
        </button>` : `
        <div class="upgrade-early-access">
          <div class="upgrade-ea-badge">${t('earlyAccess')}</div>
          <div class="upgrade-ea-text">${t('premiumNote')}</div>
          <button class="btn btn-primary ripple" id="upgrade-contact-btn" style="width:100%;justify-content:center;gap:6px;margin-top:12px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-16.5 7.5a2.25 2.25 0 0 0 .126 4.133l3.978 1.326 1.518 4.854a1.5 1.5 0 0 0 2.565.535l2.012-2.324 3.845 2.884a2.25 2.25 0 0 0 3.503-1.193l3.75-16.5a2.25 2.25 0 0 0-2.775-2.43z"/></svg>
            ${t('contactForPremium')}
          </button>
        </div>`}
        ${state.isPremium && CONFIG.LEMONSQUEEZY_CUSTOMER_PORTAL ? `
        <button class="btn btn-secondary ripple" id="upgrade-manage-btn" style="width:100%;justify-content:center;gap:6px;margin-top:8px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          ${t('manageSubscription')}
        </button>` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost close-modal-btn">${t('cancel')}</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);
  
  // Plan selection highlighting
  let selectedPlan = 'yearly'; // Default to best value
  const plans = modal.querySelectorAll('.upgrade-plan');
  plans.forEach(plan => {
    plan.addEventListener('click', () => {
      selectedPlan = plan.dataset.plan;
      plans.forEach(p => {
        p.style.borderColor = p.dataset.plan === selectedPlan ? 'var(--accent)' : 'var(--border)';
        p.style.borderWidth = p.dataset.plan === selectedPlan ? '2px' : '1px';
      });
    });
  });
  
  // LemonSqueezy checkout
  document.getElementById('upgrade-buy-btn')?.addEventListener('click', () => {
    const checkoutUrl = generateUniqueCheckoutUrl(
      CONFIG.LEMONSQUEEZY_CHECKOUT_URL,
      state.user?.email,
      state.user?.id
    );
    
    console.log('🛒 Opening checkout:', checkoutUrl, 'Plan:', selectedPlan);
    // Analytics: track checkout click
    P.analyticsTrackCheckoutClick();
    P.analyticsTrackProUpgradeClicked(selectedPlan);
    window.open(checkoutUrl, '_blank');
  });
  
  // Manage subscription portal
  document.getElementById('upgrade-manage-btn')?.addEventListener('click', () => {
    window.open(CONFIG.LEMONSQUEEZY_CUSTOMER_PORTAL, '_blank');
  });
  
  // Contact for premium (early access)
  document.getElementById('upgrade-contact-btn')?.addEventListener('click', () => {
    window.open('https://t.me/user_Alexander', '_blank');
    closeModal('upgrade-modal');
  });
  
  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => closeModal('upgrade-modal')));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal('upgrade-modal'); });
}

// closeModal is aliased from P.closeModal (modules/utils.js)

// ==================== HOTKEY SETTINGS SYNC (delegated to modules/settings.js) ====================
const syncHotkeysToSupabase = P.syncHotkeysToSupabase;
const loadHotkeysFromSupabase = P.loadHotkeysFromSupabase;

// ==================== SUPABASE SYNC (with offline queue support) ====================
async function syncPromptToSupabase(prompt) {
  if (P.syncPromptToCloud) {
    return P.syncPromptToCloud(prompt);
  }
  // Fallback: direct sync (if modules not loaded)
  if (!state.session || !state.user) return;
  try { 
    // Validate folder_id: only include if the folder exists locally 
    // (it may not exist in cloud yet, causing FK violation)
    const validFolderId = prompt.folderId && state.folders.some(f => f.id === prompt.folderId) 
      ? prompt.folderId : null;
    
    // If prompt has a folder, ensure that folder is synced to cloud first
    if (validFolderId) {
      const folder = state.folders.find(f => f.id === validFolderId);
      if (folder) {
        await syncFolderToSupabase(folder);
      }
    }
    
    const body = { 
      id: prompt.id, user_id: state.user.id, folder_id: validFolderId, 
      title: prompt.title, text: prompt.text, description: prompt.description, 
      image_url: prompt.imageUrl || null, platform: prompt.platform || 'universal', 
      tags: prompt.tags || [], variables: prompt.variables || [], 
      is_favorite: prompt.isFavorite || false, use_count: prompt.useCount || 0, 
      updated_at: new Date().toISOString() 
    };
    const res = await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'prompts', body }); 
    if (res?.error) {
      console.warn('Prompt sync error:', res.error);
      // If folder FK failed, retry without folder_id
      if (typeof res.error === 'string' && (res.error.includes('folder_id') || res.error.includes('foreign key'))) {
        body.folder_id = null;
        const retryRes = await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'prompts', body });
        if (retryRes?.error) console.error('Prompt sync retry also failed:', retryRes.error);
      }
    }
  } catch (e) { console.error('Sync failed:', e); }
}

async function syncPromptDeleteToSupabase(id) {
  if (P.syncPromptDeleteToCloud) {
    return P.syncPromptDeleteToCloud(id);
  }
  if (!state.session || !state.user) return;
  try { await supabaseMsg({ action: 'supabaseRequest', method: 'DELETE', path: `prompts?id=eq.${id}` }); } catch (e) { /* silent */ }
}

async function syncFolderToSupabase(folder) {
  if (P.syncFolderToCloud) {
    return P.syncFolderToCloud(folder);
  }
  if (!state.session || !state.user) return;
  try { 
    const res = await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'folders', body: { id: folder.id, user_id: state.user.id, name: folder.name, updated_at: new Date().toISOString() } }); 
    if (res?.error) console.warn('Folder sync error:', res.error);
  } catch (e) { console.error('Folder sync failed:', e); }
}

async function syncFolderDeleteToSupabase(id) {
  if (P.syncFolderDeleteToCloud) {
    return P.syncFolderDeleteToCloud(id);
  }
  if (!state.session || !state.user) return;
  try { await supabaseMsg({ action: 'supabaseRequest', method: 'DELETE', path: `folders?id=eq.${id}` }); } catch (e) { /* silent */ }
}

async function syncAllData() {
  if (!state.session || !state.user) return;
  console.log('🔄 Syncing data with Supabase...');
  
  try {
    // Step 1: Use sync_user_on_login RPC to ensure profile exists and get premium status
    console.log('📋 Syncing user profile via RPC...');
    let profileExists = false;
    
    try {
      const syncRes = await supabaseMsgWithRetry({ 
        action: 'supabaseRequest', 
        method: 'POST', 
        path: 'rpc/sync_user_on_login',
        body: {}
      });
      
      if (syncRes?.data) {
        const syncData = Array.isArray(syncRes.data) ? syncRes.data[0] : syncRes.data;
        if (syncData && syncData.success !== false) {
          profileExists = true;
          state.isPremium = syncData.is_premium || false;
          state.promptLimit = syncData.prompt_limit || FREE_PROMPT_LIMIT;
          console.log('✅ Profile synced via RPC. Premium:', state.isPremium, 'Limit:', state.promptLimit);
        }
      }
    } catch (rpcErr) {
      console.warn('⚠️ sync_user_on_login exception:', rpcErr);
    }
    
    // Fallback: try direct profile fetch/create if RPC failed
    if (!profileExists) {
      try {
        const profileRes = await supabaseMsg({ 
          action: 'supabaseRequest', 
          method: 'GET', 
          path: `profiles?id=eq.${state.user.id}&select=id,is_premium,prompt_limit` 
        });
        
        if (profileRes?.data?.length > 0) {
          profileExists = true;
          const profile = profileRes.data[0];
          state.isPremium = profile.is_premium || false;
          state.promptLimit = profile.prompt_limit || FREE_PROMPT_LIMIT;
        } else {
          const createRes = await supabaseMsg({
            action: 'supabaseRequest', method: 'POST', path: 'profiles',
            body: { id: state.user.id, email: state.user.email, full_name: state.user.name || state.user.email?.split('@')[0] || 'User', avatar_url: state.user.avatar || '' }
          });
          profileExists = true;
        }
      } catch (fallbackErr) {
        profileExists = true; // Assume profile exists
      }
    }
    
    _suppressStorageRender = true;
    await saveData('isPremium', state.isPremium);
    await saveData('promptLimit', state.promptLimit);
    _suppressStorageRender = false;

    // Step 2: Sync folders (ADDITIVE bidirectional merge)
    console.log('📁 Syncing folders...');
    const fRes = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: 'folders?order=created_at.asc' });
    
    if (fRes?.data) {
      const cloudFolders = fRes.data.map(f => ({ 
        id: f.id, name: f.name, 
        createdAt: new Date(f.created_at).getTime(), 
        updatedAt: new Date(f.updated_at).getTime() 
      }));
      
      // ADDITIVE merge: union of cloud + local, newer wins for conflicts
      const cloudFolderMap = new Map(cloudFolders.map(f => [f.id, f]));
      const localFolderMap = new Map(state.folders.map(f => [f.id, f]));
      const mergedFolders = new Map();
      
      // Add ALL cloud folders
      for (const cf of cloudFolders) {
        mergedFolders.set(cf.id, cf);
      }
      
      // Merge ALL local folders (additive - local-only get uploaded)
      const uploadBatch = [];
      for (const lf of state.folders) {
        const cf = cloudFolderMap.get(lf.id);
        if (!cf) {
          // Local only - keep locally AND upload to cloud
          mergedFolders.set(lf.id, lf);
          uploadBatch.push(lf);
        } else {
          // Both exist - take the newer one
          const localNewer = (lf.updatedAt || 0) > (cf.updatedAt || 0);
          mergedFolders.set(lf.id, localNewer ? lf : cf);
          if (localNewer) uploadBatch.push(lf);
        }
      }
      
      state.folders = Array.from(mergedFolders.values());
      _suppressStorageRender = true;
      await saveData('folders', state.folders);
      _suppressStorageRender = false;
      
      // Upload local-only / newer folders in parallel (batch of 5)
      if (uploadBatch.length > 0) {
        console.log('📤 Uploading', uploadBatch.length, 'folders...');
        const BATCH = 5;
        for (let i = 0; i < uploadBatch.length; i += BATCH) {
          await Promise.all(uploadBatch.slice(i, i + BATCH).map(f => syncFolderToSupabase(f)));
        }
      }
      console.log('✅ Merged folders:', state.folders.length);
    }
    
    // Step 3: Sync prompts (ADDITIVE bidirectional merge - never delete, only add/update)
    console.log('📝 Syncing prompts...');
    const pRes = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: 'prompts?order=created_at.desc' });
    
    if (pRes?.data) {
      const cloudPrompts = pRes.data.map(p => ({ 
        id: p.id, title: p.title, text: p.text, description: p.description, 
        imageUrl: p.image_url || null, folderId: p.folder_id, 
        platform: p.platform, tags: p.tags || [], variables: p.variables || [], 
        isFavorite: p.is_favorite || false, useCount: p.use_count || 0, 
        createdAt: new Date(p.created_at).getTime(), 
        updatedAt: new Date(p.updated_at).getTime() 
      }));
      
      // ADDITIVE merge: union of all prompts from both sources
      const cloudPromptMap = new Map(cloudPrompts.map(p => [p.id, p]));
      const mergedPrompts = new Map();
      
      // Add ALL cloud prompts first
      for (const cp of cloudPrompts) {
        mergedPrompts.set(cp.id, cp);
      }
      
      // Merge ALL local prompts (additive - local-only get uploaded)
      const uploadBatch = [];
      for (const lp of state.prompts) {
        const cp = cloudPromptMap.get(lp.id);
        if (!cp) {
          // Local only - keep and upload to cloud
          mergedPrompts.set(lp.id, lp);
          uploadBatch.push(lp);
        } else {
          // Both exist - smart field-level merge
          const localNewer = (lp.updatedAt || 0) > (cp.updatedAt || 0);
          const base = localNewer ? lp : cp;
          const merged = {
            ...base,
            useCount: Math.max(lp.useCount || 0, cp.useCount || 0),
            isFavorite: localNewer ? lp.isFavorite : cp.isFavorite,
            createdAt: Math.min(lp.createdAt || Infinity, cp.createdAt || Infinity)
          };
          mergedPrompts.set(lp.id, merged);
          if (localNewer) uploadBatch.push(merged);
        }
      }
      
      state.prompts = Array.from(mergedPrompts.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      _suppressStorageRender = true;
      await saveData('prompts', state.prompts);
      _suppressStorageRender = false;
      
      // Upload local-only / newer prompts in parallel batches (much faster than sequential)
      if (uploadBatch.length > 0) {
        console.log('📤 Uploading', uploadBatch.length, 'prompts...');
        const BATCH = 5;
        for (let i = 0; i < uploadBatch.length; i += BATCH) {
          await Promise.all(uploadBatch.slice(i, i + BATCH).map(p => syncPromptToSupabase(p)));
        }
      }
      console.log('✅ Merged prompts:', state.prompts.length);
    } else if (pRes?.error) {
      console.warn('⚠️ Failed to fetch prompts:', pRes.error);
      // If fetch failed but we have local prompts, try uploading them in batches
      if (state.prompts.length > 0 && profileExists) {
        console.log('📤 Uploading', state.prompts.length, 'local prompts to cloud...');
        const BATCH = 5;
        for (let i = 0; i < state.prompts.length; i += BATCH) {
          await Promise.all(state.prompts.slice(i, i + BATCH).map(p => syncPromptToSupabase(p)));
        }
      }
    }
    
    // Step 4: Sync hotkey settings from cloud
    console.log('🎹 Syncing hotkey settings...');
    await loadHotkeysFromSupabase();
    // Also upload local hotkeys to cloud (in case they only exist locally)
    syncHotkeysToSupabase();
    
    // Step 5: Update UI (single batched render, not multiple)
    requestAnimationFrame(() => {
      renderPrompts(); 
      renderFolders(); 
      renderFavorites();
      renderLimitBanner();
    });
    
    console.log('✅ Sync complete! Prompts:', state.prompts.length, 'Folders:', state.folders.length, 'Premium:', state.isPremium);
    
    // Analytics: track sync completion
    P.analyticsTrackSyncComplete(state.prompts.length, state.folders.length, state.isPremium);
    
    // After full sync, try to drain any offline queue items that may have accumulated
    if (P.processQueue) {
      setTimeout(() => P.processQueue(), 500);
    }
  } catch (e) { 
    console.error('❌ Sync error:', e); 
  }
}

// ==================== UPDATE STATIC UI TEXTS ====================
function updateStaticTexts() {
  // Update tab labels
  const tabMap = { prompts: 'tabPrompts', folders: 'tabFolders', favorites: 'tabFavorites', explore: 'tabExplore', stats: 'tabStats' };
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const key = tabMap[btn.dataset.tab];
    if (key) btn.textContent = t(key);
  });
  document.getElementById('search-input').placeholder = t('searchPlaceholder');
  const newFolderBtn = document.getElementById('new-folder-btn');
  if (newFolderBtn) {
    const svg = newFolderBtn.querySelector('svg');
    newFolderBtn.textContent = '';
    if (svg) newFolderBtn.appendChild(svg);
    newFolderBtn.appendChild(document.createTextNode(' ' + t('newFolder')));
  }
  // Re-render dynamic content
  renderPrompts();
  renderFolders();
  renderFavorites();
  renderExplore();
}

// ==================== APPLY SEARCH FILTERS ====================
function applySearchFilters(filters) {
  const searchInput = document.getElementById('search-input');
  const query = searchInput?.value.trim().toLowerCase() || '';
  
  // Apply filters to prompts
  if (state.searchOriginalPrompts) {
    let filtered = [...state.searchOriginalPrompts];
    
    // Platform filter
    if (filters.platform !== 'all') {
      filtered = filtered.filter(p => {
        if (filters.platform === 'other') {
          return !['chatgpt', 'claude', 'gemini', 'perplexity', 'poe'].includes(p.platform?.toLowerCase());
        }
        return p.platform?.toLowerCase() === filters.platform;
      });
    }
    
    // Tags filter
    if (filters.tags?.length > 0) {
      filtered = filtered.filter(p => 
        filters.tags.some(tag => p.tags?.includes(tag))
      );
    }
    
    // Has variables filter
    if (filters.hasVariables) {
      filtered = filtered.filter(p => p.variables?.length > 0);
    }
    
    // Favorites filter
    if (filters.favoritesOnly) {
      filtered = filtered.filter(p => p.isFavorite);
    }
    
    state.prompts = filtered;
    renderPrompts();
    
    if (state.prompts.length === 0 && !query) {
      document.getElementById('prompts-list').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">No prompts found</div>
          <div class="empty-state-text">Try adjusting your filters</div>
        </div>
      `;
    }
  }
}

// ==================== INIT ====================
let _initRenderDone = false; // Guard against duplicate renders during init
let searchFilters = null; // Search filters instance

async function init() {
  try {
  // Load i18n locales first
  await loadLocale('en');
  await loadLocale('ru');

  await loadData();
  applyTheme(state.settings.theme);

  // Initialize offline queue module
  if (P.initOffline) {
    await P.initOffline();
  }

  // Analytics: track popup open and identify user
  P.analyticsTrackPopupOpen();
  P.analyticsTrackExtensionOpened();
  if (state.user) P.analyticsIdentify(state.user, state.isPremium);

  // Analytics: track popup close
  window.addEventListener('beforeunload', () => {
    P.analyticsTrackPopupClose();
  });

  const mainApp = document.getElementById('main-app');
  const welcomeScreen = document.getElementById('welcome-screen');

  // ==================== TUTORIAL / WELCOME FLOW ====================
  // Flow:
  //   1. On install: background.js opens onboarding/welcome.html (age+terms+Google sign-in).
  //      welcome.html sets hasLaunched=true when complete, then closes itself.
  //   2. First popup open: if hasLaunched=false (user opened popup before completing welcome.html),
  //      show the in-popup welcome screen with "Get Started" button.
  //   3. If hasLaunched=true BUT onboardingTutorialComplete is NOT true, start the tutorial.
  //   4. If tutorial was interrupted (popup closed mid-tutorial), resume from last completed step.

  // Helper: activate main app
  async function activateMainApp(startTutorial = false) {
    if (welcomeScreen) welcomeScreen.style.display = 'none';
    mainApp.style.display = 'flex';
    state.isFirstLaunch = false;

    if (startTutorial) {
      // Start onboarding tutorial after a short delay
      setTimeout(() => {
        if (window.OnboardingTutorial) {
          P.analyticsTrackOnboardingStart();
          const tutorial = new window.OnboardingTutorial();
          tutorial.start(() => {
            console.log('✅ Onboarding complete');
            P.analyticsTrackOnboardingComplete();
          });
        }
      }, 300);
    } else {
      // Resume onboarding tutorial if it was interrupted (popup was closed mid-tutorial)
      chrome.storage.local.get(['tutorialLastCompletedStep', 'tutorialCurrentStep', 'onboardingTutorialComplete'], (stored) => {
        if (stored.onboardingTutorialComplete) return;
        const hasV13Progress = typeof stored.tutorialLastCompletedStep === 'number' && stored.tutorialLastCompletedStep >= 0;
        const hasV12Progress = !hasV13Progress && typeof stored.tutorialCurrentStep === 'number' && stored.tutorialCurrentStep > 0;
        if (hasV13Progress || hasV12Progress) {
          if (hasV12Progress) {
            const migratedStep = Math.max(0, stored.tutorialCurrentStep - 1);
            chrome.storage.local.set({ tutorialLastCompletedStep: migratedStep });
            chrome.storage.local.remove('tutorialCurrentStep');
          }
          setTimeout(() => {
            if (window.OnboardingTutorial) {
              const tutorial = new window.OnboardingTutorial();
              tutorial.start(() => { console.log('✅ Onboarding resumed and complete'); });
            }
          }, 500);
        }
      });
    }
  }

  // Determine whether to show welcome screen, start tutorial, or go straight to app
  const tutorialState = await new Promise(resolve => {
    chrome.storage.local.get(['hasLaunched', 'ageVerified', 'onboardingTutorialComplete', 'tutorialLastCompletedStep', 'tutorialCurrentStep'], resolve);
  });

  const hasCompletedWelcome = !!(tutorialState.hasLaunched && tutorialState.ageVerified);
  const isTutorialDone = !!tutorialState.onboardingTutorialComplete;
  const hasTutorialProgress = typeof tutorialState.tutorialLastCompletedStep === 'number' || typeof tutorialState.tutorialCurrentStep === 'number';

  if (state.isFirstLaunch && !hasCompletedWelcome) {
    // Case 1: User opened popup BEFORE completing welcome.html.
    // Show in-popup welcome screen with "Get Started" button.
    // welcome.html is already open in a tab (opened by background.js on install).
    welcomeScreen.style.display = 'flex';
    mainApp.style.display = 'none';

    // Update welcome screen texts from i18n
    const wTitle = document.getElementById('welcome-title');
    const wText = document.getElementById('welcome-text');
    const wBtn = document.getElementById('get-started-btn');
    const wFeat1 = document.getElementById('welcome-feat-1');
    const wFeat2 = document.getElementById('welcome-feat-2');
    const wFeat3 = document.getElementById('welcome-feat-3');
    if (wTitle) wTitle.textContent = t('welcomeTitle');
    if (wText) wText.textContent = t('welcomeText');
    if (wBtn) wBtn.textContent = t('getStarted');
    if (wFeat1) wFeat1.textContent = t('welcomeFeat1') || 'Create & organize prompts in folders';
    if (wFeat2) wFeat2.textContent = t('welcomeFeat2') || 'Instantly insert into any AI chat';
    if (wFeat3) wFeat3.textContent = t('welcomeFeat3') || 'Share & discover community prompts';

    if (wBtn) {
      wBtn.addEventListener('click', async () => {
        welcomeScreen.style.display = 'none';
        chrome.storage.local.set({ hasLaunched: true });
        await saveData('isFirstLaunch', false);
        await activateMainApp(true);
      });
    }
  } else if (!isTutorialDone && !hasTutorialProgress) {
    // Case 2: Welcome was completed (hasLaunched=true) but tutorial never started.
    // This is the normal flow: user completed welcome.html, then opens popup for the first time.
    chrome.storage.local.set({ hasLaunched: true });
    await saveData('isFirstLaunch', false);
    await activateMainApp(true);
  } else {
    // Case 3: Not first launch OR tutorial already done/in-progress.
    // Go to main app; activateMainApp will handle tutorial resume if needed.
    await activateMainApp(false);
  }

  // Initialize tabs and search BEFORE any rendering
  initTabs();
  initSearch();
  
  // Search filters hidden for now (future feature)
  // if (window.SearchFilters) {
  //   searchFilters = new window.SearchFilters();
  //   searchFilters.init({
  //     currentTab: 'prompts',
  //     onFilterChange: (filters) => {
  //       console.log('Filters changed:', filters);
  //       applySearchFilters(filters);
  //     }
  //   });
  // }

  // Update static text from i18n — this also does the FIRST render of all tabs
  updateStaticTexts();
  _initRenderDone = true;
  // Mark first render complete: subsequent renders won't replay entrance animations
  setTimeout(() => { _isFirstRender = false; }, 600);
  // No extra renderPrompts/renderFolders/etc here — updateStaticTexts already did them

  // Clean up entrance animation classes after they complete (prevents re-animation on layout changes)
  document.addEventListener('animationend', (e) => {
    if (e.target.classList.contains('card-entering')) {
      e.target.classList.remove('card-entering');
    }
  });

  document.getElementById('new-prompt-btn').addEventListener('click', () => openPromptEditor());
  document.getElementById('new-folder-btn').addEventListener('click', () => openFolderEditor());
  document.getElementById('settings-btn').addEventListener('click', openSettings);

  // Check for unsaved prompt/folder drafts from previous session
  chrome.storage.local.get(['editorDraft', 'folderEditorDraft'], (drafts) => {
    const promptDraft = drafts.editorDraft;
    const folderDraft = drafts.folderEditorDraft;
    // Prompt draft check (max 1 hour old)
    if (promptDraft && promptDraft.savedAt && (Date.now() - promptDraft.savedAt < 3600000) && (promptDraft.title || promptDraft.text)) {
      setTimeout(() => {
        if (P.checkAndRestoreDraft) {
          P.checkAndRestoreDraft({
            canCreatePrompt,
            getEffectiveLimit,
            resolveImageUrl,
            isSupabaseStorageUrl,
            syncPromptToSupabase,
            uploadImageToStorage: P.uploadImageToStorage,
            deletePrompt,
            setSuppressRender: (v) => { _suppressStorageRender = v; },
            afterSave: (editingId, prevFolderId, newFolderId) => {
              requestAnimationFrame(() => { renderPrompts(); renderFavorites(); });
            }
          });
        }
      }, 300);
    }
    // Folder draft check (max 1 hour old)
    else if (folderDraft && folderDraft.savedAt && (Date.now() - folderDraft.savedAt < 3600000) && folderDraft.name) {
      setTimeout(async () => {
        const titleText = P.getLang() === 'ru'
          ? 'Оповещение расширения "Promptory"'
          : 'Promptory Notification';
        const msg = P.getLang() === 'ru'
          ? 'У вас есть несохранённый черновик папки. Восстановить?'
          : 'You have an unsaved folder draft. Restore it?';
        const okText = 'OK';
        const cancelBtnText = P.getLang() === 'ru' ? 'Отмена' : 'Cancel';
        const confirmed = await showStyledConfirm(titleText, msg, okText, cancelBtnText);
        if (confirmed) {
          P.analyticsTrackDraftRestored('folder');
          openFolderEditor(folderDraft.folderId || null);
          setTimeout(() => {
            const nameInput = document.getElementById('fe-name');
            if (nameInput && folderDraft.name) nameInput.value = folderDraft.name;
          }, 100);
        } else {
          try { chrome.storage.local.remove('folderEditorDraft'); } catch (e) { /* silent */ }
        }
      }, 300);
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    // Skip re-renders when the change was triggered by our own saves (prevents flicker)
    if (_suppressStorageRender) {
      // Still update state silently
      if (changes.prompts) state.prompts = changes.prompts.newValue || [];
      if (changes.folders) state.folders = changes.folders.newValue || [];
      if (changes.user) state.user = changes.user.newValue;
      if (changes.session) state.session = changes.session.newValue;
      if (changes.isPremium) state.isPremium = changes.isPremium.newValue;
      if (changes.promptLimit) state.promptLimit = changes.promptLimit.newValue;
      return;
    }
    // Session expired notification
    if (changes.sessionExpired && changes.sessionExpired.newValue === true) {
      state.user = null;
      state.session = null;
      showToast(t('sessionExpired') || 'Session expired. Please sign in again.', 'error');
      renderExplore();
      // Clear the flag
      chrome.storage.local.set({ sessionExpired: false });
      return;
    }
    if (changes.prompts) { state.prompts = changes.prompts.newValue || []; renderPrompts(); renderFavorites(); }
    if (changes.folders) { state.folders = changes.folders.newValue || []; renderFolders(); renderPrompts(); }
    if (changes.user) { state.user = changes.user.newValue; renderExplore(); }
    if (changes.session) { state.session = changes.session.newValue; }
    if (changes.isPremium) { state.isPremium = changes.isPremium.newValue; }
    if (changes.promptLimit) { state.promptLimit = changes.promptLimit.newValue; }
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.settings.theme === 'system') applyTheme('system');
  });

  // If logged in, sync data from cloud ONCE, then load library ONCE after
  if (state.session && state.user) { 
    // Don't call renderExplore() separately here — updateStaticTexts() already rendered the cached version
    // syncAllData() will render prompts/folders/favorites at the end, so skip extra renders
    try {
      await syncAllData();
    } catch (e) {
      console.error('Initial sync failed:', e);
    }
    // Load library prompts ONCE after sync is done (this calls renderExplore at the end)
    await loadLibraryPrompts();
    // Check premium status (uses sync_user_on_login which was already called in syncAllData)
    // Only do a lightweight check here — don't call sync_user_on_login again
    renderLimitBanner();
  }

  // Check if we should show the review banner (3 days after install)
  checkReviewBanner();

  } catch (err) {
    // Global error boundary — show fallback UI instead of blank popup
    console.error('❌ Promptory init error:', err);
    P.analyticsTrackError('init', err?.message || String(err));
    const mainApp = document.getElementById('main-app');
    if (mainApp) {
      mainApp.style.display = 'flex';
      mainApp.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;text-align:center;height:100%;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5" style="margin-bottom:16px;opacity:0.5;">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);color:var(--text-primary);margin-bottom:8px;">Something went wrong</div>
          <div style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-bottom:20px;line-height:1.6;">Promptory encountered an error during startup.<br>Try closing and reopening the popup.</div>
          <div style="font-size:var(--font-size-xs);color:var(--text-tertiary);background:var(--bg-secondary);padding:8px 12px;border-radius:var(--radius-md);max-width:100%;overflow:hidden;text-overflow:ellipsis;word-break:break-all;">${typeof err === 'object' ? (err.message || String(err)) : String(err)}</div>
        </div>`;
    }
  }
}

// ==================== REVIEW BANNER (3 days after install) ====================
const REVIEW_DELAY_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
// Chrome Web Store URL — replace with your actual extension ID
const CWS_REVIEW_URL = 'https://chromewebstore.google.com/detail/promptory/YOUR_EXTENSION_ID/reviews';

function showReviewBanner() {
  // Don't show if already visible
  if (document.getElementById('review-banner')) return;

  const isRu = P.getLang() === 'ru';
  const bannerText = isRu 
    ? 'Если не трудно, поставь пж оценку \u2014 это поможет продвижению данного проекта, я старался бро :3'
    : 'If you enjoy Promptory, please leave a rating \u2014 it really helps the project grow!';
  const rateText = isRu ? 'Оценить' : 'Rate it';
  const laterText = isRu ? 'Позже' : 'Later';

  const banner = document.createElement('div');
  banner.id = 'review-banner';
  banner.className = 'review-banner';
  banner.innerHTML = `
    <div class="review-banner-content">
      <div class="review-banner-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      </div>
      <div class="review-banner-body">
        <div class="review-banner-text">${bannerText}</div>
        <div class="review-banner-actions">
          <button class="btn btn-primary btn-sm ripple" id="review-rate-btn">${rateText}</button>
          <button class="btn btn-ghost btn-sm" id="review-later-btn">${laterText}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(banner);

  // Animate in
  requestAnimationFrame(() => {
    banner.classList.add('visible');
  });

  document.getElementById('review-rate-btn').addEventListener('click', () => {
    try { chrome.tabs.create({ url: CWS_REVIEW_URL }); } catch (e) { window.open(CWS_REVIEW_URL, '_blank'); }
    try { chrome.storage.local.set({ reviewDismissed: true }); } catch (e) { /* silent */ }
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 300);
  });

  document.getElementById('review-later-btn').addEventListener('click', () => {
    try { chrome.storage.local.set({ reviewDismissed: true }); } catch (e) { /* silent */ }
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 300);
  });
}

function checkReviewBanner() {
  try {
    chrome.storage.local.get(['installDate', 'reviewDismissed'], (res) => {
      try {
        if (res.reviewDismissed === true) return;
        if (!res.installDate) return;
        const elapsed = Date.now() - res.installDate;
        if (elapsed >= REVIEW_DELAY_MS) {
          showReviewBanner();
        }
      } catch (e) {
        console.warn('[Promptory] checkReviewBanner callback error:', e);
      }
    });
  } catch (e) {
    console.warn('[Promptory] checkReviewBanner error:', e);
  }
}

// Debug functions exposed globally for console testing
window.debugReviewBanner = function() {
  console.log('[Promptory] Force-showing review banner (no date check)');
  showReviewBanner();
};
// Alias for convenience
window.showReviewBanner = window.debugReviewBanner;

window.debugSimulate3Days = function() {
  chrome.storage.local.set({ installDate: Date.now() - (3 * 24 * 60 * 60 * 1000) }, () => {
    console.log('[Promptory] Simulated 3 days passed. Reload popup to test.');
  });
};

window.debugResetReviewBanner = function() {
  chrome.storage.local.set({ reviewDismissed: false, installDate: Date.now() - (3 * 24 * 60 * 60 * 1000) }, () => {
    console.log('[Promptory] Review banner reset. Reload popup to test.');
  });
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
