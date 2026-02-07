/**
 * PromptVault — Popup Main Script
 * Handles all UI interactions in the extension popup
 */

const { PromptStore, FolderStore, SettingsStore, HotkeyStore, StatsStore, VariableUtils, ExportImport } = window.PromptVault;

// ============ STATE ============
let currentTab = 'prompts';
let currentFolderId = null;
let editingPromptId = null;
let editingFolderId = null;
let allPrompts = [];
let allFolders = [];
let currentSort = 'date';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();
  await loadData();
  bindEvents();
  renderCurrentTab();
});

// ============ THEME ============
async function loadTheme() {
  const settings = await SettingsStore.get();
  let theme = settings.theme;
  if (theme === 'auto') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
}

// ============ DATA ============
async function loadData() {
  allPrompts = await PromptStore.getAll();
  allFolders = await FolderStore.getAll();
  const settings = await SettingsStore.get();
  currentSort = settings.defaultSort || 'date';
  $('#sort-select').value = currentSort;
}

// ============ EVENTS ============
function bindEvents() {
  // Tabs
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Search
  $('#search-input').addEventListener('input', debounce(handleSearch, 200));

  // Sort
  $('#sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderCurrentTab();
  });

  // FAB
  $('#fab-create').addEventListener('click', handleFabClick);

  // Settings
  $('#btn-settings').addEventListener('click', () => {
    if (chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });

  // Stats
  $('#btn-stats').addEventListener('click', showStats);

  // Prompt modal
  $('#modal-close').addEventListener('click', closePromptModal);
  $('#modal-cancel').addEventListener('click', closePromptModal);
  $('#modal-save').addEventListener('click', savePrompt);
  $('#modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePromptModal();
  });

  // Folder modal
  $('#folder-modal-close').addEventListener('click', closeFolderModal);
  $('#folder-modal-cancel').addEventListener('click', closeFolderModal);
  $('#folder-modal-save').addEventListener('click', saveFolder);
  $('#folder-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeFolderModal();
  });

  // Variable modal
  $('#variable-modal-close').addEventListener('click', closeVariableModal);
  $('#variable-modal-cancel').addEventListener('click', closeVariableModal);
  $('#variable-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeVariableModal();
  });

  // Icon picker
  $$('#folder-icon-picker .icon-option').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#folder-icon-picker .icon-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Color picker
  $$('#folder-color-picker .color-option').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#folder-color-picker .color-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Panel close
  $$('.panel-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const panelId = btn.dataset.close;
      if (panelId) $(`#${panelId}`).classList.add('hidden');
    });
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePromptModal();
      closeFolderModal();
      closeVariableModal();
      $$('.panel').forEach(p => p.classList.add('hidden'));
    }
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      openCreatePromptModal();
    }
  });
}

// ============ TABS ============
function switchTab(tab) {
  currentTab = tab;
  currentFolderId = null;
  $$('.tab').forEach(t => t.classList.remove('active'));
  $(`.tab[data-tab="${tab}"]`).classList.add('active');
  $$('.tab-content').forEach(c => c.classList.remove('active'));
  $(`#tab-${tab}`).classList.add('active');
  renderCurrentTab();
}

// ============ RENDERING ============
function renderCurrentTab() {
  switch (currentTab) {
    case 'prompts': renderPrompts(); break;
    case 'folders': renderFolders(); break;
    case 'favorites': renderFavorites(); break;
    case 'library': renderLibrary(); break;
  }
}

