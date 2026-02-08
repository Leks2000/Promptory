// Prompts list functionality
import { showToast, saveData } from '../popup.js';

let contextMenuVisible = false;
let currentContextMenu = null;

export function initPrompts() {
  renderPrompts();
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.prompts) {
      window.appState.prompts = changes.prompts.newValue || [];
      renderPrompts();
    }
  });
  
  // Close context menu when clicking outside
  document.addEventListener('click', (e) => {
    if (contextMenuVisible && !e.target.closest('.context-menu')) {
      closeContextMenu();
    }
  });
}

export function renderPrompts() {
  const promptsList = document.getElementById('prompts-list');
  const prompts = window.appState.prompts;
  const folders = window.appState.folders;
  
  if (prompts.length === 0) {
    promptsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-title">No prompts yet</div>
        <div class="empty-state-text">Create your first prompt to get started</div>
        <button class="btn btn-primary ripple" onclick="document.getElementById('new-prompt-btn').click()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Create prompt
        </button>
      </div>
    `;
    return;
  }
  
  // Group prompts by folder
  const groupedPrompts = {};
  const uncategorized = [];
  
  prompts.forEach(prompt => {
    if (prompt.folderId) {
      if (!groupedPrompts[prompt.folderId]) {
        groupedPrompts[prompt.folderId] = [];
      }
      groupedPrompts[prompt.folderId].push(prompt);
    } else {
      uncategorized.push(prompt);
    }
  });
  
  let html = '';
  
  // Render folders with prompts
  folders.forEach(folder => {
    const folderPrompts = groupedPrompts[folder.id] || [];
    if (folderPrompts.length > 0) {
      html += renderFolderSection(folder, folderPrompts);
    }
  });
  
  // Render uncategorized prompts
  if (uncategorized.length > 0) {
    const uncategorizedFolder = {
      id: null,
      name: 'Uncategorized',
      icon: '📋'
    };
    html += renderFolderSection(uncategorizedFolder, uncategorized);
  }
  
  promptsList.innerHTML = html;
  
  // Add event listeners
  attachPromptListeners();
}

function renderFolderSection(folder, prompts) {
  const isExpanded = !folder.id || localStorage.getItem(`folder-${folder.id}-expanded`) !== 'false';
  
  return `
    <div class="folder-section ${isExpanded ? 'expanded' : ''}" data-folder-id="${folder.id || 'uncategorized'}">
      <div class="folder-header" onclick="toggleFolder('${folder.id || 'uncategorized'}')">
        <div class="folder-info">
          <span class="folder-arrow">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </span>
          <span class="folder-icon">${folder.icon || '📁'}</span>
          <span class="folder-name">${folder.name}</span>
        </div>
        <span class="folder-count">(${prompts.length})</span>
      </div>
      <div class="folder-content">
        ${prompts.map((prompt, index) => renderPromptCard(prompt, index)).join('')}
      </div>
    </div>
  `;
}

function renderPromptCard(prompt, index) {
  return `
    <div class="prompt-card" data-prompt-id="${prompt.id}" style="animation-delay: ${index * 40}ms">
      <div class="prompt-card-header">
        <div class="prompt-title">${escapeHtml(prompt.title)}</div>
        <div class="prompt-actions">
          <button class="prompt-action-btn ${prompt.isFavorite ? 'active' : ''}" 
                  onclick="toggleFavorite('${prompt.id}')" 
                  title="Toggle favorite">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${prompt.isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <button class="prompt-action-btn" 
                  onclick="showContextMenu(event, '${prompt.id}')" 
                  title="More actions">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="12" cy="5" r="1"/>
              <circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
        </div>
      </div>
      ${prompt.tags && prompt.tags.length > 0 ? `
        <div class="tags">
          ${prompt.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
      <div class="prompt-meta">
        <span class="prompt-stat">Used ${prompt.useCount || 0} times</span>
      </div>
    </div>
  `;
}

function attachPromptListeners() {
  const promptCards = document.querySelectorAll('.prompt-card');
  
  promptCards.forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't open editor if clicking on action buttons
      if (e.target.closest('.prompt-action-btn')) {
        return;
      }
      
      const promptId = card.getAttribute('data-prompt-id');
      openPromptEditor(promptId);
    });
  });
}

