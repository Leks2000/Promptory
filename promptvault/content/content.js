// PromptVault Content Script - Prompt insertion + Search overlay

// Platform-specific selectors for input fields
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
    showNotification('Copied to clipboard (input field not found)');
    return;
  }

  insertText(inputField, text);
  showNotification('Prompt inserted');
}

function findInputField() {
  if (platformSelector) {
    const selectors = platformSelector.split(',').map(s => s.trim());
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
  }

  // Generic fallbacks
  const fallbacks = [
    'textarea[placeholder*="essage"]',
    'textarea[placeholder*="Message"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea:not([readonly])'
  ];

  for (const sel of fallbacks) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function insertText(element, text) {
  element.focus();
  if (element.contentEditable === 'true') {
    insertIntoContentEditable(element, text);
  } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    insertIntoTextarea(element, text);
  }
}

function insertIntoContentEditable(element, text) {
  element.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);

  // Use execCommand for best compatibility with React-based editors
  document.execCommand('insertText', false, text);

  // Dispatch events
  element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: text }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
}

function insertIntoTextarea(element, text) {
  element.focus();
  // Use React-compatible value setter
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, text);
  } else {
    element.value = text;
  }
  element.selectionStart = element.selectionEnd = text.length;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
}

// ---------- Variable Dialog ----------
async function showVariableDialog(text, variables) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'promptvault-overlay';
    overlay.innerHTML = `
      <div class="promptvault-dialog">
        <div class="promptvault-header">
          <h3>Fill in Variables</h3>
          <button class="promptvault-close">&times;</button>
        </div>
        <div class="promptvault-body">
          ${variables.map(v => `
            <div class="promptvault-field">
              <label>${escapeHtml(v)}</label>
              <input type="text" data-variable="${escapeHtml(v)}" placeholder="Enter ${escapeHtml(v)}">
            </div>
          `).join('')}
        </div>
        <div class="promptvault-footer">
          <button class="promptvault-btn promptvault-btn-cancel">Cancel</button>
          <button class="promptvault-btn promptvault-btn-primary">Insert</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('visible'), 10);
    setTimeout(() => {
      const first = overlay.querySelector('input');
      if (first) first.focus();
    }, 100);

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

// ---------- Search Overlay (Ctrl+Shift+P) ----------
function toggleSearchOverlay() {
  const existing = document.getElementById('promptvault-search-overlay');
  if (existing) {
    existing.classList.remove('visible');
    setTimeout(() => existing.remove(), 200);
    searchOverlayVisible = false;
    return;
  }

  searchOverlayVisible = true;
  const overlay = document.createElement('div');
  overlay.id = 'promptvault-search-overlay';
  overlay.className = 'promptvault-overlay';
  overlay.innerHTML = `
    <div class="promptvault-search-dialog">
      <div class="promptvault-search-header">
        <input type="text" id="promptvault-search-input" placeholder="Search your prompts..." autofocus>
      </div>
      <div class="promptvault-search-results" id="promptvault-search-results">
        <div class="promptvault-search-loading">Loading prompts...</div>
      </div>
      <div class="promptvault-search-footer">
        <span>Enter to insert</span>
        <span>Esc to close</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('visible'), 10);

  // Load prompts from storage
  chrome.runtime.sendMessage({ action: 'getPrompts' }, (res) => {
    const prompts = res?.prompts || [];
    renderSearchResults(prompts, '');
  });

  const searchInput = overlay.querySelector('#promptvault-search-input');
  searchInput.focus();

  let allPrompts = [];
  chrome.runtime.sendMessage({ action: 'getPrompts' }, (res) => {
    allPrompts = res?.prompts || [];
    renderSearchResults(allPrompts, '');
  });

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = q ? allPrompts.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q)) ||
      p.text.toLowerCase().includes(q)
    ) : allPrompts;
    renderSearchResults(filtered, q);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
      searchOverlayVisible = false;
    }
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
      searchOverlayVisible = false;
    }
    // Arrow navigation
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = overlay.querySelectorAll('.promptvault-search-item');
      const active = overlay.querySelector('.promptvault-search-item.active');
      let idx = Array.from(items).indexOf(active);
      if (e.key === 'ArrowDown') idx = Math.min(idx + 1, items.length - 1);
      else idx = Math.max(idx - 1, 0);
      items.forEach(i => i.classList.remove('active'));
      if (items[idx]) {
        items[idx].classList.add('active');
        items[idx].scrollIntoView({ block: 'nearest' });
      }
    }
    if (e.key === 'Enter') {
      const active = overlay.querySelector('.promptvault-search-item.active');
      if (active) {
        active.click();
      }
    }
  });
}

function renderSearchResults(prompts, query) {
  const container = document.getElementById('promptvault-search-results');
  if (!container) return;

  if (prompts.length === 0) {
    container.innerHTML = `<div class="promptvault-search-empty">${query ? 'No prompts found' : 'No prompts yet. Create some in the extension popup.'}</div>`;
    return;
  }

  container.innerHTML = prompts.map((p, i) => `
    <div class="promptvault-search-item ${i === 0 ? 'active' : ''}" data-prompt-id="${p.id}">
      <div class="promptvault-search-item-title">${escapeHtml(p.title)}</div>
      <div class="promptvault-search-item-preview">${escapeHtml(p.text.substring(0, 80))}${p.text.length > 80 ? '...' : ''}</div>
    </div>
  `).join('');

  // Click handlers
  container.querySelectorAll('.promptvault-search-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-prompt-id');
      const prompt = prompts.find(p => p.id === id);
      if (prompt) {
        // Close overlay
        const overlay = document.getElementById('promptvault-search-overlay');
        if (overlay) {
          overlay.classList.remove('visible');
          setTimeout(() => overlay.remove(), 200);
          searchOverlayVisible = false;
        }
        // Insert prompt
        insertPrompt(prompt.text, prompt.variables || []);
        // Update use count via background
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
    });

    item.addEventListener('mouseenter', () => {
      container.querySelectorAll('.promptvault-search-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

// ---------- Notifications ----------
function showNotification(message) {
  const existing = document.querySelector('.promptvault-notification');
  if (existing) existing.remove();
  const n = document.createElement('div');
  n.className = 'promptvault-notification';
  n.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
    ${message}
  `;
  document.body.appendChild(n);
  setTimeout(() => n.classList.add('visible'), 10);
  setTimeout(() => {
    n.classList.remove('visible');
    setTimeout(() => n.remove(), 300);
  }, 3000);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
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

console.log('PromptVault content script loaded on', hostname);
