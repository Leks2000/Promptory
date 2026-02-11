// PromptVault -> Promptory Popup - Main Controller
// Performance-optimized, i18n-enabled, 3 hotkey slots

(function() {
'use strict';

// ==================== CONSTANTS ====================
const SUPABASE_URL = 'https://vofgfvlgchqheksvlibl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZmdmdmxnY2hxaGVrc3ZsaWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTgzNzEsImV4cCI6MjA4NjA3NDM3MX0.taoCHiYqJT2mSp5odtaM1p52KO5MnGzSOiz4dhmZnb0';
const FREE_PROMPT_LIMIT = 20;
const MAX_ANIM_ITEMS = 8; // Cap staggered animations for performance

// ==================== I18N ====================
const LOCALES = {};
let _lang = 'en';

async function loadLocale(lang) {
  if (LOCALES[lang]) return;
  try {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const res = await fetch(url);
    LOCALES[lang] = await res.json();
  } catch (e) { console.warn('Locale load failed:', lang, e); }
}

function t(key, ...subs) {
  const locale = LOCALES[_lang] || LOCALES['en'] || {};
  const fallback = LOCALES['en'] || {};
  const entry = locale[key] || fallback[key];
  if (!entry) return key;
  let msg = entry.message;
  subs.forEach((s, i) => { msg = msg.replace(`$${i + 1}`, String(s)); });
  return msg;
}

// ==================== STATE ====================
const state = {
  prompts: [],
  folders: [],
  settings: { theme: 'dark', hotkeys: { slot1: { promptId: null }, slot2: { promptId: null }, slot3: { promptId: null } }, defaultFolder: null },
  user: null,
  session: null,
  isFirstLaunch: false,
  libraryPrompts: [],
  searchOriginalPrompts: null,
  userLikes: new Set(),
  userReports: new Set(),
  isPremium: false,
  promptLimit: FREE_PROMPT_LIMIT
};

// ==================== UTILITIES ====================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'default') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast visible';
  if (type === 'success') toast.classList.add('success');
  else if (type === 'error') toast.classList.add('error');
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => { toast.className = 'toast'; }, 250);
  }, 2500);
}

function saveData(key, value) {
  return new Promise(resolve => chrome.storage.local.set({ [key]: value }, resolve));
}

function formatDate(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 7) return new Date(ts).toLocaleDateString();
  if (days > 0) return `${days}d`;
  if (hrs > 0) return `${hrs}h`;
  if (mins > 0) return `${mins}m`;
  return 'now';
}

function supabaseMsg(params) {
  return new Promise(resolve => chrome.runtime.sendMessage(params, resolve));
}

// Truncate text for performance (avoid rendering huge strings)
function truncate(text, max = 120) {
  if (!text || text.length <= max) return text || '';
  return text.substring(0, max) + '...';
}

// Debounce utility
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ==================== IMAGE URL RESOLVER ====================
// Resolves Supabase Storage URLs to displayable URLs (handles private buckets)
const imageCache = new Map(); // Cache resolved image URLs

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

// ==================== FREE TIER LIMIT ====================
function getEffectiveLimit() {
  return (state.promptLimit > 0 && state.promptLimit <= 1000) ? state.promptLimit : FREE_PROMPT_LIMIT;
}

function canCreatePrompt() {
  if (state.isPremium) return true;
  return state.prompts.length < getEffectiveLimit();
}

function getPromptsRemaining() {
  if (state.isPremium) return Infinity;
  return Math.max(0, getEffectiveLimit() - state.prompts.length);
}

function renderLimitBanner() {
  const existing = document.getElementById('limit-banner');
  if (existing) existing.remove();
  if (state.isPremium || !state.user) return;
  // Sanitize: if promptLimit is unreasonably high (e.g. 9999), treat as default 20
  const effectiveLimit = (state.promptLimit > 0 && state.promptLimit <= 1000) ? state.promptLimit : FREE_PROMPT_LIMIT;
  const remaining = Math.max(0, effectiveLimit - state.prompts.length);
  if (remaining > 5) return;
  const banner = document.createElement('div');
  banner.id = 'limit-banner';
  banner.className = 'limit-banner';
  const upgradeBtn = `<button class="btn btn-sm btn-primary limit-upgrade-btn" id="limit-upgrade-btn">${t('upgrade') || 'Upgrade'}</button>`;
  banner.innerHTML = remaining === 0
    ? `<div class="limit-banner-content"><span class="limit-banner-text">${t('freeLimitBanner')}</span></div><div class="limit-banner-actions"><span class="limit-banner-count">${state.prompts.length}/${effectiveLimit}</span>${upgradeBtn}</div>`
    : `<div class="limit-banner-content"><span class="limit-banner-text">${t('remainingOnFree', remaining)}</span></div><div class="limit-banner-actions"><span class="limit-banner-count">${state.prompts.length}/${effectiveLimit}</span>${upgradeBtn}</div>`;
  const content = document.querySelector('.content');
  if (content) content.insertBefore(banner, content.firstChild);
  
  // Add click handler for upgrade button
  document.getElementById('limit-upgrade-btn')?.addEventListener('click', () => {
    showUpgradeModal();
  });
}

// ==================== DATA LOADING ====================
async function loadData() {
  return new Promise(resolve => {
    chrome.storage.local.get(['prompts', 'folders', 'settings', 'user', 'session', 'hasLaunched', 'isPremium', 'promptLimit', 'language'], result => {
      if (result.prompts) state.prompts = result.prompts;
      if (result.folders) state.folders = result.folders;
      if (result.settings) state.settings = { ...state.settings, ...result.settings };
      if (result.user) state.user = result.user;
      if (result.session) state.session = result.session;
      if (result.isPremium) state.isPremium = result.isPremium;
      if (result.promptLimit) state.promptLimit = result.promptLimit;
      if (!result.hasLaunched) {
        state.isFirstLaunch = true;
        chrome.storage.local.set({ hasLaunched: true });
      }
      // Language
      if (result.language) _lang = result.language;
      else if (chrome.i18n.getUILanguage().startsWith('ru')) _lang = 'ru';
      resolve();
    });
  });
}

