// Promptory Content Script - Prompt insertion + Search overlay
// Performance-optimized with debounced search and truncated previews

const PLATFORM_SELECTORS = {
  'chat.openai.com': '#prompt-textarea, textarea[data-id="root"], div[contenteditable="true"][id="prompt-textarea"]',
  'chatgpt.com': '#prompt-textarea, textarea[data-id="root"], div[contenteditable="true"][id="prompt-textarea"]',
  'claude.ai': 'div.ProseMirror[contenteditable="true"], div[contenteditable="true"][data-placeholder]',
  'gemini.google.com': '.ql-editor[contenteditable="true"], rich-textarea div[contenteditable], div[contenteditable="true"][aria-label]',
  'perplexity.ai': 'textarea[placeholder], textarea',
  'poe.com': 'textarea[class*="TextArea"], textarea',
  'you.com': 'textarea',
  'bard.google.com': '.ql-editor[contenteditable="true"]',
  'copilot.microsoft.com': 'textarea, #userInput',
  'bing.com': 'textarea[name="q"], textarea',
  'pi.ai': 'textarea'
};

const hostname = window.location.hostname;
const platformSelector = PLATFORM_SELECTORS[hostname];
let searchOverlayVisible = false;

// i18n helper - try to load from storage, fallback to English
let _contentLang = 'en';
const _contentStrings = {
  en: {
    fillInVariables: 'Fill in Variables',
    cancel: 'Cancel',
    insertBtn: 'Insert',
    promptInserted: 'Prompt inserted',
    copiedNoField: 'Copied to clipboard (input field not found)',
    searchPlaceholder: 'Search your prompts...',
    loading: 'Loading prompts...',
    noResults: 'No prompts found',
    noPrompts: 'No prompts yet. Create some in the extension popup.',
    enterToInsert: 'Enter to insert',
    escToClose: 'Esc to close',
    enter: 'Enter'
  },
  ru: {
    fillInVariables: 'Заполните переменные',
    cancel: 'Отмена',
    insertBtn: 'Вставить',
    promptInserted: 'Промпт вставлен',
    copiedNoField: 'Скопировано в буфер (поле ввода не найдено)',
    searchPlaceholder: 'Поиск ваших промптов...',
    loading: 'Загрузка промптов...',
    noResults: 'Промпты не найдены',
    noPrompts: 'Пока нет промптов. Создайте их в расширении.',
    enterToInsert: 'Enter — вставить',
    escToClose: 'Esc — закрыть',
    enter: 'Введите'
  }
};

// Load language preference
chrome.storage.local.get(['language'], (res) => {
  if (res.language) _contentLang = res.language;
});

function ct(key) {
  return (_contentStrings[_contentLang] || _contentStrings.en)[key] || _contentStrings.en[key] || key;
}

// ---------- Message Listener ----------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'insertPrompt') {
    insertPrompt(message.text, message.variables);
    sendResponse({ success: true });
  }
  if (message.action === 'openSearchOverlay') {
    toggleSearchOverlay();
    sendResponse({ success: true });
  }
  if (message.action === 'checkPlatform') {
    sendResponse({ platform: hostname, supported: !!platformSelector });
  }
  return true;
});

// ---------- Insert Prompt ----------
async function insertPrompt(text, variables) {
  if (variables && variables.length > 0) {
    text = await showVariableDialog(text, variables);
    if (!text) return;
  }
  const inputField = findInputField();
  if (!inputField) {
    await copyToClipboard(text);
    showNotification(ct('copiedNoField'));
    return;
  }
  insertText(inputField, text);
  showNotification(ct('promptInserted'));
}

function findInputField() {
  if (platformSelector) {
    const selectors = platformSelector.split(',').map(s => s.trim());
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
  }
  const fallbacks = [
    'textarea[placeholder*="essage"]', 'textarea[placeholder*="Message"]',
    'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]',
    'textarea:not([readonly])'
  ];
  for (const sel of fallbacks) { const el = document.querySelector(sel); if (el) return el; }
  return null;
}

