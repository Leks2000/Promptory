// Promptory Onboarding Tutorial Module v9
// COMPLETE REWRITE - covers all 6 key features:
// 1. Insert prompt (MAIN feature)
// 2. Copy prompt
// 3. Favorites
// 4. Search
// 5. Edit prompt
// 6. Explore library

(function() {
'use strict';

const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log('[Tutorial]', ...args);
}

const STEPS = [
  // === STEP 1: Create a prompt (prerequisite for everything) ===
  {
    id: 1,
    title: { en: 'Create Your First Prompt', ru: 'Создайте первый промпт' },
    description: {
      en: 'Click the "+ New" button to create a prompt.',
      ru: 'Нажмите кнопку "+ New", чтобы создать промпт.'
    },
    target: '#new-prompt-btn',
    nextAction: 'click',
    tooltipPosition: 'bottom',
    icon: 'create'
  },
  // === STEP 2: Auto-fill and save prompt ===
  {
    id: 2,
    title: { en: 'Fill & Create', ru: 'Заполните и создайте' },
    description: {
      en: 'Title and text are filled for you. Click "Create Prompt" to save.',
      ru: 'Заголовок и текст заполнены. Нажмите "Create Prompt" чтобы сохранить.'
    },
    target: '#pe-save-btn',
    autoFill: true,
    nextAction: 'click',
    waitForModal: true,
    tooltipPosition: 'bottom',
    icon: 'save'
  },
  // === STEP 3: INSERT - the MAIN feature ===
  {
    id: 3,
    title: { en: 'Insert Prompt (Main Feature!)', ru: 'Вставка промпта (Главная функция!)' },
    description: {
      en: 'Click the arrow button to insert this prompt directly into any AI chat. This is the core feature of Promptory!',
      ru: 'Нажмите кнопку со стрелкой, чтобы вставить промпт в любой AI-чат. Это главная функция Promptory!'
    },
    target: '.prompt-card:first-child [data-action="insert"]',
    waitForPrompt: true,
    nextAction: 'click',
    tooltipPosition: 'bottom',
    icon: 'insert',
    highlight: 'primary'
  },
  // === STEP 4: COPY prompt ===
  {
    id: 4,
    title: { en: 'Copy Prompt', ru: 'Копирование промпта' },
    description: {
      en: 'Click anywhere on the card to copy the prompt text to clipboard. Quick and easy!',
      ru: 'Кликните на карточку, чтобы скопировать текст промпта в буфер обмена. Быстро и удобно!'
    },
    target: '.prompt-card:first-child',
    waitForPrompt: true,
    nextAction: 'click',
    tooltipPosition: 'bottom',
    icon: 'copy'
  },
  // === STEP 5: FAVORITES ===
  {
    id: 5,
    title: { en: 'Add to Favorites', ru: 'Добавьте в Избранное' },
    description: {
      en: 'Click the star to favorite this prompt for quick access later.',
      ru: 'Нажмите звезду, чтобы добавить промпт в Избранное для быстрого доступа.'
    },
    target: '.prompt-card:first-child [data-action="toggle-fav"]',
    waitForPrompt: true,
    nextAction: 'click',
    tooltipPosition: 'bottom',
    icon: 'star'
  },
  // === STEP 6: FAVORITES TAB ===
  {
    id: 6,
    title: { en: 'Favorites Tab', ru: 'Вкладка Избранное' },
    description: {
      en: 'Open the Favorites tab to see all your starred prompts in one place.',
      ru: 'Откройте вкладку Избранное, чтобы увидеть все отмеченные промпты.'
    },
    target: '[data-tab="favorites"]',
    nextAction: 'click',
    tooltipPosition: 'bottom',
    icon: 'star'
  },
  // === STEP 7: SEARCH ===
  {
    id: 7,
    title: { en: 'Search Your Prompts', ru: 'Поиск промптов' },
    description: {
      en: 'Use the search bar to find prompts by title, tags, or content. Try typing something!',
      ru: 'Используйте поиск для нахождения промптов по заголовку, тегам или содержанию.'
    },
    target: '#search-input',
    nextAction: 'focus',
    tooltipPosition: 'bottom',
    icon: 'search',
    switchTab: 'prompts'
  },
  // === STEP 8: EDIT prompt ===
  {
    id: 8,
    title: { en: 'Edit Your Prompts', ru: 'Редактирование промптов' },
    description: {
      en: 'Click the pencil icon to edit any prompt - change title, text, tags, folder, and more.',
      ru: 'Нажмите иконку карандаша, чтобы отредактировать промпт - заголовок, текст, теги, папку.'
    },
    target: '.prompt-card:first-child [data-action="edit"]',
    waitForPrompt: true,
    nextAction: 'click',
    tooltipPosition: 'bottom',
    icon: 'edit'
  },
  // === STEP 9: EXPLORE library ===
  {
    id: 9,
    title: { en: 'Explore Library', ru: 'Библиотека Explore' },
    description: {
      en: 'Browse the public prompt library! Discover ready-made prompts shared by the community. Save, like, and use them instantly.',
      ru: 'Откройте публичную библиотеку промптов! Находите готовые промпты от сообщества. Сохраняйте, лайкайте и используйте.'
    },
    target: '[data-tab="explore"]',
    nextAction: 'click',
    tooltipPosition: 'bottom',
    icon: 'explore'
  },
  // === STEP 10: Settings & Hotkeys ===
  {
    id: 10,
    title: { en: 'Settings & Hotkeys', ru: 'Настройки и горячие клавиши' },
    description: {
      en: 'Open Settings to configure hotkeys (Alt+1/2/3), theme, cloud sync, and more.',
      ru: 'Откройте Настройки для горячих клавиш (Alt+1/2/3), тем, облачной синхронизации и другого.'
    },
    target: '#settings-btn',
    nextAction: 'click',
    tooltipPosition: 'left',
    icon: 'settings',
    switchTab: 'prompts'
  },
  // === STEP 11: FINAL ===
  {
    id: 11,
    title: { en: 'You\'re All Set!', ru: 'Всё готово!' },
    description: {
      en: 'You now know all 6 key features:\n\n' +
          '1. Insert - paste prompts into AI chats\n' +
          '2. Copy - quick clipboard copy\n' +
          '3. Favorites - star your best prompts\n' +
          '4. Search - find prompts fast\n' +
          '5. Edit - modify any prompt\n' +
          '6. Explore - discover community prompts\n\n' +
          'Pro tip: Use Ctrl+Shift+P on any AI site for quick search!',
      ru: 'Теперь вы знаете все 6 ключевых функций:\n\n' +
          '1. Вставка - вставляйте промпты в AI-чаты\n' +
          '2. Копирование - быстрое копирование\n' +
          '3. Избранное - отмечайте лучшие промпты\n' +
          '4. Поиск - находите промпты мгновенно\n' +
          '5. Редактирование - изменяйте промпты\n' +
          '6. Explore - открывайте промпты сообщества\n\n' +
          'Совет: Ctrl+Shift+P на любом AI-сайте для быстрого поиска!'
    },
    target: null,
    final: true,
    icon: 'finish'
  }
];

// SVG icons for each step type
const STEP_ICONS = {
  create: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  save: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>',
  insert: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
  copy: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  star: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
  edit: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  explore: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  finish: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
};

class OnboardingTutorial {
  constructor() {
    this.currentStep = 0;
    this.overlay = null;
    this.tutorial = null;
    this.spotlight = null;
    this.onComplete = null;
    this.checkInterval = null;
    this._clickHandlerCleanup = null;
  }

  async start(onComplete) {
    this.onComplete = onComplete;
    this.currentStep = 0;
    
    log('=== STARTING TUTORIAL (11 steps, 6 key features) ===');
    
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'onboarding-overlay';
    document.body.appendChild(this.overlay);
    
    // Create spotlight
    this.spotlight = document.createElement('div');
    this.spotlight.className = 'onboarding-spotlight';
    this.spotlight.style.display = 'none';
    document.body.appendChild(this.spotlight);
    
    await this.nextFrame();
    this.overlay.classList.add('visible');
    
    await this.showStep(0);
  }

  async showStep(stepIndex) {
    if (stepIndex >= STEPS.length) {
      this.close();
      if (this.onComplete) this.onComplete();
      return;
    }

    const step = STEPS[stepIndex];
    log(`Step ${step.id}/${STEPS.length}: ${step.title.en} | target=${step.target || 'FINAL'}`);
    
    // Cleanup previous step
    this.cleanupStep();
    
    // Remove old tutorial
    if (this.tutorial) {
      this.tutorial.classList.remove('visible');
      await this.wait(120);
      this.tutorial.remove();
    }
    
    // Switch tab if needed
    if (step.switchTab) {
      log(`Switching to tab: ${step.switchTab}`);
      const tabBtn = document.querySelector(`[data-tab="${step.switchTab}"]`);
      if (tabBtn) {
        tabBtn.click();
        await this.wait(250);
      }
    }
    
    // Create tutorial box
    this.tutorial = document.createElement('div');
    this.tutorial.className = 'onboarding-tutorial';
    this.tutorial.innerHTML = this.renderTutorial(step);
    document.body.appendChild(this.tutorial);
    
    await this.nextFrame();
    this.tutorial.classList.add('visible');
    
    if (step.target) {
      let target = document.querySelector(step.target);
      
      if (!target && (step.waitForPrompt || step.waitForModal)) {
        log(`Waiting for element: ${step.target}`);
        target = await this.waitForElementAsync(
          step.waitForPrompt ? '.prompt-card:first-child' : step.target,
          10000
        );
        
        if (!target) {
          log('Element not found after waiting, skipping step');
          this.nextStep();
          return;
        }
        
        // Re-query the actual target from step (may be a child of the waited element)
        if (step.waitForPrompt && step.target !== '.prompt-card:first-child') {
          const actual = document.querySelector(step.target);
          if (actual) target = actual;
        }
      }
      
      if (target) {
        log('Target found:', target.tagName, target.className);
        
        // Scroll to target if needed
        if (step.ensureVisible || step.scrollTo) {
          await this.scrollToTarget(target);
        }
        
        // Position tutorial near target
        this.positionTutorialNear(target, step.tooltipPosition);
        
        // Highlight target
        await this.highlightTarget(target);
        
        // Setup interaction
        this.setupInteraction(step, target);
      } else {
        log('Target not found, auto-advancing in 2s');
        this.centerTutorial();
        this.hideHighlight();
        setTimeout(() => this.nextStep(), 2000);
        return;
      }
    } else {
      // Final step or no target
      this.centerTutorial();
      this.hideHighlight();
      this.setupInteraction(step, null);
    }
    
    // Auto-fill actions
    if (step.autoFill) setTimeout(() => this.autoFillPrompt(), 300);
    if (step.autoFillFolder) setTimeout(() => this.autoFillFolder(), 300);
  }

  renderTutorial(step) {
    const lang = this.getLang();
    const totalSteps = STEPS.length;
    const icon = STEP_ICONS[step.icon] || '';
    const isPrimary = step.highlight === 'primary';
    const description = step.description[lang].replace(/\n/g, '<br>');
    
    // Feature badge mapping
    const featureBadges = {
      3: { en: 'MAIN FEATURE', ru: 'ГЛАВНАЯ ФУНКЦИЯ' },
      4: { en: 'COPY', ru: 'КОПИРОВАНИЕ' },
      5: { en: 'FAVORITES', ru: 'ИЗБРАННОЕ' },
      7: { en: 'SEARCH', ru: 'ПОИСК' },
      8: { en: 'EDIT', ru: 'РЕДАКТИРОВАНИЕ' },
      9: { en: 'EXPLORE', ru: 'БИБЛИОТЕКА' }
    };
    
    const badge = featureBadges[step.id];
    const featureBadgeHtml = badge 
      ? `<div class="onboarding-feature-badge${isPrimary ? ' primary' : ''}">${badge[lang]}</div>` 
      : '';
    
    return `
      <div class="onboarding-tutorial-content">
        <div class="onboarding-header-row">
          <div class="onboarding-step-badge">${step.id}/${totalSteps}</div>
          ${step.final ? '' : `<button class="onboarding-skip-btn" id="onboarding-skip">${lang === 'ru' ? 'Пропустить' : 'Skip'}</button>`}
        </div>
        ${icon ? `<div class="onboarding-icon${isPrimary ? ' primary' : ''}">${icon}</div>` : ''}
        ${featureBadgeHtml}
        <div class="onboarding-title">${step.title[lang]}</div>
        <div class="onboarding-description">${description}</div>
        ${step.final ? `
          <button class="onboarding-btn onboarding-btn-primary" id="onboarding-finish">
            ${lang === 'ru' ? 'Начать использовать!' : 'Get Started!'}
          </button>
        ` : `
          <div class="onboarding-progress">
            <div class="onboarding-progress-bar" style="width: ${(step.id / totalSteps) * 100}%"></div>
          </div>
        `}
      </div>
    `;
  }

  positionTutorialNear(element, preferredPos = 'bottom') {
    const tutorialRect = this.tutorial.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth || 400;
    const viewportHeight = window.innerHeight || 600;
    
    let top, left;
    const gap = 14;
    
    // Calculate preferred position
    if (preferredPos === 'top') {
      top = elementRect.top - tutorialRect.height - gap;
      left = elementRect.left + (elementRect.width / 2) - (tutorialRect.width / 2);
    } else if (preferredPos === 'right') {
      top = elementRect.top + (elementRect.height / 2) - (tutorialRect.height / 2);
      left = elementRect.right + gap;
    } else if (preferredPos === 'left') {
      top = elementRect.top + (elementRect.height / 2) - (tutorialRect.height / 2);
      left = elementRect.left - tutorialRect.width - gap;
    } else { // bottom
      top = elementRect.bottom + gap;
      left = elementRect.left + (elementRect.width / 2) - (tutorialRect.width / 2);
    }
    
    // Boundary checks
    const margin = 8;
    
    // Horizontal
    left = Math.max(margin, Math.min(left, viewportWidth - tutorialRect.width - margin));
    
    // Vertical - flip if needed
    if (top < margin && preferredPos === 'top') {
      top = elementRect.bottom + gap;
    }
    if (top + tutorialRect.height > viewportHeight - margin && preferredPos === 'bottom') {
      top = elementRect.top - tutorialRect.height - gap;
    }
    
    // Final clamp
    top = Math.max(margin, Math.min(top, viewportHeight - tutorialRect.height - margin));
    
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
    const padding = 6;
    
    // Add highlight class to element
    element.classList.add('onboarding-target-highlight');
    
    // Position spotlight
    this.spotlight.style.display = 'block';
    this.spotlight.style.left = (rect.left - padding) + 'px';
    this.spotlight.style.top = (rect.top - padding) + 'px';
    this.spotlight.style.width = (rect.width + padding * 2) + 'px';
    this.spotlight.style.height = (rect.height + padding * 2) + 'px';
    this.spotlight.style.zIndex = '9999';
    
    // Update overlay hole
    this.overlay.style.background = 'rgba(0, 0, 0, 0.75)';
    this.updateOverlayHole(rect, padding);
  }

  hideHighlight() {
    document.querySelectorAll('.onboarding-target-highlight').forEach(el => {
      el.classList.remove('onboarding-target-highlight');
      el.style.zIndex = '';
    });
    
    this.spotlight.style.display = 'none';
    this.overlay.style.background = 'transparent';
    this.overlay.style.clipPath = 'none';
  }

  updateOverlayHole(rect, padding) {
    const l = rect.left - padding;
    const t = rect.top - padding;
    const r = rect.right + padding;
    const b = rect.bottom + padding;
    
    this.overlay.style.clipPath = `
      polygon(
        0% 0%, 100% 0%, 100% ${t}px,
        ${r}px ${t}px, ${r}px ${b}px,
        100% ${b}px, 100% 100%, 0% 100%,
        0% ${b}px, ${l}px ${b}px,
        ${l}px ${t}px, 0% ${t}px
      )
    `;
  }

  setupInteraction(step, target) {
    // Skip button
    const skipBtn = document.getElementById('onboarding-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        log('Tutorial skipped by user');
        this.close();
        if (this.onComplete) this.onComplete();
      });
    }
    
    // Final step
    if (step.final) {
      document.getElementById('onboarding-finish')?.addEventListener('click', () => {
        this.close();
        if (this.onComplete) this.onComplete();
      });
      return;
    }
    
    if (!target) return;
    
    // Make target clickable above overlay
    target.style.position = target.style.position || 'relative';
    target.style.zIndex = '10001';
    target.style.cursor = 'pointer';
    
    if (step.nextAction === 'focus') {
      // For search input - advance on focus
      const handler = () => {
        target.removeEventListener('focus', handler);
        log('Focus detected, advancing');
        setTimeout(() => this.nextStep(), 800);
      };
      target.addEventListener('focus', handler);
      this._clickHandlerCleanup = () => target.removeEventListener('focus', handler);
    } else {
      // Default: advance on click
      const handler = () => {
        target.removeEventListener('click', handler);
        log('Click detected on target, advancing');
        // Small delay to let the click action complete
        setTimeout(() => this.nextStep(), 400);
      };
      target.addEventListener('click', handler);
      this._clickHandlerCleanup = () => target.removeEventListener('click', handler);
    }
  }

  cleanupStep() {
    if (this._clickHandlerCleanup) {
      this._clickHandlerCleanup();
      this._clickHandlerCleanup = null;
    }
    
    // Remove highlight from all elements
    document.querySelectorAll('.onboarding-target-highlight').forEach(el => {
      el.classList.remove('onboarding-target-highlight');
      el.style.zIndex = '';
      el.style.cursor = '';
    });
  }

  waitForElementAsync(selector, timeoutMs = 10000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const check = () => {
        const el = document.querySelector(selector);
        if (el) {
          resolve(el);
          return;
        }
        if (Date.now() - startTime > timeoutMs) {
          log(`Timeout waiting for ${selector}`);
          resolve(null);
          return;
        }
        requestAnimationFrame(check);
      };
      
      check();
    });
  }

  async scrollToTarget(element) {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.wait(500);
  }

  autoFillPrompt() {
    const titleInput = document.getElementById('pe-title');
    const textInput = document.getElementById('pe-text');
    
    if (titleInput && textInput) {
      const lang = this.getLang();
      titleInput.value = lang === 'ru' ? 'Мой первый промпт' : 'My First Prompt';
      textInput.value = lang === 'ru' 
        ? 'Ты {role}. Помоги мне с {task}. Ответь подробно и структурированно.' 
        : 'You are a {role}. Help me with {task}. Give a detailed, structured response.';
      
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      textInput.dispatchEvent(new Event('input', { bubbles: true }));
      log('Auto-filled prompt with variables demo');
    }
  }

  autoFillFolder() {
    const nameInput = document.getElementById('fe-name');
    
    if (nameInput) {
      const lang = this.getLang();
      nameInput.value = lang === 'ru' ? 'Мои промпты' : 'My Prompts';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      log('Auto-filled folder name');
    }
  }

  nextStep() {
    this.currentStep++;
    this.showStep(this.currentStep);
  }

  close() {
    log('=== CLOSING TUTORIAL ===');
    
    this.cleanupStep();
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
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
    log('Tutorial state saved');
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
