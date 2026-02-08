// Settings functionality
import { showToast, saveData } from '../popup.js';
import { renderExplore } from './explore.js';

export function initSettings() {
  document.getElementById('settings-btn').addEventListener('click', openSettings);
}

function openSettings() {
  const settings = window.appState.settings;
  const user = window.appState.user;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">Settings</h2>
        <button class="btn btn-icon btn-ghost" onclick="this.closest('.modal-overlay').remove()">
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
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg-secondary); border-radius: var(--radius-md);">
              <div>
                <div style="font-weight: 500;">${escapeHtml(user.email || 'Signed In')}</div>
                <div style="font-size: var(--font-size-xs); color: var(--text-tertiary); margin-top: 2px;">Premium Account</div>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="signOut()">Sign Out</button>
            </div>
          ` : `
            <button class="btn btn-primary" onclick="signIn()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
              </svg>
              Sign in with Google
            </button>
            <span class="form-hint">Sign in to sync your prompts and access public library</span>
          `}
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
            <button class="btn btn-secondary" onclick="exportData()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Export All Data (JSON)
            </button>
            <button class="btn btn-secondary" onclick="importData()">
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
            <a href="#" style="color: var(--accent);">View on GitHub</a> •
            <a href="#" style="color: var(--accent);">Report Issue</a>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="saveSettings()">Done</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);
}

window.signIn = async function() {
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
    
    // Close and reopen settings
    document.querySelector('.modal-overlay').remove();
    setTimeout(() => {
      openSettings();
      renderExplore();
    }, 300);
  } catch (err) {
    showToast('Sign in failed', 'error');
  }
};

window.signOut = async function() {
  if (!confirm('Are you sure you want to sign out?')) {
    return;
  }
  
  window.appState.user = null;
  await saveData('user', null);
  
  showToast('Signed out', 'success');
  
  // Close and reopen settings
  document.querySelector('.modal-overlay').remove();
  setTimeout(() => {
    openSettings();
    renderExplore();
  }, 300);
};

window.saveSettings = async function() {
  const theme = document.getElementById('theme-select').value;
  
  window.appState.settings.theme = theme;
  await saveData('settings', window.appState.settings);
  
  // Apply theme
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  
  showToast('Settings saved', 'success');
  
  const modal = document.querySelector('.modal-overlay');
  modal.classList.remove('visible');
  setTimeout(() => modal.remove(), 250);
};

window.exportData = async function() {
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
  a.download = `promptvault-backup-${Date.now()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showToast('Data exported', 'success');
};

window.importData = function() {
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
