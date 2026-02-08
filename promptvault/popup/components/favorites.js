// Favorites functionality
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
      </div>
    `;
    return;
  }
  
  favoritesList.innerHTML = favorites.map((prompt, index) => renderFavoriteCard(prompt, index)).join('');
  attachFavoriteListeners();
}

function renderFavoriteCard(prompt, index) {
  return `
    <div class="prompt-card" data-prompt-id="${prompt.id}" style="animation-delay: ${index * 40}ms">
      <div class="prompt-card-header">
        <div class="prompt-title">${escapeHtml(prompt.title)}</div>
        <div class="prompt-actions">
          <button class="prompt-action-btn active" 
                  onclick="toggleFavorite('${prompt.id}')" 
                  title="Remove from favorites">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