// ==================== THEME ====================
function applyTheme(theme) {
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// ==================== TABS ====================
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(`${btn.dataset.tab}-tab`);
      if (target) target.classList.add('active');
      if (btn.dataset.tab === 'stats') renderStats();
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

// ==================== PROMPTS (optimized) ====================
function renderPrompts() {
  const list = document.getElementById('prompts-list');
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

  // Build with DocumentFragment for performance
  const frag = document.createDocumentFragment();
  folders.forEach(f => {
    const fp = grouped[f.id] || [];
    if (fp.length > 0) frag.appendChild(buildFolderSection(f, fp));
  });
  if (uncategorized.length > 0) {
    frag.appendChild(buildFolderSection({ id: null, name: t('uncategorized') }, uncategorized));
  }

  list.innerHTML = '';
  list.appendChild(frag);
  attachPromptCardListeners();
  renderLimitBanner();
}

function buildFolderSection(folder, prompts) {
  const fId = folder.id || 'uncategorized';
  const expanded = localStorage.getItem(`pv-folder-${fId}`) !== 'false';
  const section = document.createElement('div');
  section.className = `folder-section ${expanded ? 'expanded' : ''}`;
  section.dataset.folderId = fId;
  section.innerHTML = `
    <div class="folder-header" data-toggle-folder="${fId}">
      <div class="folder-info">
        <span class="folder-arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></span>
        <span class="folder-name">${escapeHtml(folder.name)}</span>
      </div>
      <span class="folder-count">${prompts.length}</span>
    </div>
    <div class="folder-content">
      ${prompts.map((p, i) => renderPromptCard(p, i)).join('')}
    </div>`;
  return section;
}

function renderPromptCard(prompt, idx) {
  const delay = idx < MAX_ANIM_ITEMS ? `style="animation-delay:${idx * 30}ms"` : 'style="animation:none;opacity:1;"';
  const tagsHtml = prompt.tags?.length
    ? `<div class="tags">${prompt.tags.slice(0, 3).map(tg => `<span class="tag">#${escapeHtml(tg)}</span>`).join('')}${prompt.tags.length > 3 ? `<span class="tag">+${prompt.tags.length - 3}</span>` : ''}</div>`
    : '';
  return `
    <div class="prompt-card" data-prompt-id="${prompt.id}" ${delay}>
      <div class="prompt-card-header">
        <div class="prompt-title">${escapeHtml(truncate(prompt.title, 60))}</div>
        <div class="prompt-actions">
          <button class="prompt-action-btn ${prompt.isFavorite ? 'active' : ''}" data-action="toggle-fav" data-id="${prompt.id}" title="${prompt.isFavorite ? t('removeFromFavorites') : t('addToFavorites')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${prompt.isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </button>
          <button class="prompt-action-btn" data-action="copy" data-id="${prompt.id}" title="${t('copyToClipboard')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="prompt-action-btn" data-action="insert" data-id="${prompt.id}" title="${t('insertToPage')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          </button>
          <button class="prompt-action-btn" data-action="menu" data-id="${prompt.id}" title="${t('more')}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
        </div>
      </div>
      ${tagsHtml}
      <div class="prompt-meta"><span class="prompt-stat">${t('usedTimes', prompt.useCount || 0)}</span></div>
    </div>`;
}

function attachPromptCardListeners() {
  // Use event delegation on the list instead of individual listeners
  const list = document.getElementById('prompts-list');
  list.onclick = async (e) => {
    // Folder toggle
    const folderHeader = e.target.closest('[data-toggle-folder]');
    if (folderHeader) {
      const fId = folderHeader.dataset.toggleFolder;
      const section = document.querySelector(`[data-folder-id="${fId}"]`);
      if (section) {
        const expanded = section.classList.toggle('expanded');
        localStorage.setItem(`pv-folder-${fId}`, expanded);
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
      else if (action === 'insert') await insertPromptToPage(id);
      else if (action === 'menu') showContextMenu(actionBtn, id);
      return;
    }
    // Card click -> edit
    const card = e.target.closest('.prompt-card');
    if (card && !e.target.closest('.prompt-action-btn')) {
      openPromptEditor(card.dataset.promptId);
    }
  };
}

async function toggleFavorite(id) {
  const p = state.prompts.find(x => x.id === id);
  if (!p) return;
  p.isFavorite = !p.isFavorite;
  p.updatedAt = Date.now();
  await saveData('prompts', state.prompts);
  showToast(p.isFavorite ? t('addedToFavorites') : t('removedFromFavorites'), 'success');
  renderPrompts();
  renderFavorites();
  syncPromptToSupabase(p);
}

async function copyPrompt(id) {
  const p = state.prompts.find(x => x.id === id);
  if (!p) return;
  try {
    await navigator.clipboard.writeText(p.text);
    p.useCount = (p.useCount || 0) + 1;
    p.updatedAt = Date.now();
    await saveData('prompts', state.prompts);
    showToast(t('copiedToClipboard'), 'success');
    renderPrompts();
    trackUsage(p, 'copy');
    syncPromptToSupabase(p); // Continuous sync
  } catch { showToast(t('failedToCopy'), 'error'); }
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
    await saveData('prompts', state.prompts);
    showToast(t('promptInserted'), 'success');
    renderPrompts();
    const platform = new URL(tab.url || '').hostname.replace('www.', '') || 'unknown';
    trackUsage(p, 'insert', platform);
    syncPromptToSupabase(p); // Continuous sync
  } catch {
    await navigator.clipboard.writeText(p.text);
    p.useCount = (p.useCount || 0) + 1;
    p.updatedAt = Date.now();
    await saveData('prompts', state.prompts);
    showToast(t('copiedClipboardNotSupported'), 'success');
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
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`;
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

async function deletePrompt(id) {
  if (!confirm(t('deletePromptConfirm'))) return;
  state.prompts = state.prompts.filter(p => p.id !== id);
  await saveData('prompts', state.prompts);
  showToast(t('promptDeleted'), 'success');
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
            <div class="image-upload-placeholder" id="share-image-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>${t('clickToUpload') || 'Click to upload image'}</span>
              <span style="font-size:10px;color:var(--text-tertiary);">PNG, JPG (max 500KB)</span>
            </div>
            <img id="share-image-preview" class="image-preview" style="display:none;" />
            <button class="btn btn-icon btn-sm image-remove-btn" id="share-image-remove" style="display:none;" title="${t('remove') || 'Remove'}">×</button>
          </div>
          <input type="file" id="share-image-input" accept="image/png,image/jpeg,image/jpg" style="display:none;">
        </div>
        <div style="padding:10px;background:var(--bg-tertiary);border-radius:var(--radius-md);margin-top:8px;"><div style="font-size:var(--font-size-xs);color:var(--text-tertiary);line-height:1.5;">${t('shareDisclaimer')}</div></div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost close-modal-btn">${t('cancel')}</button><button class="btn btn-primary ripple" id="share-confirm-btn">${t('share')}</button></div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);

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
      // Upload image to Supabase Storage if selected
      let imageUrl = null;
      if (selectedImageData) {
        try {
          // Get content type from data URL
          const contentTypeMatch = selectedImageData.match(/^data:(.+?);base64,/);
          const contentType = contentTypeMatch ? contentTypeMatch[1] : 'image/png';
          const ext = contentType.split('/')[1] || 'png';
          const fileName = `${state.user.id}/${Date.now()}_cover.${ext}`;
          
          // Upload via background script (handles auth) - pass base64 directly
          const uploadRes = await supabaseMsg({
            action: 'supabaseRequest',
            method: 'POST',
            path: `storage/v1/object/Lib_img/${fileName}`,
            body: selectedImageData,
            isFile: true,
            contentType: contentType
          });
          
          if (!uploadRes?.error) {
            // Use the signed URL or storage path returned by background
            imageUrl = uploadRes?.data?.signedUrl || uploadRes?.data?.publicUrl || `${SUPABASE_URL}/storage/v1/object/public/Lib_img/${fileName}`;
            console.log('✅ Image uploaded:', imageUrl);
          } else {
            console.warn('⚠️ Image upload failed:', uploadRes.error);
          }
        } catch (imgErr) {
          console.warn('⚠️ Image upload error:', imgErr);
          // Continue without image
        }
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
let pendingImageFile = null; // For image upload

function openPromptEditor(promptId = null) {
  if (!promptId && !canCreatePrompt()) {
    showToast(t('freeLimitReached', getEffectiveLimit()), 'error');
    return;
  }
  pendingImageFile = null;
  const prompt = promptId ? state.prompts.find(p => p.id === promptId) : null;
  const isEdit = !!prompt;
  const hasImage = prompt?.imageUrl;
  // Validate image URL - check if it's a valid URL, data URI, or supabase-storage:// scheme
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

  // Async: resolve and load image from Supabase Storage (private bucket)
  if (imageUrlValid && prompt?.imageUrl) {
    const imgEl = document.getElementById('pe-image-el');
    const loadingIndicator = document.getElementById('pe-image-loading');
    if (imgEl) {
      resolveImageUrl(prompt.imageUrl).then(resolvedUrl => {
        if (resolvedUrl && imgEl) {
          imgEl.src = resolvedUrl;
          imgEl.onload = () => { if (loadingIndicator) loadingIndicator.style.display = 'none'; };
          imgEl.onerror = () => {
            console.warn('Image load failed for:', prompt.imageUrl);
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
  textArea.addEventListener('input', debounce(updateVarsDisplay, 300));
  updateVarsDisplay();

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
    if (file && file.type.startsWith('image/')) handleImageSelect(file);
  });
  
  imageInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImageSelect(file);
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
    if (e.key === 'Enter') { e.preventDefault(); addTag(e.target.value.trim()); e.target.value = ''; }
  });
  document.getElementById('pe-tags-list').addEventListener('click', (e) => {
    const removeTag = e.target.dataset.removeTag || e.target.closest('[data-remove-tag]')?.dataset.removeTag;
    if (removeTag) document.querySelector(`#pe-tags-list [data-tag="${removeTag}"]`)?.remove();
  });
  document.getElementById('pe-save-btn').addEventListener('click', () => savePrompt(promptId));
  document.getElementById('pe-delete-btn')?.addEventListener('click', async () => { await deletePrompt(promptId); closeModal('prompt-editor-modal'); });
  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => closeModal('prompt-editor-modal')));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal('prompt-editor-modal'); });
  const escHandler = (e) => { if (e.key === 'Escape') { closeModal('prompt-editor-modal'); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
}

function handleImageSelect(file) {
  if (file.size > 2 * 1024 * 1024) { // 2MB limit
    showToast(t('imageTooLarge') || 'Image too large (max 2MB)', 'error');
    return;
  }
  pendingImageFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('pe-image-preview');
    const zone = document.getElementById('pe-image-zone');
    preview.innerHTML = `
      <img src="${e.target.result}" alt="Preview" style="max-width:100%;max-height:150px;border-radius:var(--radius-md);object-fit:cover;display:block;" onerror="this.style.display='none';">
      <button class="btn btn-sm btn-ghost image-remove-btn" id="pe-image-remove" style="position:absolute;top:4px;right:4px;background:var(--bg-primary);" title="${t('remove') || 'Remove'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    `;
    preview.style.display = 'block';
    preview.style.position = 'relative';
    zone.style.display = 'none';
    // Re-attach remove handler
    document.getElementById('pe-image-remove')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      pendingImageFile = null;
      document.getElementById('pe-image-url').value = '';
      preview.style.display = 'none';
      zone.style.display = 'flex';
    });
  };
  reader.readAsDataURL(file);
}

