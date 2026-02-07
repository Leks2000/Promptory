/**
 * PromptVault — Background Service Worker
 * Handles hotkey commands, context menu, and messaging
 */

// ============ INITIALIZATION ============

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      pv_settings: {
        theme: 'dark',
        insertMode: 'replace',
        showNotifications: true,
        defaultSort: 'date',
        compactView: false,
        maxFreePrompts: 20
      },
      pv_prompts: [],
      pv_folders: [],
      pv_hotkeys: {},
      pv_stats: {
        totalInsertions: 0,
        todayInsertions: 0,
        todayDate: new Date().toDateString(),
        weeklyData: {}
      },
      pv_usage_history: []
    });

    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html')
    });
  }

  setupContextMenu();
});

// ============ CONTEXT MENU ============

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'pv-save-selection',
      title: 'Save selected text as prompt',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'pv-open-quick-search',
      title: 'PromptVault Quick Search',
      contexts: ['editable']
    });

    chrome.contextMenus.create({
      id: 'pv-separator',
      type: 'separator',
      contexts: ['selection', 'editable']
    });

    chrome.contextMenus.create({
      id: 'pv-open-popup',
      title: 'Open PromptVault',
      contexts: ['all']
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'pv-save-selection':
      if (info.selectionText) {
        await saveQuickPrompt(info.selectionText);
      }
      break;

    case 'pv-open-quick-search':
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'SHOW_QUICK_SEARCH' }).catch(() => {});
      }
      break;

    case 'pv-open-popup':
      try { chrome.action.openPopup(); } catch(e) {}
      break;
  }
});

async function saveQuickPrompt(text) {
  const result = await chrome.storage.local.get(['pv_prompts']);
  const prompts = result.pv_prompts || [];

  const title = text.substring(0, 50).trim() + (text.length > 50 ? '...' : '');
  const prompt = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
    title,
    text,
    folderId: null,
    tags: ['quick-save'],
    color: null,
    isFavorite: false,
    usageCount: 0,
    lastUsed: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  prompts.push(prompt);
  await chrome.storage.local.set({ pv_prompts: prompts });

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'SHOW_TOAST', message: 'Prompt saved!' }).catch(() => {});
    }
  } catch (e) {}
}

// ============ COMMAND HANDLER (HOTKEYS) ============

chrome.commands.onCommand.addListener(async (command) => {
  if (command === '_execute_action') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'SHOW_QUICK_SEARCH' }).catch(() => {});
      }
    } catch (e) {}
    return;
  }

  // Handle hotkey-1 through hotkey-3 (Chrome max 4 commands total)
  if (command.startsWith('hotkey-')) {
    await handleHotkeyInsert(command);
  }
});

async function handleHotkeyInsert(hotkeySlot) {
  const result = await chrome.storage.local.get(['pv_hotkeys', 'pv_prompts']);
  const hotkeys = result.pv_hotkeys || {};
  const prompts = result.pv_prompts || [];

  const promptId = hotkeys[hotkeySlot];
  if (!promptId) return;

  const prompt = prompts.find(p => p.id === promptId);
  if (!prompt) return;

  // Variables → show in content script
  if (/\{\w+\}/.test(prompt.text)) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'SHOW_QUICK_SEARCH_WITH_PROMPT',
          prompt
        }).catch(() => {});
      }
    } catch (e) {}
    return;
  }

  // Direct insertion
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'INSERT_PROMPT',
        text: prompt.text
      }, async (response) => {
        if (response?.success) {
          await recordUsageBackground(prompt.id, prompts);
        }
      });
    }
  } catch (e) {}
}

async function recordUsageBackground(promptId, prompts) {
  const idx = prompts.findIndex(p => p.id === promptId);
  if (idx >= 0) {
    prompts[idx].usageCount = (prompts[idx].usageCount || 0) + 1;
    prompts[idx].lastUsed = new Date().toISOString();

    const statsResult = await chrome.storage.local.get(['pv_stats', 'pv_usage_history']);
    const stats = statsResult.pv_stats || { totalInsertions: 0, todayInsertions: 0, todayDate: '', weeklyData: {} };

    const today = new Date().toDateString();
    if (stats.todayDate !== today) {
      stats.todayInsertions = 0;
      stats.todayDate = today;
    }
    stats.totalInsertions++;
    stats.todayInsertions++;
    const dayKey = new Date().toISOString().split('T')[0];
    stats.weeklyData[dayKey] = (stats.weeklyData[dayKey] || 0) + 1;

    const history = statsResult.pv_usage_history || [];
    history.unshift({ promptId, promptTitle: prompts[idx].title, timestamp: new Date().toISOString() });

    await chrome.storage.local.set({
      pv_prompts: prompts,
      pv_stats: stats,
      pv_usage_history: history.slice(0, 100)
    });
  }
}

// ============ MESSAGE HANDLER ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_PROMPTS') {
    chrome.storage.local.get(['pv_prompts'], (result) => {
      sendResponse({ prompts: result.pv_prompts || [] });
    });
    return true;
  }

  if (message.action === 'GET_SETTINGS') {
    chrome.storage.local.get(['pv_settings'], (result) => {
      sendResponse({ settings: result.pv_settings || {} });
    });
    return true;
  }

  if (message.action === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }
});
