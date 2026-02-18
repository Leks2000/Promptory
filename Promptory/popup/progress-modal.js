// Promptory Progress Modal Module
// Показывает прогресс импорта/экспорта с возможностью отмены

(function() {
'use strict';

class ProgressModal {
  constructor() {
    this.overlay = null;
    this.modal = null;
    this.isCancelled = false;
    this.startTime = null;
    this.totalItems = 0;
    this.processedItems = 0;
    this.onCancel = null;
  }

  show(options = {}) {
    const {
      title = { en: 'Importing Data', ru: 'Импорт данных' },
      total = 0,
      onCancel = null
    } = options;

    this.totalItems = total;
    this.processedItems = 0;
    this.isCancelled = false;
    this.startTime = Date.now();
    this.onCancel = onCancel;

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'progress-modal-overlay';
    
    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'progress-modal';
    this.modal.innerHTML = this.renderModal(title);
    
    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);
    
    // Force reflow
    this.nextFrame();
    
    // Show
    this.overlay.classList.add('visible');
    
    // Setup cancel button
    this.modal.querySelector('.progress-cancel-btn')?.addEventListener('click', () => {
      this.cancel();
    });
  }

  renderModal(titleObj) {
    const lang = this.getLang();
    const title = titleObj[lang] || titleObj.en;
    
    return `
      <div class="progress-header">
        <div class="progress-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div class="progress-title">${title}</div>
      </div>
      
      <div class="progress-bar-container">
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width: 0%"></div>
        </div>
        <div class="progress-info">
          <span class="progress-count">0/${total}</span>
          <span class="progress-eta">~${this.formatETA(lang)}</span>
        </div>
      </div>
      
      <div class="progress-action">
        ${lang === 'ru' ? 'Подготовка...' : 'Preparing...'}
      </div>
      
      <div class="progress-footer">
        <button class="progress-cancel-btn">
          ${lang === 'ru' ? 'Отмена' : 'Cancel'}
        </button>
      </div>
    `;
  }

  update(processed, currentItemName = '') {
    if (!this.modal) return;
    
    this.processedItems = processed;
    const percent = this.totalItems > 0 ? Math.min((processed / this.totalItems) * 100, 100) : 0;
    
    // Update progress bar
    const fill = this.modal.querySelector('.progress-bar-fill');
    if (fill) {
      fill.style.width = percent + '%';
    }
    
    // Update count
    const count = this.modal.querySelector('.progress-count');
    if (count) {
      count.textContent = `${processed}/${this.totalItems}`;
    }
    
    // Update ETA
    const eta = this.modal.querySelector('.progress-eta');
    if (eta) {
      eta.textContent = '~' + this.calculateETA(processed);
    }
    
    // Update current action
    const action = this.modal.querySelector('.progress-action');
    if (action) {
      const lang = this.getLang();
      if (currentItemName) {
        action.textContent = lang === 'ru' 
          ? `Импорт '${currentItemName}'...` 
          : `Importing '${currentItemName}'...`;
      } else {
        action.textContent = lang === 'ru' ? 'Подготовка...' : 'Preparing...';
      }
    }
  }

  complete() {
    if (!this.modal) return;
    
    // Set to 100%
    this.update(this.totalItems, '');
    
    // Add success state
    this.modal.classList.add('success');
    
    // Update title
    const lang = this.getLang();
    const title = this.modal.querySelector('.progress-title');
    if (title) {
      title.textContent = lang === 'ru' ? 'Готово!' : 'Complete!';
    }
    
    // Update icon
    const icon = this.modal.querySelector('.progress-icon svg');
    if (icon) {
      icon.innerHTML = `
        <polyline points="20 6 9 17 4 12"/>
      `;
    }
    
    // Change button to OK
    const btn = this.modal.querySelector('.progress-cancel-btn');
    if (btn) {
      btn.textContent = lang === 'ru' ? 'OK' : 'OK';
      btn.onclick = () => this.close();
    }
    
    // Hide cancel button after 1 sec
    setTimeout(() => {
      if (btn) btn.style.display = 'none';
    }, 1000);
  }

  cancel() {
    this.isCancelled = true;
    
    // Update UI
    this.modal.classList.add('error');
    
    const lang = this.getLang();
    const title = this.modal.querySelector('.progress-title');
    if (title) {
      title.textContent = lang === 'ru' ? 'Отменено' : 'Cancelled';
    }
    
    const icon = this.modal.querySelector('.progress-icon svg');
    if (icon) {
      icon.innerHTML = `
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      `;
    }
    
    const btn = this.modal.querySelector('.progress-cancel-btn');
    if (btn) {
      btn.textContent = lang === 'ru' ? 'Закрыть' : 'Close';
      btn.onclick = () => this.close();
    }
    
    // Call onCancel callback
    if (this.onCancel) {
      this.onCancel();
    }
    
    // Show toast
    const toast = { en: 'Import cancelled', ru: 'Импорт отменён' }[lang];
    this.showToast(toast, 'error');
    
    // Close after 1 sec
    setTimeout(() => this.close(), 1000);
  }

  close() {
    if (this.overlay) {
      this.overlay.classList.remove('visible');
      setTimeout(() => {
        this.overlay?.remove();
        this.modal = null;
        this.overlay = null;
      }, 300);
    }
  }

  calculateETA(processed) {
    if (processed === 0 || this.totalItems === 0) return '...';
    
    const elapsed = Date.now() - this.startTime;
    const perItem = elapsed / processed;
    const remaining = this.totalItems - processed;
    const etaMs = perItem * remaining;
    
    if (etaMs < 1000) return '< 1s';
    if (etaMs < 60000) return Math.round(etaMs / 1000) + 's';
    return Math.round(etaMs / 60000) + ' sec';
  }

  formatETA(lang) {
    return lang === 'ru' ? 'сек' : 'sec';
  }

  showToast(message, type = 'info') {
    // Используем существующую функцию showToast из popup.js
    if (window.Promptory?.showToast) {
      window.Promptory.showToast(message, type);
    }
  }

  getLang() {
    return navigator.language.startsWith('ru') ? 'ru' : 'en';
  }

  nextFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve));
  }

  isCancelledFlag() {
    return this.isCancelled;
  }
}

// Export
window.ProgressModal = ProgressModal;

})();