function updateVarsDisplay() {
  const text = document.getElementById('pe-text')?.value || '';
  const vars = [...new Set((text.match(/\{([^}]+)\}/g) || []).map(m => m.slice(1, -1)))];
  const hint = document.getElementById('pe-vars-hint');
  const list = document.getElementById('pe-vars-list');
  if (hint && list) {
    if (vars.length > 0) { list.innerHTML = vars.map(v => `<span class="tag">{${escapeHtml(v)}}</span>`).join(' '); hint.style.display = 'block'; }
    else { hint.style.display = 'none'; }
  }
}

function addTag(tag) {
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

async function savePrompt(editingId) {
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
  if (pendingImageFile && state.session && state.user) {
    try {
      console.log('📤 Uploading image to Supabase Storage...');
      const uploadedUrl = await uploadImageToStorage(pendingImageFile, editingId || crypto.randomUUID());
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
        console.log('✅ Image uploaded:', uploadedUrl);
      }
    } catch (e) {
      console.error('❌ Image upload failed:', e);
      showToast(t('imageUploadFailed') || 'Image upload failed', 'error');
    }
  }
  
  const variables = [...new Set((text.match(/\{([^}]+)\}/g) || []).map(m => m.slice(1, -1)))];
  if (editingId) {
    const p = state.prompts.find(x => x.id === editingId);
    if (p) { 
      Object.assign(p, { title, text, description: desc, folderId, platform, tags, variables, imageUrl, updatedAt: Date.now() }); 
      syncPromptToSupabase(p); 
    }
  } else {
    if (!canCreatePrompt()) { showToast(t('freeLimitReached', getEffectiveLimit()), 'error'); saveBtn.classList.remove('loading'); return; }
    const newP = { id: crypto.randomUUID(), title, text, description: desc, folderId, platform, tags, variables, imageUrl, isFavorite: false, useCount: 0, createdAt: Date.now(), updatedAt: Date.now() };
    state.prompts.unshift(newP);
    syncPromptToSupabase(newP);
  }
  await saveData('prompts', state.prompts);
  saveBtn.classList.remove('loading');
  pendingImageFile = null;
  showToast(editingId ? t('promptUpdated') : t('promptCreated'), 'success');
  closeModal('prompt-editor-modal');
  renderPrompts();
  renderFavorites();
}

// ==================== IMAGE UPLOAD ====================
async function uploadImageToStorage(file, promptId) {
  if (!state.session || !state.user) return null;
  
  const fileExt = file.name.split('.').pop().toLowerCase();
  const fileName = `${state.user.id}/${promptId}.${fileExt}`;
  
  // Convert file to base64 for sending through background script
  const base64 = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // Get base64 part only
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
    
    if (res?.error) {
      console.error('Storage upload error:', res.error);
      return null;
    }
    
    // Return the signed URL or storage path (works with private buckets)
    const url = res?.data?.publicUrl || null;
    console.log('📤 Upload result URL:', url);
    return url;
  } catch (e) {
    console.error('Storage upload exception:', e);
    return null;
  }
}

// ==================== FOLDERS ====================
function renderFolders() {
  const list = document.getElementById('folders-list');
  const folders = state.folders;
  if (folders.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-title">${t('noFoldersTitle')}</div><div class="empty-state-text">${t('noFoldersText')}</div></div>`;
    return;
  }
  list.innerHTML = folders.map((f, i) => {
    const count = state.prompts.filter(p => p.folderId === f.id).length;
    const delay = i < MAX_ANIM_ITEMS ? `style="animation-delay:${i * 30}ms"` : 'style="animation:none;opacity:1;"';
    return `<div class="folder-card" data-folder-id="${f.id}" data-folder-click="${f.id}" ${delay}><div class="folder-card-left"><div class="folder-details"><div class="folder-card-name">${escapeHtml(f.name)}</div><div class="folder-card-count">${count} ${count !== 1 ? t('promptsWord') : t('promptWord')}</div></div></div><div class="folder-card-actions"><button class="prompt-action-btn" data-edit-folder="${f.id}" title="${t('edit')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="prompt-action-btn" data-delete-folder="${f.id}" title="${t('delete')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div></div>`;
  }).join('');

  // Click on folder card to navigate to prompts in that folder
  document.querySelectorAll('[data-folder-click]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.prompt-action-btn')) return; // Don't trigger on action buttons
      const folderId = card.dataset.folderClick;
      // Switch to prompts tab
      document.querySelector('[data-tab="prompts"]').click();
      // Expand only this folder section after tab switch
      setTimeout(() => {
        const sections = document.querySelectorAll('.folder-section');
        let targetSection = null;
        sections.forEach(s => {
          if (s.dataset.folderId === folderId) {
            s.classList.add('expanded');
            localStorage.setItem(`pv-folder-${folderId}`, 'true');
            targetSection = s;
            // Add highlight effect
            s.classList.add('folder-highlight');
            setTimeout(() => s.classList.remove('folder-highlight'), 2000);
          } else {
            s.classList.remove('expanded');
            localStorage.setItem(`pv-folder-${s.dataset.folderId}`, 'false');
          }
        });
        // Scroll to the folder if found
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    });
  });

  document.querySelectorAll('[data-edit-folder]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openFolderEditor(btn.dataset.editFolder); });
  });
  document.querySelectorAll('[data-delete-folder]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fId = btn.dataset.deleteFolder;
      const f = state.folders.find(x => x.id === fId);
      if (!f) return;
      const count = state.prompts.filter(p => p.folderId === fId).length;
      if (!confirm(t('deleteFolderConfirm', f.name) + (count ? '\n' + t('promptsMovedToUncategorized', count) : ''))) return;
      state.folders = state.folders.filter(x => x.id !== fId);
      state.prompts.forEach(p => { if (p.folderId === fId) p.folderId = null; });
      await saveData('folders', state.folders);
      await saveData('prompts', state.prompts);
      showToast(t('folderDeleted'), 'success');
      renderFolders();
      renderPrompts();
      syncFolderDeleteToSupabase(fId);
    });
  });
}

