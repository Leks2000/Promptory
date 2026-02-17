// Promptory Popup - Utilities Module
// Shared utility functions used across all modules

window.Promptory = window.Promptory || {};

(function(P) {
'use strict';

// ==================== I18N ====================
const LOCALES = {};
let _lang = 'en';

P.getLang = () => _lang;
P.setLang = (lang) => { _lang = lang; };

P.loadLocale = async function(lang) {
  if (LOCALES[lang]) return;
  try {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const res = await fetch(url);
    LOCALES[lang] = await res.json();
  } catch (e) { console.warn('Locale load failed:', lang, e); }
};

P.t = function(key, ...subs) {
  const locale = LOCALES[_lang] || LOCALES['en'] || {};
  const fallback = LOCALES['en'] || {};
  const entry = locale[key] || fallback[key];
  if (!entry) return key;
  let msg = entry.message;
  subs.forEach((s, i) => { msg = msg.replace(`$${i + 1}`, String(s)); });
  return msg;
};

// ==================== UTILITIES ====================
const _rateLimits = {};
P.isRateLimited = function(key, cooldownMs = 2000) {
  const now = Date.now();
  if (_rateLimits[key] && now - _rateLimits[key] < cooldownMs) return true;
  _rateLimits[key] = now;
  return false;
};

P.escapeHtml = function(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

P.showToast = function(message, type = 'default') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast visible';
  if (type === 'success') toast.classList.add('success');
  else if (type === 'error') toast.classList.add('error');
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => { toast.className = 'toast'; }, 250);
  }, 2500);
};

P.saveData = function(key, value) {
  return new Promise(resolve => chrome.storage.local.set({ [key]: value }, resolve));
};

P.formatDate = function(ts) {
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
};

P.truncate = function(text, max = 120) {
  if (!text || text.length <= max) return text || '';
  return text.substring(0, max) + '...';
};

P.debounce = function(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
};

// ==================== SUPABASE MESSAGING ====================
P.supabaseMsg = function(params) {
  return new Promise(resolve => chrome.runtime.sendMessage(params, resolve));
};

P.supabaseMsgWithRetry = async function(params, { maxRetries = 2, baseDelay = 1000 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await P.supabaseMsg(params);
      if (res?.error) {
        const errStr = P.parseSupabaseError(res.error).toLowerCase();
        if (errStr.includes('not authenticated') || errStr.includes('jwt') || errStr.includes('permission') || errStr.includes('rls') || errStr.includes('duplicate') || errStr.includes('23505')) {
          return res;
        }
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
};

P.parseSupabaseError = function(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  try { return JSON.stringify(error); } catch { return String(error); }
};

P.isAuthError = function(error) {
  const msg = P.parseSupabaseError(error).toLowerCase();
  return msg.includes('not authenticated') || msg.includes('jwt') || msg.includes('token') || msg.includes('401');
};

// ==================== CLIPBOARD ====================
P.copyPromptText = async function(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); document.body.removeChild(textarea); return true; }
    catch { document.body.removeChild(textarea); return false; }
  }
};

// ==================== MODAL UTILS ====================
P.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) { modal.classList.remove('visible'); setTimeout(() => modal.remove(), 250); }
};

// ==================== SANITIZATION (for untrusted library content) ====================
// Extra layer of protection for community-submitted prompts beyond escapeHtml
P.sanitizeLibraryText = function(text) {
  if (!text) return '';
  // Remove null bytes, control characters (except newline/tab), and zero-width chars
  let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Remove zero-width characters used for homograph attacks
  sanitized = sanitized.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, '');
  // Limit length to prevent DOM bloat
  if (sanitized.length > 10000) sanitized = sanitized.substring(0, 10000) + '...';
  return sanitized;
};

})(window.Promptory);
