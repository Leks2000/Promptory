// Content script for inserting prompts into AI chat interfaces

// Platform-specific selectors
const SELECTORS = {
  'chat.openai.com': '#prompt-textarea, textarea[data-id="root"]',
  'chatgpt.com': '#prompt-textarea, textarea[data-id="root"]',
  'claude.ai': 'div.ProseMirror[contenteditable="true"], div[contenteditable="true"][data-placeholder]',
  'gemini.google.com': '.ql-editor[contenteditable="true"], rich-textarea div[contenteditable], div[contenteditable="true"][aria-label]',
  'perplexity.ai': 'textarea[placeholder], textarea',
  'poe.com': 'textarea',
  'you.com': 'textarea',
  'bard.google.com': '.ql-editor[contenteditable="true"]',
  'copilot.microsoft.com': 'textarea',
  'bing.com': 'textarea[name="q"]',
  'pi.ai': 'textarea'
};

// Detect current platform
const hostname = window.location.hostname;
const selector = SELECTORS[hostname];

// Listen for keyboard shortcuts
document.addEventListener('keydown', handleKeyboardShortcut);

function handleKeyboardShortcut(e) {
  // Build key combination string
  const keys = [];
  if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
  if (e.shiftKey) keys.push('Shift');
  if (e.altKey) keys.push('Alt');
  
  if (e.key && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    keys.push(e.key.toUpperCase());
  }
  
  const keyCombo = keys.join('+');
  
  // Check if it's a potential hotkey (at least Ctrl/Cmd + another key)
  if (keys.length >= 2 && (e.ctrlKey || e.metaKey)) {
    // Send to background to check if it matches a configured hotkey
    chrome.runtime.sendMessage({
      action: 'hotkeyPressed',
      key: keyCombo
    });
  }
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'insertPrompt') {
    insertPrompt(message.text, message.variables);
    sendResponse({ success: true });
  }
  
  if (message.action === 'checkPlatform') {
    sendResponse({ 
      platform: hostname,
      supported: !!selector 
    });
  }
  
  return true;
});

async function insertPrompt(text, variables) {
  // If prompt has variables, show variable input dialog
  if (variables && variables.length > 0) {
    text = await showVariableDialog(text, variables);
    if (!text) return; // User cancelled
  }
  
  // Find input field
  const inputField = findInputField();
  
  if (!inputField) {
    // Fallback: copy to clipboard
    await copyToClipboard(text);
    showNotification('Copied to clipboard (input field not found)');
    return;
  }
  
  // Insert text
  insertText(inputField, text);
  showNotification('Prompt inserted');
}

function findInputField() {
  if (!selector) return null;
  
  // Try multiple selectors if comma-separated
  const selectors = selector.split(',').map(s => s.trim());
  
  for (const sel of selectors) {
    const element = document.querySelector(sel);
    if (element) return element;
  }
  
  // Generic fallback selectors
  const fallbacks = [
    'textarea[placeholder*="message"]',
    'textarea[placeholder*="Message"]',
    'div[contenteditable="true"]',
    'textarea'
  ];
  
  for (const sel of fallbacks) {
    const element = document.querySelector(sel);
    if (element) return element;
  }
  
  return null;
}

function insertText(element, text) {
  // Focus the element first
  element.focus();
  
  // Check if it's a contenteditable element
  if (element.contentEditable === 'true') {
    // For contenteditable elements (Claude, Gemini)
    insertIntoContentEditable(element, text);
  } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    // For textarea/input elements (ChatGPT, Perplexity, Poe)
    insertIntoTextarea(element, text);
  }
}

function insertIntoContentEditable(element, text) {
  element.focus();
  
  // Clear existing content and set new text
  const selection = window.getSelection();
  const range = document.createRange();
  
  // Method 1: Use execCommand (works on most browsers)
  if (document.execCommand) {
    // Select all and delete first
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Insert new text
    document.execCommand('insertText', false, text);
  } else {
    // Method 2: Direct manipulation
    element.innerHTML = '';
    const textNode = document.createTextNode(text);
    element.appendChild(textNode);
    
    // Set cursor at end
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  
  // Dispatch input events for React/Vue compatibility
  element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: text }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  // For Claude specifically - trigger a key event
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
}

function insertIntoTextarea(element, text) {
  element.focus();
  
  // Set value directly
  element.value = text;
  
  // Set cursor at end
  element.selectionStart = element.selectionEnd = text.length;
  
  // Dispatch events for React compatibility
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  nativeInputValueSetter.call(element, text);
  
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  // For ChatGPT - trigger keyboard events
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
}

