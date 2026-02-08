// Import components
import { initTabs } from './components/tabs.js';
import { initPrompts } from './components/prompts.js';
import { initFolders } from './components/folders.js';
import { initFavorites } from './components/favorites.js';
import { initExplore } from './components/explore.js';
import { initSettings } from './components/settings.js';
import { initPromptEditor } from './components/prompt-editor.js';
import { initSearch } from './components/search.js';
import { initAuth } from './components/auth.js';

// Global state
window.appState = {
  prompts: [],
  folders: [],
  settings: {
    theme: 'system',
    hotkeys: {},
    defaultFolder: null
  },
  user: null,
  isFirstLaunch: false
};

// Toast notification
export function showToast(message, type = 'default') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast visible';
  
  if (type === 'success') {
    toast.classList.add('success');
  } else if (type === 'error') {
    toast.classList.add('error');
  }
  
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => {
      toast.className = 'toast';
    }, 250);
  }, 3000);
}

// Load data from storage
async function loadData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['prompts', 'folders', 'settings', 'user', 'hasLaunched'], (result) => {
      if (result.prompts) window.appState.prompts = result.prompts;
      if (result.folders) window.appState.folders = result.folders;
      if (result.settings) window.appState.settings = { ...window.appState.settings, ...result.settings };
      if (result.user) window.appState.user = result.user;
      
      // Check if first launch
      if (!result.hasLaunched) {
        window.appState.isFirstLaunch = true;
        chrome.storage.local.set({ hasLaunched: true });
      }
      
      resolve();
    });
  });
}

// Save data to storage
export function saveData(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve();
    });
  });
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

// Initialize app
async function init() {
  // Load data
  await loadData();
  
  // Apply theme
  applyTheme(window.appState.settings.theme);
  
  // Show welcome screen or main app
  const welcomeScreen = document.getElementById('welcome-screen');
  const mainApp = document.getElementById('main-app');
  
  if (window.appState.isFirstLaunch) {
    welcomeScreen.style.display = 'flex';
    mainApp.style.display = 'none';
    
    // Get started button
    document.getElementById('get-started-btn').addEventListener('click', () => {
      welcomeScreen.style.display = 'none';
      mainApp.style.display = 'flex';
      window.appState.isFirstLaunch = false;
    });
  } else {
    welcomeScreen.style.display = 'none';
    mainApp.style.display = 'flex';
  }
  
  // Initialize components
  initTabs();
  initPrompts();
  initFolders();
  initFavorites();
  initExplore();
  initSettings();
  initPromptEditor();
  initSearch();
  initAuth();
  
  // Listen for theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (window.appState.settings.theme === 'system') {
      applyTheme('system');
    }
  });
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