function openFolderEditor(folderId = null) {
  const folder = folderId ? state.folders.find(f => f.id === folderId) : null;
  const isEdit = !!folder;
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
    if (folderId) { const f = state.folders.find(x => x.id === folderId); if (f) { f.name = name; f.updatedAt = Date.now(); syncFolderToSupabase(f); } }
    else { const newF = { id: crypto.randomUUID(), name, createdAt: Date.now(), updatedAt: Date.now() }; state.folders.push(newF); syncFolderToSupabase(newF); }
    await saveData('folders', state.folders);
    showToast(folderId ? t('folderUpdated') : t('folderCreated'), 'success');
    closeModal('folder-editor-modal');
    renderFolders();
    renderPrompts();
  });
  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => closeModal('folder-editor-modal')));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal('folder-editor-modal'); });
}

// ==================== FAVORITES ====================
function renderFavorites() {
  const list = document.getElementById('favorites-list');
  const favorites = state.prompts.filter(p => p.isFavorite);
  if (favorites.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-title">${t('noFavoritesTitle')}</div><div class="empty-state-text">${t('noFavoritesText')}</div><button class="btn btn-secondary ripple" id="fav-browse-btn">${t('browsePrompts')}</button></div>`;
    document.getElementById('fav-browse-btn')?.addEventListener('click', () => document.querySelector('[data-tab="prompts"]').click());
    return;
  }
  let html = `<div class="favorites-header"><span class="favorites-header-title">${t('favorites')}</span><span class="favorites-count">${favorites.length}</span></div>`;
  html += favorites.map((p, i) => {
    const delay = i < MAX_ANIM_ITEMS ? `style="animation-delay:${i * 30}ms"` : 'style="animation:none;opacity:1;"';
    return `<div class="prompt-card favorite-card" data-prompt-id="${p.id}" ${delay}><div class="prompt-card-header"><div class="prompt-title">${escapeHtml(truncate(p.title, 50))}</div><div class="prompt-actions"><button class="prompt-action-btn" data-fav-copy="${p.id}" title="${t('copy')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button><button class="prompt-action-btn" data-fav-insert="${p.id}" title="${t('insertToPage')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg></button><button class="prompt-action-btn active" data-fav-remove="${p.id}" title="${t('removeFromFavorites')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></button></div></div><div class="prompt-meta"><span class="prompt-stat">${t('usedTimes', p.useCount || 0)}</span><span class="prompt-stat">${formatDate(p.updatedAt)}</span></div></div>`;
  }).join('');
  list.innerHTML = html;
  document.querySelectorAll('[data-fav-copy]').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); copyPrompt(btn.dataset.favCopy); }));
  document.querySelectorAll('[data-fav-insert]').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); insertPromptToPage(btn.dataset.favInsert); }));
  document.querySelectorAll('[data-fav-remove]').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(btn.dataset.favRemove); }));
  document.querySelectorAll('#favorites-list .prompt-card').forEach(card => {
    card.addEventListener('click', (e) => { if (!e.target.closest('.prompt-action-btn')) openPromptEditor(card.dataset.promptId); });
  });
}

