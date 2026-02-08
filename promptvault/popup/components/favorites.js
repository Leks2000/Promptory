// Favorites functionality
import { showToast, saveData } from '../popup.js';
import { renderPrompts } from './prompts.js';

export function initFavorites() {
  renderFavorites();
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.prompts) {
      window.appState.prompts = changes.prompts.newValue || [];
      renderFavorites();
    }
  });
}

export function renderFavorites() {
  const favoritesList = document.getElementById('favorites-list');
  const favorites = window.appState.prompts.filter(p => p.isFavorite);
  
  if (favorites.length === 0) {
    favoritesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⭐</div>
        <div class="empty-state-title">No favorites yet</div>
        <div class="empty-state-text">Star prompts to see them here for quick access</div>
        <button class="btn btn-secondary ripple" onclick="document.querySelector('[data-tab=\\'prompts\\']').click()">
          Browse Prompts
        </button>
      </div>
    `;
    return;
  }
  
  // Add header with count
  let html = `
    <div class="favorites-header">
      <span class="favorites-header-icon">⭐</span>
      <span class="favorites-header-title">Favorites</span>
      <span class="favorites-count">${favorites.length} prompt${favorites.length !== 1 ? 's' : ''}</span>
    </div>
  `;
  
  html += favorites.map((prompt, index) => renderFavoriteCard(prompt, index)).join('');
  
  favoritesList.innerHTML = html;
  attachFavoriteListeners();
}

function renderFavoriteCard(prompt, index) {
  const folderName = prompt.folderId 
    ? window.appState.folders.find(f => f.id === prompt.folderId)?.name || 'Unknown' 
    : null;
    
  return `
    <div class="prompt-card favorite-card" data-prompt-id="${prompt.id}" style="animation-delay: ${index * 40}ms">
      <div class="prompt-card-header">
        <div class="prompt-title">${escapeHtml(prompt.title)}</div>
        <div class="prompt-actions">
          <button class="prompt-action-btn copy-btn" 
                  onclick="event.stopPropagation(); copyFavoritePrompt('${prompt.id}')" 
                  title="Copy prompt">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="prompt-action-btn active" 
                  onclick="event.stopPropagation(); toggleFavoriteFromList('${prompt.id}')" 
                  title="Remove from favorites">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <button class="prompt-action-btn" 
                  onclick="event.stopPropagation(); showContextMenu(event, '${prompt.id}')" 
                  title="More actions">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="12" cy="5" r="1"/>
              <circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
        </div>
      </div>
      ${folderName ? `
        <div class="prompt-folder-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          ${escapeHtml(folderName)}
        </div>
      ` : ''}
      ${prompt.tags && prompt.tags.length > 0 ? `
        <div class="tags">
          ${prompt.tags.slice(0, 3).map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
          ${prompt.tags.length > 3 ? `<span class="tag">+${prompt.tags.length - 3}</span>` : ''}
        </div>
      ` : ''}
      <div class="prompt-meta">
        <span class="prompt-stat">Used ${prompt.useCount || 0} times</span>
        ${prompt.updatedAt ? `<span class="prompt-stat">Updated ${formatDate(prompt.updatedAt)}</span>` : ''}
      </div>
    </div>
  `;
}

function attachFavoriteListeners() {
  const promptCards = document.querySelectorAll('#favorites-list .prompt-card');
  
  promptCards.forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.prompt-action-btn')) {
        return;
      }
      
      const promptId = card.getAttribute('data-prompt-id');
      const event = new CustomEvent('open-prompt-editor', { detail: { promptId } });
      document.dispatchEvent(event);
    });
  });
}

window.copyFavoritePrompt = async function(promptId) {
  const prompt = window.appState.prompts.find(p => p.id === promptId);
  if (!prompt) return;
  
  try {
    await navigator.clipboard.writeText(prompt.text);
    
    // Increment use count
    prompt.useCount = (prompt.useCount || 0) + 1;
    await saveData('prompts', window.appState.prompts);
    
    showToast('Copied to clipboard', 'success');
    renderFavorites();
  } catch (err) {
    showToast('Failed to copy', 'error');
  }
};

window.toggleFavoriteFromList = async function(promptId) {
  const prompt = window.appState.prompts.find(p => p.id === promptId);
  if (!prompt) return;
  
  prompt.isFavorite = !prompt.isFavorite;
  await saveData('prompts', window.appState.prompts);
  
  showToast(prompt.isFavorite ? 'Added to favorites' : 'Removed from favorites', 'success');
  renderFavorites();
  renderPrompts();
};

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 7) {
    return date.toLocaleDateString();
  } else if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return 'Just now';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
