// Explore public prompts functionality
import { showToast, saveData } from '../popup.js';

let explorePrompts = [];
let flippedCards = new Set();

export function initExplore() {
  renderExplore();
  
  // Load public prompts (mock data for now since Supabase isn't configured)
  loadExplorePrompts();
}

async function loadExplorePrompts() {
  // Mock data - in production this would fetch from Supabase
  const mockPrompts = [
    {
      id: 'explore-1',
      title: 'Professional Email Writer',
      text: 'Write a professional email about {topic} to {recipient}. The tone should be {tone}.',
      author: 'PromptMaster',
      likes: 245,
      downloads: 1200,
      tags: ['business', 'communication'],
      icon: '✉️'
    },
    {
      id: 'explore-2',
      title: 'Code Review Assistant',
      text: 'Review the following code and provide constructive feedback on:\n1. Code quality\n2. Best practices\n3. Potential bugs\n4. Performance improvements\n\nCode: {code}',
      author: 'DevGuru',
      likes: 189,
      downloads: 950,
      tags: ['coding', 'review'],
      icon: '💻'
    },
    {
      id: 'explore-3',
      title: 'Social Media Caption',
      text: 'Create an engaging social media caption for {platform} about {topic}. Include relevant hashtags and emojis.',
      author: 'ContentQueen',
      likes: 312,
      downloads: 1500,
      tags: ['marketing', 'social'],
      icon: '📱'
    },
    {
      id: 'explore-4',
      title: 'Meeting Summarizer',
      text: 'Summarize the following meeting notes into:\n1. Key decisions made\n2. Action items with owners\n3. Next steps\n\nNotes: {notes}',
      author: 'ProductivityPro',
      likes: 156,
      downloads: 780,
      tags: ['productivity', 'business'],
      icon: '📊'
    }
  ];
  
  explorePrompts = mockPrompts;
  renderExplore();
}

export function renderExplore() {
  const exploreList = document.getElementById('explore-list');
  
  if (!window.appState.user) {
    exploreList.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🌐</div>
        <div class="empty-state-title">Sign in to explore</div>
        <div class="empty-state-text">Discover and save public prompts from the community</div>
        <button class="btn btn-primary ripple" onclick="document.getElementById('settings-btn').click()">
          Sign In
        </button>
      </div>
    `;
    return;
  }
  
  if (explorePrompts.length === 0) {
    exploreList.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🌐</div>
        <div class="empty-state-title">No public prompts yet</div>
        <div class="empty-state-text">Check back soon for community prompts</div>
      </div>
    `;
    return;
  }
  
  exploreList.innerHTML = explorePrompts.map((prompt, index) => renderExploreCard(prompt, index)).join('');
  attachExploreListeners();
}

function renderExploreCard(prompt, index) {
  const isFlipped = flippedCards.has(prompt.id);
  
  return `
    <div class="explore-card-wrapper" data-prompt-id="${prompt.id}" style="animation-delay: ${index * 40}ms">
      <div class="explore-card ${isFlipped ? 'flipped' : ''}">
        <div class="explore-card-front">
          <div class="explore-card-thumbnail">${prompt.icon || '📝'}</div>
          <div class="explore-card-title">${escapeHtml(prompt.title)}</div>
          <div class="explore-card-meta">
            <span class="explore-card-author">${escapeHtml(prompt.author)}</span>
            <div class="explore-card-stats">
              <span title="Likes">❤️ ${prompt.likes}</span>
            </div>
          </div>
        </div>
        <div class="explore-card-back">
          <div class="explore-card-text">${escapeHtml(prompt.text)}</div>
          ${prompt.tags && prompt.tags.length > 0 ? `
            <div class="tags">
              ${prompt.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}
          <div class="explore-card-actions">
            <button class="btn btn-secondary btn-sm ripple" onclick="copyExplorePrompt('${prompt.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy
            </button>
            <button class="btn btn-primary btn-sm ripple" onclick="saveExplorePrompt('${prompt.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function attachExploreListeners() {
  const cards = document.querySelectorAll('.explore-card-wrapper');
  
  cards.forEach(wrapper => {
    const card = wrapper.querySelector('.explore-card');
    const promptId = wrapper.getAttribute('data-prompt-id');
    
    wrapper.addEventListener('click', (e) => {
      // Don't flip if clicking on buttons
      if (e.target.closest('button')) {
        return;
      }
      
      const isFlipped = card.classList.contains('flipped');
      
      if (isFlipped) {
        card.classList.remove('flipped');
        flippedCards.delete(promptId);
      } else {
        card.classList.add('flipped');
        flippedCards.add(promptId);
      }
    });
  });
}

window.copyExplorePrompt = async function(promptId) {
  const prompt = explorePrompts.find(p => p.id === promptId);
  if (!prompt) return;
  
  try {
    await navigator.clipboard.writeText(prompt.text);
    showToast('Copied to clipboard', 'success');
  } catch (err) {
    showToast('Failed to copy', 'error');
  }
};

window.saveExplorePrompt = async function(promptId) {
  const explorePrompt = explorePrompts.find(p => p.id === promptId);
  if (!explorePrompt) return;
  
  // Create a new prompt from the explore prompt
  const newPrompt = {
    id: Date.now().toString(),
    title: explorePrompt.title,
    text: explorePrompt.text,
    description: `From ${explorePrompt.author}`,
    tags: explorePrompt.tags || [],
    folderId: null,
    isFavorite: false,
    useCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  window.appState.prompts.push(newPrompt);
  await saveData('prompts', window.appState.prompts);
  
  showToast('Saved to your library', 'success');
  
  // Switch to prompts tab
  setTimeout(() => {
    document.querySelector('[data-tab="prompts"]').click();
  }, 500);
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
