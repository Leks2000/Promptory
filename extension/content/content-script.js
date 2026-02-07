/**
 * PromptVault — Content Script
 * Handles prompt insertion into AI chat platforms
 * Supports: ChatGPT, Claude, Gemini, Perplexity, Poe, and fallback
 */

(function() {
  'use strict';

  const hostname = window.location.hostname;

  // ============ PLATFORM DETECTION ============

  const PLATFORMS = {
    chatgpt: {
      match: () => hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com'),
      getInput: () => {
        return document.querySelector('#prompt-textarea') ||
               document.querySelector('div[contenteditable="true"][id="prompt-textarea"]') ||
               document.querySelector('textarea[data-id="root"]') ||
               document.querySelector('div[contenteditable="true"]');
      },
      insert: (el, text) => {
        if (el.tagName === 'TEXTAREA') insertIntoTextarea(el, text);
        else insertIntoContentEditable(el, text);
      }
    },
    claude: {
      match: () => hostname.includes('claude.ai'),
      getInput: () => {
        return document.querySelector('div.ProseMirror[contenteditable="true"]') ||
               document.querySelector('div[contenteditable="true"]') ||
               document.querySelector('fieldset div[contenteditable]');
      },
      insert: (el, text) => insertIntoContentEditable(el, text)
    },
    gemini: {
      match: () => hostname.includes('gemini.google.com'),
      getInput: () => {
        return document.querySelector('.ql-editor[contenteditable="true"]') ||
               document.querySelector('div[contenteditable="true"]') ||
               document.querySelector('rich-textarea div[contenteditable]');
      },
      insert: (el, text) => insertIntoContentEditable(el, text)
    },
    perplexity: {
      match: () => hostname.includes('perplexity.ai'),
      getInput: () => {
        return document.querySelector('textarea[placeholder]') ||
               document.querySelector('textarea') ||
               document.querySelector('div[contenteditable="true"]');
      },
      insert: (el, text) => {
        if (el.tagName === 'TEXTAREA') insertIntoTextarea(el, text);
        else insertIntoContentEditable(el, text);
      }
    },
    poe: {
      match: () => hostname.includes('poe.com'),
      getInput: () => {
        return document.querySelector('textarea[class*="TextArea"]') ||
               document.querySelector('textarea') ||
               document.querySelector('div[contenteditable="true"]');
      },
      insert: (el, text) => {
        if (el.tagName === 'TEXTAREA') insertIntoTextarea(el, text);
        else insertIntoContentEditable(el, text);
      }
    },
    genspark: {
      match: () => hostname.includes('genspark.ai'),
      getInput: () => {
        return document.querySelector('textarea') ||
               document.querySelector('div[contenteditable="true"]');
      },
      insert: (el, text) => {
        if (el.tagName === 'TEXTAREA') insertIntoTextarea(el, text);
        else insertIntoContentEditable(el, text);
      }
    }
  };

  // ============ INSERTION HELPERS ============

  function insertIntoTextarea(textarea, text) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    nativeInputValueSetter.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.focus();
    textarea.setSelectionRange(text.length, text.length);
    textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  function insertIntoContentEditable(el, text) {
    el.focus();
    el.textContent = '';
    const textNode = document.createTextNode(text);
    el.appendChild(textNode);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    if (el.classList.contains('ProseMirror')) {
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: true, inputType: 'insertText', data: text
      }));
    }
  }

  // ============ DETECT & INSERT ============

  function detectPlatform() {
    for (const [name, platform] of Object.entries(PLATFORMS)) {
      if (platform.match()) return { name, ...platform };
    }
    return null;
  }

  function insertPrompt(text) {
    const platform = detectPlatform();
    if (platform) {
      const input = platform.getInput();
      if (input) {
        platform.insert(input, text);
        return { success: true, platform: platform.name };
      }
    }

    // Fallback
    const activeEl = document.activeElement;
    if (activeEl) {
      if (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT') {
        insertIntoTextarea(activeEl, text);
        return { success: true, platform: 'fallback-textarea' };
      }
      if (activeEl.getAttribute('contenteditable') === 'true') {
        insertIntoContentEditable(activeEl, text);
        return { success: true, platform: 'fallback-contenteditable' };
      }
    }

    const anyEditable = document.querySelector('textarea:not([hidden]), div[contenteditable="true"]');
    if (anyEditable) {
      if (anyEditable.tagName === 'TEXTAREA') insertIntoTextarea(anyEditable, text);
      else insertIntoContentEditable(anyEditable, text);
      return { success: true, platform: 'fallback-any' };
    }

    return { success: false, error: 'No input field found' };
  }

  // ============ MESSAGE LISTENER ============

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'INSERT_PROMPT') {
      const result = insertPrompt(message.text);
      sendResponse(result);
      return true;
    }

    if (message.action === 'PING') {
      sendResponse({ alive: true, platform: detectPlatform()?.name || 'unknown' });
      return true;
    }

    if (message.action === 'SHOW_QUICK_SEARCH') {
      showQuickSearch();
      sendResponse({ success: true });
      return true;
    }

    if (message.action === 'SHOW_TOAST') {
      showPageToast(message.message);
      sendResponse({ success: true });
      return true;
    }
  });

  // ============ PAGE TOAST ============

  function showPageToast(msg) {
    let toast = document.getElementById('pv-page-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pv-page-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.cssText = `
      position:fixed!important;bottom:24px!important;right:24px!important;
      padding:10px 20px!important;background:rgba(14,14,22,0.9)!important;
      backdrop-filter:blur(12px)!important;border:1px solid rgba(124,58,237,0.3)!important;
      color:#f0f0f8!important;border-radius:12px!important;font-size:13px!important;
      font-weight:600!important;z-index:2147483647!important;
      font-family:'Inter','Segoe UI',sans-serif!important;
      box-shadow:0 8px 32px rgba(0,0,0,0.4),0 0 20px rgba(124,58,237,0.15)!important;
      animation:pvFadeIn 0.2s ease!important;
    `;
    clearTimeout(window._pvToast);
    window._pvToast = setTimeout(() => { toast.remove(); }, 2500);
  }

  // ============ QUICK SEARCH OVERLAY ============

  let quickSearchOverlay = null;

  function showQuickSearch() {
    if (quickSearchOverlay) { quickSearchOverlay.remove(); quickSearchOverlay = null; return; }

    quickSearchOverlay = document.createElement('div');
    quickSearchOverlay.id = 'pv-quick-search-overlay';
    quickSearchOverlay.addEventListener('click', (e) => {
      if (e.target === quickSearchOverlay) hideQuickSearch();
    });

    const container = document.createElement('div');
    container.id = 'pv-quick-search-container';

    const header = document.createElement('div');
    header.className = 'pv-qs-header';
    header.innerHTML = `
      <div class="pv-qs-logo">PromptVault</div>
      <input type="text" id="pv-qs-input" placeholder="Search prompts..." autocomplete="off" autofocus>
    `;

    const results = document.createElement('div');
    results.id = 'pv-qs-results';
    results.innerHTML = '<div class="pv-qs-loading">Loading...</div>';

    container.appendChild(header);
    container.appendChild(results);
    quickSearchOverlay.appendChild(container);
    document.body.appendChild(quickSearchOverlay);

    const input = document.getElementById('pv-qs-input');
    setTimeout(() => input.focus(), 50);

    loadQuickSearchPrompts('');

    input.addEventListener('input', () => loadQuickSearchPrompts(input.value));

    let selectedIndex = -1;
    input.addEventListener('keydown', (e) => {
      const items = document.querySelectorAll('.pv-qs-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        updateSelection(items, selectedIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection(items, selectedIndex);
      } else if (e.key === 'Enter' && selectedIndex >= 0 && items[selectedIndex]) {
        e.preventDefault();
        items[selectedIndex].click();
      } else if (e.key === 'Escape') {
        hideQuickSearch();
      }
    });
  }

  function hideQuickSearch() {
    if (quickSearchOverlay) { quickSearchOverlay.remove(); quickSearchOverlay = null; }
  }

  function updateSelection(items, index) {
    items.forEach((item, i) => item.classList.toggle('pv-qs-selected', i === index));
    if (items[index]) items[index].scrollIntoView({ block: 'nearest' });
  }

  function loadQuickSearchPrompts(query) {
    chrome.storage.local.get(['pv_prompts'], (result) => {
      let prompts = result.pv_prompts || [];
      if (query) {
        const q = query.toLowerCase();
        prompts = prompts.filter(p =>
          p.title.toLowerCase().includes(q) ||
          p.text.toLowerCase().includes(q) ||
          (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
        );
      }
      prompts.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
      prompts = prompts.slice(0, 15);

      const container = document.getElementById('pv-qs-results');
      if (!container) return;

      if (prompts.length === 0) {
        container.innerHTML = '<div class="pv-qs-empty">No prompts found</div>';
        return;
      }

      container.innerHTML = prompts.map((p, i) => `
        <div class="pv-qs-item" data-id="${p.id}" data-index="${i}">
          <div class="pv-qs-item-title">${esc(p.title)}</div>
          <div class="pv-qs-item-preview">${esc(p.text).substring(0, 80)}${p.text.length > 80 ? '...' : ''}</div>
          ${(p.tags || []).length > 0 ? `<div class="pv-qs-item-tags">${p.tags.slice(0, 3).map(t => `<span class="pv-qs-tag">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
      `).join('');

      container.querySelectorAll('.pv-qs-item').forEach(item => {
        item.addEventListener('click', () => {
          const prompt = prompts.find(p => p.id === item.dataset.id);
          if (prompt) {
            if (/\{\w+\}/.test(prompt.text)) {
              showInlineVariableInput(prompt);
            } else {
              insertPrompt(prompt.text);
              hideQuickSearch();
              recordUsage(prompt.id);
            }
          }
        });
      });
    });
  }

  function showInlineVariableInput(prompt) {
    const variables = [];
    const regex = /\{(\w+)\}/g;
    let match;
    while ((match = regex.exec(prompt.text)) !== null) {
      if (!variables.includes(match[1])) variables.push(match[1]);
    }

    const container = document.getElementById('pv-qs-results');
    container.innerHTML = `
      <div class="pv-qs-var-form">
        <div class="pv-qs-var-title">${esc(prompt.title)}</div>
        <div class="pv-qs-var-subtitle">Fill in the variables:</div>
        ${variables.map(v => `
          <div class="pv-qs-var-field">
            <label>${v}</label>
            <input type="text" data-var="${v}" placeholder="Enter ${v}..." autocomplete="off">
          </div>
        `).join('')}
        <button class="pv-qs-var-insert" id="pv-qs-var-insert-btn">Insert Prompt</button>
      </div>
    `;

    const firstInput = container.querySelector('.pv-qs-var-field input');
    if (firstInput) firstInput.focus();

    document.getElementById('pv-qs-var-insert-btn').addEventListener('click', () => {
      const values = {};
      container.querySelectorAll('.pv-qs-var-field input').forEach(input => {
        values[input.dataset.var] = input.value || input.dataset.var;
      });
      let finalText = prompt.text;
      for (const [key, value] of Object.entries(values)) {
        finalText = finalText.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      }
      insertPrompt(finalText);
      hideQuickSearch();
      recordUsage(prompt.id);
    });

    container.querySelectorAll('.pv-qs-var-field input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('pv-qs-var-insert-btn').click();
      });
    });
  }

  function recordUsage(promptId) {
    chrome.storage.local.get(['pv_prompts', 'pv_stats', 'pv_usage_history'], (result) => {
      const prompts = result.pv_prompts || [];
      const idx = prompts.findIndex(p => p.id === promptId);
      if (idx >= 0) {
        prompts[idx].usageCount = (prompts[idx].usageCount || 0) + 1;
        prompts[idx].lastUsed = new Date().toISOString();

        const stats = result.pv_stats || { totalInsertions: 0, todayInsertions: 0, todayDate: '', weeklyData: {} };
        const today = new Date().toDateString();
        if (stats.todayDate !== today) { stats.todayInsertions = 0; stats.todayDate = today; }
        stats.totalInsertions++;
        stats.todayInsertions++;
        const dayKey = new Date().toISOString().split('T')[0];
        stats.weeklyData[dayKey] = (stats.weeklyData[dayKey] || 0) + 1;

        const history = result.pv_usage_history || [];
        history.unshift({ promptId, promptTitle: prompts[idx].title, timestamp: new Date().toISOString() });

        chrome.storage.local.set({
          pv_prompts: prompts,
          pv_stats: stats,
          pv_usage_history: history.slice(0, 100)
        });
      }
    });
  }

  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      showQuickSearch();
    }
  });

})();
