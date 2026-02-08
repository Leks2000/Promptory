// PromptVault Popup - Main Controller
// Non-module script for Chrome Extension popup

(function() {
'use strict';

// ==================== CONSTANTS ====================
const SUPABASE_URL = 'https://vofgfvlgchqheksvlibl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZmdmdmxnY2hxaGVrc3ZsaWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTgzNzEsImV4cCI6MjA4NjA3NDM3MX0.taoCHiYqJT2mSp5odtaM1p52KO5MnGzSOiz4dhmZnb0';
const FREE_PROMPT_LIMIT = 20;

// ==================== STATE ====================
const state = {
  prompts: [],
  folders: [],
  settings: { theme: 'dark', hotkeys: { slot1: { promptId: null }, slot2: { promptId: null }, slot3: { promptId: null }, slot4: { promptId: null } }, defaultFolder: null },
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
  }, 3000);
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
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'Just now';
}

function supabaseMsg(params) {
  return new Promise(resolve => chrome.runtime.sendMessage(params, resolve));
}

// ==================== FREE TIER LIMIT ====================
function canCreatePrompt() {
  if (state.isPremium) return true;
  return state.prompts.length < state.promptLimit;
}

function getPromptsRemaining() {
  if (state.isPremium) return Infinity;
  return Math.max(0, state.promptLimit - state.prompts.length);
}

function renderLimitBanner() {
  const existing = document.getElementById('limit-banner');
  if (existing) existing.remove();

  if (state.isPremium || !state.user) return;

  const remaining = getPromptsRemaining();
  if (remaining > 5) return;

  const banner = document.createElement('div');
  banner.id = 'limit-banner';
  banner.className = 'limit-banner';
  if (remaining === 0) {
    banner.innerHTML = `
      <span class="limit-banner-text">Free limit reached. Upgrade to Premium for unlimited prompts.</span>
      <span class="limit-banner-count">${state.prompts.length}/${state.promptLimit}</span>`;
  } else {
    banner.innerHTML = `
      <span class="limit-banner-text">${remaining} prompt${remaining !== 1 ? 's' : ''} remaining on free plan</span>
      <span class="limit-banner-count">${state.prompts.length}/${state.promptLimit}</span>`;
  }
  const content = document.querySelector('.content');
  if (content) content.insertBefore(banner, content.firstChild);
}

// ==================== DATA LOADING ====================
async function loadData() {
  return new Promise(resolve => {
    chrome.storage.local.get(['prompts', 'folders', 'settings', 'user', 'session', 'hasLaunched', 'isPremium', 'promptLimit'], result => {
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
      // Lazy-load stats when tab is clicked
      if (btn.dataset.tab === 'stats') renderStats();
    });
  });
}

// ==================== USAGE HISTORY TRACKING ====================
async function trackUsage(prompt, action = 'insert', platform = null) {
  if (!state.session || !state.user) return;
  try {
    await supabaseMsg({
      action: 'supabaseRequest', method: 'POST',
      path: 'rpc/record_usage',
      body: { p_prompt_id: prompt.id, p_prompt_title: prompt.title, p_platform: platform || 'unknown', p_action: action }
    });
  } catch (e) { console.error('Track usage failed:', e); }
}