async function renderPrompts(filter = null) {
  let prompts = filter ? filter : allPrompts;
  if (currentFolderId) {
    prompts = prompts.filter(p => p.folderId === currentFolderId);
  }
  prompts = await PromptStore.sort(prompts, currentSort);

  const hotkeys = await HotkeyStore.getAll();
  const hotkeyMap = {};
  for (const [slot, pid] of Object.entries(hotkeys)) {
    hotkeyMap[pid] = slot.replace('hotkey-', 'Alt+');
  }

  const container = $('#prompts-list');
  const empty = $('#empty-state');

  if (prompts.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  let breadcrumbHtml = '';
  if (currentFolderId) {
    const folder = allFolders.find(f => f.id === currentFolderId);
    breadcrumbHtml = `
      <div class="breadcrumb">
        <button class="breadcrumb-item" onclick="exitFolder()">All Folders</button>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-item active">${folder ? folder.icon + ' ' + folder.name : 'Folder'}</span>
      </div>
    `;
  }

  container.innerHTML = breadcrumbHtml + prompts.map(p => `
    <div class="prompt-card" data-id="${p.id}" onclick="handlePromptClick('${p.id}')">
      <div class="prompt-card-header">
        <span class="prompt-card-title">${escHtml(p.title)}</span>
        <div class="prompt-card-actions">
          <button class="prompt-card-action ${p.isFavorite ? 'fav-active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${p.id}')" title="Favorite">
            ${p.isFavorite ? '★' : '☆'}
          </button>
          <button class="prompt-card-action" onclick="event.stopPropagation(); editPrompt('${p.id}')" title="Edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="prompt-card-action" onclick="event.stopPropagation(); copyPromptText('${p.id}')" title="Copy">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="prompt-card-action danger" onclick="event.stopPropagation(); deletePrompt('${p.id}')" title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <div class="prompt-card-preview">${highlightVars(escHtml(p.text))}</div>
      <div class="prompt-card-meta">
        ${(p.tags || []).slice(0, 3).map(t => `<span class="prompt-tag">${escHtml(t)}</span>`).join('')}
        ${hotkeyMap[p.id] ? `<span class="prompt-card-hotkey">${hotkeyMap[p.id]}</span>` : ''}
        <span class="prompt-card-date">${formatDate(p.createdAt)}</span>
      </div>
    </div>
  `).join('');
}

async function renderFolders() {
  const folders = allFolders.filter(f => !f.parentId);
  const emptyEl = $('#folders-empty');
  const container = $('#folders-list');

  if (folders.length === 0) {
    container.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  const folderHtml = folders.map(f => {
    const count = allPrompts.filter(p => p.folderId === f.id).length;
    const children = allFolders.filter(c => c.parentId === f.id);

    let childrenHtml = '';
    if (children.length > 0) {
      childrenHtml = children.map(c => {
        const cc = allPrompts.filter(p => p.folderId === c.id).length;
        return `
          <div class="folder-card" style="margin-left: 16px; border-left: 2px solid ${c.color}" onclick="openFolder('${c.id}')">
            <div class="folder-card-icon" style="background: ${c.color}18; color: ${c.color}">${c.icon}</div>
            <div class="folder-card-info">
              <div class="folder-card-name">${escHtml(c.name)}</div>
              <div class="folder-card-count">${cc} prompts</div>
            </div>
            <div class="folder-card-actions">
              <button class="prompt-card-action" onclick="event.stopPropagation(); editFolder('${c.id}')" title="Edit">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="prompt-card-action danger" onclick="event.stopPropagation(); deleteFolder('${c.id}')" title="Delete">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    return `
      <div class="folder-card" style="border-left: 3px solid ${f.color}" onclick="openFolder('${f.id}')">
        <div class="folder-card-icon" style="background: ${f.color}18; color: ${f.color}">${f.icon}</div>
        <div class="folder-card-info">
          <div class="folder-card-name">${escHtml(f.name)}</div>
          <div class="folder-card-count">${count} prompts${children.length > 0 ? ` · ${children.length} sub` : ''}</div>
        </div>
        <div class="folder-card-actions">
          <button class="prompt-card-action" onclick="event.stopPropagation(); editFolder('${f.id}')" title="Edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="prompt-card-action danger" onclick="event.stopPropagation(); deleteFolder('${f.id}')" title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      ${childrenHtml}
    `;
  });

  container.innerHTML = folderHtml.join('');
}

async function renderFavorites() {
  const favorites = allPrompts.filter(p => p.isFavorite);
  const sorted = await PromptStore.sort(favorites, currentSort);
  const emptyEl = $('#favorites-empty');
  const container = $('#favorites-list');

  if (sorted.length === 0) {
    container.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  container.innerHTML = sorted.map(p => `
    <div class="prompt-card" data-id="${p.id}" onclick="handlePromptClick('${p.id}')">
      <div class="prompt-card-header">
        <span class="prompt-card-title">${escHtml(p.title)}</span>
        <div class="prompt-card-actions" style="opacity:1">
          <button class="prompt-card-action fav-active" onclick="event.stopPropagation(); toggleFavorite('${p.id}')">★</button>
          <button class="prompt-card-action" onclick="event.stopPropagation(); copyPromptText('${p.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>
      </div>
      <div class="prompt-card-preview">${highlightVars(escHtml(p.text))}</div>
      <div class="prompt-card-meta">
        ${(p.tags || []).slice(0, 3).map(t => `<span class="prompt-tag">${escHtml(t)}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

function renderLibrary() {
  const sampleLibrary = [
    { id: 'lib1', title: 'Summarize Article', category: 'Productivity', prompt: 'Summarize the following article in 3 concise bullet points. Focus on the key takeaways and main arguments:\n\n{article_text}', likes: 142, icon: '📝', gradient: 'linear-gradient(135deg, #7c3aed, #6366f1)' },
    { id: 'lib2', title: 'Code Review', category: 'Development', prompt: 'Review the following code for:\n1. Bugs and potential issues\n2. Performance improvements\n3. Best practices\n4. Security vulnerabilities\n\nCode:\n{code}', likes: 89, icon: '💻', gradient: 'linear-gradient(135deg, #22c55e, #06b6d4)' },
    { id: 'lib3', title: 'Email Writer', category: 'Communication', prompt: 'Write a {tone} email about {topic} to {recipient}. Keep it {length}. Include a clear call to action.', likes: 234, icon: '📧', gradient: 'linear-gradient(135deg, #ec4899, #f97316)' },
    { id: 'lib4', title: 'Blog Outline', category: 'Content', prompt: 'Create a detailed blog post outline about {topic}. Include:\n- 3 catchy title options\n- Introduction hook\n- 5 main sections with sub-points\n- Conclusion with CTA\n- SEO keywords', likes: 176, icon: '📰', gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
    { id: 'lib5', title: 'Midjourney v6', category: 'AI Art', prompt: '{subject}, {style} style, {lighting} lighting, {camera} shot, highly detailed, 8k, cinematic --ar {aspect_ratio} --v 6', likes: 312, icon: '🎨', gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
    { id: 'lib6', title: 'Debug Helper', category: 'Development', prompt: 'I\'m getting this error:\n\n{error_message}\n\nIn this code:\n{code_snippet}\n\nPlease:\n1. Explain the cause\n2. Provide a fix\n3. Explain why it works', likes: 198, icon: '🐛', gradient: 'linear-gradient(135deg, #ef4444, #f97316)' },
    { id: 'lib7', title: 'Video Script', category: 'Content', prompt: 'Write a {duration}-minute video script about {topic}.\n\nStructure:\n- Hook (5 sec)\n- Problem\n- Solution\n- Key takeaways\n- CTA\n\nTone: {tone}\nAudience: {audience}', likes: 87, icon: '🎬', gradient: 'linear-gradient(135deg, #06b6d4, #7c3aed)' },
    { id: 'lib8', title: 'Translate & Localize', category: 'Language', prompt: 'Translate to {language}. Don\'t translate literally — localize it:\n- Adapt idioms\n- Keep {tone} tone\n- Maintain formatting\n\nText:\n{text}', likes: 95, icon: '🌍', gradient: 'linear-gradient(135deg, #22c55e, #eab308)' }
  ];

  const container = $('#library-grid');
  container.innerHTML = sampleLibrary.map(item => `
    <div class="library-card" onclick="flipCard(this)">
      <div class="library-card-inner">
        <div class="library-card-front">
          <div class="library-card-thumb" style="background: ${item.gradient}">
            <span>${item.icon}</span>
            <button class="library-card-copy-btn" onclick="event.stopPropagation(); copyToClipboard(\`${escAttr(item.prompt)}\`)">Copy</button>
          </div>
          <div class="library-card-info">
            <div class="library-card-title">${escHtml(item.title)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="library-card-category">${item.category}</span>
              <span class="library-card-likes">♥ ${item.likes}</span>
            </div>
          </div>
        </div>
        <div class="library-card-back">
          <div class="library-card-back-title">${escHtml(item.title)}</div>
          <div class="library-card-back-text">${highlightVars(escHtml(item.prompt))}</div>
          <div class="library-card-back-actions">
            <button onclick="event.stopPropagation(); copyToClipboard(\`${escAttr(item.prompt)}\`)">Copy</button>
            <button onclick="event.stopPropagation(); saveFromLibrary(\`${escAttr(item.title)}\`, \`${escAttr(item.prompt)}\`, '${item.category}')">Save</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// ============ PROMPT ACTIONS ============

function handlePromptClick(id) {
  const prompt = allPrompts.find(p => p.id === id);
  if (!prompt) return;
  if (VariableUtils.hasVariables(prompt.text)) {
    openVariableModal(prompt);
  } else {
    insertPrompt(prompt.text, id);
  }
}

async function insertPrompt(text, promptId) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'INSERT_PROMPT', text }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        copyToClipboard(text);
      } else {
        showToast('Prompt inserted!', 'success');
      }
    });
  } catch {
    copyToClipboard(text);
  }
  if (promptId) {
    await PromptStore.recordUsage(promptId);
    await loadData();
  }
}

async function copyPromptText(id) {
  const prompt = allPrompts.find(p => p.id === id);
  if (prompt) {
    copyToClipboard(prompt.text);
    await PromptStore.recordUsage(id);
    await loadData();
  }
}

async function toggleFavorite(id) {
  await PromptStore.toggleFavorite(id);
  await loadData();
  renderCurrentTab();
}

async function deletePrompt(id) {
  if (confirm('Delete this prompt?')) {
    await PromptStore.delete(id);
    await loadData();
    renderCurrentTab();
    showToast('Prompt deleted', 'danger');
  }
}

function editPrompt(id) {
  const prompt = allPrompts.find(p => p.id === id);
  if (prompt) openCreatePromptModal(prompt);
}

// ============ FOLDER ACTIONS ============

function openFolder(folderId) {
  currentFolderId = folderId;
  switchTab('prompts');
  renderPrompts();
}

window.exitFolder = function() {
  currentFolderId = null;
  switchTab('folders');
};

async function deleteFolder(id) {
  if (confirm('Delete this folder? Prompts will move to root.')) {
    await FolderStore.delete(id);
    await loadData();
    renderCurrentTab();
    showToast('Folder deleted', 'danger');
  }
}

function editFolder(id) {
  const folder = allFolders.find(f => f.id === id);
  if (folder) openCreateFolderModal(folder);
}

// ============ PROMPT MODAL ============

function openCreatePromptModal(existing = null) {
  editingPromptId = existing ? existing.id : null;
  $('#modal-title').textContent = existing ? 'Edit Prompt' : 'New Prompt';
  $('#modal-save').textContent = existing ? 'Update' : 'Save Prompt';
  $('#prompt-name').value = existing ? existing.title : '';
  $('#prompt-text').value = existing ? existing.text : '';
  $('#prompt-tags').value = existing ? (existing.tags || []).join(', ') : '';

  const folderSelect = $('#prompt-folder');
  folderSelect.innerHTML = '<option value="">No Folder</option>' +
    allFolders.map(f => `<option value="${f.id}" ${existing && existing.folderId === f.id ? 'selected' : ''}>${f.icon} ${escHtml(f.name)}</option>`).join('');

  $('#modal-overlay').classList.remove('hidden');
  setTimeout(() => $('#prompt-name').focus(), 100);
}

function closePromptModal() {
  $('#modal-overlay').classList.add('hidden');
  editingPromptId = null;
}

async function savePrompt() {
  const title = $('#prompt-name').value.trim();
  const text = $('#prompt-text').value.trim();
  const folderId = $('#prompt-folder').value || null;
  const tags = $('#prompt-tags').value.split(',').map(t => t.trim()).filter(Boolean);

  if (!title || !text) {
    showToast('Title and text are required', 'warning');
    return;
  }

  if (editingPromptId) {
    await PromptStore.update(editingPromptId, { title, text, folderId, tags });
    showToast('Prompt updated!', 'success');
  } else {
    await PromptStore.create({ title, text, folderId, tags });
    showToast('Prompt saved!', 'success');
  }

  closePromptModal();
  await loadData();
  renderCurrentTab();
}

// ============ FOLDER MODAL ============

function openCreateFolderModal(existing = null) {
  editingFolderId = existing ? existing.id : null;
  $('#folder-modal-title').textContent = existing ? 'Edit Folder' : 'New Folder';
  $('#folder-modal-save').textContent = existing ? 'Update' : 'Create Folder';
  $('#folder-name').value = existing ? existing.name : '';

  $$('#folder-icon-picker .icon-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.icon === (existing ? existing.icon : '📁'));
  });
  $$('#folder-color-picker .color-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === (existing ? existing.color : '#7c3aed'));
  });

  const parentSelect = $('#folder-parent');
  const filteredFolders = allFolders.filter(f => f.id !== editingFolderId);
  parentSelect.innerHTML = '<option value="">Root</option>' +
    filteredFolders.map(f => `<option value="${f.id}" ${existing && existing.parentId === f.id ? 'selected' : ''}>${f.icon} ${escHtml(f.name)}</option>`).join('');

  $('#folder-modal-overlay').classList.remove('hidden');
  setTimeout(() => $('#folder-name').focus(), 100);
}

function closeFolderModal() {
  $('#folder-modal-overlay').classList.add('hidden');
  editingFolderId = null;
}

async function saveFolder() {
  const name = $('#folder-name').value.trim();
  const icon = $('#folder-icon-picker .icon-option.active')?.dataset.icon || '📁';
  const color = $('#folder-color-picker .color-option.active')?.dataset.color || '#7c3aed';
  const parentId = $('#folder-parent').value || null;

  if (!name) {
    showToast('Folder name is required', 'warning');
    return;
  }

  if (editingFolderId) {
    await FolderStore.update(editingFolderId, { name, icon, color, parentId });
    showToast('Folder updated!', 'success');
  } else {
    await FolderStore.create({ name, icon, color, parentId });
    showToast('Folder created!', 'success');
  }

  closeFolderModal();
  await loadData();
  renderCurrentTab();
}

// ============ VARIABLE MODAL ============

let pendingVariablePrompt = null;

function openVariableModal(prompt) {
  pendingVariablePrompt = prompt;
  const variables = VariableUtils.extract(prompt.text);

  const container = $('#variable-fields');
  container.innerHTML = variables.map(v => `
    <div class="form-group">
      <label for="var-${v}">${v}</label>
      <input type="text" id="var-${v}" data-var="${v}" placeholder="Enter ${v}..." autocomplete="off">
    </div>
  `).join('');

  $('#variable-modal-overlay').classList.remove('hidden');

  $('#variable-modal-insert').onclick = () => {
    const values = {};
    container.querySelectorAll('input').forEach(input => {
      values[input.dataset.var] = input.value || input.dataset.var;
    });
    const finalText = VariableUtils.replace(prompt.text, values);
    closeVariableModal();
    insertPrompt(finalText, prompt.id);
  };

  setTimeout(() => {
    const first = container.querySelector('input');
    if (first) first.focus();
  }, 100);
}

function closeVariableModal() {
  $('#variable-modal-overlay').classList.add('hidden');
  pendingVariablePrompt = null;
}

// ============ FAB ============

function handleFabClick() {
  if (currentTab === 'folders') {
    openCreateFolderModal();
  } else {
    openCreatePromptModal();
  }
}

// ============ SEARCH ============

async function handleSearch() {
  const query = $('#search-input').value.trim();
  if (!query) {
    await loadData();
    renderCurrentTab();
    return;
  }
  const results = await PromptStore.search(query);
  renderPrompts(results);
}

// ============ STATS ============

async function showStats() {
  const stats = await StatsStore.get();
  const mostUsed = await StatsStore.getMostUsed(5);
  const promptCount = allPrompts.length;
  const folderCount = allFolders.length;

  const weekDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en', { weekday: 'short' });
    weekDays.push({ key, label, count: stats.weeklyData[key] || 0 });
  }
  const maxCount = Math.max(...weekDays.map(d => d.count), 1);

  $('#stats-body').innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${promptCount}</div><div class="stat-label">Total Prompts</div></div>
      <div class="stat-card"><div class="stat-value">${folderCount}</div><div class="stat-label">Folders</div></div>
      <div class="stat-card"><div class="stat-value">${stats.todayInsertions || 0}</div><div class="stat-label">Used Today</div></div>
      <div class="stat-card"><div class="stat-value">${stats.totalInsertions || 0}</div><div class="stat-label">Total Uses</div></div>
    </div>
    <div class="stat-section-title">This Week</div>
    <div class="stat-bar-chart">
      ${weekDays.map(d => `
        <div class="stat-bar" style="height: ${Math.max(8, (d.count / maxCount) * 100)}%" title="${d.label}: ${d.count}">
          <span class="stat-bar-label">${d.label}</span>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:20px">
      <div class="stat-section-title">Most Used</div>
      ${mostUsed.length === 0 ? '<p style="color:var(--text-3);font-size:11px">No usage data yet</p>' :
        mostUsed.map((p, i) => `
          <div class="most-used-item">
            <div class="most-used-rank">${i + 1}</div>
            <div class="most-used-title">${escHtml(p.title)}</div>
            <div class="most-used-count">${p.usageCount}x</div>
          </div>
        `).join('')}
    </div>
  `;

  $('#stats-panel').classList.remove('hidden');
}

// ============ LIBRARY ============

function flipCard(el) { el.classList.toggle('flipped'); }

async function saveFromLibrary(title, prompt, category) {
  await PromptStore.create({ title, text: prompt, tags: [category.toLowerCase()] });
  await loadData();
  showToast('Saved to your library!', 'success');
}

// ============ CLIPBOARD ============

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    showToast('Copied to clipboard!', 'success');
  }
}

// ============ TOAST ============

function showToast(msg, type = 'info') {
  const toast = $('#toast');
  const icons = { success: '✓', danger: '✕', warning: '!', info: 'i' };
  const colors = { success: '#22c55e', danger: '#ef4444', warning: '#f59e0b', info: '#6366f1' };
  
  $('#toast-icon').textContent = icons[type] || icons.info;
  $('#toast-icon').style.cssText = `
    display:inline-flex;align-items:center;justify-content:center;
    width:18px;height:18px;border-radius:50%;font-size:10px;font-weight:800;
    background:${colors[type] || colors.info};color:#fff;flex-shrink:0;
  `;
  $('#toast-msg').textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('show');

  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2000);
}

// ============ UTILITY ============

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escAttr(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function highlightVars(text) {
  return text.replace(/\{(\w+)\}/g, '<span class="var-highlight">{$1}</span>');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd';
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// Expose to global
window.handlePromptClick = handlePromptClick;
window.toggleFavorite = toggleFavorite;
window.editPrompt = editPrompt;
window.copyPromptText = copyPromptText;
window.deletePrompt = deletePrompt;
window.openFolder = openFolder;
window.editFolder = editFolder;
window.deleteFolder = deleteFolder;
window.flipCard = flipCard;
window.saveFromLibrary = saveFromLibrary;
window.copyToClipboard = copyToClipboard;
