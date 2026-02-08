// Background service worker

// Store hotkeys configuration
let hotkeysConfig = {
  slot1: { key: 'Ctrl+Shift+1', promptId: null },
  slot2: { key: 'Ctrl+Shift+2', promptId: null },
  slot3: { key: 'Ctrl+Shift+3', promptId: null },
  slot4: { key: 'Ctrl+Shift+4', promptId: null }
};

// Listen for commands (keyboard shortcuts)
chrome.commands.onCommand.addListener((command) => {
  console.log('Command received:', command);
  
  if (command === '_execute_action') {
    // Open popup (handled by manifest)
    console.log('Opening PromptVault via keyboard shortcut');
  }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('PromptVault installed');
    
    // Initialize storage with default data
    chrome.storage.local.set({
      prompts: [],
      folders: [],
      settings: {
        theme: 'system',
        hotkeys: { ...hotkeysConfig },
        defaultFolder: null
      },
      user: null,
      hasLaunched: false
    });
  } else if (details.reason === 'update') {
    console.log('PromptVault updated to', chrome.runtime.getManifest().version);
  }
});

// Load hotkeys on startup
chrome.storage.local.get(['settings'], (result) => {
  if (result.settings?.hotkeys) {
    hotkeysConfig = result.settings.hotkeys;
    console.log('Hotkeys loaded:', hotkeysConfig);
  }
});

// Context menu integration
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-as-prompt',
    title: 'Save selection as Prompt',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-as-prompt') {
    const text = info.selectionText;
    if (!text) return;
    
    // Get current prompts
    const result = await chrome.storage.local.get(['prompts']);
    const prompts = result.prompts || [];
    
    // Create new prompt from selection
    const newPrompt = {
      id: Date.now().toString(),
      title: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      text: text,
      description: 'Saved from selection',
      folderId: null,
      platform: 'universal',
      tags: [],
      variables: [],
      isFavorite: false,
      useCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    prompts.push(newPrompt);
    await chrome.storage.local.set({ prompts });
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icon128.png',
      title: 'PromptVault',
      message: 'Prompt saved successfully!'
    });
  }
});

// Message passing between popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);
  
  if (message.action === 'updateHotkeys') {
    hotkeysConfig = message.hotkeys;
    console.log('Hotkeys updated:', hotkeysConfig);
    sendResponse({ success: true });
  }
  
  if (message.action === 'syncToSupabase') {
    // Future: sync data to Supabase
    console.log('Sync to Supabase requested');
    sendResponse({ success: true });
  }
  
  if (message.action === 'getHotkeys') {
    sendResponse({ hotkeys: hotkeysConfig });
  }
  
  if (message.action === 'insertHotkeyPrompt') {
    const slotId = message.slotId;
    const slot = hotkeysConfig[slotId];
    
    if (slot?.promptId) {
      chrome.storage.local.get(['prompts'], (result) => {
        const prompts = result.prompts || [];
        const prompt = prompts.find(p => p.id === slot.promptId);
        
        if (prompt) {
          // Send prompt to content script
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'insertPrompt',
                text: prompt.text,
                variables: prompt.variables || []
              });
            }
          });
        }
      });
    }
    sendResponse({ success: true });
  }
  
  return true;
});

// Listen for keyboard shortcuts in content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'hotkeyPressed') {
    const key = message.key;
    
    // Find matching hotkey slot
    for (const [slotId, slot] of Object.entries(hotkeysConfig)) {
      if (slot.key === key && slot.promptId) {
        // Get prompt and insert
        chrome.storage.local.get(['prompts'], (result) => {
          const prompts = result.prompts || [];
          const prompt = prompts.find(p => p.id === slot.promptId);
          
          if (prompt) {
            chrome.tabs.sendMessage(sender.tab.id, {
              action: 'insertPrompt',
              text: prompt.text,
              variables: prompt.variables || []
            });
            
            // Update use count
            prompt.useCount = (prompt.useCount || 0) + 1;
            chrome.storage.local.set({ prompts });
          }
        });
        break;
      }
    }
    sendResponse({ success: true });
  }
  return true;
});

console.log('PromptVault background service worker initialized');
