// Prompt editor (create/edit prompt)
import { showToast, saveData } from '../popup.js';
import { renderPrompts } from './prompts.js';
import { renderFavorites } from './favorites.js';

export function initPromptEditor() {
  // New prompt button
  document.getElementById('new-prompt-btn').addEventListener('click', () => {
    openPromptEditor();
  });
  
  // Listen for open editor events
  document.addEventListener('open-prompt-editor', (e) => {
    openPromptEditor(e.detail.promptId);
  });
}

function openPromptEditor(promptId = null) {
  const prompt = promptId ? window.appState.prompts.find(p => p.id === promptId) : null;
  const isEdit = !!prompt;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="max-width: 600px;">
      <div class="modal-header">
        <h2 class="modal-title">${isEdit ? 'Edit Prompt' : 'New Prompt'}</h2>
        <button class="btn btn-icon btn-ghost" onclick="closePromptEditor()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label required">Title</label>
          <input type="text" id="prompt-title-input" placeholder="e.g., Summarize Article" value="${prompt ? escapeHtml(prompt.title) : ''}">
          <span class="form-error" id="title-error" style="display: none;">Title is required</span>
        </div>
        
        <div class="form-group">
          <label class="form-label required">Prompt Text</label>
          <textarea id="prompt-text-input" placeholder="Write your prompt here... Use {variables} for dynamic content" rows="8">${prompt ? escapeHtml(prompt.text) : ''}</textarea>
          <span class="form-error" id="text-error" style="display: none;">Prompt text is required</span>
          <span class="form-hint" id="variables-hint" style="display: none;">Variables detected: <span id="variables-list"></span></span>
        </div>
        
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="prompt-description-input" placeholder="Optional description of what this prompt does" rows="2">${prompt ? escapeHtml(prompt.description || '') : ''}</textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">Folder</label>
          <select id="prompt-folder-select">
            <option value="">Uncategorized</option>
            ${window.appState.folders.map(folder => `
              <option value="${folder.id}" ${prompt && prompt.folderId === folder.id ? 'selected' : ''}>
                ${folder.icon || '📁'} ${escapeHtml(folder.name)}
              </option>
            `).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Tags</label>
          <div id="tags-input-container">
            <div class="tags" id="tags-list">
              ${prompt && prompt.tags ? prompt.tags.map(tag => `
                <span class="tag tag-removable" data-tag="${escapeHtml(tag)}">
                  #${escapeHtml(tag)}
                  <span class="tag-remove" onclick="removeTag('${escapeHtml(tag)}')">×</span>
                </span>
              `).join('') : ''}
            </div>
            <input type="text" id="tag-input" placeholder="Add tags (press Enter)" style="margin-top: 8px;">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Platform</label>
          <select id="prompt-platform-select">
            <option value="universal" ${!prompt || prompt.platform === 'universal' ? 'selected' : ''}>Universal</option>
            <option value="chatgpt" ${prompt && prompt.platform === 'chatgpt' ? 'selected' : ''}>ChatGPT</option>
            <option value="claude" ${prompt && prompt.platform === 'claude' ? 'selected' : ''}>Claude</option>
            <option value="gemini" ${prompt && prompt.platform === 'gemini' ? 'selected' : ''}>Gemini</option>
          </select>
          <span class="form-hint">Optimize for specific AI platform</span>
        </div>
      </div>
      <div class="modal-footer" style="justify-content: space-between;">
        ${isEdit ? `
          <button class="btn btn-danger" onclick="deletePromptFromEditor('${prompt.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Delete
          </button>
        ` : '<div></div>'}
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-ghost" onclick="closePromptEditor()">Cancel</button>
          <button class="btn btn-primary ripple" id="save-prompt-btn">
            ${isEdit ? 'Save Changes' : 'Create Prompt'}
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 10);
  
  // Focus title input
  const titleInput = document.getElementById('prompt-title-input');
  titleInput.focus();
  
  // Auto-detect variables
  const textInput = document.getElementById('prompt-text-input');
  textInput.addEventListener('input', updateVariables);
  updateVariables();
  
  // Tag input
  const tagInput = document.getElementById('tag-input');
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(tagInput.value.trim());
      tagInput.value = '';
    }
  });
  
  // Save button
  document.getElementById('save-prompt-btn').addEventListener('click', () => {
    savePrompt(promptId);
  });
}

