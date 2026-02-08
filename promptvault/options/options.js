// PromptVault Options page functionality

// ==================== LOAD SETTINGS ====================
function loadSettings() {
  chrome.storage.local.get(['settings', 'prompts', 'folders'], (result) => {
    const settings = result.settings || { theme: 'system' };
    const prompts = result.prompts || [];
    const folders = result.folders || [];

    document.getElementById('theme-select').value = settings.theme;
    applyTheme(settings.theme);

    // Stats
    document.getElementById('stat-prompts').textContent = prompts.length;
    document.getElementById('stat-folders').textContent = folders.length;
    document.getElementById('stat-uses').textContent = prompts.reduce((s, p) => s + (p.useCount || 0), 0);
    document.getElementById('stat-favorites').textContent = prompts.filter(p => p.isFavorite).length;

    // Load shortcuts display
    loadShortcuts();

    // Load hotkey assignments
    loadHotkeyAssignments(settings, prompts);
  });

  // Load version
  const manifest = chrome.runtime.getManifest();
  document.getElementById('version').textContent = manifest.version;
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

// ==================== SHORTCUTS DISPLAY ====================
function loadShortcuts() {
  const container = document.getElementById('shortcut-list');
  if (!container) return;

  const commandLabels = {
    'open-search': { name: 'Search Overlay', desc: 'Open prompt search on any page' },
    'hotkey-1': { name: 'Quick Insert 1', desc: 'Insert prompt from Slot 1' },
    'hotkey-2': { name: 'Quick Insert 2', desc: 'Insert prompt from Slot 2' },
    'hotkey-3': { name: 'Quick Insert 3', desc: 'Insert prompt from Slot 3' },
    'hotkey-4': { name: 'Quick Insert 4', desc: 'Insert prompt from Slot 4' }
  };

  if (chrome.commands && chrome.commands.getAll) {
    chrome.commands.getAll(commands => {
      let html = '';
      commands.forEach(cmd => {
        if (cmd.name === '_execute_action') return;
        const info = commandLabels[cmd.name];
        if (!info) return;
        const shortcut = cmd.shortcut || '';
        html += `
          <div class="shortcut-item">
            <div class="shortcut-label">
              <span class="shortcut-name">${escapeHtml(info.name)}</span>
              <span class="shortcut-desc">${escapeHtml(info.desc)}</span>
            </div>
            <span class="shortcut-key ${!shortcut ? 'not-set' : ''}">${shortcut || 'Not set'}</span>
          </div>`;
      });
      container.innerHTML = html || '<div style="color:var(--text-tertiary);font-size:var(--font-size-sm);">No shortcuts found</div>';
    });
  } else {
    container.innerHTML = '<div style="color:var(--text-tertiary);font-size:var(--font-size-sm);">Cannot read shortcuts. Use the button below to manage them.</div>';
  }
}

// ==================== HOTKEY ASSIGNMENTS ====================
function loadHotkeyAssignments(settings, prompts) {
  const container = document.getElementById('hotkey-assignment');
  if (!container) return;

  const hotkeys = settings.hotkeys || {};
  let html = '';

  for (let n = 1; n <= 4; n++) {
    const slotId = `slot${n}`;
    const slot = hotkeys[slotId] || {};
    const assigned = slot.promptId ? prompts.find(p => p.id === slot.promptId) : null;

    html += `
      <div class="hotkey-row">
        <div class="hotkey-row-left">
          <span class="hotkey-row-label">Slot ${n} (Alt+${n})</span>
          <span class="hotkey-row-assigned">${assigned ? escapeHtml(assigned.title) : 'No prompt assigned'}</span>
        </div>
        <select data-slot="${slotId}">
          <option value="">-- No prompt --</option>
          ${prompts.map(p => `<option value="${p.id}" ${slot.promptId === p.id ? 'selected' : ''}>${escapeHtml(p.title.substring(0, 40))}${p.title.length > 40 ? '...' : ''}</option>`).join('')}
        </select>
      </div>`;
  }

  container.innerHTML = html;
}

// ==================== SAVE SETTINGS ====================
function saveSettings() {
  const theme = document.getElementById('theme-select').value;

  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || {};
    settings.theme = theme;

    chrome.storage.local.set({ settings }, () => {
      applyTheme(theme);
      showSuccessMessage();
    });
  });
}

function saveHotkeyAssignments() {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || {};
    if (!settings.hotkeys) settings.hotkeys = {};

    document.querySelectorAll('#hotkey-assignment [data-slot]').forEach(sel => {
      const slotId = sel.dataset.slot;
      if (!settings.hotkeys[slotId]) settings.hotkeys[slotId] = {};
      settings.hotkeys[slotId].promptId = sel.value || null;
    });

    chrome.storage.local.set({ settings }, () => {
      showSuccessMessage();
      // Refresh the assignment display
      chrome.storage.local.get(['settings', 'prompts'], (res) => {
        loadHotkeyAssignments(res.settings || {}, res.prompts || []);
      });
    });
  });
}

// ==================== SUCCESS MESSAGE ====================
function showSuccessMessage() {
  const message = document.getElementById('success-message');
  message.classList.add('visible');
  setTimeout(() => { message.classList.remove('visible'); }, 3000);
}

// ==================== DATA EXPORT/IMPORT ====================
function exportData() {
  chrome.storage.local.get(['prompts', 'folders', 'settings'], (result) => {
    const data = {
      prompts: result.prompts || [],
      folders: result.folders || [],
      settings: result.settings || {},
      exportDate: new Date().toISOString()
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `promptvault-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showSuccessMessage();
  });
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.prompts || !data.folders) {
        throw new Error('Invalid backup file');
      }

      if (!confirm('This will replace all current data. Continue?')) {
        return;
      }

      chrome.storage.local.set({
        prompts: data.prompts,
        folders: data.folders,
        settings: data.settings || {}
      }, () => {
        showSuccessMessage();
        setTimeout(() => loadSettings(), 500);
      });
    } catch (err) {
      alert('Import failed: Invalid file format');
    }
  });

  input.click();
}

// ==================== HELPERS ====================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== EVENT LISTENERS ====================
document.getElementById('theme-select').addEventListener('change', saveSettings);
document.getElementById('export-btn').addEventListener('click', exportData);
document.getElementById('import-btn').addEventListener('click', importData);
document.getElementById('save-hotkeys-btn').addEventListener('click', saveHotkeyAssignments);

document.getElementById('open-shortcuts-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// Theme change listener
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings && result.settings.theme === 'system') {
      applyTheme('system');
    }
  });
});

// Initialize
loadSettings();
