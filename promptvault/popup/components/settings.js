// Settings functionality with hotkeys
import { showToast, saveData } from '../popup.js';
import { renderExplore } from './explore.js';

// Default hotkey slots
const DEFAULT_HOTKEYS = {
  slot1: { key: 'Ctrl+Shift+1', promptId: null },
  slot2: { key: 'Ctrl+Shift+2', promptId: null },
  slot3: { key: 'Ctrl+Shift+3', promptId: null },
  slot4: { key: 'Ctrl+Shift+4', promptId: null }
};

let recordingSlot = null;

export function initSettings() {
  // Initialize default hotkeys if not set
  if (!window.appState.settings.hotkeys || Object.keys(window.appState.settings.hotkeys).length === 0) {
    window.appState.settings.hotkeys = { ...DEFAULT_HOTKEYS };
  }
  
  document.getElementById('settings-btn').addEventListener('click', openSettings);
}

function openSettings() {
  const settings = window.appState.settings;
  const user = window.appState.user;
  const hotkeys = settings.hotkeys || DEFAULT_HOTKEYS;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'settings-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 500px;">
      <div class="modal-header">
        <h2 class="modal-title">Settings</h2>
        <button class="btn btn-icon btn-ghost close-modal-btn" onclick="closeSettingsModal()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <!-- Account Section -->
        <div class="form-group">
          <label class="form-label">Account</label>
          ${user ? `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--border);">
              <div>
                <div style="font-weight: 500;">${escapeHtml(user.email || 'Signed In')}</div>
                <div style="font-size: var(--font-size-xs); color: var(--text-tertiary); margin-top: 2px;">Premium Account</div>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="signOutUser()">Sign Out</button>
            </div>
          ` : `
            <button class="btn btn-primary" onclick="signInUser()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
              </svg>
              Sign in with Google
            </button>
            <span class="form-hint">Sign in to sync your prompts and access public library</span>
          `}
        </div>
        
        <div class="divider"></div>
        
        <!-- Hotkeys Section -->
        <div class="form-group">
          <label class="form-label">Quick Insert Hotkeys</label>
          <span class="form-hint" style="margin-bottom: 12px; display: block;">
            Assign up to 4 prompts for quick insertion with keyboard shortcuts
          </span>
          <div class="hotkey-section">
            ${renderHotkeySlot('slot1', hotkeys.slot1, 1)}
            ${renderHotkeySlot('slot2', hotkeys.slot2, 2)}
            ${renderHotkeySlot('slot3', hotkeys.slot3, 3)}
            ${renderHotkeySlot('slot4', hotkeys.slot4, 4)}
          </div>
        </div>
        
        <div class="divider"></div>
        
        <!-- Theme Section -->
        <div class="form-group">
          <label class="form-label">Theme</label>
          <select id="theme-select">
            <option value="system" ${settings.theme === 'system' ? 'selected' : ''}>System</option>
            <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
          </select>
        </div>
        
        <div class="divider"></div>
        
        <!-- Data Section -->
        <div class="form-group">
          <label class="form-label">Data Management</label>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-secondary" onclick="exportAllData()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Export All Data (JSON)
            </button>
            <button class="btn btn-secondary" onclick="importAllData()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
              Import Data (JSON)
            </button>
          </div>
        </div>
        
        <div class="divider"></div>
        
        <!-- About Section -->
        <div class="form-group">
          <label class="form-label">About</label>
          <div style="font-size: var(--font-size-sm); color: var(--text-secondary); line-height: 1.6;">
            <strong>PromptVault</strong> v1.0.0<br>
            AI Prompt Manager for power users<br>
            <br>
            <a href="https://github.com/Leks2000/PromptVault" target="_blank" style="color: var(--accent);">View on GitHub</a> •
            <a href="https://github.com/Leks2000/PromptVault/issues" target="_blank" style="color: var(--accent);">Report Issue</a>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeSettingsModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveAllSettings()">Save Settings</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);
  
  // Setup hotkey recording listeners
  setupHotkeyListeners();
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeSettingsModal();
    }
  });
}

function renderHotkeySlot(slotId, slotData, number) {
  const prompts = window.appState.prompts;
  const selectedPrompt = slotData?.promptId ? prompts.find(p => p.id === slotData.promptId) : null;
  
  return `
    <div class="hotkey-item" data-slot="${slotId}">
      <div class="hotkey-info">
        <div class="hotkey-name">Slot ${number}</div>
        <div class="hotkey-description">
          ${selectedPrompt ? escapeHtml(selectedPrompt.title) : 'No prompt assigned'}
        </div>
      </div>
      <div class="hotkey-key">
        <select class="hotkey-prompt-select" id="${slotId}-prompt" onchange="updateHotkeyPrompt('${slotId}', this.value)">
          <option value="">Select prompt...</option>
          ${prompts.map(p => `
            <option value="${p.id}" ${slotData?.promptId === p.id ? 'selected' : ''}>
              ${escapeHtml(p.title.substring(0, 20))}${p.title.length > 20 ? '...' : ''}
            </option>
          `).join('')}
        </select>
        <div class="hotkey-badge ${recordingSlot === slotId ? 'recording' : ''}" 
             id="${slotId}-key"
             onclick="startRecordingHotkey('${slotId}')"
             title="Click to change">
          ${slotData?.key || `Ctrl+${number}`}
        </div>
      </div>
    </div>
  `;
}

