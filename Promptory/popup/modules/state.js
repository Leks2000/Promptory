// Promptory Popup - State Module
// Application state and data loading

window.Promptory = window.Promptory || {};

(function(P) {
'use strict';

const FREE_PROMPT_LIMIT = CONFIG.FREE_PROMPT_LIMIT;

// ==================== STATE ====================
P.state = {
  prompts: [],
  folders: [],
  settings: { theme: 'dark', hotkeys: { slot1: { promptId: null }, slot2: { promptId: null }, slot3: { promptId: null } }, defaultFolder: null },
  user: null,
  session: null,
  isFirstLaunch: false,
  libraryPrompts: [],
  libraryError: null,
  searchOriginalPrompts: null,
  userLikes: new Set(),
  userReports: new Set(),
  isPremium: false,
  promptLimit: FREE_PROMPT_LIMIT,
  isAdmin: false,
  pendingReports: [],
  // Library pagination state
  libraryPage: 0,
  libraryHasMore: true,
  libraryLoading: false
};

// ==================== DATA MIGRATIONS ====================
const DATA_VERSION = 2; // Increment when schema changes

async function migrateData(currentVersion) {
  if (currentVersion < 1) {
    // v0 -> v1: Ensure all prompts have required fields
    const { prompts } = await new Promise(r => chrome.storage.local.get(['prompts'], r));
    if (prompts && Array.isArray(prompts)) {
      let changed = false;
      prompts.forEach(p => {
        if (!p.imageUrl && p.imageUrl !== null) { p.imageUrl = null; changed = true; }
        if (!p.variables) { p.variables = []; changed = true; }
        if (!p.tags) { p.tags = []; changed = true; }
        if (p.useCount === undefined) { p.useCount = 0; changed = true; }
      });
      if (changed) await new Promise(r => chrome.storage.local.set({ prompts }, r));
    }
  }
  if (currentVersion < 2) {
    // v1 -> v2: Add platform field to old prompts, ensure createdAt/updatedAt
    const { prompts } = await new Promise(r => chrome.storage.local.get(['prompts'], r));
    if (prompts && Array.isArray(prompts)) {
      let changed = false;
      const now = Date.now();
      prompts.forEach(p => {
        if (!p.platform) { p.platform = 'universal'; changed = true; }
        if (!p.createdAt) { p.createdAt = now; changed = true; }
        if (!p.updatedAt) { p.updatedAt = now; changed = true; }
      });
      if (changed) await new Promise(r => chrome.storage.local.set({ prompts }, r));
    }
  }
  await new Promise(r => chrome.storage.local.set({ dataVersion: DATA_VERSION }, r));
  console.log(`\uD83D\uDCE6 Data migrated to version ${DATA_VERSION}`);
}

// ==================== DATA LOADING ====================
P.loadData = async function() {
  return new Promise(resolve => {
    chrome.storage.local.get(['prompts', 'folders', 'settings', 'user', 'session', 'hasLaunched', 'isPremium', 'promptLimit', 'language', 'libraryPromptsCache', 'dataVersion'], async (result) => {
      // Run data migrations if needed
      const storedVersion = result.dataVersion || 0;
      if (storedVersion < DATA_VERSION) {
        await migrateData(storedVersion);
      }
      
      if (result.prompts) P.state.prompts = result.prompts;
      if (result.folders) P.state.folders = result.folders;
      if (result.settings) P.state.settings = { ...P.state.settings, ...result.settings };
      if (result.user) P.state.user = result.user;
      if (result.session) P.state.session = result.session;
      if (result.isPremium) P.state.isPremium = result.isPremium;
      if (result.promptLimit) P.state.promptLimit = result.promptLimit;
      if (result.libraryPromptsCache && Array.isArray(result.libraryPromptsCache)) P.state.libraryPrompts = result.libraryPromptsCache;
      if (!result.hasLaunched) {
        P.state.isFirstLaunch = true;
        chrome.storage.local.set({ hasLaunched: true });
      }
      if (result.language) P.setLang(result.language);
      else if (chrome.i18n.getUILanguage().startsWith('ru')) P.setLang('ru');
      resolve();
    });
  });
};

// ==================== FREE TIER LIMIT ====================
P.getEffectiveLimit = function() {
  return (P.state.promptLimit > 0 && P.state.promptLimit <= 1000) ? P.state.promptLimit : FREE_PROMPT_LIMIT;
};

P.canCreatePrompt = function() {
  if (P.state.isPremium) return true;
  return P.state.prompts.length < P.getEffectiveLimit();
};

P.getPromptsRemaining = function() {
  if (P.state.isPremium) return Infinity;
  return Math.max(0, P.getEffectiveLimit() - P.state.prompts.length);
};

// ==================== THEME ====================
P.applyTheme = function(theme) {
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
};

// ==================== SETTINGS PROMPT POOL (for hotkey selectors) ====================
let _settingsPromptPoolCache = { key: '', items: [] };

P.getSettingsPromptPool = function() {
  const cacheKey = `${P.state.prompts.length}:${P.state.prompts[0]?.updatedAt || 0}`;
  if (_settingsPromptPoolCache.key === cacheKey) return _settingsPromptPoolCache.items;
  const sorted = [...P.state.prompts].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const items = sorted.slice(0, CONFIG.SETTINGS_PROMPT_SELECT_LIMIT);
  _settingsPromptPoolCache = { key: cacheKey, items };
  return items;
};

P.getSettingsPromptOptions = function(selectedPromptId) {
  const selectedId = selectedPromptId || null;
  const limited = [...P.getSettingsPromptPool()];
  if (selectedId && !limited.some(p => p.id === selectedId)) {
    const selectedPrompt = P.state.prompts.find(p => p.id === selectedId);
    if (selectedPrompt) limited.unshift(selectedPrompt);
  }
  return limited.map(p => `<option value="${p.id}" ${selectedId === p.id ? 'selected' : ''}>${P.escapeHtml(P.truncate(p.title, 25))}</option>`).join('');
};

})(window.Promptory);
