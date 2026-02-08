// Search functionality
import { renderPrompts } from './prompts.js';

let searchTimeout;
let originalPrompts = [];

export function initSearch() {
  const searchInput = document.getElementById('search-input');
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(e.target.value.trim());
    }, 200); // Debounce 200ms
  });
}

function performSearch(query) {
  if (!query) {
    // Restore original prompts
    if (originalPrompts.length > 0) {
      window.appState.prompts = originalPrompts;
      originalPrompts = [];
    }
    renderPrompts();
    return;
  }
  
  // Save original prompts if first search
  if (originalPrompts.length === 0) {
    originalPrompts = [...window.appState.prompts];
  }
  
  const lowerQuery = query.toLowerCase();
  
  // Search in title, description, tags, and text
  const results = originalPrompts.filter(prompt => {
    const titleMatch = prompt.title.toLowerCase().includes(lowerQuery);
    const descMatch = prompt.description && prompt.description.toLowerCase().includes(lowerQuery);
    const tagsMatch = prompt.tags && prompt.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
    const textMatch = prompt.text.toLowerCase().includes(lowerQuery);
    
    return titleMatch || descMatch || tagsMatch || textMatch;
  });
  
  window.appState.prompts = results;
  renderPrompts();
  
  // Show "no results" if empty
  if (results.length === 0) {
    const promptsList = document.getElementById('prompts-list');
    promptsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">No prompts found</div>
        <div class="empty-state-text">Try searching with different keywords</div>
      </div>
    `;
  }
}