function setupHotkeyListeners() {
  document.addEventListener('keydown', handleHotkeyRecording);
}

function handleHotkeyRecording(e) {
  if (!recordingSlot) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  const key = [];
  if (e.ctrlKey || e.metaKey) key.push('Ctrl');
  if (e.shiftKey) key.push('Shift');
  if (e.altKey) key.push('Alt');
  
  // Add the actual key
  if (e.key && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    key.push(e.key.toUpperCase());
  }
  
  if (key.length >= 2) {
    const keyCombo = key.join('+');
    const keyBadge = document.getElementById(`${recordingSlot}-key`);
    
    if (keyBadge) {
      keyBadge.textContent = keyCombo;
      keyBadge.classList.remove('recording');
    }
    
    // Update settings
    if (!window.appState.settings.hotkeys) {
      window.appState.settings.hotkeys = { ...DEFAULT_HOTKEYS };
    }
    if (!window.appState.settings.hotkeys[recordingSlot]) {
      window.appState.settings.hotkeys[recordingSlot] = {};
    }
    window.appState.settings.hotkeys[recordingSlot].key = keyCombo;
    
    recordingSlot = null;
  }
}

window.startRecordingHotkey = function(slotId) {
  // Stop any previous recording
  if (recordingSlot) {
    const prevBadge = document.getElementById(`${recordingSlot}-key`);
    if (prevBadge) prevBadge.classList.remove('recording');
  }
  
  recordingSlot = slotId;
  const badge = document.getElementById(`${slotId}-key`);
  if (badge) {
    badge.classList.add('recording');
    badge.textContent = 'Press keys...';
  }
};

window.updateHotkeyPrompt = function(slotId, promptId) {
  if (!window.appState.settings.hotkeys) {
    window.appState.settings.hotkeys = { ...DEFAULT_HOTKEYS };
  }
  if (!window.appState.settings.hotkeys[slotId]) {
    window.appState.settings.hotkeys[slotId] = { key: `Ctrl+Shift+${slotId.slice(-1)}` };
  }
  window.appState.settings.hotkeys[slotId].promptId = promptId || null;
  
  // Update description
  const item = document.querySelector(`[data-slot="${slotId}"]`);
  if (item) {
    const description = item.querySelector('.hotkey-description');
    if (description) {
      const prompt = window.appState.prompts.find(p => p.id === promptId);
      description.textContent = prompt ? prompt.title : 'No prompt assigned';
    }
  }
};

window.closeSettingsModal = function() {
  recordingSlot = null;
  document.removeEventListener('keydown', handleHotkeyRecording);
  
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.classList.remove('visible');
    setTimeout(() => modal.remove(), 250);
  }
};

window.saveAllSettings = async function() {
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    window.appState.settings.theme = themeSelect.value;
  }
  
  await saveData('settings', window.appState.settings);
  
  // Apply theme
  const theme = window.appState.settings.theme;
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  
  // Send hotkeys to background script
  chrome.runtime.sendMessage({
    action: 'updateHotkeys',
    hotkeys: window.appState.settings.hotkeys
  });
  
  showToast('Settings saved', 'success');
  closeSettingsModal();
};

window.signInUser = async function() {
  try {
    // Mock sign in - in production this would use chrome.identity API
    const mockUser = {
      id: 'user-' + Date.now(),
      email: 'user@example.com',
      name: 'Demo User'
    };
    
    window.appState.user = mockUser;
    await saveData('user', mockUser);
    
    showToast('Signed in successfully', 'success');
    
    closeSettingsModal();
    setTimeout(() => {
      openSettings();
      renderExplore();
    }, 300);
  } catch (err) {
    showToast('Sign in failed', 'error');
  }
};

window.signOutUser = async function() {
  if (!confirm('Are you sure you want to sign out?')) {
    return;
  }
  
  window.appState.user = null;
  await saveData('user', null);
  
  showToast('Signed out', 'success');
  
  closeSettingsModal();
  setTimeout(() => {
    openSettings();
    renderExplore();
  }, 300);
};

window.exportAllData = async function() {
  const data = {
    prompts: window.appState.prompts,
    folders: window.appState.folders,
    settings: window.appState.settings,
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
  showToast('Data exported', 'success');
};

window.importAllData = function() {
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
      
      window.appState.prompts = data.prompts;
      window.appState.folders = data.folders;
      if (data.settings) {
        window.appState.settings = { ...window.appState.settings, ...data.settings };
      }
      
      await saveData('prompts', window.appState.prompts);
      await saveData('folders', window.appState.folders);
      await saveData('settings', window.appState.settings);
      
      showToast('Data imported successfully', 'success');
      
      // Reload popup
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      showToast('Import failed: Invalid file', 'error');
    }
  });
  
  input.click();
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