// ==================== PROMPTS ====================
function renderPrompts() {
  const list = document.getElementById('prompts-list');
  const prompts = state.prompts;
  const folders = state.folders;

  if (prompts.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No prompts yet</div>
        <div class="empty-state-text">Create your first prompt to get started</div>
        <button class="btn btn-primary ripple" id="empty-create-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Create prompt
        </button>
      </div>`;
    document.getElementById('empty-create-btn')?.addEventListener('click', () => openPromptEditor());
    return;
  }

  // Group by folder
  const grouped = {};
  const uncategorized = [];
  prompts.forEach(p => {
    if (p.folderId) {
      if (!grouped[p.folderId]) grouped[p.folderId] = [];
      grouped[p.folderId].push(p);
    } else {
      uncategorized.push(p);
    }
  });

  let html = '';
  folders.forEach(f => {
    const fp = grouped[f.id] || [];
    if (fp.length > 0) html += renderFolderSection(f, fp);
  });
  if (uncategorized.length > 0) {
    html += renderFolderSection({ id: null, name: 'Uncategorized' }, uncategorized);
  }

  list.innerHTML = html;
  attachPromptCardListeners();
  renderLimitBanner();
}

function renderFolderSection(folder, prompts) {
  const fId = folder.id || 'uncategorized';
  const expanded = localStorage.getItem(`pv-folder-${fId}`) !== 'false';
  return `
    <div class="folder-section ${expanded ? 'expanded' : ''}" data-folder-id="${fId}">
      <div class="folder-header" data-toggle-folder="${fId}">
        <div class="folder-info">
          <span class="folder-arrow">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
          </span>
          <span class="folder-name">${escapeHtml(folder.name)}</span>
        </div>
        <span class="folder-count">${prompts.length}</span>
      </div>
      <div class="folder-content">
        ${prompts.map((p, i) => renderPromptCard(p, i)).join('')}
      </div>
    </div>`;
}

function renderPromptCard(prompt, idx) {
  return `
    <div class="prompt-card" data-prompt-id="${prompt.id}" style="animation-delay:${idx * 40}ms">
      <div class="prompt-card-header">
        <div class="prompt-title">${escapeHtml(prompt.title)}</div>
        <div class="prompt-actions">
          <button class="prompt-action-btn ${prompt.isFavorite ? 'active' : ''}" data-action="toggle-fav" data-id="${prompt.id}" title="${prompt.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${prompt.isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <button class="prompt-action-btn" data-action="copy" data-id="${prompt.id}" title="Copy to clipboard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="prompt-action-btn" data-action="insert" data-id="${prompt.id}" title="Insert to page">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
          </button>
          <button class="prompt-action-btn" data-action="menu" data-id="${prompt.id}" title="More">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
        </div>
      </div>
      ${prompt.tags?.length ? `<div class="tags">${prompt.tags.slice(0,3).map(t=>`<span class="tag">#${escapeHtml(t)}</span>`).join('')}${prompt.tags.length > 3 ? `<span class="tag">+${prompt.tags.length-3}</span>` : ''}</div>` : ''}
      <div class="prompt-meta"><span class="prompt-stat">Used ${prompt.useCount || 0} times</span></div>
    </div>`;
}

function attachPromptCardListeners() {
  // Folder toggle
  document.querySelectorAll('[data-toggle-folder]').forEach(el => {
    el.addEventListener('click', () => {
      const fId = el.dataset.toggleFolder;
      const section = document.querySelector(`[data-folder-id="${fId}"]`);
      if (!section) return;
      const expanded = section.classList.toggle('expanded');
      localStorage.setItem(`pv-folder-${fId}`, expanded);
    });
  });

  // Action buttons (delegated)
  document.querySelectorAll('.prompt-card .prompt-action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'toggle-fav') await toggleFavorite(id);
      else if (action === 'copy') await copyPrompt(id);
      else if (action === 'insert') await insertPromptToPage(id);
      else if (action === 'menu') showContextMenu(btn, id);
    });
  });

  // Card click -> edit
  document.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.prompt-action-btn')) return;
      openPromptEditor(card.dataset.promptId);
    });
  });
}

async function toggleFavorite(id) {
  const p = state.prompts.find(x => x.id === id);
  if (!p) return;
  p.isFavorite = !p.isFavorite;
  p.updatedAt = Date.now();
  await saveData('prompts', state.prompts);
  showToast(p.isFavorite ? 'Added to favorites' : 'Removed from favorites', 'success');
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
    showToast('Copied to clipboard', 'success');
    renderPrompts();
    trackUsage(p, 'copy');
  } catch { showToast('Failed to copy', 'error'); }
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
    showToast('Prompt inserted', 'success');
    renderPrompts();
    const platform = new URL(tab.url || '').hostname.replace('www.','') || 'unknown';
    trackUsage(p, 'insert', platform);
  } catch {
    await navigator.clipboard.writeText(p.text);
    p.useCount = (p.useCount || 0) + 1;
    p.updatedAt = Date.now();
    await saveData('prompts', state.prompts);
    showToast('Copied to clipboard (page not supported)', 'success');
    trackUsage(p, 'clipboard');
  }
}

// ==================== CONTEXT MENU ====================
let activeContextMenu = null;

function showContextMenu(anchorEl, promptId) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <div class="context-menu-item" data-ctx="edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit</div>
    <div class="context-menu-item" data-ctx="copy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</div>
    <div class="context-menu-item" data-ctx="insert"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>Insert to page</div>
    ${state.user ? `<div class="context-menu-item share" data-ctx="share"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share to Library</div>` : ''}
    <div class="context-menu-divider"></div>
    <div class="context-menu-item danger" data-ctx="delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Delete</div>`;
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

  setTimeout(() => document.addEventListener('click', closeContextMenu, { once: true }), 10);
}

function closeContextMenu() {
  if (activeContextMenu) { activeContextMenu.remove(); activeContextMenu = null; }
}

async function deletePrompt(id) {
  if (!confirm('Delete this prompt?')) return;
  state.prompts = state.prompts.filter(p => p.id !== id);
  await saveData('prompts', state.prompts);
  showToast('Prompt deleted', 'success');
  renderPrompts();
  renderFavorites();
  syncPromptDeleteToSupabase(id);
}

// ==================== SHARE TO LIBRARY ====================
async function shareToLibrary(promptId) {
  const p = state.prompts.find(x => x.id === promptId);
  if (!p) return;
  if (!state.user || !state.session) {
    showToast('Sign in to share prompts', 'error');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'share-modal';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">Share to Public Library</h2>
        <button class="btn btn-icon btn-ghost close-modal-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Title</label>
          <input type="text" id="share-title" value="${escapeHtml(p.title)}">
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="share-desc" rows="2" placeholder="Brief description for the community">${escapeHtml(p.description || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select id="share-category">
            <option value="general">General</option>
            <option value="business">Business</option>
            <option value="development">Development</option>
            <option value="marketing">Marketing</option>
            <option value="creative">Creative</option>
            <option value="learning">Learning</option>
            <option value="ai">AI & Prompts</option>
          </select>
        </div>
        <div style="padding:10px;background:var(--bg-tertiary);border-radius:var(--radius-md);margin-top:8px;">
          <div style="font-size:var(--font-size-xs);color:var(--text-tertiary);line-height:1.5;">
            By sharing, your prompt will be visible to all PromptVault users.
            Your name will appear as the author. You can remove it later.
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost close-modal-btn">Cancel</button>
        <button class="btn btn-primary ripple" id="share-confirm-btn">Share</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);

  document.getElementById('share-confirm-btn').addEventListener('click', async () => {
    const title = document.getElementById('share-title').value.trim();
    const desc = document.getElementById('share-desc').value.trim();
    const category = document.getElementById('share-category').value;
    if (!title) { showToast('Title is required', 'error'); return; }

    const btn = document.getElementById('share-confirm-btn');
    btn.classList.add('loading');
    try {
      const res = await supabaseMsg({
        action: 'supabaseRequest', method: 'POST',
        path: 'library_prompts',
        body: {
          title, text: p.text, description: desc,
          author: state.user.name || state.user.email.split('@')[0],
          author_id: state.user.id,
          tags: p.tags || [], variables: p.variables || [],
          category, is_approved: true
        }
      });
      if (res?.error) throw new Error(res.error);
      showToast('Prompt shared to library!', 'success');
      closeModal('share-modal');
      loadLibraryPrompts();
    } catch (e) {
      showToast('Failed to share: ' + (e.message || 'Unknown error'), 'error');
    }
    btn.classList.remove('loading');
  });

  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => closeModal('share-modal')));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal('share-modal'); });
}

