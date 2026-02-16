// PromptVault -> Promptory Popup - Main Controller
// Performance-optimized, i18n-enabled, 3 hotkey slots

(function() {
'use strict';

// ==================== CONSTANTS (from shared config.js) ====================
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
const FREE_PROMPT_LIMIT = CONFIG.FREE_PROMPT_LIMIT;
const MAX_ANIM_ITEMS = CONFIG.MAX_ANIM_ITEMS;
const SETTINGS_PROMPT_SELECT_LIMIT = CONFIG.SETTINGS_PROMPT_SELECT_LIMIT;
const LIBRARY_PAGE_SIZE = CONFIG.LIBRARY_PAGE_SIZE;

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
  libraryError: null,
  searchOriginalPrompts: null,
  userLikes: new Set(),
  userReports: new Set(),
  isPremium: false,
  promptLimit: FREE_PROMPT_LIMIT,
  isAdmin: false,
  pendingReports: []
};

// ==================== UTILITIES ====================
// Simple client-side rate limiter to prevent spam clicks on likes/reports
const _rateLimits = {};
function isRateLimited(key, cooldownMs = 2000) {
  const now = Date.now();
  if (_rateLimits[key] && now - _rateLimits[key] < cooldownMs) return true;
  _rateLimits[key] = now;
  return false;
}

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

// Retry wrapper with exponential backoff for critical Supabase operations
async function supabaseMsgWithRetry(params, { maxRetries = 2, baseDelay = 1000 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await supabaseMsg(params);
      // Don't retry on auth/permission errors - they won't resolve themselves
      if (res?.error) {
        const errStr = parseSupabaseError(res.error).toLowerCase();
        if (errStr.includes('not authenticated') || errStr.includes('jwt') || errStr.includes('permission') || errStr.includes('rls') || errStr.includes('duplicate') || errStr.includes('23505')) {
          return res;
        }
        // Retry on server/network errors
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
          continue;
        }
      }
      return res;
    } catch (e) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
        continue;
      }
      return { error: e.message || 'Network error' };
    }
  }
}

function parseSupabaseError(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  try { return JSON.stringify(error); } catch { return String(error); }
}

function isAuthError(error) {
  const msg = parseSupabaseError(error).toLowerCase();
  return msg.includes('not authenticated') || msg.includes('jwt') || msg.includes('token') || msg.includes('401');
}

// Truncate text for performance (avoid rendering huge strings)
function truncate(text, max = 120) {
  if (!text || text.length <= max) return text || '';
  return text.substring(0, max) + '...';
}

let _settingsPromptPoolCache = { key: '', items: [] };

function getSettingsPromptPool() {
  const cacheKey = `${state.prompts.length}:${state.prompts[0]?.updatedAt || 0}`;
  if (_settingsPromptPoolCache.key === cacheKey) return _settingsPromptPoolCache.items;

  const sorted = [...state.prompts].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const items = sorted.slice(0, SETTINGS_PROMPT_SELECT_LIMIT);
  _settingsPromptPoolCache = { key: cacheKey, items };
  return items;
}

function getSettingsPromptOptions(selectedPromptId) {
  const selectedId = selectedPromptId || null;
  const limited = [...getSettingsPromptPool()];

  if (selectedId && !limited.some(p => p.id === selectedId)) {
    const selectedPrompt = state.prompts.find(p => p.id === selectedId);
    if (selectedPrompt) limited.unshift(selectedPrompt);
  }

  return limited.map(p => `<option value="${p.id}" ${selectedId === p.id ? 'selected' : ''}>${escapeHtml(truncate(p.title, 25))}</option>`).join('');
}

// Debounce utility
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// CSV line parser (handles quoted fields with commas/newlines)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
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
// Data version migration system
const DATA_VERSION = 2; // Increment when schema changes

async function migrateData(currentVersion) {
  if (currentVersion < 1) {
    // v0 -> v1: Ensure all prompts have required fields
    const { prompts } = await new Promise(r => chrome.storage.local.get(['prompts'], r));
    if (prompts && Array.isArray(prompts)) {
      let changed = false;
      prompts.forEach(p => {
        if (!p.imageUrl && p.imageUrl !== null) { p.imageUrl = null; changed = true; }
        if (!p.variables) { p.variables = []; changed = true; }
        if (!p.tags) { p.tags = []; changed = true; }
        if (p.useCount === undefined) { p.useCount = 0; changed = true; }
      });
      if (changed) await new Promise(r => chrome.storage.local.set({ prompts }, r));
    }
  }
  if (currentVersion < 2) {
    // v1 -> v2: Add platform field to old prompts, ensure createdAt/updatedAt
    const { prompts } = await new Promise(r => chrome.storage.local.get(['prompts'], r));
    if (prompts && Array.isArray(prompts)) {
      let changed = false;
      const now = Date.now();
      prompts.forEach(p => {
        if (!p.platform) { p.platform = 'universal'; changed = true; }
        if (!p.createdAt) { p.createdAt = now; changed = true; }
        if (!p.updatedAt) { p.updatedAt = now; changed = true; }
      });
      if (changed) await new Promise(r => chrome.storage.local.set({ prompts }, r));
    }
  }
  // Save current version
  await new Promise(r => chrome.storage.local.set({ dataVersion: DATA_VERSION }, r));
  console.log(`📦 Data migrated to version ${DATA_VERSION}`);
}