async function showVariableDialog(text, variables) {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'promptvault-overlay';
    overlay.innerHTML = `
      <div class="promptvault-dialog">
        <div class="promptvault-header">
          <h3>Fill in Variables</h3>
          <button class="promptvault-close">×</button>
        </div>
        <div class="promptvault-body">
          ${variables.map(variable => `
            <div class="promptvault-field">
              <label>${escapeHtml(variable)}</label>
              <input type="text" data-variable="${escapeHtml(variable)}" placeholder="Enter ${escapeHtml(variable)}">
            </div>
          `).join('')}
        </div>
        <div class="promptvault-footer">
          <button class="promptvault-btn promptvault-btn-cancel">Cancel</button>
          <button class="promptvault-btn promptvault-btn-primary">Insert</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Focus first input
    setTimeout(() => {
      const firstInput = overlay.querySelector('input');
      if (firstInput) firstInput.focus();
    }, 100);
    
    // Close button
    overlay.querySelector('.promptvault-close').addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });
    
    // Cancel button
    overlay.querySelector('.promptvault-btn-cancel').addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });
    
    // Insert button
    overlay.querySelector('.promptvault-btn-primary').addEventListener('click', () => {
      let filledText = text;
      
      // Replace variables with values
      variables.forEach(variable => {
        const input = overlay.querySelector(`[data-variable="${escapeHtml(variable)}"]`);
        if (input) {
          const value = input.value.trim() || `{${variable}}`;
          filledText = filledText.replaceAll(`{${variable}}`, value);
        }
      });
      
      overlay.remove();
      resolve(filledText);
    });
    
    // Enter key to submit
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        overlay.querySelector('.promptvault-btn-primary').click();
      }
      if (e.key === 'Escape') {
        overlay.remove();
        resolve(null);
      }
    });
    
    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    });
  });
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

function showNotification(message) {
  // Remove existing notification
  const existing = document.querySelector('.promptvault-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.className = 'promptvault-notification';
  notification.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
    ${message}
  `;
  
  document.body.appendChild(notification);
  
  // Show notification
  setTimeout(() => notification.classList.add('visible'), 10);
  
  // Hide after 3 seconds
  setTimeout(() => {
    notification.classList.remove('visible');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Inject styles
const style = document.createElement('style');
style.textContent = `
  .promptvault-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  
  .promptvault-dialog {
    background: #1a1a1a;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    width: 400px;
    max-width: 90vw;
    max-height: 80vh;
    overflow: hidden;
    animation: promptvault-slide-up 200ms ease;
  }
  
  @keyframes promptvault-slide-up {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  .promptvault-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #333;
  }
  
  .promptvault-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  }
  
  .promptvault-close {
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: #888;
    font-size: 20px;
    cursor: pointer;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms;
  }
  
  .promptvault-close:hover {
    background: #333;
    color: #fff;
  }
  
  .promptvault-body {
    padding: 20px;
    max-height: 400px;
    overflow-y: auto;
  }
  
  .promptvault-field {
    margin-bottom: 16px;
  }
  
  .promptvault-field:last-child {
    margin-bottom: 0;
  }
  
  .promptvault-field label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #ccc;
    margin-bottom: 6px;
  }
  
  .promptvault-field input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #333;
    border-radius: 8px;
    background: #2a2a2a;
    color: #fff;
    font-size: 14px;
    outline: none;
    transition: border-color 150ms;
  }
  
  .promptvault-field input:focus {
    border-color: #2383E2;
  }
  
  .promptvault-field input::placeholder {
    color: #666;
  }
  
  .promptvault-footer {
    display: flex;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid #333;
    justify-content: flex-end;
  }
  
  .promptvault-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms;
  }
  
  .promptvault-btn-cancel {
    background: #333;
    color: #ccc;
  }
  
  .promptvault-btn-cancel:hover {
    background: #444;
  }
  
  .promptvault-btn-primary {
    background: #2383E2;
    color: #fff;
  }
  
  .promptvault-btn-primary:hover {
    background: #1B6EC2;
  }
  
  .promptvault-notification {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(100%);
    background: #1a1a1a;
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0;
    transition: all 250ms ease;
  }
  
  .promptvault-notification.visible {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
  
  .promptvault-notification svg {
    color: #0F7B6C;
  }
`;
document.head.appendChild(style);

// Initialize
console.log('PromptVault content script loaded on', hostname);