function openPromptEditor(promptId) {
  const event = new CustomEvent('open-prompt-editor', { detail: { promptId } });
  document.dispatchEvent(event);
}

// Global functions (accessible from HTML)
window.toggleFolder = function(folderId) {
  const section = document.querySelector(`[data-folder-id="${folderId}"]`);
  if (!section) return;
  
  const isExpanded = section.classList.contains('expanded');
  section.classList.toggle('expanded');
  
  // Save state
  if (folderId !== 'uncategorized') {
    localStorage.setItem(`folder-${folderId}-expanded`, !isExpanded);
  }
};

window.toggleFavorite = async function(promptId) {
  const prompt = window.appState.prompts.find(p => p.id === promptId);
  if (!prompt) return;
  
  prompt.isFavorite = !prompt.isFavorite;
  await saveData('prompts', window.appState.prompts);
  
  showToast(prompt.isFavorite ? 'Added to favorites' : 'Removed from favorites', 'success');
  renderPrompts();
};

window.showContextMenu = function(event, promptId) {
  event.preventDefault();
  event.stopPropagation();
  
  closeContextMenu();
  
  const prompt = window.appState.prompts.find(p => p.id === promptId);
  if (!prompt) return;
  
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <div class="context-menu-item" onclick="copyPromptText('${promptId}')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      Copy prompt
    </div>
    <div class="context-menu-item" onclick="insertPrompt('${promptId}')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
      </svg>
      Insert to page
    </div>
    <div class="context-menu-item" onclick="openPromptEditor('${promptId}')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      Edit
    </div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item danger" onclick="deletePrompt('${promptId}')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      Delete
    </div>
  `;
  
  document.body.appendChild(menu);
  
  // Position menu
  const rect = event.target.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;
  
  // Adjust if menu goes off-screen
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = `${rect.right - menuRect.width}px`;
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = `${rect.top - menuRect.height - 4}px`;
  }
  
  currentContextMenu = menu;
  contextMenuVisible = true;
};

function closeContextMenu() {
  if (currentContextMenu) {
    currentContextMenu.remove();
    currentContextMenu = null;
    contextMenuVisible = false;
  }
}

window.copyPromptText = async function(promptId) {
  const prompt = window.appState.prompts.find(p => p.id === promptId);
  if (!prompt) return;
  
  try {
    await navigator.clipboard.writeText(prompt.text);
    showToast('Copied to clipboard', 'success');
    
    // Increment use count
    prompt.useCount = (prompt.useCount || 0) + 1;
    await saveData('prompts', window.appState.prompts);
    renderPrompts();
  } catch (err) {
    showToast('Failed to copy', 'error');
  }
  
  closeContextMenu();
};

window.insertPrompt = async function(promptId) {
  const prompt = window.appState.prompts.find(p => p.id === promptId);
  if (!prompt) return;
  
  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    showToast('No active tab found', 'error');
    closeContextMenu();
    return;
  }
  
  // Send message to content script
  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: 'insertPrompt',
      text: prompt.text,
      variables: extractVariables(prompt.text)
    });
    
    // Increment use count
    prompt.useCount = (prompt.useCount || 0) + 1;
    await saveData('prompts', window.appState.prompts);
    
    showToast('Prompt inserted', 'success');
    renderPrompts();
  } catch (err) {
    // Fallback: copy to clipboard
    await navigator.clipboard.writeText(prompt.text);
    showToast('Copied to clipboard (page not supported)', 'success');
  }
  
  closeContextMenu();
};

window.deletePrompt = async function(promptId) {
  if (!confirm('Are you sure you want to delete this prompt?')) {
    closeContextMenu();
    return;
  }
  
  window.appState.prompts = window.appState.prompts.filter(p => p.id !== promptId);
  await saveData('prompts', window.appState.prompts);
  
  showToast('Prompt deleted', 'success');
  renderPrompts();
  closeContextMenu();
};

window.openPromptEditor = function(promptId) {
  const event = new CustomEvent('open-prompt-editor', { detail: { promptId } });
  document.dispatchEvent(event);
  closeContextMenu();
};

function extractVariables(text) {
  const regex = /\{([^}]+)\}/g;
  const variables = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  
  return variables;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
