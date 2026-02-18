// Promptory Onboarding Tutorial Module v8
// ФИНАЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ - все баги исправлены

(function() {
'use strict';

const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log('🎯 [Tutorial]', ...args);
}

const STEPS = [
  {
    id: 1,
    title: { en: 'Create Your First Prompt', ru: 'Создайте первый промпт' },
    description: {
      en: 'Click the "+ New" button',
      ru: 'Нажмите кнопку "+ New"'
    },
    target: '#new-prompt-btn',
    nextAction: 'click',
    tooltipPosition: 'bottom'
  },
  {
    id: 2,
    title: { en: 'Fill & Create', ru: 'Заполните и создайте' },
    description: {
      en: 'Title and text filled automatically. Click "Create Prompt"',
      ru: 'Заголовок и текст заполнены автоматически. Нажмите "Create Prompt"'
    },
    target: '#pe-save-btn',
    autoFill: true,
    nextAction: 'click',
    waitForModal: true,
    tooltipPosition: 'bottom'
  },
  {
    id: 3,
    title: { en: 'Create a Folder', ru: 'Создайте папку' },
    description: {
      en: 'Click "+ New Folder" button',
      ru: 'Нажмите кнопку "+ New Folder"'
    },
    target: '#new-folder-btn',
    nextAction: 'click',
    tooltipPosition: 'bottom',
    ensureVisible: true,
    switchTab: 'folders' // ✅ ПЕРЕКЛЮЧИТЬСЯ НА ТАБ FOLDERS
  },
  {
    id: 4,
    title: { en: 'Name Your Folder', ru: 'Назовите папку' },
    description: {
      en: 'Name filled automatically. Click "Create Folder"',
      ru: 'Название заполнено автоматически. Нажмите "Create Folder"'
    },
    target: '#fe-save-btn',
    autoFillFolder: true,
    nextAction: 'click',
    waitForModal: true,
    tooltipPosition: 'bottom'
  },
  {
    id: 5,
    title: { en: 'Open Settings', ru: 'Откройте Настройки' },
    description: {
      en: 'Click the Settings icon (⚙️)',
      ru: 'Нажмите иконку Настройки (⚙️)'
    },
    target: '#settings-btn',
    nextAction: 'click',
    tooltipPosition: 'left',
    switchTab: 'prompts' // ✅ ПЕРЕКЛЮЧИТЬСЯ НАЗАД НА PROMPTS
  },
  {
    id: 6,
    title: { en: 'Quick Insert Section', ru: 'Секция Быстрой Вставки' },
    description: {
      en: 'Scroll to "Quick Insert" section below',
      ru: 'Прокрутите к секции "Quick Insert"'
    },
    target: '[data-hotkey-section]',
    scrollTo: true,
    wait: 1000,
    tooltipPosition: 'top',
    switchTab: 'prompts' // ✅ УБЕДИТЬСЯ ЧТО МЫ НА PROMPTS
  },
  {
    id: 7,
    title: { en: 'Select Prompt for Slot 1', ru: 'Выберите промпт для Slot 1' },
    description: {
      en: 'Click dropdown and select a prompt',
      ru: 'Кликните dropdown и выберите промпт'
    },
    target: '[data-hotkey-slot="1"]',
    nextAction: 'click',
    tooltipPosition: 'bottom'
  },
  {
    id: 8,
    title: { en: 'Save Settings', ru: 'Сохраните настройки' },
    description: {
      en: 'Click "Save Changes" button',
      ru: 'Нажмите кнопку "Save Changes"'
    },
    target: '#settings-save-btn',
    nextAction: 'click',
    closeSettings: true,
    tooltipPosition: 'top'
  },
  {
    id: 9,
    title: { en: 'You\'re Ready!', ru: 'Вы готовы!' },
    description: {
      en: 'All set! Start using Promptory',
      ru: 'Всё готово! Начните использовать Promptory'
    },
    target: null,
    final: true
  }
];

class OnboardingTutorial {
  constructor() {
    this.currentStep = 0;
    this.overlay = null;
    this.tutorial = null;
    this.spotlight = null;
    this.onComplete = null;
    this.checkInterval = null;
  }

  async start(onComplete) {
    this.onComplete = onComplete;
    this.currentStep = 0;
    
    log('=== STARTING TUTORIAL ===');
    
    this.overlay = document.createElement('div');
    this.overlay.className = 'onboarding-overlay';
    document.body.appendChild(this.overlay);
    
    this.spotlight = document.createElement('div');
    this.spotlight.className = 'onboarding-spotlight';
    this.spotlight.style.display = 'none';
    document.body.appendChild(this.spotlight);
    
    await this.nextFrame();
    this.overlay.classList.add('visible');
    
    await this.showStep(0);
  }

  async showStep(stepIndex) {
    const step = STEPS[stepIndex];
    log(`Step ${step.id}/${STEPS.length}: ${step.target || 'FINAL'}`);
    
    if (this.tutorial) {
      this.tutorial.classList.remove('visible');
      await this.wait(150);
      this.tutorial.remove();
    }
    
    this.tutorial = document.createElement('div');
    this.tutorial.className = 'onboarding-tutorial';
    this.tutorial.innerHTML = this.renderTutorial(step);
    document.body.appendChild(this.tutorial);
    
    await this.nextFrame();
    this.tutorial.classList.add('visible');
    
    // Переключаем таб если нужно
    if (step.switchTab) {
      log(`Switching to tab: ${step.switchTab}`);
      const tabBtn = document.querySelector(`[data-tab="${step.switchTab}"]`);
      if (tabBtn) {
        tabBtn.click();
        await this.wait(300); // Ждём переключения таба
      }
    }
    
    if (step.target) {
      const target = document.querySelector(step.target);
      
      if (target) {
        log(`✅ Target found:`, target);
        
        // Прокручиваем если нужно
        if (step.ensureVisible || step.scrollTo) {
          await this.scrollToTarget(target);
        }
        
        // СНАЧАЛА позиционируем туториал
        this.positionTutorialNear(target, step.tooltipPosition);
        
        // ПОТОМ подсвечиваем элемент
        await this.highlightTarget(target);
        
      } else {
        log(`⏳ Target NOT found, waiting...`, step.target);
        
        if (step.waitForPrompt) {
          this.waitForElement('.prompt-card:first-child', (el) => {
            log(`✅ Prompt found!`);
            this.positionTutorialNear(el, step.tooltipPosition);
            this.highlightTarget(el);
          });
          return;
        } else if (step.waitForModal) {
          this.waitForElement(step.target, (el) => {
            log(`✅ Modal button found!`);
            this.positionTutorialNear(el, step.tooltipPosition);
            this.highlightTarget(el);
          });
          return;
        } else {
          log(`❌ Target not found, skipping...`);
          setTimeout(() => this.nextStep(), 1500);
          return;
        }
      }
    } else {
      log('Final step - centering');
      this.centerTutorial();
      this.hideHighlight();
    }
    
    this.setupInteraction(step);
    
    if (step.autoFill) setTimeout(() => this.autoFillPrompt(), 300);
    if (step.autoEdit) setTimeout(() => this.autoEditPrompt(), 300);
    if (step.autoFillFolder) setTimeout(() => this.autoFillFolder(), 300);
  }

  renderTutorial(step) {
    const lang = this.getLang();
    const totalSteps = STEPS.length;
    
    return `
      <div class="onboarding-tutorial-content">
        <div class="onboarding-step-badge">${step.id}/${totalSteps}</div>
        <div class="onboarding-title">${step.title[lang]}</div>
        <div class="onboarding-description">${step.description[lang]}</div>
        ${step.final ? `
          <button class="onboarding-btn onboarding-btn-primary" id="onboarding-finish">
            ${lang === 'ru' ? 'Начать использовать' : 'Get Started'}
          </button>
        ` : ''}
      </div>
    `;
  }

  positionTutorialNear(element, preferredPos = 'bottom') {
    const tutorialRect = this.tutorial.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth || 400;
    const viewportHeight = window.innerHeight || 600;
    
    log(`Positioning: element=${elementRect.width}x${elementRect.height} at (${elementRect.left},${elementRect.top}), tutorial=${tutorialRect.width}x${tutorialRect.height}`);
    
    let top, left;
    const gap = 12; // Отступ от элемента
    
    // Пробуем preferred позицию
    if (preferredPos === 'top') {
      top = elementRect.top - tutorialRect.height - gap;
      left = elementRect.left + (elementRect.width / 2) - (tutorialRect.width / 2);
    } else if (preferredPos === 'right') {
      top = elementRect.top + (elementRect.height / 2) - (tutorialRect.height / 2);
      left = elementRect.right + gap;
    } else if (preferredPos === 'left') {
      top = elementRect.top + (elementRect.height / 2) - (tutorialRect.height / 2);
      left = elementRect.left - tutorialRect.width - gap;
    } else { // bottom (по умолчанию)
      top = elementRect.bottom + gap;
      left = elementRect.left + (elementRect.width / 2) - (tutorialRect.width / 2);
    }
    
    log(`Preferred ${preferredPos}: top=${top}, left=${left}`);
    
    // Проверка границ viewport
    const margin = 8;
    
    // По горизонтали
    if (left < margin) {
      left = margin;
    }
    if (left + tutorialRect.width > viewportWidth - margin) {
      left = viewportWidth - tutorialRect.width - margin;
    }
    
    // По вертикали - если не влезает, меняем позицию
    if (top < margin) {
      // Слишком высоко - пробуем снизу
      if (preferredPos === 'top') {
        top = elementRect.bottom + gap;
        log('Switched to BOTTOM (no space at top)');
      } else {
        top = margin;
      }
    }
    if (top + tutorialRect.height > viewportHeight - margin) {
      // Слишком низко - пробуем сверху
      if (preferredPos === 'bottom') {
        top = elementRect.top - tutorialRect.height - gap;
        log('Switched to TOP (no space at bottom)');
      } else {
        top = viewportHeight - tutorialRect.height - margin;
      }
    }
    
    // Финальная проверка
    top = Math.max(margin, Math.min(top, viewportHeight - tutorialRect.height - margin));
    left = Math.max(margin, Math.min(left, viewportWidth - tutorialRect.width - margin));
    
    log(`Final position: top=${top}, left=${left}`);
    
    this.tutorial.style.position = 'fixed';
    this.tutorial.style.top = top + 'px';
    this.tutorial.style.left = left + 'px';
    this.tutorial.style.zIndex = '10000';
  }

  centerTutorial() {
    this.tutorial.style.position = 'fixed';
    this.tutorial.style.top = '50%';
    this.tutorial.style.left = '50%';
    this.tutorial.style.transform = 'translate(-50%, -50%)';
    this.tutorial.style.zIndex = '10000';
  }

  async highlightTarget(element) {
    if (!element) {
      this.hideHighlight();
      return;
    }
    
    const rect = element.getBoundingClientRect();
    const padding = 8;
    
    log(`Highlighting: ${rect.width}x${rect.height} at (${rect.left},${rect.top})`);
    
    // Добавляем класс элементу
    element.classList.add('onboarding-target-highlight');
    
    this.spotlight.style.display = 'block';
    this.spotlight.style.left = (rect.left - padding) + 'px';
    this.spotlight.style.top = (rect.top - padding) + 'px';
    this.spotlight.style.width = (rect.width + padding * 2) + 'px';
    this.spotlight.style.height = (rect.height + padding * 2) + 'px';
    this.spotlight.style.zIndex = '9999';
    
    this.overlay.style.background = 'rgba(0, 0, 0, 0.75)';
    this.updateOverlayHole(rect, padding);
  }

  hideHighlight() {
    document.querySelectorAll('.onboarding-target-highlight').forEach(el => {
      el.classList.remove('onboarding-target-highlight');
    });
    
    this.spotlight.style.display = 'none';
    this.overlay.style.background = 'transparent';
    this.overlay.style.clipPath = 'none';
  }

  updateOverlayHole(rect, padding) {
    this.overlay.style.clipPath = `
      polygon(
        0% 0%, 100% 0%, 100% ${rect.top - padding}px,
        ${rect.right + padding}px ${rect.top - padding}px,
        ${rect.right + padding}px ${rect.bottom + padding}px,
        100% ${rect.bottom + padding}px,
        100% 100%, 0% 100%,
        0% ${rect.bottom + padding}px,
        ${rect.left - padding}px ${rect.bottom + padding}px,
        ${rect.left - padding}px ${rect.top - padding}px,
        0% ${rect.top - padding}px
      )
    `;
  }

  setupInteraction(step) {
    if (step.final) {
      document.getElementById('onboarding-finish')?.addEventListener('click', () => {
        this.close();
        if (this.onComplete) this.onComplete();
      });
      return;
    }
    
    const target = document.querySelector(step.target);
    if (target) {
      target.style.cursor = 'pointer';
      target.style.zIndex = '10001';
      
      const handler = () => {
        target.removeEventListener('click', handler);
        log('Click detected, next step');
        this.nextStep();
      };
      
      target.addEventListener('click', handler, { once: true });
    }
    
    if (step.closeSettings) {
      setTimeout(() => {
        const closeBtn = document.querySelector('#settings-modal .close-modal-btn');
        if (closeBtn) {
          log('Auto-closing settings');
          closeBtn.click();
          this.nextStep();
        }
      }, 800);
    }
  }

  waitForElement(selector, callback) {
    if (this.checkInterval) clearInterval(this.checkInterval);
    
    let attempts = 0;
    this.checkInterval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
        callback(element);
      }
      attempts++;
      if (attempts > 50) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
        log(`⏰ Timeout waiting for ${selector}`);
        this.nextStep();
      }
    }, 200);
  }

  async scrollToTarget(element) {
    if (!element) return;
    log('Scrolling to target');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.wait(600);
  }

  autoFillPrompt() {
    const titleInput = document.getElementById('pe-title');
    const textInput = document.getElementById('pe-text');
    
    if (titleInput && textInput) {
      const lang = this.getLang();
      titleInput.value = lang === 'ru' ? 'Мой первый промпт' : 'My First Prompt';
      textInput.value = lang === 'ru' 
        ? 'Это мой первый промпт для Promptory!' 
        : 'This is my first prompt for Promptory!';
      
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      textInput.dispatchEvent(new Event('input', { bubbles: true }));
      log('Auto-filled prompt');
    }
  }

  autoEditPrompt() {
    const textInput = document.getElementById('pe-text');
    
    if (textInput) {
      const lang = this.getLang();
      textInput.value += lang === 'ru' 
        ? '\n\nДополнительный текст для примера.' 
        : '\n\nAdditional example text.';
      
      textInput.dispatchEvent(new Event('input', { bubbles: true }));
      log('Auto-edited prompt');
    }
  }

  autoFillFolder() {
    const nameInput = document.getElementById('fe-name');
    
    if (nameInput) {
      const lang = this.getLang();
      nameInput.value = lang === 'ru' ? 'Мои промпты' : 'My Prompts';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      log('Auto-filled folder');
    }
  }

  nextStep() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.currentStep++;
    if (this.currentStep < STEPS.length) {
      this.showStep(this.currentStep);
    } else {
      this.close();
      if (this.onComplete) this.onComplete();
    }
  }

  close() {
    log('=== CLOSING TUTORIAL ===');
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    document.querySelectorAll('.onboarding-target-highlight').forEach(el => {
      el.classList.remove('onboarding-target-highlight');
    });
    
    if (this.overlay) {
      this.overlay.classList.remove('visible');
      this.overlay.style.clipPath = 'none';
      setTimeout(() => this.overlay?.remove(), 300);
    }
    if (this.tutorial) {
      this.tutorial.classList.remove('visible');
      setTimeout(() => this.tutorial?.remove(), 300);
    }
    if (this.spotlight) {
      this.spotlight.remove();
    }
    
    chrome.storage.local.set({ onboardingTutorialComplete: true });
  }

  getLang() {
    return navigator.language.startsWith('ru') ? 'ru' : 'en';
  }

  nextFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve));
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

window.OnboardingTutorial = OnboardingTutorial;

})();