async function loadData() {
  return new Promise(resolve => {
    chrome.storage.local.get(['prompts', 'folders', 'settings', 'user', 'session', 'hasLaunched', 'isPremium', 'promptLimit', 'language', 'libraryPromptsCache', 'dataVersion'], async (result) => {
      // Run data migrations if needed
      const storedVersion = result.dataVersion || 0;
      if (storedVersion < DATA_VERSION) {
        await migrateData(storedVersion);
      }
      
      if (result.prompts) state.prompts = result.prompts;
      if (result.folders) state.folders = result.folders;
      if (result.settings) state.settings = { ...state.settings, ...result.settings };
      if (result.user) state.user = result.user;
      if (result.session) state.session = result.session;
      if (result.isPremium) state.isPremium = result.isPremium;
      if (result.promptLimit) state.promptLimit = result.promptLimit;
      if (result.libraryPromptsCache && Array.isArray(result.libraryPromptsCache)) state.libraryPrompts = result.libraryPromptsCache;
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
// Lazy-render prompts using IntersectionObserver to avoid DOM overload
const VIRTUAL_SCROLL_THRESHOLD = 50; // Only virtualize if more than 50 prompts in a folder
const VIRTUAL_BATCH_SIZE = 20; // Render 20 at a time

class VirtualFolderRenderer {
  constructor(container, prompts, renderFn) {
    this.container = container;
    this.allPrompts = prompts;
    this.renderFn = renderFn;
    this.rendered = 0;
    this.observer = null;
  }

  init() {
    if (this.allPrompts.length <= VIRTUAL_SCROLL_THRESHOLD) {
      // Small list — render all at once
      this.container.innerHTML = this.allPrompts.map((p, i) => this.renderFn(p, i)).join('');
      return;
    }

    // Large list — render first batch + sentinel
    this.rendered = Math.min(VIRTUAL_BATCH_SIZE, this.allPrompts.length);
    let html = this.allPrompts.slice(0, this.rendered).map((p, i) => this.renderFn(p, i)).join('');
    
    if (this.rendered < this.allPrompts.length) {
      html += `<div class="virtual-scroll-sentinel" data-remaining="${this.allPrompts.length - this.rendered}">
        <div class="virtual-scroll-hint">${this.allPrompts.length - this.rendered} more prompts...</div>
      </div>`;
    }
    this.container.innerHTML = html;
    
    // Observe sentinel for lazy loading
    const sentinel = this.container.querySelector('.virtual-scroll-sentinel');
    if (sentinel) {
      this.observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) this.loadMore();
      }, { rootMargin: '100px' });
      this.observer.observe(sentinel);
    }
  }

  loadMore() {
    if (this.rendered >= this.allPrompts.length) return;
    
    const nextBatch = this.allPrompts.slice(this.rendered, this.rendered + VIRTUAL_BATCH_SIZE);
    const frag = document.createDocumentFragment();
    const temp = document.createElement('div');
    temp.innerHTML = nextBatch.map((p, i) => this.renderFn(p, this.rendered + i)).join('');
    while (temp.firstChild) frag.appendChild(temp.firstChild);
    
    this.rendered += nextBatch.length;
    
    // Remove old sentinel
    const oldSentinel = this.container.querySelector('.virtual-scroll-sentinel');
    if (oldSentinel) {
      this.container.insertBefore(frag, oldSentinel);
      if (this.rendered >= this.allPrompts.length) {
        if (this.observer) this.observer.disconnect();
        oldSentinel.remove();
      } else {
        oldSentinel.dataset.remaining = String(this.allPrompts.length - this.rendered);
        oldSentinel.querySelector('.virtual-scroll-hint').textContent = 
          `${this.allPrompts.length - this.rendered} more prompts...`;
      }
    }
  }

  destroy() {
    if (this.observer) this.observer.disconnect();
  }
}

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
  }
  
  return section;
}