// ==================== PROMPT EDITOR (CREATE/EDIT) ====================
function openPromptEditor(promptId = null) {
  // Check free tier limit for new prompts
  if (!promptId && !canCreatePrompt()) {
    showToast(`Free limit reached (${state.promptLimit} prompts). Upgrade to Premium for unlimited prompts.`, 'error');
    return;
  }

  const prompt = promptId ? state.prompts.find(p => p.id === promptId) : null;
  const isEdit = !!prompt;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'prompt-editor-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width:600px;">
      <div class="modal-header">
        <h2 class="modal-title">${isEdit ? 'Edit Prompt' : 'New Prompt'}</h2>
        <button class="btn btn-icon btn-ghost close-modal-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label required">Title</label>
          <input type="text" id="pe-title" placeholder="e.g., Summarize Article" value="${prompt ? escapeHtml(prompt.title) : ''}">
          <span class="form-error" id="pe-title-err" style="display:none;">Title is required</span>
        </div>
        <div class="form-group">
          <label class="form-label required">Prompt Text</label>
          <textarea id="pe-text" placeholder="Write your prompt... Use {variables} for dynamic content" rows="8">${prompt ? escapeHtml(prompt.text) : ''}</textarea>
          <span class="form-error" id="pe-text-err" style="display:none;">Text is required</span>
          <span class="form-hint" id="pe-vars-hint" style="display:none;">Variables: <span id="pe-vars-list"></span></span>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="pe-desc" placeholder="Optional description" rows="2">${prompt ? escapeHtml(prompt.description || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Folder</label>
          <select id="pe-folder">
            <option value="">Uncategorized</option>
            ${state.folders.map(f => `<option value="${f.id}" ${prompt?.folderId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tags</label>
          <div id="pe-tags-container">
            <div class="tags" id="pe-tags-list">
              ${(prompt?.tags || []).map(t => `<span class="tag tag-removable" data-tag="${escapeHtml(t)}">#${escapeHtml(t)} <span class="tag-remove" data-remove-tag="${escapeHtml(t)}">&times;</span></span>`).join('')}
            </div>
            <input type="text" id="pe-tag-input" placeholder="Add tag (Enter)" style="margin-top:8px;">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Platform</label>
          <select id="pe-platform">
            <option value="universal" ${!prompt || prompt.platform === 'universal' ? 'selected' : ''}>Universal</option>
            <option value="chatgpt" ${prompt?.platform === 'chatgpt' ? 'selected' : ''}>ChatGPT</option>
            <option value="claude" ${prompt?.platform === 'claude' ? 'selected' : ''}>Claude</option>
            <option value="gemini" ${prompt?.platform === 'gemini' ? 'selected' : ''}>Gemini</option>
            <option value="perplexity" ${prompt?.platform === 'perplexity' ? 'selected' : ''}>Perplexity</option>
          </select>
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        ${isEdit ? `<button class="btn btn-danger" id="pe-delete-btn">Delete</button>` : '<div></div>'}
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost close-modal-btn">Cancel</button>
          <button class="btn btn-primary ripple" id="pe-save-btn">${isEdit ? 'Save Changes' : 'Create Prompt'}</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);

  document.getElementById('pe-title').focus();

  const textArea = document.getElementById('pe-text');
  textArea.addEventListener('input', updateVarsDisplay);
  updateVarsDisplay();

  document.getElementById('pe-tag-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(e.target.value.trim());
      e.target.value = '';
    }
  });

  document.getElementById('pe-tags-list').addEventListener('click', (e) => {
    const removeTag = e.target.dataset.removeTag || e.target.closest('[data-remove-tag]')?.dataset.removeTag;
    if (removeTag) {
      const tagEl = document.querySelector(`#pe-tags-list [data-tag="${removeTag}"]`);
      if (tagEl) tagEl.remove();
    }
  });

  document.getElementById('pe-save-btn').addEventListener('click', () => savePrompt(promptId));

  document.getElementById('pe-delete-btn')?.addEventListener('click', async () => {
    await deletePrompt(promptId);
    closeModal('prompt-editor-modal');
  });

  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => closeModal('prompt-editor-modal')));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal('prompt-editor-modal'); });

  const escHandler = (e) => { if (e.key === 'Escape') { closeModal('prompt-editor-modal'); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
}

function updateVarsDisplay() {
  const text = document.getElementById('pe-text')?.value || '';
  const vars = [...new Set((text.match(/\{([^}]+)\}/g) || []).map(m => m.slice(1, -1)))];
  const hint = document.getElementById('pe-vars-hint');
  const list = document.getElementById('pe-vars-list');
  if (hint && list) {
    if (vars.length > 0) {
      list.innerHTML = vars.map(v => `<span class="tag">{${escapeHtml(v)}}</span>`).join(' ');
      hint.style.display = 'block';
    } else {
      hint.style.display = 'none';
    }
  }
}

function addTag(tag) {
  if (!tag) return;
  tag = tag.replace(/^#/, '');
  const existing = Array.from(document.querySelectorAll('#pe-tags-list [data-tag]')).map(el => el.dataset.tag);
  if (existing.includes(tag)) return;
  const tagsList = document.getElementById('pe-tags-list');
  const el = document.createElement('span');
  el.className = 'tag tag-removable';
  el.dataset.tag = tag;
  el.innerHTML = `#${escapeHtml(tag)} <span class="tag-remove" data-remove-tag="${escapeHtml(tag)}">&times;</span>`;
  tagsList.appendChild(el);
}

async function savePrompt(editingId) {
  const title = document.getElementById('pe-title')?.value.trim();
  const text = document.getElementById('pe-text')?.value.trim();
  const desc = document.getElementById('pe-desc')?.value.trim();
  const folderId = document.getElementById('pe-folder')?.value || null;
  const platform = document.getElementById('pe-platform')?.value || 'universal';
  const tags = Array.from(document.querySelectorAll('#pe-tags-list [data-tag]')).map(el => el.dataset.tag);

  let hasError = false;
  if (!title) { document.getElementById('pe-title-err').style.display = 'block'; hasError = true; } else { document.getElementById('pe-title-err').style.display = 'none'; }
  if (!text) { document.getElementById('pe-text-err').style.display = 'block'; hasError = true; } else { document.getElementById('pe-text-err').style.display = 'none'; }
  if (hasError) return;

  const variables = [...new Set((text.match(/\{([^}]+)\}/g) || []).map(m => m.slice(1, -1)))];

  if (editingId) {
    const p = state.prompts.find(x => x.id === editingId);
    if (p) {
      Object.assign(p, { title, text, description: desc, folderId, platform, tags, variables, updatedAt: Date.now() });
      syncPromptToSupabase(p);
    }
  } else {
    // Check limit again before creating
    if (!canCreatePrompt()) {
      showToast(`Free limit reached (${state.promptLimit} prompts). Upgrade to Premium.`, 'error');
      return;
    }
    const newP = { id: crypto.randomUUID(), title, text, description: desc, folderId, platform, tags, variables, isFavorite: false, useCount: 0, createdAt: Date.now(), updatedAt: Date.now() };
    state.prompts.unshift(newP);
    syncPromptToSupabase(newP);
  }

  await saveData('prompts', state.prompts);
  showToast(editingId ? 'Prompt updated' : 'Prompt created', 'success');
  closeModal('prompt-editor-modal');
  renderPrompts();
  renderFavorites();
}