function updateVariables() {
  const text = document.getElementById('prompt-text-input').value;
  const variables = extractVariables(text);
  const hint = document.getElementById('variables-hint');
  const list = document.getElementById('variables-list');
  
  if (variables.length > 0) {
    list.innerHTML = variables.map(v => `<span class="tag">{${escapeHtml(v)}}</span>`).join(' ');
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
}

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

function addTag(tag) {
  if (!tag) return;
  
  // Remove # if user typed it
  tag = tag.replace(/^#/, '');
  
  // Check if tag already exists
  const existingTags = Array.from(document.querySelectorAll('[data-tag]')).map(el => el.getAttribute('data-tag'));
  if (existingTags.includes(tag)) return;
  
  const tagsList = document.getElementById('tags-list');
  const tagEl = document.createElement('span');
  tagEl.className = 'tag tag-removable';
  tagEl.setAttribute('data-tag', tag);
  tagEl.innerHTML = `
    #${escapeHtml(tag)}
    <span class="tag-remove" onclick="removeTag('${escapeHtml(tag)}')">×</span>
  `;
  
  tagsList.appendChild(tagEl);
}

window.removeTag = function(tag) {
  const tagEl = document.querySelector(`[data-tag="${tag}"]`);
  if (tagEl) {
    tagEl.remove();
  }
};

async function savePrompt(promptId) {
  const title = document.getElementById('prompt-title-input').value.trim();
  const text = document.getElementById('prompt-text-input').value.trim();
  const description = document.getElementById('prompt-description-input').value.trim();
  const folderId = document.getElementById('prompt-folder-select').value || null;
  const platform = document.getElementById('prompt-platform-select').value;
  const tags = Array.from(document.querySelectorAll('[data-tag]')).map(el => el.getAttribute('data-tag'));
  
  // Validation
  const titleError = document.getElementById('title-error');
  const textError = document.getElementById('text-error');
  let hasError = false;
  
  if (!title) {
    titleError.style.display = 'block';
    hasError = true;
  } else {
    titleError.style.display = 'none';
  }
  
  if (!text) {
    textError.style.display = 'block';
    hasError = true;
  } else {
    textError.style.display = 'none';
  }
  
  if (hasError) return;
  
  const variables = extractVariables(text);
  
  if (promptId) {
    // Update existing prompt
    const prompt = window.appState.prompts.find(p => p.id === promptId);
    if (prompt) {
      prompt.title = title;
      prompt.text = text;
      prompt.description = description;
      prompt.folderId = folderId;
      prompt.platform = platform;
      prompt.tags = tags;
      prompt.variables = variables;
      prompt.updatedAt = Date.now();
    }
  } else {
    // Create new prompt
    const newPrompt = {
      id: Date.now().toString(),
      title,
      text,
      description,
      folderId,
      platform,
      tags,
      variables,
      isFavorite: false,
      useCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    window.appState.prompts.push(newPrompt);
  }
  
  await saveData('prompts', window.appState.prompts);
  showToast(promptId ? 'Prompt updated' : 'Prompt created', 'success');
  
  closePromptEditor();
  renderPrompts();
  renderFavorites();
}

window.deletePromptFromEditor = async function(promptId) {
  if (!confirm('Are you sure you want to delete this prompt?')) {
    return;
  }
  
  window.appState.prompts = window.appState.prompts.filter(p => p.id !== promptId);
  await saveData('prompts', window.appState.prompts);
  
  showToast('Prompt deleted', 'success');
  closePromptEditor();
  renderPrompts();
  renderFavorites();
};

window.closePromptEditor = function() {
  const modal = document.querySelector('.modal-overlay');
  if (modal) {
    modal.classList.remove('visible');
    setTimeout(() => modal.remove(), 250);
  }
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