function renderPromptCard(prompt, idx) {
  const delay = idx < MAX_ANIM_ITEMS ? `style="animation-delay:${idx * 35}ms"` : 'style="animation:none;opacity:1;transform:none;"';
  const tagsHtml = prompt.tags?.length
    ? `<div class="tags">${prompt.tags.slice(0, 3).map(tg => `<span class="tag">#${escapeHtml(tg)}</span>`).join('')}${prompt.tags.length > 3 ? `<span class="tag">+${prompt.tags.length - 3}</span>` : ''}</div>`
    : '';
  // Card click = copy. Actions: fav, edit, insert, menu. Added glare-card for premium hover effect
  // Keyboard: tabindex + role for accessibility; draggable for drag-and-drop
  return `
    <div class="prompt-card glare-card" data-prompt-id="${prompt.id}" ${delay} title="${t('clickToCopy') || 'Click to copy'}" tabindex="0" role="button" aria-label="${escapeHtml(prompt.title)} - ${t('clickToCopy')}" draggable="true">
      <div class="prompt-card-header">
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
    renderPrompts();
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

// ==================== COPY PROMPT (single unified copy function) ====================
// This is THE copy function used everywhere - card click, button click, context menu, explore
async function copyPromptText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); document.body.removeChild(textarea); return true; }
    catch { document.body.removeChild(textarea); return false; }
  }
}

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
  _suppressStorageRender = true;
  await saveData('prompts', state.prompts);
  _suppressStorageRender = false;
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
  
  // Auto-compress images larger than 500KB
  const needsCompression = file.size > 500 * 1024;
  
  const processImage = (dataUrl) => {
    const preview = document.getElementById('pe-image-preview');
    const zone = document.getElementById('pe-image-zone');
    preview.innerHTML = `
      <img src="${dataUrl}" alt="Preview" style="max-width:100%;max-height:150px;border-radius:var(--radius-md);object-fit:cover;display:block;" onerror="this.style.display='none';">
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
  
  if (needsCompression) {
    // Compress using canvas
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Scale down if very large
        let w = img.width, h = img.height;
        const maxDim = 1200;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        // Try quality levels until under 500KB
        let quality = 0.8;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 500 * 1024 * 1.37 && quality > 0.3) { // 1.37 = base64 overhead
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        // Create compressed file blob for upload
        canvas.toBlob((blob) => {
          if (blob) {
            pendingImageFile = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
            console.log(`📸 Image compressed: ${(file.size/1024).toFixed(0)}KB → ${(blob.size/1024).toFixed(0)}KB (q=${quality.toFixed(1)})`);
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
  let previousFolderId = null;
  if (editingId) {
    const p = state.prompts.find(x => x.id === editingId);
    if (p) { 
      previousFolderId = p.folderId || null;
      Object.assign(p, { title, text, description: desc, folderId, platform, tags, variables, imageUrl, updatedAt: Date.now() }); 
      syncPromptToSupabase(p); 
    }
  } else {
    if (!canCreatePrompt()) { showToast(t('freeLimitReached', getEffectiveLimit()), 'error'); saveBtn.classList.remove('loading'); return; }
    const newP = { id: crypto.randomUUID(), title, text, description: desc, folderId, platform, tags, variables, imageUrl, isFavorite: false, useCount: 0, createdAt: Date.now(), updatedAt: Date.now() };
    state.prompts.unshift(newP);
    syncPromptToSupabase(newP);
  }
  // Suppress storage listener re-renders during our own save (prevents full page reload flicker)
  _suppressStorageRender = true;
  await saveData('prompts', state.prompts);
  _suppressStorageRender = false;
  saveBtn.classList.remove('loading');
  pendingImageFile = null;
  showToast(editingId ? t('promptUpdated') : t('promptCreated'), 'success');
  closeModal('prompt-editor-modal');
  // For edits: try in-place update (no flicker). Full re-render only when needed (new prompt or folder change)
  if (editingId) {
    const updatedPrompt = state.prompts.find(x => x.id === editingId);
    const folderChanged = (previousFolderId || 'uncategorized') !== (folderId || 'uncategorized');
    if (folderChanged || !updatedPrompt || !updatePromptCardInPlace(editingId, updatedPrompt)) {
      // Folder changed or card not found — need full re-render but use rAF to avoid layout thrash
      requestAnimationFrame(() => { renderPrompts(); renderFavorites(); });
    } else {
      // In-place update succeeded — only refresh favorites in case it's also there
      renderFavorites();
    }
  } else {
    requestAnimationFrame(() => { renderPrompts(); renderFavorites(); });
  }
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
      _suppressStorageRender = true;
      await saveData('folders', state.folders);
      await saveData('prompts', state.prompts);
      _suppressStorageRender = false;
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
    } else {
      renderFolders();
    }
    // Don't re-render prompts list here - it causes visible flicker on folders tab
  });
  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => closeModal('folder-editor-modal')));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal('folder-editor-modal'); });
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
    card.addEventListener('click', (e) => { if (!e.target.closest('.prompt-action-btn')) copyPrompt(card.dataset.promptId); });
  });
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
        const newItems = res.data.map(p => ({
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
    const delay = i < MAX_ANIM_ITEMS ? `style="animation-delay:${i * 60}ms"` : 'style="animation:none;opacity:1;transform:none;"';
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
      if (isRateLimited('like_' + id, 1500)) return;
      try { 
        const res = await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'rpc/toggle_library_like', body: { prompt_uuid: id } }); 
        if (res?.data) { 
          const result = Array.isArray(res.data) ? res.data[0] : res.data; 
          if (result.liked) state.userLikes.add(id); 
          else state.userLikes.delete(id); 
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
    }, { rootMargin: '100px' });
    imageElements.forEach(el => imgObserver.observe(el));
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
    loadMoreContainer.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 16px 0;';
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
    <div class="stats-overview"><div class="stat-card" style="animation:floatUp 400ms var(--ease-out-expo) forwards;animation-delay:0ms;"><div class="stat-card-value">${totalPrompts}</div><div class="stat-card-label">${t('totalPrompts')}</div></div><div class="stat-card" style="animation:floatUp 400ms var(--ease-out-expo) forwards;animation-delay:80ms;opacity:0;"><div class="stat-card-value">${totalUses}</div><div class="stat-card-label">${t('totalUses')}</div></div><div class="stat-card" style="animation:floatUp 400ms var(--ease-out-expo) forwards;animation-delay:160ms;opacity:0;"><div class="stat-card-value">${totalFavorites}</div><div class="stat-card-label">${t('favoritesCount')}</div></div></div>
    <div class="stats-section"><div class="stats-section-title">${t('activityLast7Days')}</div><div class="usage-chart">${dailyUses.map(d => `<div class="chart-bar-wrap"><div class="chart-bar" style="height:${Math.max((d.count / maxDaily) * 80, 2)}px;" title="${d.count}"></div><div class="chart-bar-label">${d.label}</div></div>`).join('')}</div></div>
    <div class="stats-section"><div class="stats-section-title">${t('mostUsedPrompts')}</div>${topPrompts.length > 0 ? topPrompts.map((p, i) => `<div class="top-prompt-item"><span class="top-prompt-rank">${i + 1}</span><span class="top-prompt-name">${escapeHtml(truncate(p.title, 30))}</span><span class="top-prompt-uses">${p.useCount} ${t('uses')}</span></div>`).join('') : `<div style="font-size:var(--font-size-xs);color:var(--text-tertiary);padding:8px 0;">${t('noUsageData')}</div>`}</div>
    ${platforms.length > 0 ? `<div class="stats-section"><div class="stats-section-title">${t('usageByPlatform')}</div><div class="platform-stats">${platforms.map(([name, count]) => `<div class="platform-stat-row"><span class="platform-stat-name">${escapeHtml(name)}</span><div class="platform-stat-bar-bg"><div class="platform-stat-bar" style="width:${(count / maxPlatform) * 100}%;"></div></div><span class="platform-stat-count">${count}</span></div>`).join('')}</div></div>` : ''}
    ${topTags.length > 0 ? `<div class="stats-section"><div class="stats-section-title">${t('topTags')}</div><div class="tags" style="flex-wrap:wrap;">${topTags.map(([tag, count]) => `<span class="tag">#${escapeHtml(tag)} (${count})</span>`).join('')}</div></div>` : ''}
    ${!state.isPremium && state.user ? `<div class="stats-section" style="border-color:rgba(var(--accent-rgb),0.3);"><div class="stats-section-title">${t('freePlan')}</div><div style="font-size:var(--font-size-sm);color:var(--text-secondary);line-height:1.6;">${t('promptsUsed', state.prompts.length, getEffectiveLimit())}<div style="margin-top:8px;height:6px;background:var(--bg-tertiary);border-radius:var(--radius-full);overflow:hidden;"><div style="height:100%;width:${Math.min((state.prompts.length / getEffectiveLimit()) * 100, 100)}%;background:${state.prompts.length >= getEffectiveLimit() ? 'var(--error)' : 'var(--accent-gradient)'};border-radius:var(--radius-full);transition:width 500ms var(--ease-out-expo);"></div></div><div style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-top:8px;">${t('upgradeInfo')}</div></div></div>` : ''}
  </div>`;
}

// ==================== SETTINGS (optimized: lazy sections, reduced reflows) ====================
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
  modal.className = 'modal-overlay no-blur';
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
        <div class="form-group"><label class="form-label">${t('quickInsertPrompts')}</label><span class="form-hint" style="margin-bottom:12px;display:block;">${t('quickInsertHint')}</span><span class="form-hint" style="margin-bottom:8px;display:block;">${state.prompts.length > SETTINGS_PROMPT_SELECT_LIMIT ? `Showing recent ${SETTINGS_PROMPT_SELECT_LIMIT} prompts for faster settings` : ''}</span><div class="hotkey-section">
          ${[1, 2, 3].map(n => {
            const slotId = `slot${n}`;
            const slot = hotkeys[slotId] || {};
            const assigned = slot.promptId ? state.prompts.find(p => p.id === slot.promptId) : null;
            return `<div class="hotkey-item"><div class="hotkey-info"><div class="hotkey-name">${t('slot', n)}</div><div class="hotkey-description">${assigned ? escapeHtml(truncate(assigned.title, 25)) : t('noPromptAssigned')}</div></div><div class="hotkey-key"><select class="hotkey-prompt-select" data-hotkey-slot="${slotId}"><option value="">${t('selectPrompt')}</option>${getSettingsPromptOptions(slot.promptId)}</select><div class="hotkey-badge">Alt+${n}</div></div></div>`;
          }).join('')}
        </div></div><div class="divider"></div>
        <div class="form-group"><label class="form-label">${t('theme')}</label><select id="settings-theme"><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>${t('themeDark')}</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>${t('themeLight')}</option><option value="system" ${s.theme === 'system' ? 'selected' : ''}>${t('themeSystem')}</option></select></div><div class="divider"></div>
        <div class="form-group"><label class="form-label">${t('dataManagement')}</label><div style="display:flex;flex-direction:column;gap:8px;"><button class="btn btn-secondary" id="settings-export-btn">${t('exportAllData')}</button><button class="btn btn-secondary" id="settings-import-btn">${t('importData')}</button></div></div><div class="divider"></div>
        <div class="form-group"><label class="form-label">${t('proSubscription')}</label>
          <div class="pro-settings-card">
            <div class="pro-settings-header">
              <div class="pro-settings-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div class="pro-settings-info">
                <div class="pro-settings-title">${state.isPremium ? t('premiumActive') : t('proSubscription')}</div>
                <div class="pro-settings-subtitle">${state.isPremium ? t('premiumActiveDesc') : t('proSubtitleShort')}</div>
              </div>
              ${state.isPremium ? '<span class="pro-badge-active">PRO</span>' : ''}
            </div>
            ${!state.isPremium ? `<div class="pro-settings-features">
              <div class="pro-feature-mini"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>${t('premiumFeature1')}</span></div>
              <div class="pro-feature-mini"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>${t('premiumFeature2')}</span></div>
              <div class="pro-feature-mini"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>${t('premiumFeature3')}</span></div>
            </div>` : ''}
            <button class="btn ${state.isPremium ? 'btn-secondary' : 'btn-primary'} ripple" id="settings-upgrade-btn" style="width:100%;justify-content:center;gap:6px;margin-top:12px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${state.isPremium ? '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>' : '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'}</svg>
              ${state.isPremium ? t('manageSubscription') : t('upgradeToPro')}
            </button>
          </div>
        </div><div class="divider"></div>
        <div class="form-group"><label class="form-label">${t('community') || 'Community & Links'}</label>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <a href="https://t.me/user_Alexander" target="_blank" class="settings-link telegram-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-16.5 7.5a2.25 2.25 0 0 0 .126 4.133l3.978 1.326 1.518 4.854a1.5 1.5 0 0 0 2.565.535l2.012-2.324 3.845 2.884a2.25 2.25 0 0 0 3.503-1.193l3.75-16.5a2.25 2.25 0 0 0-2.775-2.43z"/></svg>
              <div class="settings-link-text">
                <div class="settings-link-title">Telegram</div>
                <div class="settings-link-subtitle">@user_Alexander</div>
              </div>
            </a>
            <a href="https://t.me/WORLD_ArIn_NEWS" target="_blank" class="settings-link telegram-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-16.5 7.5a2.25 2.25 0 0 0 .126 4.133l3.978 1.326 1.518 4.854a1.5 1.5 0 0 0 2.565.535l2.012-2.324 3.845 2.884a2.25 2.25 0 0 0 3.503-1.193l3.75-16.5a2.25 2.25 0 0 0-2.775-2.43z"/></svg>
              <div class="settings-link-text">
                <div class="settings-link-title">AI News</div>
                <div class="settings-link-subtitle">@WORLD_ArIn_NEWS</div>
              </div>
            </a>
            <a href="https://softerror-studios.itch.io" target="_blank" class="settings-link itch-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              <div class="settings-link-text">
                <div class="settings-link-title">itch.io Games</div>
                <div class="settings-link-subtitle">softerror-studios.itch.io</div>
              </div>
            </a>
          </div>
        </div><div class="divider"></div>
        <div class="form-group"><label class="form-label">${t('supportDeveloper') || 'Support Developer'}</label>
          <a href="https://donationalerts.com/r/knightcoreking" target="_blank" class="settings-link donation-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <div class="settings-link-text">
              <div class="settings-link-title">${t('supportViaDonation') || 'Support via DonationAlerts'}</div>
              <div class="settings-link-subtitle">${t('helpDevelopment') || 'Help us improve Promptory'}</div>
            </div>
          </a>
        </div><div class="divider"></div>
        ${state.isAdmin ? `
        <div class="form-group"><label class="form-label">${t('adminModeration')} <span class="admin-badge">ADMIN</span></label>
          <div id="moderation-panel-container"></div>
        </div><div class="divider"></div>
        ` : ''}
        ${state.user ? `
        <div class="form-group"><label class="form-label">${t('yourRights')}</label>
          <div class="gdpr-rights">
            <div class="gdpr-rights-list">
              <div class="gdpr-right-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>${t('rightToAccess')}</span>
              </div>
              <div class="gdpr-right-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>${t('rightToExport')}</span>
              </div>
              <div class="gdpr-right-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>${t('rightToDelete')}</span>
              </div>
            </div>
            <button class="btn btn-sm btn-danger" id="request-deletion-btn" style="width:100%;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              ${t('requestDeletion')}
            </button>
          </div>
        </div><div class="divider"></div>
        ` : ''}
        <div class="form-group"><label class="form-label">${t('about')}</label><div style="font-size:var(--font-size-sm);color:var(--text-secondary);line-height:1.6;"><strong>Promptory</strong> v${CONFIG.VERSION}<br>${t('aboutDescription')}<div style="margin-top:8px;display:flex;gap:12px;"><a href="${chrome.runtime.getURL('privacy.html')}" target="_blank" style="color:var(--accent);font-size:var(--font-size-xs);">Privacy Policy</a><a href="${chrome.runtime.getURL('terms.html')}" target="_blank" style="color:var(--accent);font-size:var(--font-size-xs);">Terms of Service</a></div></div></div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost close-modal-btn">${t('cancel')}</button><button class="btn btn-primary" id="settings-save-btn">${t('saveChanges')}</button></div>
    </div>`;
  document.body.appendChild(modal);
  // Use rAF to avoid layout thrash during modal open
  requestAnimationFrame(() => {
    modal.classList.add('visible');
    loadShortcutsDisplay(commandNames);
    // Load moderation panel for admins
    if (state.isAdmin) {
      loadPendingReports().then(() => renderModerationPanel());
    }
  });
  document.getElementById('open-shortcuts-link')?.addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }); });

  // GDPR: Request account deletion
  document.getElementById('request-deletion-btn')?.addEventListener('click', async () => {
    if (!confirm(t('deleteAccountConfirm'))) return;
    // Open Telegram to request deletion (manual process for now)
    window.open('https://t.me/user_Alexander?text=' + encodeURIComponent(`Account Deletion Request\nEmail: ${state.user?.email || 'Unknown'}\nUser ID: ${state.user?.id || 'Unknown'}\n\nPlease delete all my data from Promptory.`), '_blank');
    showToast(t('accountDeletionRequested'), 'success');
  });

  document.getElementById('settings-signin-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('settings-signin-btn');
    btn.classList.add('loading');
    const result = await new Promise(resolve => chrome.runtime.sendMessage({ action: 'signInWithGoogle' }, resolve));
    btn.classList.remove('loading');
    
    if (result?.success) {
      state.user = result.user;
      state.session = result.session;
      
      // Save to storage
      await saveData('user', state.user);
      await saveData('session', state.session);
      
      // ✅ IMMEDIATELY close modal and show success (FAST UX)
      closeModal('settings-modal');
      showToast(t('signedInSuccess'), 'success');
      renderExplore();
      
      // ⚡ Run heavy sync operations in background (non-blocking)
      setTimeout(async () => {
        console.log('🔄 Background sync started...');
        try {
          await syncAllData();
          await loadLibraryPrompts();
          await checkPremiumStatus();
          console.log('✅ Background sync complete');
        } catch (e) {
          console.error('❌ Background sync error:', e);
        }
      }, 100);
    } else {
      showToast(t('signInFailed') + ': ' + (result?.error || ''), 'error');
    }
  });
  
  document.getElementById('settings-signout-btn')?.addEventListener('click', async () => {
    if (!confirm(t('signOutConfirm'))) return;
    const btn = document.getElementById('settings-signout-btn');
    if (btn) btn.classList.add('loading');
    
    try {
      // Send sign-out to background (handles Supabase logout + token clearing)
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'signOut' }, (response) => {
          resolve(response || { success: true });
        });
      });
      console.log('Sign-out result:', result);
    } catch (e) {
      console.warn('Sign-out message error (non-critical):', e);
    }
    
    // Clear all in-memory state regardless of background result
    state.user = null; 
    state.session = null; 
    state.isPremium = false;
    state.prompts = []; 
    state.folders = [];
    state.settings.hotkeys = { slot1: { promptId: null }, slot2: { promptId: null }, slot3: { promptId: null } };
    state.libraryPrompts = []; 
    state.userLikes = new Set(); 
    state.userReports = new Set();
    state.promptLimit = FREE_PROMPT_LIMIT;
    state.isAdmin = false; 
    state.pendingReports = [];
    state.searchOriginalPrompts = null;
    
    // Persist the cleared state (background already did this, but be safe)
    _suppressStorageRender = true;
    await saveData('prompts', []);
    await saveData('folders', []);
    await saveData('settings', state.settings);
    await saveData('isPremium', false);
    await saveData('promptLimit', FREE_PROMPT_LIMIT);
    await saveData('libraryPromptsCache', []);
    await saveData('user', null);
    await saveData('session', null);
    _suppressStorageRender = false;
    
    if (btn) btn.classList.remove('loading');
    showToast(t('signedOutSuccess'), 'success');
    closeModal('settings-modal');
    
    // Re-render all UI sections
    requestAnimationFrame(() => {
      renderPrompts(); 
      renderFolders(); 
      renderFavorites(); 
      renderExplore();
      renderLimitBanner();
    });
  });
  document.getElementById('settings-export-btn').addEventListener('click', () => {
    const data = { prompts: state.prompts, folders: state.folders, settings: state.settings, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `promptvault-backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(a.href);
    showToast(t('dataExported'), 'success');
  });
  
  // LemonSqueezy Pro upgrade from settings
  document.getElementById('settings-upgrade-btn')?.addEventListener('click', () => {
    if (state.isPremium && CONFIG.LEMONSQUEEZY_CUSTOMER_PORTAL) {
      window.open(CONFIG.LEMONSQUEEZY_CUSTOMER_PORTAL, '_blank');
    } else {
      showUpgradeModal();
    }
  });
  document.getElementById('settings-import-btn').addEventListener('click', () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const fileName = file.name.toLowerCase();
      
      try {
        const fileText = await file.text();
        
        // --- CSV Import ---
        if (fileName.endsWith('.csv')) {
          const lines = fileText.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');
          
          // Parse header
          const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
          const titleIdx = headers.findIndex(h => h === 'title' || h === 'name');
          const textIdx = headers.findIndex(h => h === 'text' || h === 'prompt' || h === 'content');
          const descIdx = headers.findIndex(h => h === 'description' || h === 'desc');
          const tagsIdx = headers.findIndex(h => h === 'tags');
          const folderIdx = headers.findIndex(h => h === 'folder');
          const platformIdx = headers.findIndex(h => h === 'platform');
          
          if (titleIdx === -1 && textIdx === -1) {
            throw new Error('CSV must have at least a "title" or "text" column. Found columns: ' + headers.join(', '));
          }
          
          const imported = [];
          const errors = [];
          for (let i = 1; i < lines.length; i++) {
            try {
              const cols = parseCSVLine(lines[i]);
              const title = (titleIdx >= 0 ? cols[titleIdx] : '').trim();
              const text = (textIdx >= 0 ? cols[textIdx] : '').trim();
              if (!title && !text) { errors.push(`Row ${i + 1}: empty title and text`); continue; }
              
              const tags = tagsIdx >= 0 && cols[tagsIdx] ? cols[tagsIdx].split(/[,;|]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean) : [];
              const variables = [...new Set((text.match(/\{([^}]+)\}/g) || []).map(m => m.slice(1, -1)))];
              
              // Match folder by name
              let folderId = null;
              if (folderIdx >= 0 && cols[folderIdx]) {
                const folderName = cols[folderIdx].trim();
                const f = state.folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
                folderId = f ? f.id : null;
              }
              
              imported.push({
                id: crypto.randomUUID(),
                title: title || text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                text: text || title,
                description: descIdx >= 0 ? (cols[descIdx] || '').trim() : '',
                folderId,
                platform: platformIdx >= 0 ? (cols[platformIdx] || 'universal').trim() : 'universal',
                tags,
                variables,
                isFavorite: false,
                useCount: 0,
                createdAt: Date.now(),
                updatedAt: Date.now()
              });
            } catch (rowErr) {
              errors.push(`Row ${i + 1}: ${rowErr.message}`);
            }
          }
          
          if (imported.length === 0) throw new Error('No valid prompts found in CSV' + (errors.length ? '. Errors:\n' + errors.slice(0, 5).join('\n') : ''));
          if (!confirm(t('importConfirmCount', imported.length) || `Import ${imported.length} prompts?` + (errors.length ? ` (${errors.length} rows skipped)` : ''))) return;
          
          state.prompts = [...imported, ...state.prompts];
          await saveData('prompts', state.prompts);
          showToast((t('dataImported') || 'Data imported') + ` (${imported.length} prompts)`, 'success');
          closeModal('settings-modal');
          renderPrompts(); renderFolders(); renderFavorites();
          return;
        }
        
        // --- JSON Import (with detailed validation) ---
        let data;
        try {
          data = JSON.parse(fileText);
        } catch (parseErr) {
          throw new Error('Invalid JSON: ' + parseErr.message.substring(0, 100));
        }
        
        // Validate structure
        if (typeof data !== 'object' || data === null) throw new Error('JSON root must be an object, got: ' + typeof data);
        if (!data.prompts && !data.folders) throw new Error('JSON must contain "prompts" and/or "folders" arrays. Found keys: ' + Object.keys(data).join(', '));
        
        if (data.prompts) {
          if (!Array.isArray(data.prompts)) throw new Error('"prompts" must be an array, got: ' + typeof data.prompts);
          // Validate each prompt has minimal fields
          const invalid = [];
          data.prompts.forEach((p, i) => {
            if (!p.title && !p.text) invalid.push(`prompts[${i}]: missing title and text`);
            if (typeof p !== 'object') invalid.push(`prompts[${i}]: not an object`);
          });
          if (invalid.length > 0) {
            throw new Error(`${invalid.length} invalid prompt(s):\n${invalid.slice(0, 5).join('\n')}${invalid.length > 5 ? '\n...' : ''}`);
          }
        }
        if (data.folders && !Array.isArray(data.folders)) throw new Error('"folders" must be an array, got: ' + typeof data.folders);
        
        if (!confirm(t('replaceAllData'))) return;
        if (data.prompts) state.prompts = data.prompts;
        if (data.folders) state.folders = data.folders;
        if (data.settings) state.settings = { ...state.settings, ...data.settings };
        await saveData('prompts', state.prompts); await saveData('folders', state.folders); await saveData('settings', state.settings);
        showToast(t('dataImported'), 'success');
        closeModal('settings-modal');
        renderPrompts(); renderFolders(); renderFavorites();
      } catch (err) { showToast((t('importFailed') || 'Import failed') + ': ' + (err.message || String(err)), 'error'); }
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
    // Sync hotkey settings to Supabase
    syncHotkeysToSupabase();
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
      }
    }
    // Fetch is_admin status separately (not in sync_user_on_login)
    const profileRes = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: `profiles?id=eq.${state.user.id}&select=is_admin` });
    if (profileRes?.data?.[0]) {
      state.isAdmin = profileRes.data[0].is_admin || false;
      console.log('✅ Admin status:', state.isAdmin);
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

// ==================== SEARCH (optimized) ====================
function initSearch() {
  const input = document.getElementById('search-input');
  let searchCache = null; // Cache lowercase versions for faster search
  let lastQuery = '';
  
  const debouncedSearch = debounce((q) => {
    if (q === lastQuery) return; // Skip if query hasn't changed
    lastQuery = q;
    
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
    if (state.prompts.length === 0) {
      document.getElementById('prompts-list').innerHTML = `<div class="empty-state"><div class="empty-state-title">${t('noPromptsFound')}</div></div>`;
    }
  }, 150); // Faster debounce for snappy feel

  input.addEventListener('input', () => debouncedSearch(input.value.trim().toLowerCase()));
}

function generateUniqueCheckoutUrl(baseUrl, userEmail, userId) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  const params = new URLSearchParams();
  params.set('checkout', uniqueId); // Forces new session
  
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
  const hasCheckoutUrl = CONFIG.LEMONSQUEEZY_CHECKOUT_URL && CONFIG.LEMONSQUEEZY_CHECKOUT_URL.length > 0;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'upgrade-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width:420px;">
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
        <button class="btn btn-primary btn-lg ripple upgrade-cta-btn" id="upgrade-buy-btn">
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
  
  // LemonSqueezy checkout
document.getElementById('upgrade-buy-btn')?.addEventListener('click', () => {
  const checkoutUrl = generateUniqueCheckoutUrl(
    CONFIG.LEMONSQUEEZY_CHECKOUT_URL,
    state.user?.email,
    state.user?.id
  );
  
  console.log('🛒 Opening checkout:', checkoutUrl);
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

// ==================== MODAL UTILS ====================
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) { modal.classList.remove('visible'); setTimeout(() => modal.remove(), 250); }
}

// ==================== HOTKEY SETTINGS SYNC ====================
async function syncHotkeysToSupabase() {
  if (!state.session || !state.user) return;
  const hotkeys = state.settings.hotkeys || {};
  const slotNames = { slot1: 1, slot2: 2, slot3: 3 };
  const keyDefaults = { slot1: 'Alt+1', slot2: 'Alt+2', slot3: 'Alt+3' };
  
  for (const [slotId, slotNum] of Object.entries(slotNames)) {
    const slot = hotkeys[slotId];
    const promptId = slot?.promptId || null;
    
    if (promptId) {
      // First try to delete existing row for this slot, then insert fresh
      // This avoids conflict issues with the composite unique constraint
      try {
        await supabaseMsg({
          action: 'supabaseRequest',
          method: 'DELETE',
          path: `hotkey_settings?user_id=eq.${state.user.id}&slot_number=eq.${slotNum}`
        });
      } catch (e) { /* ignore delete errors */ }
      try {
        await supabaseMsg({
          action: 'supabaseRequest',
          method: 'POST',
          path: 'hotkey_settings',
          body: {
            user_id: state.user.id,
            slot_number: slotNum,
            key_combo: keyDefaults[slotId],
            prompt_id: promptId,
            updated_at: new Date().toISOString()
          }
        });
      } catch (e) { console.error('Hotkey sync failed for', slotId, e); }
    } else {
      // Delete hotkey setting if no prompt assigned
      try {
        await supabaseMsg({
          action: 'supabaseRequest',
          method: 'DELETE',
          path: `hotkey_settings?user_id=eq.${state.user.id}&slot_number=eq.${slotNum}`
        });
      } catch (e) { /* silent */ }
    }
  }
}

async function loadHotkeysFromSupabase() {
  if (!state.session || !state.user) return;
  try {
    const res = await supabaseMsg({
      action: 'supabaseRequest',
      method: 'GET',
      path: `hotkey_settings?user_id=eq.${state.user.id}&order=slot_number.asc`
    });
    if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
      const slotNames = { 1: 'slot1', 2: 'slot2', 3: 'slot3' };
      if (!state.settings.hotkeys) state.settings.hotkeys = {};
      for (const row of res.data) {
        const slotId = slotNames[row.slot_number];
        if (slotId) {
          if (!state.settings.hotkeys[slotId]) state.settings.hotkeys[slotId] = {};
          state.settings.hotkeys[slotId].promptId = row.prompt_id || null;
        }
      }
      await saveData('settings', state.settings);
    }
  } catch (e) { console.warn('Failed to load hotkeys from cloud:', e); }
}

// ==================== SUPABASE SYNC (with offline queue support) ====================
async function syncPromptToSupabase(prompt) {
  if (typeof Promptory !== 'undefined' && Promptory.syncPromptToCloud) {
    return Promptory.syncPromptToCloud(prompt);
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
  if (typeof Promptory !== 'undefined' && Promptory.syncPromptDeleteToCloud) {
    return Promptory.syncPromptDeleteToCloud(id);
  }
  if (!state.session || !state.user) return;
  try { await supabaseMsg({ action: 'supabaseRequest', method: 'DELETE', path: `prompts?id=eq.${id}` }); } catch (e) { /* silent */ }
}

async function syncFolderToSupabase(folder) {
  if (typeof Promptory !== 'undefined' && Promptory.syncFolderToCloud) {
    return Promptory.syncFolderToCloud(folder);
  }
  if (!state.session || !state.user) return;
  try { 
    const res = await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'folders', body: { id: folder.id, user_id: state.user.id, name: folder.name, updated_at: new Date().toISOString() } }); 
    if (res?.error) console.warn('Folder sync error:', res.error);
  } catch (e) { console.error('Folder sync failed:', e); }
}

async function syncFolderDeleteToSupabase(id) {
  if (typeof Promptory !== 'undefined' && Promptory.syncFolderDeleteToCloud) {
    return Promptory.syncFolderDeleteToCloud(id);
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
    
    // After full sync, try to drain any offline queue items that may have accumulated
    if (typeof Promptory !== 'undefined' && Promptory.processQueue) {
      setTimeout(() => Promptory.processQueue(), 500);
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

// ==================== INIT ====================
let _initRenderDone = false; // Guard against duplicate renders during init

async function init() {
  try {
  // Load i18n locales first
  await loadLocale('en');
  await loadLocale('ru');

  await loadData();
  applyTheme(state.settings.theme);
  
  // Initialize offline queue module
  if (typeof Promptory !== 'undefined' && Promptory.initOffline) {
    // Share state with offline module
    Promptory.state = state;
    await Promptory.initOffline();
  }

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

  // Initialize tabs and search BEFORE any rendering
  initTabs();
  initSearch();

  // Update static text from i18n — this also does the FIRST render of all tabs
  updateStaticTexts();
  _initRenderDone = true;
  // No extra renderPrompts/renderFolders/etc here — updateStaticTexts already did them

  document.getElementById('new-prompt-btn').addEventListener('click', () => openPromptEditor());
  document.getElementById('new-folder-btn').addEventListener('click', () => openFolderEditor());
  document.getElementById('settings-btn').addEventListener('click', openSettings);

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

  } catch (err) {
    // Global error boundary — show fallback UI instead of blank popup
    console.error('❌ Promptory init error:', err);
    const mainApp = document.getElementById('main-app');
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) welcomeScreen.style.display = 'none';
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

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