// ==================== FOLDERS ====================
function renderFolders() {
  const list = document.getElementById('folders-list');
  const folders = state.folders;

  if (folders.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No folders yet</div>
        <div class="empty-state-text">Create folders to organize your prompts</div>
      </div>`;
    return;
  }

  list.innerHTML = folders.map((f, i) => {
    const count = state.prompts.filter(p => p.folderId === f.id).length;
    return `
      <div class="folder-card" data-folder-id="${f.id}" style="animation-delay:${i*40}ms">
        <div class="folder-card-left">
          <div class="folder-details">
            <div class="folder-card-name">${escapeHtml(f.name)}</div>
            <div class="folder-card-count">${count} prompt${count !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="folder-card-actions">
          <button class="prompt-action-btn" data-edit-folder="${f.id}" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="prompt-action-btn" data-delete-folder="${f.id}" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');

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
      if (!confirm(`Delete "${f.name}"?${count ? `\n${count} prompts will be moved to Uncategorized.` : ''}`)) return;
      state.folders = state.folders.filter(x => x.id !== fId);
      state.prompts.forEach(p => { if (p.folderId === fId) p.folderId = null; });
      await saveData('folders', state.folders);
      await saveData('prompts', state.prompts);
      showToast('Folder deleted', 'success');
      renderFolders();
      renderPrompts();
      syncFolderDeleteToSupabase(fId);
    });
  });
  document.querySelectorAll('.folder-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.folder-card-actions')) return;
      document.querySelector('[data-tab="prompts"]').click();
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
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${isEdit ? 'Edit Folder' : 'New Folder'}</h2>
        <button class="btn btn-icon btn-ghost close-modal-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label required">Folder Name</label>
          <input type="text" id="fe-name" placeholder="e.g., Marketing" value="${folder ? escapeHtml(folder.name) : ''}">
          <span class="form-error" id="fe-name-err" style="display:none;">Name is required</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost close-modal-btn">Cancel</button>
        <button class="btn btn-primary ripple" id="fe-save-btn">${isEdit ? 'Save Changes' : 'Create Folder'}</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);
  document.getElementById('fe-name').focus();

  document.getElementById('fe-save-btn').addEventListener('click', async () => {
    const name = document.getElementById('fe-name').value.trim();
    if (!name) { document.getElementById('fe-name-err').style.display = 'block'; return; }

    if (folderId) {
      const f = state.folders.find(x => x.id === folderId);
      if (f) { f.name = name; f.updatedAt = Date.now(); syncFolderToSupabase(f); }
    } else {
      const newF = { id: crypto.randomUUID(), name, createdAt: Date.now(), updatedAt: Date.now() };
      state.folders.push(newF);
      syncFolderToSupabase(newF);
    }
    await saveData('folders', state.folders);
    showToast(folderId ? 'Folder updated' : 'Folder created', 'success');
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
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No favorites yet</div>
        <div class="empty-state-text">Star prompts to see them here for quick access</div>
        <button class="btn btn-secondary ripple" id="fav-browse-btn">Browse Prompts</button>
      </div>`;
    document.getElementById('fav-browse-btn')?.addEventListener('click', () => document.querySelector('[data-tab="prompts"]').click());
    return;
  }

  let html = `
    <div class="favorites-header">
      <span class="favorites-header-title">Favorites</span>
      <span class="favorites-count">${favorites.length} prompt${favorites.length !== 1 ? 's' : ''}</span>
    </div>`;

  html += favorites.map((p, i) => {
    const folderName = p.folderId ? state.folders.find(f => f.id === p.folderId)?.name : null;
    return `
      <div class="prompt-card favorite-card" data-prompt-id="${p.id}" style="animation-delay:${i*40}ms">
        <div class="prompt-card-header">
          <div class="prompt-title">${escapeHtml(p.title)}</div>
          <div class="prompt-actions">
            <button class="prompt-action-btn" data-fav-copy="${p.id}" title="Copy">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="prompt-action-btn" data-fav-insert="${p.id}" title="Insert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            </button>
            <button class="prompt-action-btn active" data-fav-remove="${p.id}" title="Remove from favorites">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </button>
          </div>
        </div>
        ${folderName ? `<div class="prompt-folder-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>${escapeHtml(folderName)}</div>` : ''}
        ${p.tags?.length ? `<div class="tags">${p.tags.slice(0,3).map(t=>`<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="prompt-meta"><span class="prompt-stat">Used ${p.useCount || 0} times</span><span class="prompt-stat">${formatDate(p.updatedAt)}</span></div>
      </div>`;
  }).join('');

  list.innerHTML = html;

  document.querySelectorAll('[data-fav-copy]').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); copyPrompt(btn.dataset.favCopy); }));
  document.querySelectorAll('[data-fav-insert]').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); insertPromptToPage(btn.dataset.favInsert); }));
  document.querySelectorAll('[data-fav-remove]').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(btn.dataset.favRemove); }));
  document.querySelectorAll('#favorites-list .prompt-card').forEach(card => {
    card.addEventListener('click', (e) => { if (!e.target.closest('.prompt-action-btn')) openPromptEditor(card.dataset.promptId); });
  });
}

// ==================== EXPLORE (Library) ====================
async function loadLibraryPrompts() {
  if (!state.session) return;
  try {
    const res = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: 'library_prompts?is_approved=eq.true&order=likes.desc' });
    if (res?.data) {
      state.libraryPrompts = res.data.map(p => ({
        id: p.id, title: p.title, text: p.text, description: p.description,
        author: p.author, authorId: p.author_id, tags: p.tags || [],
        likes: p.likes, downloads: p.downloads,
        category: p.category, isFeatured: p.is_featured
      }));
    }
    // Load user's likes
    const likesRes = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: 'library_likes?select=prompt_id' });
    if (likesRes?.data) {
      state.userLikes = new Set(likesRes.data.map(l => l.prompt_id));
    }
    // Load user's reports
    const reportsRes = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: 'prompt_reports?select=prompt_id' });
    if (reportsRes?.data) {
      state.userReports = new Set(reportsRes.data.map(r => r.prompt_id));
    }
  } catch (e) { console.error('Failed to load library:', e); }
  renderExplore();
}

let flippedCards = new Set();

function renderExplore() {
  const list = document.getElementById('explore-list');

  if (!state.user) {
    list.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-title">Sign in to explore</div><div class="empty-state-text">Discover and save public prompts from the community</div><button class="btn btn-primary ripple" id="explore-signin-btn">Sign In</button></div>`;
    document.getElementById('explore-signin-btn')?.addEventListener('click', () => document.getElementById('settings-btn').click());
    return;
  }

  if (state.libraryPrompts.length === 0) {
    list.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-title">No public prompts yet</div><div class="empty-state-text">Be the first to share! Use the context menu on any prompt.</div></div>`;
    return;
  }

  list.innerHTML = state.libraryPrompts.map((p, i) => {
    const isFlipped = flippedCards.has(p.id);
    const preview = p.text.substring(0, 120) + (p.text.length > 120 ? '...' : '');
    const isLiked = state.userLikes.has(p.id);
    const isReported = state.userReports.has(p.id);
    return `
      <div class="explore-card-wrapper" data-explore-id="${p.id}" style="animation-delay:${i*60}ms">
        <div class="explore-card ${isFlipped ? 'flipped' : ''}">
          <div class="explore-card-front">
            <div class="explore-card-thumbnail">${p.category || 'general'}</div>
            <div class="explore-card-title">${escapeHtml(p.title)}</div>
            <div class="explore-card-meta">
              <span class="explore-card-author">${escapeHtml(p.author)}</span>
              <div class="explore-card-stats"><span>${p.likes} likes</span></div>
            </div>
          </div>
          <div class="explore-card-back">
            <div class="explore-card-back-header"><div class="explore-card-back-title">${escapeHtml(p.title)}</div></div>
            <div class="explore-card-text">${escapeHtml(preview)}</div>
            ${p.tags?.length ? `<div class="tags" style="margin-top:8px;">${p.tags.slice(0,2).map(t=>`<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
            <div class="explore-card-actions">
              <button class="btn btn-secondary btn-sm ripple" data-explore-copy="${p.id}">Copy</button>
              <button class="btn btn-primary btn-sm ripple" data-explore-save="${p.id}">Save</button>
            </div>
            <div class="explore-card-actions-row">
              <button class="explore-action-btn ${isLiked ? 'liked' : ''}" data-explore-like="${p.id}" title="Like">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
              <span style="font-size:11px;color:var(--text-tertiary);">${p.likes}</span>
              <button class="explore-action-btn ${isReported ? 'reported' : ''}" data-explore-report="${p.id}" title="${isReported ? 'Reported' : 'Report'}" ${isReported ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  // Flip cards
  document.querySelectorAll('.explore-card-wrapper').forEach(wrapper => {
    wrapper.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const card = wrapper.querySelector('.explore-card');
      const id = wrapper.dataset.exploreId;
      if (card.classList.contains('flipped')) { card.classList.remove('flipped'); flippedCards.delete(id); }
      else { card.classList.add('flipped'); flippedCards.add(id); }
    });
  });

  // Copy
  document.querySelectorAll('[data-explore-copy]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const p = state.libraryPrompts.find(x => x.id === btn.dataset.exploreCopy);
      if (p) { await navigator.clipboard.writeText(p.text); showToast('Copied to clipboard', 'success'); }
    });
  });

  // Save
  document.querySelectorAll('[data-explore-save]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.exploreSave;
      if (state.prompts.some(p => p.sourceId === id)) { showToast('Already in your library', 'error'); return; }
      if (!canCreatePrompt()) { showToast(`Free limit reached (${state.promptLimit} prompts)`, 'error'); return; }
      const ep = state.libraryPrompts.find(x => x.id === id);
      if (!ep) return;
      const newP = { id: crypto.randomUUID(), sourceId: id, title: ep.title, text: ep.text, description: `From ${ep.author}`, tags: ep.tags || [], folderId: null, platform: 'universal', variables: [], isFavorite: false, useCount: 0, createdAt: Date.now(), updatedAt: Date.now() };
      state.prompts.unshift(newP);
      await saveData('prompts', state.prompts);
      showToast('Saved to your library', 'success');
      supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'rpc/increment_download_count', body: { prompt_uuid: id } });
    });
  });

  // Like
  document.querySelectorAll('[data-explore-like]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.exploreLike;
      try {
        const res = await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'rpc/toggle_library_like', body: { prompt_uuid: id } });
        if (res?.data) {
          const result = Array.isArray(res.data) ? res.data[0] : res.data;
          if (result.liked) { state.userLikes.add(id); } else { state.userLikes.delete(id); }
          const lp = state.libraryPrompts.find(x => x.id === id);
          if (lp) lp.likes = result.likes;
          renderExplore();
        }
      } catch (err) { showToast('Failed to like', 'error'); }
    });
  });

  // Report
  document.querySelectorAll('[data-explore-report]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.userReports.has(btn.dataset.exploreReport)) return;
      openReportModal(btn.dataset.exploreReport);
    });
  });
}

// ==================== REPORT MODAL ====================
function openReportModal(promptId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'report-modal';
  const reasons = ['Inappropriate content', 'Spam or misleading', 'NSFW content', 'Copyright violation', 'Low quality / not useful', 'Other'];
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">Report Prompt</h2>
        <button class="btn btn-icon btn-ghost close-modal-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Reason for reporting</label>
          <div class="report-reasons">
            ${reasons.map((r, i) => `
              <label class="report-reason-option" data-reason="${escapeHtml(r)}">
                <input type="radio" name="report-reason" value="${escapeHtml(r)}" ${i === 0 ? 'checked' : ''}>
                <span class="report-reason-label">${escapeHtml(r)}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Additional details (optional)</label>
          <textarea id="report-details" rows="3" placeholder="Provide more context..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost close-modal-btn">Cancel</button>
        <button class="btn btn-danger ripple" id="report-submit-btn">Submit Report</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);

  // Radio selection styling
  modal.querySelectorAll('.report-reason-option').forEach(opt => {
    opt.addEventListener('click', () => {
      modal.querySelectorAll('.report-reason-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input').checked = true;
    });
  });
  modal.querySelector('.report-reason-option')?.classList.add('selected');

  document.getElementById('report-submit-btn').addEventListener('click', async () => {
    const reason = modal.querySelector('input[name="report-reason"]:checked')?.value;
    const details = document.getElementById('report-details')?.value.trim();
    if (!reason) return;

    const btn = document.getElementById('report-submit-btn');
    btn.classList.add('loading');
    try {
      const res = await supabaseMsg({
        action: 'supabaseRequest', method: 'POST', path: 'prompt_reports',
        body: { user_id: state.user.id, prompt_id: promptId, reason, details: details || null }
      });
      if (res?.error) throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
      state.userReports.add(promptId);
      showToast('Report submitted. Thank you!', 'success');
      closeModal('report-modal');
      renderExplore();
    } catch (e) {
      if (e.message && e.message.includes('duplicate')) {
        showToast('Already reported', 'error');
        state.userReports.add(promptId);
      } else {
        showToast('Failed to submit report', 'error');
      }
    }
    btn.classList.remove('loading');
  });

  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => closeModal('report-modal')));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal('report-modal'); });
}

