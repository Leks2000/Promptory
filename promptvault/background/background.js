// Background service worker

// Listen for commands (keyboard shortcuts)
chrome.commands.onCommand.addListener((command) => {
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
        hotkeys: {},
        defaultFolder: null
      },
      user: null,
      hasLaunched: false
    });
  } else if (details.reason === 'update') {
    console.log('PromptVault updated to', chrome.runtime.getManifest().version);
  }
});

// Context menu integration (future feature)
// chrome.contextMenus.create({
//   id: 'save-as-prompt',
//   title: 'Save as Prompt',
//   contexts: ['selection']
// });

// chrome.contextMenus.onClicked.addListener((info, tab) => {
//   if (info.menuItemId === 'save-as-prompt') {
//     // Save selected text as a new prompt
//     const text = info.selectionText;
//     // Send to popup or open editor
//   }
// });

// Message passing between popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'syncToSupabase') {
    // Future: sync data to Supabase
    console.log('Sync to Supabase requested');
    sendResponse({ success: true });
  }
  
  return true;
});

console.log('PromptVault background service worker initialized');
