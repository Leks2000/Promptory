// Folders management functionality
import { showToast, saveData } from '../popup.js';
import { renderPrompts } from './prompts.js';

let contextMenuVisible = false;
let currentContextMenu = null;

export function initFolders() {
  renderFolders();
  
  // New folder button
  document.getElementById('new-folder-btn').addEventListener('click', () => {
    openFolderEditor();
  });
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.folders) {
      window.appState.folders = changes.folders.newValue || [];
      renderFolders();
      renderPrompts(); // Re-render prompts when folders change
    }
  });
  
  // Close context menu when clicking outside
  document.addEventListener('click', (e) => {
    if (contextMenuVisible && !e.target.closest('.context-menu')) {
      closeContextMenu();
    }
  });
}

export function renderFolders() {
  const foldersList = document.getElementById('folders-list');
  const folders = window.appState.folders;
  
  if (folders.length === 0) {
    foldersList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <div class="empty-state-title">No folders yet</div>
        <div class="empty-state-text">Create folders to organize your prompts</div>
        <button class="btn btn-primary ripple" onclick="document.getElementById('new-folder-btn').click()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Create folder
        </button>
      </div>
    `;
    return;
  }
  
  foldersList.innerHTML = folders.map((folder, index) => renderFolderCard(folder, index)).join('');
  attachFolderListeners();
}

function renderFolderCard(folder, index) {
  const promptCount = window.appState.prompts.filter(p => p.folderId === folder.id).length;
  
  return `
    <div class="folder-card" data-folder-id="${folder.id}" style="animation-delay: ${index * 40}ms">
      <div class="folder-card-left">
        <div class="folder-icon">${folder.icon || '📁'}</div>
        <div class="folder-details">
          <div class="folder-card-name">${escapeHtml(folder.name)}</div>
          <div class="folder-card-count">${promptCount} prompt${promptCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="folder-card-actions">
        <button class="prompt-action-btn" 
                onclick="event.stopPropagation(); editFolderById('${folder.id}')" 
                title="Edit folder">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="prompt-action-btn" 
                onclick="event.stopPropagation(); deleteFolderById('${folder.id}')" 
                title="Delete folder">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function attachFolderListeners() {
  const folderCards = document.querySelectorAll('.folder-card');
  
  folderCards.forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't trigger card click if clicking on action buttons
      if (e.target.closest('.folder-card-actions')) {
        return;
      }
      if (e.target.closest('.prompt-action-btn')) {
        return;
      }
      
      const folderId = card.getAttribute('data-folder-id');
      // Switch to prompts tab
      document.querySelector('[data-tab="prompts"]').click();
    });
  });
}

function openFolderEditor(folderId = null) {
  const folder = folderId ? window.appState.folders.find(f => f.id === folderId) : null;
  const isEdit = !!folder;
  
  // Icon picker options
  const iconOptions = ['📁', '📂', '📋', '📝', '💼', '🎨', '🔧', '💡', '🎯', '🚀', '📊', '💻', '🎮', '📱', '🌐', '⚡'];
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'folder-editor-modal';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${isEdit ? 'Edit Folder' : 'New Folder'}</h2>
        <button class="btn btn-icon btn-ghost" onclick="closeFolderEditorModal()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label required">Folder Name</label>
          <input type="text" id="folder-name-input" placeholder="e.g., Marketing" value="${folder ? escapeHtml(folder.name) : ''}">
          <span class="form-error" id="folder-name-error" style="display: none;">Name is required</span>
        </div>
        <div class="form-group">
          <label class="form-label">Icon</label>
          <div class="icon-picker" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
            ${iconOptions.map(icon => `
              <button type="button" 
                      class="icon-picker-btn ${folder?.icon === icon || (!folder && icon === '📁') ? 'active' : ''}" 
                      onclick="selectFolderIcon('${icon}')"
                      style="width: 36px; height: 36px; font-size: 18px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                ${icon}
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="folder-icon-input" value="${folder ? folder.icon : '📁'}">
          <span class="form-hint">Pick an emoji to represent this folder</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeFolderEditorModal()">Cancel</button>
        <button class="btn btn-primary ripple" onclick="saveFolderFromEditor('${folderId || ''}')">
          ${isEdit ? 'Save Changes' : 'Create Folder'}
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Show modal with animation
  setTimeout(() => modal.classList.add('visible'), 10);
  
  // Focus name input
  const nameInput = document.getElementById('folder-name-input');
  nameInput.focus();
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeFolderEditorModal();
    }
  });
}

window.selectFolderIcon = function(icon) {
  // Update hidden input
  const input = document.getElementById('folder-icon-input');
  if (input) input.value = icon;
  
  // Update active state
  const buttons = document.querySelectorAll('.icon-picker-btn');
  buttons.forEach(btn => {
    btn.classList.remove('active');
    btn.style.borderColor = 'var(--border)';
    btn.style.background = 'var(--bg-secondary)';
    if (btn.textContent.trim() === icon) {
      btn.classList.add('active');
      btn.style.borderColor = 'var(--accent)';
      btn.style.background = 'var(--accent-light)';
    }
  });
};

window.saveFolderFromEditor = async function(folderId) {
  const name = document.getElementById('folder-name-input')?.value.trim();
  const icon = document.getElementById('folder-icon-input')?.value.trim();
  const error = document.getElementById('folder-name-error');
  
  if (!name) {
    if (error) error.style.display = 'block';
    document.getElementById('folder-name-input')?.focus();
    return;
  }
  
  if (error) error.style.display = 'none';
  
  if (folderId) {
    // Update existing folder
    const folder = window.appState.folders.find(f => f.id === folderId);
    if (folder) {
      folder.name = name;
      folder.icon = icon || '📁';
      folder.updatedAt = Date.now();
    }
  } else {
    // Create new folder
    const newFolder = {
      id: Date.now().toString(),
      name,
      icon: icon || '📁',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    window.appState.folders.push(newFolder);
  }
  
  await saveData('folders', window.appState.folders);
  showToast(folderId ? 'Folder updated' : 'Folder created', 'success');
  
  closeFolderEditorModal();
  renderFolders();
};

window.closeFolderEditorModal = function() {
  const modal = document.getElementById('folder-editor-modal');
  if (modal) {
    modal.classList.remove('visible');
    setTimeout(() => modal.remove(), 250);
  }
};

window.editFolderById = function(folderId) {
  openFolderEditor(folderId);
};

window.deleteFolderById = async function(folderId) {
  const folder = window.appState.folders.find(f => f.id === folderId);
  if (!folder) return;
  
  const promptCount = window.appState.prompts.filter(p => p.folderId === folderId).length;
  
  let confirmMessage = `Are you sure you want to delete "${folder.name}"?`;
  if (promptCount > 0) {
    confirmMessage += `\n\n${promptCount} prompt${promptCount !== 1 ? 's' : ''} will be moved to Uncategorized.`;
  }
  
  if (!confirm(confirmMessage)) {
    return;
  }
  
  // Remove folder
  window.appState.folders = window.appState.folders.filter(f => f.id !== folderId);
  
  // Move prompts to uncategorized
  window.appState.prompts.forEach(prompt => {
    if (prompt.folderId === folderId) {
      prompt.folderId = null;
    }
  });
  
  await saveData('folders', window.appState.folders);
  await saveData('prompts', window.appState.prompts);
  
  showToast('Folder deleted', 'success');
  renderFolders();
  renderPrompts();
};

function closeContextMenu() {
  if (currentContextMenu) {
    currentContextMenu.remove();
    currentContextMenu = null;
    contextMenuVisible = false;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