// ==================== STATISTICS DASHBOARD ====================
function renderStats() {
  const container = document.getElementById('stats-content');
  if (!container) return;

  // Local stats from prompts data
  const totalPrompts = state.prompts.length;
  const totalUses = state.prompts.reduce((s, p) => s + (p.useCount || 0), 0);
  const totalFavorites = state.prompts.filter(p => p.isFavorite).length;

  // Top prompts by usage
  const topPrompts = [...state.prompts]
    .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
    .slice(0, 5)
    .filter(p => (p.useCount || 0) > 0);

  // Tags frequency
  const tagMap = {};
  state.prompts.forEach(p => (p.tags || []).forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; }));
  const topTags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Usage over last 7 days (approximation from updatedAt)
  const now = Date.now();
  const dayMs = 86400000;
  const dailyUses = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - (i + 1) * dayMs;
    const dayEnd = now - i * dayMs;
    const dayLabel = new Date(dayEnd).toLocaleDateString('en', { weekday: 'short' });
    const count = state.prompts.reduce((s, p) => {
      if (p.updatedAt && p.updatedAt >= dayStart && p.updatedAt < dayEnd && (p.useCount || 0) > 0) return s + 1;
      return s;
    }, 0);
    dailyUses.push({ label: dayLabel, count });
  }
  const maxDaily = Math.max(...dailyUses.map(d => d.count), 1);

  // Platform breakdown from prompts
  const platformMap = {};
  state.prompts.forEach(p => {
    const pl = p.platform || 'universal';
    platformMap[pl] = (platformMap[pl] || 0) + (p.useCount || 0);
  });
  const platforms = Object.entries(platformMap).sort((a, b) => b[1] - a[1]);
  const maxPlatform = Math.max(...platforms.map(p => p[1]), 1);

  container.innerHTML = `
    <div class="stats-dashboard">
      <!-- Overview cards -->
      <div class="stats-overview">
        <div class="stat-card">
          <div class="stat-card-value">${totalPrompts}</div>
          <div class="stat-card-label">Total Prompts</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${totalUses}</div>
          <div class="stat-card-label">Total Uses</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${totalFavorites}</div>
          <div class="stat-card-label">Favorites</div>
        </div>
      </div>

      <!-- Usage Chart -->
      <div class="stats-section">
        <div class="stats-section-title">Activity (Last 7 Days)</div>
        <div class="usage-chart">
          ${dailyUses.map(d => `
            <div class="chart-bar-wrap">
              <div class="chart-bar" style="height:${Math.max((d.count / maxDaily) * 80, 2)}px;" title="${d.count} uses"></div>
              <div class="chart-bar-label">${d.label}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Top Prompts -->
      <div class="stats-section">
        <div class="stats-section-title">Most Used Prompts</div>
        ${topPrompts.length > 0 ? topPrompts.map((p, i) => `
          <div class="top-prompt-item">
            <span class="top-prompt-rank">${i + 1}</span>
            <span class="top-prompt-name">${escapeHtml(p.title)}</span>
            <span class="top-prompt-uses">${p.useCount} uses</span>
          </div>
        `).join('') : '<div style="font-size:var(--font-size-xs);color:var(--text-tertiary);padding:8px 0;">No usage data yet. Start using prompts!</div>'}
      </div>

      <!-- Platform breakdown -->
      ${platforms.length > 0 ? `
      <div class="stats-section">
        <div class="stats-section-title">Usage by Platform</div>
        <div class="platform-stats">
          ${platforms.map(([name, count]) => `
            <div class="platform-stat-row">
              <span class="platform-stat-name">${escapeHtml(name)}</span>
              <div class="platform-stat-bar-bg">
                <div class="platform-stat-bar" style="width:${(count / maxPlatform) * 100}%;"></div>
              </div>
              <span class="platform-stat-count">${count}</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <!-- Top Tags -->
      ${topTags.length > 0 ? `
      <div class="stats-section">
        <div class="stats-section-title">Top Tags</div>
        <div class="tags" style="flex-wrap:wrap;">
          ${topTags.map(([tag, count]) => `<span class="tag">#${escapeHtml(tag)} (${count})</span>`).join('')}
        </div>
      </div>` : ''}

      ${!state.isPremium && state.user ? `
      <!-- Free tier info -->
      <div class="stats-section" style="border-color:var(--accent);">
        <div class="stats-section-title">Free Plan</div>
        <div style="font-size:var(--font-size-sm);color:var(--text-secondary);line-height:1.6;">
          ${state.prompts.length} / ${state.promptLimit} prompts used<br>
          <div style="margin-top:8px;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${Math.min((state.prompts.length / state.promptLimit) * 100, 100)}%;background:${state.prompts.length >= state.promptLimit ? 'var(--error)' : 'var(--accent)'};border-radius:3px;"></div>
          </div>
          <div style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-top:8px;">Upgrade to Premium for unlimited prompts, priority library access, and more.</div>
        </div>
      </div>` : ''}
    </div>`;

  // If user is signed in, also try to load server-side stats
  if (state.session) {
    loadServerStats();
  }
}

async function loadServerStats() {
  try {
    const res = await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'rpc/get_usage_stats', body: { days_back: 30 } });
    if (res?.data) {
      // Server stats loaded - could enhance the local display with cloud data
      console.log('Server usage stats:', res.data);
    }
  } catch (e) { console.error('Load server stats failed:', e); }
}