// ==================== EXPLORE ====================
async function loadLibraryPrompts() {
  // Library prompts should be visible to authenticated users only
  if (!state.session || !state.user) {
    console.log('📚 Skipping library load - not authenticated');
    renderExplore();
    return;
  }
  
  console.log('📚 Loading library prompts...');
  try {
    // Show approved cards for everyone + own cards for the current user
    const currentUserId = encodeURIComponent(state.user.id);
    const libraryPath = `library_prompts?or=(is_approved.eq.true,is_approved.is.null,author_id.eq.${currentUserId})&order=likes.desc&limit=50`;

    // First try: approved cards + current user's own cards
    const res = await supabaseMsg({ 
      action: 'supabaseRequest', 
      method: 'GET', 
      path: libraryPath
    });
    console.log('📚 Library response:', JSON.stringify(res).substring(0, 500));
    
    if (res?.data && Array.isArray(res.data)) {
      state.libraryPrompts = res.data.map(p => ({ 
        id: p.id, 
        title: p.title, 
        text: p.text, 
        description: p.description, 
        author: p.author, 
        authorId: p.author_id, 
        tags: p.tags || [], 
        likes: p.likes || 0, 
        downloads: p.downloads || 0, 
        category: p.category || 'general', 
        isFeatured: p.is_featured,
        imageUrl: p.image_url || null
      }));
      console.log('📚 Loaded', state.libraryPrompts.length, 'library prompts');
    } else if (res?.error || (res?.data && Array.isArray(res.data) && res.data.length === 0)) {
      console.error('📚 Library load error:', res.error);
      // Fallback: try without filters to quickly reveal RLS/query issues in production
      console.log('📚 Trying fallback query without filter...');
      const fallbackRes = await supabaseMsg({ 
        action: 'supabaseRequest', 
        method: 'GET', 
        path: 'library_prompts?order=likes.desc&limit=50' 
      });
      console.log('📚 Fallback response:', JSON.stringify(fallbackRes).substring(0, 500));
      if (fallbackRes?.data && Array.isArray(fallbackRes.data)) {
        state.libraryPrompts = fallbackRes.data.map(p => ({ 
          id: p.id, 
          title: p.title, 
          text: p.text, 
          description: p.description, 
          author: p.author, 
          authorId: p.author_id, 
          tags: p.tags || [], 
          likes: p.likes || 0, 
          downloads: p.downloads || 0, 
          category: p.category || 'general', 
          isFeatured: p.is_featured,
          imageUrl: p.image_url || null
        }));
        console.log('📚 Fallback loaded', state.libraryPrompts.length, 'library prompts');
      }
    }
    
    // Load user likes and reports
    try {
      const likesRes = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: 'library_likes?select=prompt_id' });
      if (likesRes?.data) state.userLikes = new Set(likesRes.data.map(l => l.prompt_id));
    } catch (e) { console.warn('📚 Failed to load likes:', e); }
    
    try {
      const reportsRes = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: 'prompt_reports?select=prompt_id' });
      if (reportsRes?.data) state.userReports = new Set(reportsRes.data.map(r => r.prompt_id));
    } catch (e) { console.warn('📚 Failed to load reports:', e); }
  } catch (e) { 
    console.error('Failed to load library:', e); 
  }
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
  
  if (state.libraryPrompts.length === 0) {
    list.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-title">${t('noPublicPrompts')}</div><div class="empty-state-text">${t('beFirstToShare')}</div></div>`;
    return;
  }
  
  // Render library cards with flip effect
  list.innerHTML = state.libraryPrompts.map((p, i) => {
    const isFlipped = flippedCards.has(p.id);
    const isLiked = state.userLikes.has(p.id);
    const isReported = state.userReports.has(p.id);
    const delay = i < MAX_ANIM_ITEMS ? `style="animation-delay:${i * 50}ms"` : 'style="animation:none;opacity:1;"';
    const categoryInfo = CATEGORY_COLORS[p.category] || CATEGORY_COLORS['general'];
    
    // Thumbnail: use image_url if available, otherwise category gradient (no emoji)
    // For Supabase storage images, we'll load them asynchronously after render
    const hasStorageImage = p.imageUrl && isSupabaseStorageUrl(p.imageUrl);
    const hasDirectImage = p.imageUrl && !isSupabaseStorageUrl(p.imageUrl);
    const thumbnailStyle = hasDirectImage 
      ? `background-image: url('${escapeHtml(p.imageUrl)}'); background-size: cover; background-position: center;`
      : `background: ${categoryInfo.bg};`;
    const thumbnailContent = '';
    
    return `<div class="explore-card-wrapper" data-explore-id="${p.id}" ${delay}>
      <div class="explore-card ${isFlipped ? 'flipped' : ''}">
        <div class="explore-card-front">
          <div class="explore-card-thumbnail${hasStorageImage ? ' needs-image-load' : ''}" ${hasStorageImage ? `data-image-url="${escapeHtml(p.imageUrl)}"` : ''} style="${thumbnailStyle}">
            ${thumbnailContent}
            <div class="explore-card-category-badge">${escapeHtml(p.category || 'general')}</div>
          </div>
          <div class="explore-card-content">
            <div class="explore-card-title">${escapeHtml(truncate(p.title, 45))}</div>
            <div class="explore-card-meta">
              <span class="explore-card-author">${escapeHtml(p.author)}</span>
              <div class="explore-card-stats">
                <span class="explore-stat">❤️ ${p.likes}</span>
              </div>
            </div>
          </div>
          <div class="explore-flip-hint">Click to view code</div>
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
            <span style="font-size:11px;color:var(--text-tertiary);">${p.likes}</span>
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
    if (copyBtn) { e.stopPropagation(); const p = state.libraryPrompts.find(x => x.id === copyBtn.dataset.exploreCopy); if (p) { await navigator.clipboard.writeText(p.text); showToast(t('copiedToClipboard'), 'success'); } return; }
    const saveBtn = e.target.closest('[data-explore-save]');
    if (saveBtn) { 
      e.stopPropagation(); 
      if (!state.user) { showToast(t('signInToSave') || 'Sign in to save prompts', 'error'); return; }
      const id = saveBtn.dataset.exploreSave; 
      if (state.prompts.some(p => p.sourceId === id)) { showToast(t('alreadyInLibrary'), 'error'); return; } 
      if (!canCreatePrompt()) { showToast(t('freeLimitReached', getEffectiveLimit()), 'error'); return; } 
      const ep = state.libraryPrompts.find(x => x.id === id); 
      if (!ep) return; 
      state.prompts.unshift({ id: crypto.randomUUID(), sourceId: id, title: ep.title, text: ep.text, description: `From ${ep.author}`, tags: ep.tags || [], folderId: null, platform: 'universal', variables: [], isFavorite: false, useCount: 0, createdAt: Date.now(), updatedAt: Date.now() }); 
      await saveData('prompts', state.prompts); 
      showToast(t('savedToLibrary'), 'success'); 
      supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'rpc/increment_download_count', body: { prompt_uuid: id } }); 
      renderPrompts();
      return; 
    }
    const likeBtn = e.target.closest('[data-explore-like]');
    if (likeBtn) { 
      e.stopPropagation(); 
      if (!state.user) { showToast(t('signInToLike') || 'Sign in to like prompts', 'error'); return; }
      const id = likeBtn.dataset.exploreLike; 
      try { 
        const res = await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'rpc/toggle_library_like', body: { prompt_uuid: id } }); 
        if (res?.data) { 
          const result = Array.isArray(res.data) ? res.data[0] : res.data; 
          if (result.liked) state.userLikes.add(id); 
          else state.userLikes.delete(id); 
          const lp = state.libraryPrompts.find(x => x.id === id); 
          if (lp) lp.likes = result.likes; 
          renderExplore(); 
        } 
      } catch { showToast(t('failedToLike'), 'error'); } 
      return; 
    }
    const reportBtn = e.target.closest('[data-explore-report]');
    if (reportBtn) { e.stopPropagation(); if (!state.userReports.has(reportBtn.dataset.exploreReport)) openReportModal(reportBtn.dataset.exploreReport); return; }
    // Card flip on click
    const wrapper = e.target.closest('.explore-card-wrapper');
    if (wrapper && !e.target.closest('button')) {
      const card = wrapper.querySelector('.explore-card');
      const id = wrapper.dataset.exploreId;
      if (card.classList.contains('flipped')) { 
        card.classList.remove('flipped'); 
        flippedCards.delete(id); 
      } else { 
        card.classList.add('flipped'); 
        flippedCards.add(id); 
      }
    }
  };
  
  // Async: load images from private Supabase Storage for explore cards
  list.querySelectorAll('.explore-card-thumbnail.needs-image-load').forEach(async (el) => {
    const imageUrl = el.dataset.imageUrl;
    if (imageUrl) {
      try {
        const resolvedUrl = await resolveImageUrl(imageUrl);
        if (resolvedUrl) {
          el.style.cssText = `background-image: url('${resolvedUrl}'); background-size: cover; background-position: center;`;
        }
      } catch (e) {
        console.warn('Failed to load explore card image:', e);
      }
    }
  });
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
    const reason = modal.querySelector('input[name="report-reason"]:checked')?.value;
    const details = document.getElementById('report-details')?.value.trim();
    if (!reason) return;
    const btn = document.getElementById('report-submit-btn');
    btn.classList.add('loading');
    try {
      const res = await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'prompt_reports', body: { user_id: state.user.id, prompt_id: promptId, reason, details: details || null } });
      if (res?.error) throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
      state.userReports.add(promptId);
      showToast(t('reportSubmitted'), 'success');
      closeModal('report-modal');
      renderExplore();
    } catch (e) {
      if (e.message?.includes('duplicate')) { showToast(t('alreadyReported'), 'error'); state.userReports.add(promptId); }
      else showToast(t('failedToReport'), 'error');
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
    const dayLabel = new Date(dayEnd).toLocaleDateString(_lang === 'ru' ? 'ru' : 'en', { weekday: 'short' });
    const count = state.prompts.reduce((s, p) => { if (p.updatedAt && p.updatedAt >= dayStart && p.updatedAt < dayEnd && (p.useCount || 0) > 0) return s + 1; return s; }, 0);
    dailyUses.push({ label: dayLabel, count });
  }
  const maxDaily = Math.max(...dailyUses.map(d => d.count), 1);
  const platformMap = {};
  state.prompts.forEach(p => { const pl = p.platform || 'universal'; platformMap[pl] = (platformMap[pl] || 0) + (p.useCount || 0); });
  const platforms = Object.entries(platformMap).sort((a, b) => b[1] - a[1]);
  const maxPlatform = Math.max(...platforms.map(p => p[1]), 1);

  container.innerHTML = `<div class="stats-dashboard">
    <div class="stats-overview"><div class="stat-card"><div class="stat-card-value">${totalPrompts}</div><div class="stat-card-label">${t('totalPrompts')}</div></div><div class="stat-card"><div class="stat-card-value">${totalUses}</div><div class="stat-card-label">${t('totalUses')}</div></div><div class="stat-card"><div class="stat-card-value">${totalFavorites}</div><div class="stat-card-label">${t('favoritesCount')}</div></div></div>
    <div class="stats-section"><div class="stats-section-title">${t('activityLast7Days')}</div><div class="usage-chart">${dailyUses.map(d => `<div class="chart-bar-wrap"><div class="chart-bar" style="height:${Math.max((d.count / maxDaily) * 80, 2)}px;" title="${d.count}"></div><div class="chart-bar-label">${d.label}</div></div>`).join('')}</div></div>
    <div class="stats-section"><div class="stats-section-title">${t('mostUsedPrompts')}</div>${topPrompts.length > 0 ? topPrompts.map((p, i) => `<div class="top-prompt-item"><span class="top-prompt-rank">${i + 1}</span><span class="top-prompt-name">${escapeHtml(truncate(p.title, 30))}</span><span class="top-prompt-uses">${p.useCount} ${t('uses')}</span></div>`).join('') : `<div style="font-size:var(--font-size-xs);color:var(--text-tertiary);padding:8px 0;">${t('noUsageData')}</div>`}</div>
    ${platforms.length > 0 ? `<div class="stats-section"><div class="stats-section-title">${t('usageByPlatform')}</div><div class="platform-stats">${platforms.map(([name, count]) => `<div class="platform-stat-row"><span class="platform-stat-name">${escapeHtml(name)}</span><div class="platform-stat-bar-bg"><div class="platform-stat-bar" style="width:${(count / maxPlatform) * 100}%;"></div></div><span class="platform-stat-count">${count}</span></div>`).join('')}</div></div>` : ''}
    ${topTags.length > 0 ? `<div class="stats-section"><div class="stats-section-title">${t('topTags')}</div><div class="tags" style="flex-wrap:wrap;">${topTags.map(([tag, count]) => `<span class="tag">#${escapeHtml(tag)} (${count})</span>`).join('')}</div></div>` : ''}
    ${!state.isPremium && state.user ? `<div class="stats-section" style="border-color:var(--accent);"><div class="stats-section-title">${t('freePlan')}</div><div style="font-size:var(--font-size-sm);color:var(--text-secondary);line-height:1.6;">${t('promptsUsed', state.prompts.length, getEffectiveLimit())}<div style="margin-top:8px;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${Math.min((state.prompts.length / getEffectiveLimit()) * 100, 100)}%;background:${state.prompts.length >= getEffectiveLimit() ? 'var(--error)' : 'var(--accent)'};border-radius:3px;"></div></div><div style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-top:8px;">${t('upgradeInfo')}</div></div></div>` : ''}
  </div>`;
}

// ==================== SETTINGS ====================
function openSettings() {
  const s = state.settings;
  const user = state.user;
  const hotkeys = s.hotkeys || {};
  const commandNames = {
    'open-search': { label: t('searchOverlay'), default: 'Ctrl+Shift+P' },
    'hotkey-1': { label: t('quickInsertSlot', '1'), default: 'Alt+1' },
    'hotkey-2': { label: t('quickInsertSlot', '2'), default: 'Alt+2' },
    'hotkey-3': { label: t('quickInsertSlot', '3'), default: 'Alt+3' }
  };
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'settings-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width:500px;">
      <div class="modal-header"><h2 class="modal-title">${t('settings')}</h2><button class="btn btn-icon btn-ghost close-modal-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">${t('account')}</label>
          ${user ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);border:1px solid var(--border);"><div><div style="font-weight:500;">${escapeHtml(user.email || user.name || t('signedIn'))}</div><div style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-top:2px;">${t('cloudSyncActive')}${state.isPremium ? ' | Premium' : ` | ${t('free')} (${state.prompts.length}/${getEffectiveLimit()})`}</div></div><button class="btn btn-secondary btn-sm" id="settings-signout-btn">${t('signOut')}</button></div>` :
            `<button class="btn btn-primary" id="settings-signin-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/></svg>${t('signInWithGoogle')}</button><span class="form-hint">${t('signInHint')}</span>`}
        </div><div class="divider"></div>
        <div class="form-group"><label class="form-label">${t('language')}</label><select id="settings-lang"><option value="en" ${_lang === 'en' ? 'selected' : ''}>${t('langEnglish')}</option><option value="ru" ${_lang === 'ru' ? 'selected' : ''}>${t('langRussian')}</option></select></div><div class="divider"></div>
        <div class="form-group"><label class="form-label">${t('keyboardShortcuts')}</label><span class="form-hint" style="margin-bottom:12px;display:block;">${t('shortcutsHint')} <a href="#" id="open-shortcuts-link" style="color:var(--accent);">${t('chromeShortcuts')}</a></span><div class="hotkey-rebind-section" id="shortcuts-display"></div></div><div class="divider"></div>
        <div class="form-group"><label class="form-label">${t('quickInsertPrompts')}</label><span class="form-hint" style="margin-bottom:12px;display:block;">${t('quickInsertHint')}</span><div class="hotkey-section">
          ${[1, 2, 3].map(n => {
            const slotId = `slot${n}`;
            const slot = hotkeys[slotId] || {};
            const assigned = slot.promptId ? state.prompts.find(p => p.id === slot.promptId) : null;
            return `<div class="hotkey-item"><div class="hotkey-info"><div class="hotkey-name">${t('slot', n)}</div><div class="hotkey-description">${assigned ? escapeHtml(truncate(assigned.title, 25)) : t('noPromptAssigned')}</div></div><div class="hotkey-key"><select class="hotkey-prompt-select" data-hotkey-slot="${slotId}"><option value="">${t('selectPrompt')}</option>${state.prompts.map(p => `<option value="${p.id}" ${slot.promptId === p.id ? 'selected' : ''}>${escapeHtml(truncate(p.title, 25))}</option>`).join('')}</select><div class="hotkey-badge">Alt+${n}</div></div></div>`;
          }).join('')}
        </div></div><div class="divider"></div>
        <div class="form-group"><label class="form-label">${t('theme')}</label><select id="settings-theme"><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>${t('themeDark')}</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>${t('themeLight')}</option><option value="system" ${s.theme === 'system' ? 'selected' : ''}>${t('themeSystem')}</option></select></div><div class="divider"></div>
        <div class="form-group"><label class="form-label">${t('dataManagement')}</label><div style="display:flex;flex-direction:column;gap:8px;"><button class="btn btn-secondary" id="settings-export-btn">${t('exportAllData')}</button><button class="btn btn-secondary" id="settings-import-btn">${t('importData')}</button></div></div><div class="divider"></div>
        <div class="form-group"><label class="form-label">${t('about')}</label><div style="font-size:var(--font-size-sm);color:var(--text-secondary);line-height:1.6;"><strong>Promptory</strong> v1.1.0<br>${t('aboutDescription')}</div></div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost close-modal-btn">${t('cancel')}</button><button class="btn btn-primary" id="settings-save-btn">${t('saveChanges')}</button></div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);
  loadShortcutsDisplay(commandNames);
  document.getElementById('open-shortcuts-link')?.addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }); });

  document.getElementById('settings-signin-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('settings-signin-btn');
    btn.classList.add('loading');
    const result = await new Promise(resolve => chrome.runtime.sendMessage({ action: 'signInWithGoogle' }, resolve));
    btn.classList.remove('loading');
    if (result?.success) {
      state.user = result.user;
      state.session = result.session;
      // Ensure user/session are saved to local storage for persistence
      await saveData('user', state.user);
      await saveData('session', state.session);
      showToast(t('signedInSuccess'), 'success');
      closeModal('settings-modal');
      renderExplore();
      // First sync profile/data, THEN load library (order matters for profile creation)
      await syncAllData();
      await loadLibraryPrompts();
      checkPremiumStatus();
    } else {
      showToast(t('signInFailed') + ': ' + (result?.error || ''), 'error');
    }
  });
  document.getElementById('settings-signout-btn')?.addEventListener('click', async () => {
    if (!confirm(t('signOutConfirm'))) return;
    await new Promise(resolve => chrome.runtime.sendMessage({ action: 'signOut' }, resolve));
    state.user = null; state.session = null; state.isPremium = false;
    showToast(t('signedOutSuccess'), 'success');
    closeModal('settings-modal');
    renderExplore();
  });
  document.getElementById('settings-export-btn').addEventListener('click', () => {
    const data = { prompts: state.prompts, folders: state.folders, settings: state.settings, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `promptvault-backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(a.href);
    showToast(t('dataExported'), 'success');
  });
  document.getElementById('settings-import-btn').addEventListener('click', () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data.prompts && !data.folders) throw new Error('Invalid');
        if (!confirm(t('replaceAllData'))) return;
        if (data.prompts) state.prompts = data.prompts;
        if (data.folders) state.folders = data.folders;
        if (data.settings) state.settings = { ...state.settings, ...data.settings };
        await saveData('prompts', state.prompts); await saveData('folders', state.folders); await saveData('settings', state.settings);
        showToast(t('dataImported'), 'success');
        closeModal('settings-modal');
        renderPrompts(); renderFolders(); renderFavorites();
      } catch { showToast(t('importFailed'), 'error'); }
    };
    input.click();
  });
  document.getElementById('settings-save-btn').addEventListener('click', async () => {
    state.settings.theme = document.getElementById('settings-theme').value;
    const newLang = document.getElementById('settings-lang').value;
    document.querySelectorAll('[data-hotkey-slot]').forEach(sel => {
      const slotId = sel.dataset.hotkeySlot;
      if (!state.settings.hotkeys) state.settings.hotkeys = {};
      if (!state.settings.hotkeys[slotId]) state.settings.hotkeys[slotId] = {};
      state.settings.hotkeys[slotId].promptId = sel.value || null;
    });
    await saveData('settings', state.settings);
    applyTheme(state.settings.theme);
    if (newLang !== _lang) {
      _lang = newLang;
      await saveData('language', _lang);
      // Re-render UI with new language
      updateStaticTexts();
    }
    showToast(t('settingsSaved'), 'success');
    closeModal('settings-modal');
  });
  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => closeModal('settings-modal')));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal('settings-modal'); });
}

function loadShortcutsDisplay(commandNames) {
  const container = document.getElementById('shortcuts-display');
  if (!container) return;
  if (chrome.commands && chrome.commands.getAll) {
    chrome.commands.getAll(commands => {
      let html = '';
      commands.forEach(cmd => {
        if (cmd.name === '_execute_action') return;
        const info = commandNames[cmd.name] || { label: cmd.description || cmd.name, default: '' };
        const shortcut = cmd.shortcut || info.default || 'Not set';
        html += `<div class="hotkey-rebind-item"><span class="hotkey-rebind-label">${escapeHtml(info.label)}</span><span class="hotkey-rebind-current"><span class="hotkey-rebind-btn" title="${t('chromeShortcuts')}">${escapeHtml(shortcut)}</span></span></div>`;
      });
      container.innerHTML = html || `<div style="font-size:var(--font-size-xs);color:var(--text-tertiary);">No shortcuts</div>`;
      container.querySelectorAll('.hotkey-rebind-btn').forEach(btn => {
        btn.addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
      });
    });
  }
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
        return;
      }
    }
    // Fallback: direct profile query
    const res = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: `profiles?id=eq.${state.user.id}&select=is_premium,prompt_limit` });
    if (res?.data?.[0]) {
      state.isPremium = res.data[0].is_premium || false;
      state.promptLimit = res.data[0].prompt_limit || FREE_PROMPT_LIMIT;
      await saveData('isPremium', state.isPremium);
      await saveData('promptLimit', state.promptLimit);
    }
  } catch (e) { /* silent */ }
}

// ==================== SEARCH ====================
function initSearch() {
  const input = document.getElementById('search-input');
  let searchCache = null; // Cache lowercase versions for faster search
  
  const debouncedSearch = debounce((q) => {
    if (!q) {
      if (state.searchOriginalPrompts) { state.prompts = state.searchOriginalPrompts; state.searchOriginalPrompts = null; searchCache = null; }
      renderPrompts();
      return;
    }
    if (!state.searchOriginalPrompts) {
      state.searchOriginalPrompts = [...state.prompts];
      // Pre-compute lowercase search fields once
      searchCache = state.searchOriginalPrompts.map(p => ({
        prompt: p,
        title: p.title.toLowerCase(),
        desc: (p.description || '').toLowerCase(),
        tags: (p.tags || []).map(tg => tg.toLowerCase()),
        text: p.text.toLowerCase()
      }));
    }
    
    // Use cached lowercase fields for faster filtering
    const filtered = searchCache.filter(c =>
      c.title.includes(q) || c.desc.includes(q) ||
      c.tags.some(tg => tg.includes(q)) || c.text.includes(q)
    );
    state.prompts = filtered.map(c => c.prompt);
    renderPrompts();
    if (state.prompts.length === 0) {
      document.getElementById('prompts-list').innerHTML = `<div class="empty-state"><div class="empty-state-title">${t('noPromptsFound')}</div></div>`;
    }
  }, 200);

  input.addEventListener('input', () => debouncedSearch(input.value.trim().toLowerCase()));
}

// ==================== UPGRADE MODAL ====================
function showUpgradeModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'upgrade-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width:400px;">
      <div class="modal-header"><h2 class="modal-title">${t('upgradeToPremium')}</h2><button class="btn btn-icon btn-ghost close-modal-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="modal-body">
        <div class="upgrade-hero">
          <div class="upgrade-icon">✨</div>
          <div class="upgrade-title">${t('unlockPremium')}</div>
        </div>
        <div class="upgrade-features">
          <div class="upgrade-feature"><span class="upgrade-feature-icon">♾️</span><span>${t('premiumFeature1')}</span></div>
          <div class="upgrade-feature"><span class="upgrade-feature-icon">☁️</span><span>${t('premiumFeature2')}</span></div>
          <div class="upgrade-feature"><span class="upgrade-feature-icon">⭐</span><span>${t('premiumFeature3')}</span></div>
          <div class="upgrade-feature"><span class="upgrade-feature-icon">🚀</span><span>${t('premiumFeature4')}</span></div>
        </div>
        <div class="upgrade-note" style="padding:12px;background:var(--bg-tertiary);border-radius:var(--radius-md);margin-top:16px;">
          <div style="font-size:var(--font-size-xs);color:var(--text-tertiary);line-height:1.6;">${t('premiumNote')}</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost close-modal-btn">${t('cancel')}</button>
        <button class="btn btn-primary ripple" id="upgrade-contact-btn">${t('contactForPremium')}</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);
  
  document.getElementById('upgrade-contact-btn').addEventListener('click', () => {
    // Open contact/email link for premium upgrade
    window.open('mailto:support@promptory.app?subject=Premium%20Upgrade%20Request', '_blank');
    closeModal('upgrade-modal');
  });
  
  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => closeModal('upgrade-modal')));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal('upgrade-modal'); });
}

// ==================== MODAL UTILS ====================
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) { modal.classList.remove('visible'); setTimeout(() => modal.remove(), 250); }
}

// ==================== SUPABASE SYNC ====================
async function syncPromptToSupabase(prompt) {
  if (!state.session || !state.user) {
    console.log('⏭️ Skipping sync - no session');
    return;
  }
  try { 
    console.log('☁️ Syncing prompt to cloud:', prompt.title);
    const body = { 
      id: prompt.id, 
      user_id: state.user.id, 
      folder_id: prompt.folderId || null, 
      title: prompt.title, 
      text: prompt.text, 
      description: prompt.description, 
      image_url: prompt.imageUrl || null,
      platform: prompt.platform || 'universal', 
      tags: prompt.tags || [], 
      variables: prompt.variables || [], 
      is_favorite: prompt.isFavorite || false, 
      use_count: prompt.useCount || 0, 
      updated_at: new Date().toISOString() 
    };
    const res = await supabaseMsg({ 
      action: 'supabaseRequest', 
      method: 'POST', 
      path: 'prompts', 
      body 
    }); 
    if (res?.error) {
      console.warn('⚠️ Sync error for prompt:', prompt.title, res.error);
      // If error contains "foreign key", the folder might not exist in cloud
      if (typeof res.error === 'string' && res.error.includes('folder_id')) {
        console.log('🔄 Retrying without folder_id...');
        body.folder_id = null;
        const retry = await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'prompts', body });
        if (retry?.error) {
          console.warn('⚠️ Retry also failed:', retry.error);
        } else {
          console.log('✅ Synced prompt (without folder):', prompt.title);
        }
      }
    } else {
      console.log('✅ Synced prompt:', prompt.title);
    }
  } catch (e) { 
    console.error('❌ Sync failed:', e); 
  }
}

async function syncPromptDeleteToSupabase(id) {
  if (!state.session || !state.user) return;
  try { await supabaseMsg({ action: 'supabaseRequest', method: 'DELETE', path: `prompts?id=eq.${id}` }); } catch (e) { /* silent */ }
}

async function syncFolderToSupabase(folder) {
  if (!state.session || !state.user) return;
  try { await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'folders', body: { id: folder.id, user_id: state.user.id, name: folder.name, updated_at: new Date().toISOString() } }); } catch (e) { /* silent */ }
}

async function syncFolderDeleteToSupabase(id) {
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
      const syncRes = await supabaseMsg({ 
        action: 'supabaseRequest', 
        method: 'POST', 
        path: 'rpc/sync_user_on_login',
        body: {}
      });
      console.log('📋 sync_user_on_login response:', JSON.stringify(syncRes));
      
      if (syncRes?.data) {
        const syncData = Array.isArray(syncRes.data) ? syncRes.data[0] : syncRes.data;
        if (syncData && syncData.success !== false) {
          profileExists = true;
          state.isPremium = syncData.is_premium || false;
          state.promptLimit = syncData.prompt_limit || FREE_PROMPT_LIMIT;
          console.log('✅ Profile synced via RPC. Premium:', state.isPremium, 'Limit:', state.promptLimit);
        } else {
          console.warn('⚠️ sync_user_on_login returned:', syncData);
        }
      } else if (syncRes?.error) {
        console.warn('⚠️ sync_user_on_login error:', syncRes.error);
      }
    } catch (rpcErr) {
      console.warn('⚠️ sync_user_on_login exception:', rpcErr);
    }
    
    // Fallback: try direct profile fetch/create if RPC failed
    if (!profileExists) {
      console.log('📋 Trying fallback profile fetch...');
      try {
        const profileRes = await supabaseMsg({ 
          action: 'supabaseRequest', 
          method: 'GET', 
          path: `profiles?id=eq.${state.user.id}&select=id,is_premium,prompt_limit` 
        });
        console.log('📋 Profile fallback response:', JSON.stringify(profileRes));
        
        if (profileRes?.data?.length > 0) {
          profileExists = true;
          const profile = profileRes.data[0];
          state.isPremium = profile.is_premium || false;
          state.promptLimit = profile.prompt_limit || FREE_PROMPT_LIMIT;
          console.log('✅ Profile found via fallback. Premium:', state.isPremium, 'Limit:', state.promptLimit);
        } else {
          // Try to create profile directly
          console.log('📋 Creating profile directly...');
          const createRes = await supabaseMsg({
            action: 'supabaseRequest',
            method: 'POST',
            path: 'profiles',
            body: {
              id: state.user.id,
              email: state.user.email,
              full_name: state.user.name || state.user.email?.split('@')[0] || 'User',
              avatar_url: state.user.avatar || ''
            }
          });
          console.log('📋 Profile create response:', JSON.stringify(createRes));
          if (!createRes?.error) {
            profileExists = true;
            console.log('✅ Profile created directly');
          } else {
            console.warn('⚠️ Profile create failed:', createRes.error);
            // Even if insert fails (e.g. duplicate), the profile might exist
            profileExists = true;
          }
        }
      } catch (fallbackErr) {
        console.warn('⚠️ Profile fallback error:', fallbackErr);
        // Assume profile exists and try to continue with sync anyway
        profileExists = true;
      }
    }
    
    await saveData('isPremium', state.isPremium);
    await saveData('promptLimit', state.promptLimit);

    // Step 2: Sync folders (bidirectional merge)
    console.log('📁 Syncing folders...');
    const fRes = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: 'folders?order=created_at.asc' });
    console.log('📁 Folders response:', fRes?.data?.length, 'items, error:', fRes?.error || 'none');
    
    if (fRes?.data) {
      const cloudFolders = fRes.data.map(f => ({ 
        id: f.id, 
        name: f.name, 
        createdAt: new Date(f.created_at).getTime(), 
        updatedAt: new Date(f.updated_at).getTime() 
      }));
      
      // Bidirectional merge: combine cloud + local, newest wins on conflicts
      const cloudFolderMap = new Map(cloudFolders.map(f => [f.id, f]));
      const localFolders = [...state.folders];
      const mergedFolders = new Map();
      
      // Add all cloud folders
      cloudFolders.forEach(f => mergedFolders.set(f.id, f));
      
      // Add local folders that don't exist in cloud, or are newer
      for (const lf of localFolders) {
        const cf = cloudFolderMap.get(lf.id);
        if (!cf) {
          // Local only - upload to cloud
          mergedFolders.set(lf.id, lf);
          await syncFolderToSupabase(lf);
          console.log('📤 Uploaded local folder:', lf.name);
        } else if (lf.updatedAt > cf.updatedAt) {
          // Local is newer - update cloud
          mergedFolders.set(lf.id, lf);
          await syncFolderToSupabase(lf);
        }
      }
      
      state.folders = Array.from(mergedFolders.values());
      await saveData('folders', state.folders);
      console.log('✅ Merged folders:', state.folders.length);
    } else if (fRes?.error) {
      console.warn('⚠️ Failed to fetch folders:', fRes.error);
    }
    
    // Step 3: Sync prompts (bidirectional merge)
    console.log('📝 Syncing prompts...');
    const pRes = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: 'prompts?order=created_at.desc' });
    console.log('📝 Prompts response:', pRes?.data?.length, 'items, error:', pRes?.error || 'none');
    
    if (pRes?.data) {
      const cloudPrompts = pRes.data.map(p => ({ 
        id: p.id, 
        title: p.title, 
        text: p.text, 
        description: p.description, 
        imageUrl: p.image_url || null,
        folderId: p.folder_id, 
        platform: p.platform, 
        tags: p.tags || [], 
        variables: p.variables || [], 
        isFavorite: p.is_favorite || false, 
        useCount: p.use_count || 0, 
        createdAt: new Date(p.created_at).getTime(), 
        updatedAt: new Date(p.updated_at).getTime() 
      }));
      
      // Bidirectional merge: combine cloud + local, newest wins on conflicts
      const cloudPromptMap = new Map(cloudPrompts.map(p => [p.id, p]));
      const localPrompts = [...state.prompts];
      const mergedPrompts = new Map();
      
      // Add all cloud prompts
      cloudPrompts.forEach(p => mergedPrompts.set(p.id, p));
      
      // Add local prompts that don't exist in cloud, or are newer
      for (const lp of localPrompts) {
        const cp = cloudPromptMap.get(lp.id);
        if (!cp) {
          // Local only - upload to cloud
          mergedPrompts.set(lp.id, lp);
          await syncPromptToSupabase(lp);
          console.log('📤 Uploaded local prompt:', lp.title);
        } else if (lp.updatedAt > cp.updatedAt) {
          // Local is newer - update cloud
          mergedPrompts.set(lp.id, lp);
          await syncPromptToSupabase(lp);
        }
      }
      
      state.prompts = Array.from(mergedPrompts.values()).sort((a, b) => b.createdAt - a.createdAt);
      await saveData('prompts', state.prompts);
      console.log('✅ Merged prompts:', state.prompts.length);
    } else if (pRes?.error) {
      console.warn('⚠️ Failed to fetch prompts:', pRes.error);
      // If fetch failed but we have local prompts, try uploading them
      if (state.prompts.length > 0 && profileExists) {
        console.log('📤 Uploading', state.prompts.length, 'local prompts to cloud...');
        for (const p of state.prompts) {
          await syncPromptToSupabase(p);
        }
      }
    }
    
    // Step 4: Update UI
    renderPrompts(); 
    renderFolders(); 
    renderFavorites();
    renderLimitBanner();
    
    console.log('✅ Sync complete! Prompts:', state.prompts.length, 'Folders:', state.folders.length, 'Premium:', state.isPremium);
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

// ==================== INIT ====================
async function init() {
  // Load i18n locales first
  await loadLocale('en');
  await loadLocale('ru');

  await loadData();
  applyTheme(state.settings.theme);

  const welcomeScreen = document.getElementById('welcome-screen');
  const mainApp = document.getElementById('main-app');

  if (state.isFirstLaunch) {
    welcomeScreen.style.display = 'flex';
    mainApp.style.display = 'none';
    // Update welcome screen texts
    document.getElementById('welcome-title').textContent = t('welcomeTitle');
    document.getElementById('welcome-text').textContent = t('welcomeText');
    document.getElementById('get-started-btn').textContent = t('getStarted');
    document.getElementById('get-started-btn').addEventListener('click', () => {
      welcomeScreen.style.display = 'none';
      mainApp.style.display = 'flex';
      state.isFirstLaunch = false;
    });
  } else {
    welcomeScreen.style.display = 'none';
    mainApp.style.display = 'flex';
  }

  // Update static text from i18n
  updateStaticTexts();

  initTabs();
  renderPrompts();
  renderFolders();
  renderFavorites();
  renderExplore();
  initSearch();

  document.getElementById('new-prompt-btn').addEventListener('click', () => openPromptEditor());
  document.getElementById('new-folder-btn').addEventListener('click', () => openFolderEditor());
  document.getElementById('settings-btn').addEventListener('click', openSettings);

  chrome.storage.onChanged.addListener((changes) => {
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

  // If logged in, load library and sync user data
  if (state.session && state.user) { 
    // Run sync first, then load library (profile must exist before library loads)
    syncAllData().then(() => {
      loadLibraryPrompts();
    });
    checkPremiumStatus(); 
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
