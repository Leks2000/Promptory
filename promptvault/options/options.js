// Options page functionality

// Load settings
function loadSettings() {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || { theme: 'system' };
    
    document.getElementById('theme-select').value = settings.theme;
    applyTheme(settings.theme);
  });
  
  // Load version
  const manifest = chrome.runtime.getManifest();
  document.getElementById('version').textContent = manifest.version;
}

// Apply theme
function applyTheme(theme) {
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// Save settings
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

// Show success message
function showSuccessMessage() {
  const message = document.getElementById('success-message');
  message.classList.add('visible');
  
  setTimeout(() => {
    message.classList.remove('visible');
  }, 3000);
}

// Export data
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
    a.download = `promptvault-backup-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showSuccessMessage();
  });
}

// Import data
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

// Event listeners
document.getElementById('theme-select').addEventListener('change', saveSettings);
document.getElementById('export-btn').addEventListener('click', exportData);
document.getElementById('import-btn').addEventListener('click', importData);

// Listen for theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings && result.settings.theme === 'system') {
      applyTheme('system');
    }
  });
});

// Initialize
loadSettings();