// ==================== SETTINGS ====================
function openSettings() {
  const s = state.settings;
  const user = state.user;
  const hotkeys = s.hotkeys || {};

  // Get current Chrome commands for display
  const commandNames = {
    'open-search': { label: 'Search Overlay', default: 'Ctrl+Shift+P' },
    'hotkey-1': { label: 'Quick Insert Slot 1', default: 'Alt+1' },
    'hotkey-2': { label: 'Quick Insert Slot 2', default: 'Alt+2' },
    'hotkey-3': { label: 'Quick Insert Slot 3', default: 'Alt+3' },
    'hotkey-4': { label: 'Quick Insert Slot 4', default: 'Alt+4' }
  };

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'settings-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width:500px;">
      <div class="modal-header">
        <h2 class="modal-title">Settings</h2>
        <button class="btn btn-icon btn-ghost close-modal-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="modal-body">
        <!-- Account -->
        <div class="form-group">
          <label class="form-label">Account</label>
          ${user ? `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);border:1px solid var(--border);">
              <div>
                <div style="font-weight:500;">${escapeHtml(user.email || user.name || 'Signed In')}</div>
                <div style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-top:2px;">
                  Cloud sync active${state.isPremium ? ' | Premium' : ` | Free (${state.prompts.length}/${state.promptLimit})`}
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" id="settings-signout-btn">Sign Out</button>
            </div>` : `
            <button class="btn btn-primary" id="settings-signin-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/></svg>
              Sign in with Google
            </button>
            <span class="form-hint">Sign in to sync prompts and access the public library</span>`}
        </div>
        <div class="divider"></div>

        <!-- Keyboard Shortcuts -->
        <div class="form-group">
          <label class="form-label">Keyboard Shortcuts</label>
          <span class="form-hint" style="margin-bottom:12px;display:block;">
            Current key bindings. To change shortcuts, open
            <a href="#" id="open-shortcuts-link" style="color:var(--accent);">chrome://extensions/shortcuts</a>
          </span>
          <div class="hotkey-rebind-section" id="shortcuts-display"></div>
        </div>
        <div class="divider"></div>

        <!-- Hotkey Prompt Assignment -->
        <div class="form-group">
          <label class="form-label">Quick Insert Prompts</label>
          <span class="form-hint" style="margin-bottom:12px;display:block;">Assign prompts to hotkey slots for instant insertion</span>
          <div class="hotkey-section">
            ${[1,2,3,4].map(n => {
              const slotId = `slot${n}`;
              const slot = hotkeys[slotId] || {};
              const assigned = slot.promptId ? state.prompts.find(p => p.id === slot.promptId) : null;
              return `
                <div class="hotkey-item">
                  <div class="hotkey-info">
                    <div class="hotkey-name">Slot ${n}</div>
                    <div class="hotkey-description">${assigned ? escapeHtml(assigned.title) : 'No prompt assigned'}</div>
                  </div>
                  <div class="hotkey-key">
                    <select class="hotkey-prompt-select" data-hotkey-slot="${slotId}">
                      <option value="">Select prompt...</option>
                      ${state.prompts.map(p => `<option value="${p.id}" ${slot.promptId === p.id ? 'selected' : ''}>${escapeHtml(p.title.substring(0,25))}${p.title.length>25?'...':''}</option>`).join('')}
                    </select>
                    <div class="hotkey-badge">Alt+${n}</div>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>
        <div class="divider"></div>

        <!-- Theme -->
        <div class="form-group">
          <label class="form-label">Theme</label>
          <select id="settings-theme">
            <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option>
            <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="system" ${s.theme === 'system' ? 'selected' : ''}>System</option>
          </select>
        </div>
        <div class="divider"></div>

        <!-- Data -->
        <div class="form-group">
          <label class="form-label">Data Management</label>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button class="btn btn-secondary" id="settings-export-btn">Export All Data (JSON)</button>
            <button class="btn btn-secondary" id="settings-import-btn">Import Data (JSON)</button>
          </div>
        </div>
        <div class="divider"></div>

        <!-- About -->
        <div class="form-group">
          <label class="form-label">About</label>
          <div style="font-size:var(--font-size-sm);color:var(--text-secondary);line-height:1.6;">
            <strong>PromptVault</strong> v1.0.0<br>
            AI Prompt Manager for power users
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost close-modal-btn">Cancel</button>
        <button class="btn btn-primary" id="settings-save-btn">Save Settings</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);

  // Load and display current shortcuts
  loadShortcutsDisplay(commandNames);

  // Open shortcuts link
  document.getElementById('open-shortcuts-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  // Sign in / Sign out
  document.getElementById('settings-signin-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('settings-signin-btn');
    btn.classList.add('loading');
    const result = await new Promise(resolve => chrome.runtime.sendMessage({ action: 'signInWithGoogle' }, resolve));
    btn.classList.remove('loading');
    if (result?.success) {
      state.user = result.user;
      state.session = result.session;
      showToast('Signed in successfully', 'success');
      closeModal('settings-modal');
      renderExplore();
      loadLibraryPrompts();
      syncAllData();
      checkPremiumStatus();
    } else {
      showToast('Sign in failed: ' + (result?.error || 'Unknown error'), 'error');
    }
  });

  document.getElementById('settings-signout-btn')?.addEventListener('click', async () => {
    if (!confirm('Sign out?')) return;
    await new Promise(resolve => chrome.runtime.sendMessage({ action: 'signOut' }, resolve));
    state.user = null;
    state.session = null;
    state.isPremium = false;
    showToast('Signed out', 'success');
    closeModal('settings-modal');
    renderExplore();
  });

  // Export
  document.getElementById('settings-export-btn').addEventListener('click', () => {
    const data = { prompts: state.prompts, folders: state.folders, settings: state.settings, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `promptvault-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Data exported', 'success');
  });

  // Import
  document.getElementById('settings-import-btn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data.prompts && !data.folders) throw new Error('Invalid');
        if (!confirm('Replace all current data?')) return;
        if (data.prompts) state.prompts = data.prompts;
        if (data.folders) state.folders = data.folders;
        if (data.settings) state.settings = { ...state.settings, ...data.settings };
        await saveData('prompts', state.prompts);
        await saveData('folders', state.folders);
        await saveData('settings', state.settings);
        showToast('Data imported', 'success');
        closeModal('settings-modal');
        renderPrompts();
        renderFolders();
        renderFavorites();
      } catch { showToast('Import failed: Invalid file', 'error'); }
    };
    input.click();
  });

  // Save Settings
  document.getElementById('settings-save-btn').addEventListener('click', async () => {
    state.settings.theme = document.getElementById('settings-theme').value;
    document.querySelectorAll('[data-hotkey-slot]').forEach(sel => {
      const slotId = sel.dataset.hotkeySlot;
      if (!state.settings.hotkeys) state.settings.hotkeys = {};
      if (!state.settings.hotkeys[slotId]) state.settings.hotkeys[slotId] = {};
      state.settings.hotkeys[slotId].promptId = sel.value || null;
    });
    await saveData('settings', state.settings);
    applyTheme(state.settings.theme);
    showToast('Settings saved', 'success');
    closeModal('settings-modal');
  });

  // Close
  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => closeModal('settings-modal')));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal('settings-modal'); });
}

