// Promptory Search Filters Module
// Фильтры для поиска промптов

(function() {
'use strict';

class SearchFilters {
  constructor() {
    this.activeFilters = {
      platform: 'all',
      category: 'all',
      tags: [],
      hasVariables: false,
      favoritesOnly: false,
      popularOnly: false
    };
    this.availableTags = [];
    this.availableCategories = [];
    this.onFilterChange = null;
    this.currentTab = 'prompts'; // prompts, library, etc.
  }

  init(options = {}) {
    this.onFilterChange = options.onFilterChange;
    this.currentTab = options.currentTab || 'prompts';
    
    // Load tags/categories
    this.loadAvailableFilters();
    
    // Create filter button
    this.createFilterButton();
    
    // Create filter dropdown
    this.createFilterDropdown();
    
    // Setup event listeners
    this.setupListeners();
  }

  createFilterButton() {
    const searchBar = document.querySelector('.search-bar');
    if (!searchBar) return;
    
    const filterBtn = document.createElement('button');
    filterBtn.className = 'search-filter-btn';
    filterBtn.id = 'search-filter-btn';
    filterBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
      <span class="filter-count-badge" style="display: none;">0</span>
    `;
    
    searchBar.appendChild(filterBtn);
  }

  createFilterDropdown() {
    const filterBtn = document.getElementById('search-filter-btn');
    if (!filterBtn) return;
    
    const dropdown = document.createElement('div');
    dropdown.className = 'filter-dropdown';
    dropdown.id = 'search-filter-dropdown';
    dropdown.innerHTML = this.renderDropdown();
    
    filterBtn.parentElement.style.position = 'relative';
    filterBtn.parentElement.appendChild(dropdown);
  }

  renderDropdown() {
    const lang = this.getLang();
    const isLibrary = this.currentTab === 'explore' || this.currentTab === 'stats';
    
    return `
      <div class="filter-dropdown-title">
        ${lang === 'ru' ? 'Фильтры' : 'Filters'}
      </div>
      
      <div class="filter-group">
        <label class="filter-label">${lang === 'ru' ? 'Платформа' : 'Platform'}</label>
        <select class="filter-select" id="filter-platform">
          <option value="all">${lang === 'ru' ? 'Все' : 'All'}</option>
          <option value="chatgpt">ChatGPT</option>
          <option value="claude">Claude</option>
          <option value="gemini">Gemini</option>
          <option value="perplexity">Perplexity</option>
          <option value="poe">Poe</option>
          <option value="other">${lang === 'ru' ? 'Другие' : 'Other'}</option>
        </select>
      </div>
      
      ${isLibrary ? `
      <div class="filter-group">
        <label class="filter-label">${lang === 'ru' ? 'Категория' : 'Category'}</label>
        <select class="filter-select" id="filter-category">
          <option value="all">${lang === 'ru' ? 'Все' : 'All'}</option>
          ${this.availableCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
        </select>
      </div>
      
      <div class="filter-group">
        <label class="filter-checkbox">
          <input type="checkbox" id="filter-popular">
          <span>${lang === 'ru' ? 'Только популярные' : 'Only popular'}</span>
        </label>
      </div>
      ` : `
      <div class="filter-group">
        <label class="filter-label">${lang === 'ru' ? 'Теги' : 'Tags'}</label>
        <div class="filter-tags-container" id="filter-tags">
          ${this.availableTags.slice(0, 15).map(tag => `
            <div class="filter-tag" data-tag="${tag}">
              <span>${tag}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="filter-group">
        <label class="filter-checkbox">
          <input type="checkbox" id="filter-variables">
          <span>${lang === 'ru' ? 'С переменными' : 'Has variables'}</span>
        </label>
      </div>
      
      ${this.currentTab !== 'folders' ? `
      <div class="filter-group">
        <label class="filter-checkbox">
          <input type="checkbox" id="filter-favorites">
          <span>${lang === 'ru' ? 'Только избранные' : 'Only favorites'}</span>
        </label>
      </div>
      ` : ''}
      `}
      
      <div class="filter-footer">
        <button class="filter-btn filter-btn-clear" id="filter-clear">
          ${lang === 'ru' ? 'Сбросить' : 'Clear'}
        </button>
      </div>
    `;
  }

  setupListeners() {
    const filterBtn = document.getElementById('search-filter-btn');
    const dropdown = document.getElementById('search-filter-dropdown');
    
    if (!filterBtn || !dropdown) return;
    
    // Toggle dropdown
    filterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('visible');
      filterBtn.classList.toggle('active');
      this.updateFilterCount();
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== filterBtn) {
        dropdown.classList.remove('visible');
        filterBtn.classList.remove('active');
      }
    });
    
    // Filter changes
    dropdown.querySelector('#filter-platform')?.addEventListener('change', (e) => {
      this.activeFilters.platform = e.target.value;
      this.onFilterChange?.(this.getActiveFilters());
    });
    
    dropdown.querySelector('#filter-category')?.addEventListener('change', (e) => {
      this.activeFilters.category = e.target.value;
      this.onFilterChange?.(this.getActiveFilters());
    });
    
    dropdown.querySelector('#filter-variables')?.addEventListener('change', (e) => {
      this.activeFilters.hasVariables = e.target.checked;
      this.onFilterChange?.(this.getActiveFilters());
    });
    
    dropdown.querySelector('#filter-favorites')?.addEventListener('change', (e) => {
      this.activeFilters.favoritesOnly = e.target.checked;
      this.onFilterChange?.(this.getActiveFilters());
    });
    
    dropdown.querySelector('#filter-popular')?.addEventListener('change', (e) => {
      this.activeFilters.popularOnly = e.target.checked;
      this.onFilterChange?.(this.getActiveFilters());
    });
    
    // Tag selection
    dropdown.querySelectorAll('.filter-tag').forEach(tagEl => {
      tagEl.addEventListener('click', () => {
        const tag = tagEl.dataset.tag;
        const index = this.activeFilters.tags.indexOf(tag);
        
        if (index > -1) {
          this.activeFilters.tags.splice(index, 1);
          tagEl.classList.remove('selected');
        } else {
          this.activeFilters.tags.push(tag);
          tagEl.classList.add('selected');
        }
        
        this.onFilterChange?.(this.getActiveFilters());
        this.updateFilterCount();
      });
    });
    
    // Clear button
    dropdown.querySelector('#filter-clear')?.addEventListener('click', () => {
      this.resetFilters();
    });
  }

  async loadAvailableFilters() {
    const lang = this.getLang();
    
    // Load tags from user's prompts
    if (window.Promptory?.state?.prompts) {
      const allTags = window.Promptory.state.prompts
        .flatMap(p => p.tags || [])
        .filter(Boolean);
      
      // Get top 15 most used tags
      const tagCounts = {};
      allTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
      
      this.availableTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([tag]) => tag);
    }
    
    // Load categories from library (if available)
    if (window.Promptory?.state?.libraryPrompts) {
      const categories = new Set(
        window.Promptory.state.libraryPrompts
          .map(p => p.category)
          .filter(Boolean)
      );
      this.availableCategories = Array.from(categories).sort();
    }
  }

  getActiveFilters() {
    return { ...this.activeFilters };
  }

  resetFilters() {
    this.activeFilters = {
      platform: 'all',
      category: 'all',
      tags: [],
      hasVariables: false,
      favoritesOnly: false,
      popularOnly: false
    };
    
    const dropdown = document.getElementById('search-filter-dropdown');
    if (dropdown) {
      dropdown.querySelector('#filter-platform').value = 'all';
      dropdown.querySelector('#filter-category').value = 'all';
      dropdown.querySelector('#filter-variables').checked = false;
      dropdown.querySelector('#filter-favorites').checked = false;
      dropdown.querySelector('#filter-popular').checked = false;
      dropdown.querySelectorAll('.filter-tag').forEach(el => el.classList.remove('selected'));
    }
    
    this.onFilterChange?.(this.getActiveFilters());
    this.updateFilterCount();
  }

  updateFilterCount() {
    const count = 
      (this.activeFilters.platform !== 'all' ? 1 : 0) +
      (this.activeFilters.category !== 'all' ? 1 : 0) +
      (this.activeFilters.tags.length > 0 ? 1 : 0) +
      (this.activeFilters.hasVariables ? 1 : 0) +
      (this.activeFilters.favoritesOnly ? 1 : 0) +
      (this.activeFilters.popularOnly ? 1 : 0);
    
    const badge = document.querySelector('.filter-count-badge');
    if (badge) {
      badge.style.display = count > 0 ? 'inline-block' : 'none';
      badge.textContent = count;
    }
  }

  setCurrentTab(tab) {
    this.currentTab = tab;
    this.loadAvailableFilters();
    
    // Re-render dropdown
    const dropdown = document.getElementById('search-filter-dropdown');
    if (dropdown) {
      dropdown.innerHTML = this.renderDropdown();
      this.setupListeners();
    }
  }

  getLang() {
    return navigator.language.startsWith('ru') ? 'ru' : 'en';
  }
}

// Export
window.SearchFilters = SearchFilters;

})();
