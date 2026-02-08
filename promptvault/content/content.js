// Content script for inserting prompts into AI chat interfaces

// Platform-specific selectors
const SELECTORS = {
  'chat.openai.com': '#prompt-textarea',
  'chatgpt.com': '#prompt-textarea',
  'claude.ai': 'div.ProseMirror[contenteditable="true"]',
  'gemini.google.com': '.ql-editor[contenteditable="true"], rich-textarea div[contenteditable]',
  'perplexity.ai': 'textarea[placeholder]',
  'poe.com': 'textarea'
};

// Detect current platform
const hostname = window.location.hostname;
const selector = SELECTORS[hostname];

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'insertPrompt') {
    insertPrompt(message.text, message.variables);
    sendResponse({ success: true });
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
  showNotification('Prompt inserted successfully');
}

function findInputField() {
  if (!selector) return null;
  
  // Try multiple selectors if comma-separated
  const selectors = selector.split(',').map(s => s.trim());
  
  for (const sel of selectors) {
    const element = document.querySelector(sel);
    if (element) return element;
  }
  
  return null;
}

function insertText(element, text) {
  // Check if it's a contenteditable element
  if (element.contentEditable === 'true') {
    // For contenteditable elements (Claude, Gemini)
    element.focus();
    
    // Try multiple methods
    // Method 1: execCommand (deprecated but still works)
    if (document.execCommand) {
      document.execCommand('insertText', false, text);
    } else {
      // Method 2: Direct manipulation
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    // Dispatch input event
    element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    // For textarea/input elements (ChatGPT, Perplexity, Poe)
    element.focus();
    element.value = text;
    
    // Dispatch events
    element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
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
          const value = input.value.trim();
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
  const notification = document.createElement('div');
  notification.className = 'promptvault-notification';
  notification.textContent = message;
  
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

// Initialize
console.log('PromptVault content script loaded on', hostname);