function loadShortcutsDisplay(commandNames) {
  const container = document.getElementById('shortcuts-display');
  if (!container) return;

  // Try to get actual chrome commands
  if (chrome.commands && chrome.commands.getAll) {
    chrome.commands.getAll(commands => {
      let html = '';
      commands.forEach(cmd => {
        if (cmd.name === '_execute_action') return; // Skip default action
        const info = commandNames[cmd.name] || { label: cmd.description || cmd.name, default: '' };
        const shortcut = cmd.shortcut || info.default || 'Not set';
        html += `
          <div class="hotkey-rebind-item">
            <span class="hotkey-rebind-label">${escapeHtml(info.label)}</span>
            <span class="hotkey-rebind-current">
              <span class="hotkey-rebind-btn" title="Change in chrome://extensions/shortcuts">${escapeHtml(shortcut)}</span>
            </span>
          </div>`;
      });
      container.innerHTML = html || '<div style="font-size:var(--font-size-xs);color:var(--text-tertiary);">No shortcuts configured</div>';

      // Make shortcut buttons clickable to open chrome shortcuts page
      container.querySelectorAll('.hotkey-rebind-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
        });
      });
    });
  } else {
    // Fallback: show defaults
    let html = '';
    Object.entries(commandNames).forEach(([name, info]) => {
      html += `
        <div class="hotkey-rebind-item">
          <span class="hotkey-rebind-label">${escapeHtml(info.label)}</span>
          <span class="hotkey-rebind-current">
            <span class="hotkey-rebind-btn">${escapeHtml(info.default)}</span>
          </span>
        </div>`;
    });
    container.innerHTML = html;
  }
}