function insertText(element, text) {
  element.focus();
  if (element.contentEditable === 'true') insertIntoContentEditable(element, text);
  else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') insertIntoTextarea(element, text);
}

function insertIntoContentEditable(element, text) {
  element.focus();
  // Clear existing content and insert new text for better compatibility
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
  // Try execCommand first for React-based editors compatibility
  // Falls back to InputEvent + manual insertion if execCommand is unavailable
  let inserted = false;
  try {
    inserted = document.execCommand('insertText', false, text);
  } catch (_e) {
    inserted = false;
  }
  if (!inserted) {
    // Fallback: delete selected content and insert text node
    selection.deleteFromDocument();
    const textNode = document.createTextNode(text);
    const sel = window.getSelection();
    if (sel.rangeCount) {
      const r = sel.getRangeAt(0);
      r.insertNode(textNode);
      r.setStartAfter(textNode);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    } else {
      element.textContent = text;
    }
  }
  // Dispatch events to notify frameworks
  element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: text }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function insertIntoTextarea(element, text) {
  element.focus();
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (nativeInputValueSetter) nativeInputValueSetter.call(element, text);
  else element.value = text;
  element.selectionStart = element.selectionEnd = text.length;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

// ---------- Variable Dialog (performance-optimized) ----------
async function showVariableDialog(text, variables) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = `promptvault-overlay ${shouldUseLiteOverlay() ? 'promptvault-overlay-lite' : 'promptvault-overlay-blur'}`;
    // Build HTML with limited variable fields for performance
    const fieldsHtml = variables.slice(0, 20).map(v => `
      <div class="promptvault-field">
        <label>${escapeHtml(v)}</label>
        <input type="text" data-variable="${escapeHtml(v)}" placeholder="${ct('enter')} ${escapeHtml(v)}">
      </div>
    `).join('');
    overlay.innerHTML = `
      <div class="promptvault-dialog">
        <div class="promptvault-header"><h3>${ct('fillInVariables')}</h3><button class="promptvault-close">&times;</button></div>
        <div class="promptvault-body">${fieldsHtml}</div>
        <div class="promptvault-footer"><button class="promptvault-btn promptvault-btn-cancel">${ct('cancel')}</button><button class="promptvault-btn promptvault-btn-primary">${ct('insertBtn')}</button></div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    setTimeout(() => { const first = overlay.querySelector('input'); if (first) first.focus(); }, 100);

    const close = () => { overlay.classList.remove('visible'); setTimeout(() => overlay.remove(), 200); resolve(null); };
    overlay.querySelector('.promptvault-close').onclick = close;
    overlay.querySelector('.promptvault-btn-cancel').onclick = close;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    const insert = () => {
      let filled = text;
      variables.forEach(v => {
        const input = overlay.querySelector(`[data-variable="${escapeHtml(v)}"]`);
        const val = input?.value.trim() || `{${v}}`;
        filled = filled.replaceAll(`{${v}}`, val);
      });
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
      resolve(filled);
    };
    overlay.querySelector('.promptvault-btn-primary').onclick = insert;
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); insert(); }
      if (e.key === 'Escape') close();
    });
  });
}

// ---------- Search Overlay (Alt+S) - performance-optimized ----------
let searchOverlayPrompts = []; // Cache prompts to avoid repeated fetches
const searchResultsCache = new Map(); // Query cache for fast repeated searches
let searchOverlayRAF = null; // RAF handle for cleanup
let searchIdleHandle = null; // requestIdleCallback handle for cleanup

function shouldUseLiteOverlay() {
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
  const supportsBackdrop = typeof CSS !== 'undefined' && (CSS.supports('backdrop-filter: blur(4px)') || CSS.supports('-webkit-backdrop-filter: blur(4px)'));
  return reducedMotion || lowCpu || lowMemory || !supportsBackdrop;
}

function closeSearchOverlay(overlay, removeDelay = 150) {
  if (!overlay) return;
  overlay.classList.remove('visible');
  if (searchOverlayRAF) { cancelAnimationFrame(searchOverlayRAF); searchOverlayRAF = null; }
  if (searchIdleHandle && window.cancelIdleCallback) {
    cancelIdleCallback(searchIdleHandle);
    searchIdleHandle = null;
  }
  searchResultsCache.clear();
  setTimeout(() => overlay.remove(), removeDelay);
  searchOverlayVisible = false;
}

function toggleSearchOverlay() {
  const existing = document.getElementById('promptvault-search-overlay');
  if (existing) {
    closeSearchOverlay(existing, 150);
    return;
  }

  searchOverlayVisible = true;
  
  // Create overlay with minimal DOM operations
  const overlay = document.createElement('div');
  overlay.id = 'promptvault-search-overlay';
  overlay.className = `promptvault-overlay ${shouldUseLiteOverlay() ? 'promptvault-overlay-lite' : 'promptvault-overlay-blur'}`;
  
  // Use template literal without extra whitespace
  overlay.innerHTML = `<div class="promptvault-search-dialog"><div class="promptvault-search-header"><input type="text" id="promptvault-search-input" placeholder="${ct('searchPlaceholder')}"></div><div class="promptvault-search-results" id="promptvault-search-results"><div class="promptvault-search-loading">${ct('loading')}</div></div><div class="promptvault-search-footer"><span>${ct('enterToInsert')}</span><span>${ct('escToClose')}</span></div></div>`;
  
  // Batch DOM operations
  document.body.appendChild(overlay);
  
  // Use double RAF for guaranteed smooth animation
  searchOverlayRAF = requestAnimationFrame(() => {
    searchOverlayRAF = requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  });

  const searchInput = overlay.querySelector('#promptvault-search-input');
  // Immediate focus without delay
  searchInput.focus();

  // Fetch prompts once and cache - use lightweight rendering
  chrome.runtime.sendMessage({ action: 'getPrompts' }, (res) => {
    searchOverlayPrompts = res?.prompts || [];
    // Only render if overlay still exists
    if (document.getElementById('promptvault-search-overlay')) {
      renderSearchResultsOptimized(searchOverlayPrompts, '');
    }
  });

  // Optimized search with requestIdleCallback fallback
  let searchTimer;
  let lastQuery = '';
  
  const performSearch = (q) => {
    if (q === lastQuery) return;
    lastQuery = q;

    if (searchResultsCache.has(q)) {
      renderSearchResultsOptimized(searchResultsCache.get(q), q);
      return;
    }

    const filtered = q ? searchOverlayPrompts.filter(p => {
      const ql = q.toLowerCase();
      // Fast path: title check first (most common match)
      if (p.title.toLowerCase().includes(ql)) return true;
      // Tags are fast to check
      if ((p.tags || []).some(t => t.toLowerCase().includes(ql))) return true;
      // Description check
      if ((p.description || '').toLowerCase().includes(ql)) return true;
      // Text check - limited to 200 chars for speed
      if ((p.text || '').substring(0, 200).toLowerCase().includes(ql)) return true;
      return false;
    }) : searchOverlayPrompts;

    // Keep cache bounded for low memory usage
    if (searchResultsCache.size > 40) searchResultsCache.clear();
    searchResultsCache.set(q, filtered);
    renderSearchResultsOptimized(filtered, q);
  };
  
  const handleSearch = () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    
    // Immediate render for empty query
    if (!q) {
      performSearch('');
      return;
    }
    
    // Use requestIdleCallback if available, otherwise setTimeout
    if (window.requestIdleCallback) {
      if (searchIdleHandle && window.cancelIdleCallback) cancelIdleCallback(searchIdleHandle);
      searchIdleHandle = requestIdleCallback(() => {
        searchIdleHandle = null;
        performSearch(q);
      }, { timeout: 150 });
    } else {
      searchTimer = setTimeout(() => performSearch(q), 100);
    }
  };
  
  searchInput.addEventListener('input', handleSearch);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeSearchOverlay(overlay, 200);
    }
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearchOverlay(overlay, 200);
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = overlay.querySelectorAll('.promptvault-search-item');
      const active = overlay.querySelector('.promptvault-search-item.active');
      let idx = Array.from(items).indexOf(active);
      if (e.key === 'ArrowDown') idx = Math.min(idx + 1, items.length - 1);
      else idx = Math.max(idx - 1, 0);
      items.forEach(i => i.classList.remove('active'));
      if (items[idx]) { items[idx].classList.add('active'); items[idx].scrollIntoView({ block: 'nearest', behavior: 'auto' }); }
    }
    if (e.key === 'Enter') {
      const active = overlay.querySelector('.promptvault-search-item.active');
      if (active) active.click();
    }
  });
}

// Optimized search results rendering with virtual DOM approach
function renderSearchResultsOptimized(prompts, query) {
  const container = document.getElementById('promptvault-search-results');
  if (!container) return;

  if (prompts.length === 0) {
    container.innerHTML = `<div class="promptvault-search-empty">${query ? ct('noResults') : ct('noPrompts')}</div>`;
    return;
  }

  // Limit to 20 results for smooth scrolling
  const limited = prompts.slice(0, 20);
  
  // Build HTML string directly (faster than DocumentFragment for small lists)
  const html = limited.map((p, i) => 
    `<div class="promptvault-search-item${i === 0 ? ' active' : ''}" data-prompt-id="${p.id}"><div class="promptvault-search-item-title">${escapeHtml(p.title)}</div><div class="promptvault-search-item-preview">${escapeHtml(p.text.substring(0, 50))}...</div></div>`
  ).join('');
  
  container.innerHTML = html;
  
  // Single event delegation setup
  if (!container._hasListeners) {
    container._hasListeners = true;
    
    container.onclick = (e) => {
      const item = e.target.closest('.promptvault-search-item');
      if (!item) return;
      const id = item.getAttribute('data-prompt-id');
      const prompt = searchOverlayPrompts.find(p => p.id === id);
      if (prompt) {
        const overlay = document.getElementById('promptvault-search-overlay');
        if (overlay) closeSearchOverlay(overlay, 150);
        insertPrompt(prompt.text, prompt.variables || []);
        // Fire and forget usage update
        chrome.storage.local.get(['prompts'], (res) => {
          const stored = res.prompts || [];
          const found = stored.find(sp => sp.id === id);
          if (found) {
            found.useCount = (found.useCount || 0) + 1;
            found.updatedAt = Date.now();
            chrome.storage.local.set({ prompts: stored });
          }
        });
      }
    };

    container.onmouseover = (e) => {
      const item = e.target.closest('.promptvault-search-item');
      if (item && !item.classList.contains('active')) {
        const active = container.querySelector('.promptvault-search-item.active');
        if (active) active.classList.remove('active');
        item.classList.add('active');
      }
    };
  }
}

// Legacy function for backwards compatibility
function renderSearchResults(prompts, query) {
  renderSearchResultsOptimized(prompts, query);
}

// ---------- Notifications ----------
function showNotification(message) {
  const existing = document.querySelector('.promptvault-notification');
  if (existing) existing.remove();
  const n = document.createElement('div');
  n.className = 'promptvault-notification';
  n.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>${message}`;
  document.body.appendChild(n);
  requestAnimationFrame(() => n.classList.add('visible'));
  setTimeout(() => { n.classList.remove('visible'); setTimeout(() => n.remove(), 300); }, 2500);
}

async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

console.log('Promptory content script loaded on', hostname);