// ==================== PREMIUM STATUS CHECK ====================
async function checkPremiumStatus() {
  if (!state.session || !state.user) return;
  try {
    const res = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: `profiles?id=eq.${state.user.id}&select=is_premium,prompt_limit` });
    if (res?.data?.[0]) {
      state.isPremium = res.data[0].is_premium || false;
      state.promptLimit = res.data[0].prompt_limit || FREE_PROMPT_LIMIT;
      await saveData('isPremium', state.isPremium);
      await saveData('promptLimit', state.promptLimit);
    }
  } catch (e) { console.error('Premium check failed:', e); }
}

// ==================== SEARCH ====================
function initSearch() {
  const input = document.getElementById('search-input');
  let timeout;
  input.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        if (state.searchOriginalPrompts) {
          state.prompts = state.searchOriginalPrompts;
          state.searchOriginalPrompts = null;
        }
        renderPrompts();
        return;
      }
      if (!state.searchOriginalPrompts) {
        state.searchOriginalPrompts = [...state.prompts];
      }
      state.prompts = state.searchOriginalPrompts.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.toLowerCase().includes(q)) ||
        p.text.toLowerCase().includes(q)
      );
      renderPrompts();
      if (state.prompts.length === 0) {
        document.getElementById('prompts-list').innerHTML = `<div class="empty-state"><div class="empty-state-title">No prompts found</div><div class="empty-state-text">Try different keywords</div></div>`;
      }
    }, 200);
  });
}

// ==================== MODAL UTILS ====================
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('visible');
    setTimeout(() => modal.remove(), 250);
  }
}

// ==================== SUPABASE SYNC ====================
async function syncPromptToSupabase(prompt) {
  if (!state.session || !state.user) return;
  try {
    await supabaseMsg({
      action: 'supabaseRequest', method: 'POST',
      path: 'prompts',
      body: {
        id: prompt.id, user_id: state.user.id, folder_id: prompt.folderId || null,
        title: prompt.title, text: prompt.text, description: prompt.description,
        platform: prompt.platform || 'universal', tags: prompt.tags || [],
        variables: prompt.variables || [], is_favorite: prompt.isFavorite || false,
        use_count: prompt.useCount || 0, updated_at: new Date().toISOString()
      }
    });
  } catch (e) { console.error('Sync prompt failed:', e); }
}

async function syncPromptDeleteToSupabase(id) {
  if (!state.session || !state.user) return;
  try {
    await supabaseMsg({ action: 'supabaseRequest', method: 'DELETE', path: `prompts?id=eq.${id}` });
  } catch (e) { console.error('Delete sync failed:', e); }
}

async function syncFolderToSupabase(folder) {
  if (!state.session || !state.user) return;
  try {
    await supabaseMsg({
      action: 'supabaseRequest', method: 'POST',
      path: 'folders',
      body: { id: folder.id, user_id: state.user.id, name: folder.name, updated_at: new Date().toISOString() }
    });
  } catch (e) { console.error('Sync folder failed:', e); }
}

async function syncFolderDeleteToSupabase(id) {
  if (!state.session || !state.user) return;
  try {
    await supabaseMsg({ action: 'supabaseRequest', method: 'DELETE', path: `folders?id=eq.${id}` });
  } catch (e) { console.error('Delete folder sync failed:', e); }
}

async function syncAllData() {
  if (!state.session || !state.user) return;
  try {
    const fRes = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: 'folders?order=created_at.asc' });
    if (fRes?.data?.length) {
      state.folders = fRes.data.map(f => ({ id: f.id, name: f.name, createdAt: new Date(f.created_at).getTime(), updatedAt: new Date(f.updated_at).getTime() }));
      await saveData('folders', state.folders);
    }
    const pRes = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: 'prompts?order=created_at.desc' });
    if (pRes?.data?.length) {
      state.prompts = pRes.data.map(p => ({ id: p.id, title: p.title, text: p.text, description: p.description, folderId: p.folder_id, platform: p.platform, tags: p.tags || [], variables: p.variables || [], isFavorite: p.is_favorite, useCount: p.use_count || 0, createdAt: new Date(p.created_at).getTime(), updatedAt: new Date(p.updated_at).getTime() }));
      await saveData('prompts', state.prompts);
    }
    renderPrompts();
    renderFolders();
    renderFavorites();
  } catch (e) { console.error('Sync all failed:', e); }
}

// ==================== INIT ====================
async function init() {
  await loadData();
  applyTheme(state.settings.theme);

  const welcomeScreen = document.getElementById('welcome-screen');
  const mainApp = document.getElementById('main-app');

  if (state.isFirstLaunch) {
    welcomeScreen.style.display = 'flex';
    mainApp.style.display = 'none';
    document.getElementById('get-started-btn').addEventListener('click', () => {
      welcomeScreen.style.display = 'none';
      mainApp.style.display = 'flex';
      state.isFirstLaunch = false;
    });
  } else {
    welcomeScreen.style.display = 'none';
    mainApp.style.display = 'flex';
  }

  initTabs();
  renderPrompts();
  renderFolders();
  renderFavorites();
  renderExplore();
  initSearch();

  // Button handlers
  document.getElementById('new-prompt-btn').addEventListener('click', () => openPromptEditor());
  document.getElementById('new-folder-btn').addEventListener('click', () => openFolderEditor());
  document.getElementById('settings-btn').addEventListener('click', openSettings);

  // Storage change listener
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.prompts) { state.prompts = changes.prompts.newValue || []; renderPrompts(); renderFavorites(); }
    if (changes.folders) { state.folders = changes.folders.newValue || []; renderFolders(); renderPrompts(); }
    if (changes.user) { state.user = changes.user.newValue; renderExplore(); }
    if (changes.session) { state.session = changes.session.newValue; }
    if (changes.isPremium) { state.isPremium = changes.isPremium.newValue; }
    if (changes.promptLimit) { state.promptLimit = changes.promptLimit.newValue; }
  });

  // Theme listener
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.settings.theme === 'system') applyTheme('system');
  });

  // Load library and check premium if logged in
  if (state.session) {
    loadLibraryPrompts();
    checkPremiumStatus();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
