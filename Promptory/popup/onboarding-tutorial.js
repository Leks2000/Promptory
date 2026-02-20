// Promptory Onboarding Tutorial Module v13
// REWRITE — 4-panel overlay approach (no clip-path z-index issues)
// Flow: Create prompt -> Favorites -> Folders -> Edit -> Settings -> Hotkeys -> Final
// KEY FIX v13:
// 1. Modal-aware z-index layering (from v12).
// 2. Fixed state persistence: only saves progress on SUCCESSFUL step completion,
//    marks complete ONLY when user clicks "Finish" on final step or "Skip".
//    On popup reopen, resumes from last completed step (not current step).
// 3. Fixed memory leaks: _waitForEl uses setTimeout instead of RAF spin-loop,
//    all cleanup paths properly release ResizeObserver and event listeners.
// 4. Fixed folder creation: waitForTab properly waits for tab content to render.
// 5. Final step: simple checkmark with "Get Started" button.
// 6. Removed duplicate _renderFinalStep method.
//
// Z-index stack: base panels (9998) < modal raised (10001/10002) <
//   inside-modal panels (10003) < spotlight (10004) < tooltip (10005).

(function() {
'use strict';

const DEBUG = false;
function log(...args) {
  if (DEBUG) console.log('[Tutorial v13]', ...args);
}

// ==================== STEP DEFINITIONS ====================
function buildSteps() {
  return [
    // === STEP 1: Create a prompt ===
    {
      id: 1,
      title: { en: 'Create Your First Prompt', ru: 'Создайте первый промпт' },
      description: {
        en: 'Click the "+ New" button to create your first prompt.',
        ru: 'Нажмите кнопку "+ New", чтобы создать свой первый промпт.'
      },
      target: '#new-prompt-btn',
      action: 'click',
      tooltipPosition: 'bottom',
      icon: 'create',
      badge: null
    },
    // === STEP 2: Auto-fill and save ===
    {
      id: 2,
      title: { en: 'Save Your Prompt', ru: 'Сохраните промпт' },
      description: {
        en: 'We filled in a sample prompt for you. Click "Create Prompt" to save it.',
        ru: 'Мы заполнили пример промпта. Нажмите "Create Prompt", чтобы сохранить.'
      },
      target: '#pe-save-btn',
      action: 'click',
      autoFill: true,
      waitForModal: true,
      tooltipPosition: 'top',
      icon: 'save',
      badge: null
    },
    // === STEP 3: Add to Favorites ===
    {
      id: 3,
      title: { en: 'Add to Favorites', ru: 'Добавьте в Избранное' },
      description: {
        en: 'Click the star icon to add this prompt to your Favorites for quick access.',
        ru: 'Нажмите на звёздочку, чтобы добавить промпт в Избранное для быстрого доступа.'
      },
      target: '.prompt-card:first-child [data-action="toggle-fav"]',
      action: 'click',
      waitForPrompt: true,
      tooltipPosition: 'left',
      icon: 'favorite',
      badge: { en: 'FAVORITES', ru: 'ИЗБРАННОЕ' },
      switchTab: 'prompts'
    },
    // === STEP 4: Go to Folders tab ===
    {
      id: 4,
      title: { en: 'Create a Folder', ru: 'Создайте папку' },
      description: {
        en: 'Organize your prompts into folders! Switch to the Folders tab first.',
        ru: 'Организуйте промпты по папкам! Сначала перейдите во вкладку Папки.'
      },
      target: '[data-tab="folders"]',
      action: 'click',
      tooltipPosition: 'bottom',
      icon: 'folder',
      badge: { en: 'ORGANIZE', ru: 'ОРГАНИЗАЦИЯ' }
    },
    // === STEP 5: Click New Folder button ===
    {
      id: 5,
      title: { en: 'New Folder', ru: 'Новая папка' },
      description: {
        en: 'Click "New Folder" to create a folder for your prompts.',
        ru: 'Нажмите "New Folder", чтобы создать папку для промптов.'
      },
      target: '#new-folder-btn',
      action: 'click',
      waitForTab: 'folders',
      tooltipPosition: 'bottom',
      icon: 'create',
      badge: null
    },
    // === STEP 6: Auto-fill folder name and save ===
    {
      id: 6,
      title: { en: 'Name Your Folder', ru: 'Назовите папку' },
      description: {
        en: 'We filled in a name. Click "Create" to save the folder.',
        ru: 'Мы заполнили название. Нажмите "Create", чтобы сохранить папку.'
      },
      target: '#fe-save-btn',
      action: 'click',
      autoFillFolder: true,
      waitForModal: true,
      tooltipPosition: 'top',
      icon: 'save',
      badge: null
    },
    // === STEP 7: Edit prompt — add to folder ===
    {
      id: 7,
      title: { en: 'Move Prompt to Folder', ru: 'Переместите промпт в папку' },
      description: {
        en: 'Now let\'s move your prompt into the folder. Click the edit button on your prompt.',
        ru: 'Теперь переместим промпт в папку. Нажмите кнопку редактирования на промпте.'
      },
      target: '.prompt-card:first-child [data-action="edit"]',
      action: 'click',
      switchTab: 'prompts',
      tooltipPosition: 'left',
      icon: 'edit',
      badge: { en: 'EDIT', ru: 'РЕДАКТИРОВАНИЕ' }
    },
    // === STEP 8: Select folder in editor and save ===
    {
      id: 8,
      title: { en: 'Select Folder & Save', ru: 'Выберите папку и сохраните' },
      description: {
        en: 'Select your folder from the dropdown, then click "Save Changes" to move the prompt.',
        ru: 'Выберите папку из списка, затем нажмите "Сохранить", чтобы переместить промпт.'
      },
      target: '#pe-save-btn',
      action: 'click',
      autoSelectFolder: true,
      waitForModal: true,
      tooltipPosition: 'top',
      icon: 'save',
      badge: { en: 'SAVE', ru: 'СОХРАНЕНИЕ' }
    },
    // === STEP 9: Open Settings ===
    {
      id: 9,
      title: { en: 'Open Settings', ru: 'Откройте Настройки' },
      description: {
        en: 'Now let\'s set up Quick Insert — your main power feature! Click the Settings button.',
        ru: 'Теперь настроим Быструю вставку — вашу главную суперсилу! Нажмите кнопку Настройки.'
      },
      target: '#settings-btn',
      action: 'click',
      waitForPrompt: true,
      tooltipPosition: 'bottom',
      icon: 'settings',
      badge: { en: 'SETTINGS', ru: 'НАСТРОЙКИ' },
      switchTab: 'prompts'
    },
    // === STEP 10: Focus on Quick Insert section ===
    {
      id: 10,
      title: { en: 'Quick Insert Hotkeys', ru: 'Горячие клавиши' },
      description: {
        en: 'This is the Quick Insert section. You can assign any prompt to Alt+1, Alt+2 or Alt+3 for instant insertion into any AI chat!',
        ru: 'Это раздел Быстрой вставки. Назначьте любой промпт на Alt+1, Alt+2 или Alt+3 для мгновенной вставки в любой AI-чат!'
      },
      target: '[data-hotkey-section]',
      action: 'observe',
      waitForSettings: true,
      scrollInSettings: true,
      tooltipPosition: 'top',
      icon: 'hotkey',
      badge: { en: 'QUICK INSERT', ru: 'БЫСТРАЯ ВСТАВКА' }
    },
    // === STEP 11: Select prompt in Slot 1 dropdown ===
    {
      id: 11,
      title: { en: 'Assign a Prompt', ru: 'Назначьте промпт' },
      description: {
        en: 'Click the dropdown and select your prompt to assign it to a hotkey slot.',
        ru: 'Нажмите на выпадающий список и выберите промпт для назначения на горячую клавишу.'
      },
      target: '[data-hotkey-slot="slot1"]',
      action: 'change',
      autoOpenDropdown: true,
      tooltipPosition: 'top',
      icon: 'select',
      badge: { en: 'SELECT PROMPT', ru: 'ВЫБОР ПРОМПТА' }
    },
    // === STEP 12: Save Settings ===
    {
      id: 12,
      title: { en: 'Save Settings', ru: 'Сохраните настройки' },
      description: {
        en: 'Great! Now click "Save Changes" to apply your hotkey settings.',
        ru: 'Отлично! Нажмите "Сохранить", чтобы применить настройки горячих клавиш.'
      },
      target: '#settings-save-btn',
      action: 'click',
      scrollToBottom: true,
      tooltipPosition: 'top',
      icon: 'save',
      badge: { en: 'SAVE', ru: 'СОХРАНЕНИЕ' }
    },
    // === STEP 13: Final — You're Ready! ===
    {
      id: 13,
      title: { en: 'You\'re Ready!', ru: 'Вы готовы!' },
      description: {
        en: 'final_custom',
        ru: 'final_custom'
      },
      target: null,
      action: 'final',
      icon: 'finish',
      badge: null,
      dynamic: true
    }
  ];
}

// ==================== SVG ICONS ====================
const ICONS = {
  create: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  save: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>',
  favorite: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  folder: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  edit: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  hotkey: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>',
  select: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
  explore: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  finish: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
};

// ==================== TUTORIAL CLASS ====================
class OnboardingTutorial {
  constructor() {
    this.currentStep = 0;
    this.panels = [];       // 4 overlay panels (top, right, bottom, left)
    this.fullOverlay = null; // Full overlay for info/final steps
    this.tooltip = null;
    this.spotlight = null;
    this.onComplete = null;
    this._cleanup = null;
    this._resizeObserver = null;
    this._waitTimers = [];   // Track all setTimeout/RAF ids for cleanup
    this.steps = null;
    this.assignedHotkey = 'Alt+1';
    this.assignedSlot = 'slot1';
    this._destroyed = false; // Guard against operations after destroy
  }

  // ==================== START ====================
  async start(onComplete) {
    if (this._destroyed) return;
    this.onComplete = onComplete;
    this.steps = buildSteps();

    // Resume from saved step if popup was closed mid-tutorial
    let resumeStep = 0;
    try {
      const stored = await new Promise(resolve => {
        chrome.storage.local.get(['tutorialLastCompletedStep', 'onboardingTutorialComplete'], resolve);
      });
      if (stored.onboardingTutorialComplete) {
        // Tutorial already completed — don't restart
        log('Tutorial already completed, skipping');
        if (this.onComplete) this.onComplete();
        return;
      }
      // Resume from the step AFTER the last completed one
      if (typeof stored.tutorialLastCompletedStep === 'number' && stored.tutorialLastCompletedStep >= 0) {
        resumeStep = stored.tutorialLastCompletedStep + 1;
        // Clamp to valid range
        if (resumeStep >= this.steps.length) {
          // All steps were completed but _finish wasn't called (popup closed on final step)
          this._markComplete();
          if (this.onComplete) this.onComplete();
          return;
        }
        log('Resuming tutorial from step', resumeStep, '(last completed:', stored.tutorialLastCompletedStep, ')');
      }
    } catch (e) {
      log('Could not read tutorial state:', e);
    }
    this.currentStep = resumeStep;

    log(`=== STARTING TUTORIAL v13 (${this.steps.length} steps) ===`);

    // Create 4 overlay panels
    const panelNames = ['top', 'right', 'bottom', 'left'];
    this.panels = panelNames.map(name => {
      const panel = document.createElement('div');
      panel.className = 'tut-overlay-panel';
      panel.id = `tut-panel-${name}`;
      panel.dataset.panel = name;
      document.body.appendChild(panel);
      return panel;
    });

    // Create full overlay (hidden by default, for info/final steps)
    this.fullOverlay = document.createElement('div');
    this.fullOverlay.className = 'tut-overlay-full';
    this.fullOverlay.id = 'tut-overlay-full';
    document.body.appendChild(this.fullOverlay);

    // Create spotlight ring
    this.spotlight = document.createElement('div');
    this.spotlight.className = 'tut-spotlight';
    this.spotlight.id = 'tut-spotlight';
    document.body.appendChild(this.spotlight);

    // Create tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tut-tooltip';
    this.tooltip.id = 'tut-tooltip';
    document.body.appendChild(this.tooltip);

    // Fade in panels
    await this._raf();
    if (this._destroyed) return;
    this.panels.forEach(p => p.classList.add('tut-visible'));
    await this._wait(300);

    // Handle resize — debounced to avoid excessive recalculation
    let resizeTimer = null;
    this._resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this._repositionCurrent(), 100);
    });
    this._resizeObserver.observe(document.body);

    await this._showStep(resumeStep);
  }

  // ==================== SAVE PROGRESS ====================
  // Save the index of the last SUCCESSFULLY COMPLETED step
  _saveCompletedStep(stepIndex) {
    try {
      chrome.storage.local.set({ tutorialLastCompletedStep: stepIndex });
      log('Saved completed step:', stepIndex);
    } catch (e) {
      log('Failed to save tutorial progress:', e);
    }
  }

  // Mark the entire tutorial as complete
  _markComplete() {
    try {
      chrome.storage.local.set({
        onboardingTutorialComplete: true,
        tutorialLastCompletedStep: -1 // Reset
      });
      // Also clean up old key if it exists
      chrome.storage.local.remove('tutorialCurrentStep');
    } catch (e) {
      log('Failed to mark tutorial complete:', e);
    }
  }

  // ==================== SHOW STEP ====================
  async _showStep(index) {
    if (this._destroyed) return;
    if (index >= this.steps.length) {
      this._finish();
      return;
    }

    const step = this.steps[index];
    this.currentStep = index;
    log(`Step ${step.id}/${this.steps.length}: ${step.title.en}`);

    // Cleanup previous step
    this._cleanupStep();

    // Hide tooltip during transition
    this.tooltip.classList.remove('tut-visible');
    await this._wait(150);
    if (this._destroyed) return;

    // Switch tab if needed
    if (step.switchTab) {
      const tabBtn = document.querySelector(`[data-tab="${step.switchTab}"]`);
      if (tabBtn) {
        tabBtn.click();
        await this._wait(200);
        if (this._destroyed) return;
      }
    }

    // Wait for tab content to render (for steps that depend on tab being active)
    if (step.waitForTab) {
      const tabContent = document.getElementById(`${step.waitForTab}-tab`);
      if (tabContent && !tabContent.classList.contains('active')) {
        const tabBtn = document.querySelector(`[data-tab="${step.waitForTab}"]`);
        if (tabBtn) {
          tabBtn.click();
          await this._wait(300);
          if (this._destroyed) return;
        }
      }
      // Wait a bit for the tab content to render
      await this._wait(200);
      if (this._destroyed) return;
    }

    // Wait for settings modal if needed
    if (step.waitForSettings) {
      log('Waiting for settings modal...');
      const settingsModal = await this._waitForEl('#settings-modal.visible', 5000);
      if (this._destroyed) return;
      if (!settingsModal) {
        log('Settings modal not found, skipping');
        this._saveCompletedStep(index);
        this._nextStep();
        return;
      }
      await this._wait(400);
      if (this._destroyed) return;
    }

    // Find target element
    let target = null;
    if (step.target) {
      target = document.querySelector(step.target);

      if (!target && (step.waitForPrompt || step.waitForModal)) {
        log(`Waiting for target: ${step.target}`);
        const waitSelector = step.waitForPrompt ? '.prompt-card:first-child' : step.target;
        await this._waitForEl(waitSelector, 10000);
        if (this._destroyed) return;
        target = document.querySelector(step.target);
        if (!target && step.waitForPrompt) {
          target = document.querySelector('.prompt-card:first-child');
        }
      }

      if (!target) {
        log(`Target ${step.target} not found, auto-advancing`);
        this._saveCompletedStep(index);
        const tid = setTimeout(() => this._nextStep(), 1500);
        this._waitTimers.push(tid);
        return;
      }
    }

    // Scroll to target inside settings modal if needed
    if (step.scrollInSettings && target) {
      await this._smoothScrollInSettings(target);
      if (this._destroyed) return;
    }

    // Scroll save button into view
    if (step.scrollToBottom && target) {
      const footer = target.closest('.modal')?.querySelector('.modal-footer');
      if (footer) {
        footer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this._wait(500);
        if (this._destroyed) return;
      }
    }

    // Render tooltip content
    this.tooltip.innerHTML = this._renderTooltip(step);
    await this._raf();
    if (this._destroyed) return;

    // Position spotlight and tooltip
    if (target) {
      this._highlightTarget(target, step);
      this._positionTooltip(target, step.tooltipPosition);
      // Ensure panels are visible, full overlay is hidden
      this._showPanels();
    } else {
      // Center tooltip for info/final steps
      this._hideSpotlight();
      this._hidePanels();
      this._showFullOverlay();
      this._centerTooltip();
    }

    // Show tooltip with animation
    await this._raf();
    if (this._destroyed) return;
    this.tooltip.classList.add('tut-visible');

    // Auto-fill prompt editor
    if (step.autoFill) {
      const tid = setTimeout(() => this._autoFillPrompt(), 350);
      this._waitTimers.push(tid);
    }

    // Auto-fill folder name
    if (step.autoFillFolder) {
      const tid = setTimeout(() => this._autoFillFolder(), 350);
      this._waitTimers.push(tid);
    }

    // Auto-select folder in editor
    if (step.autoSelectFolder) {
      const tid = setTimeout(() => this._autoSelectFolder(), 350);
      this._waitTimers.push(tid);
    }

    // Auto-open dropdown
    if (step.autoOpenDropdown && target) {
      const tid = setTimeout(() => {
        if (this._destroyed) return;
        log('Auto-opening dropdown');
        target.focus();
        target.classList.add('tut-dropdown-flash');
        const tid2 = setTimeout(() => target.classList.remove('tut-dropdown-flash'), 600);
        this._waitTimers.push(tid2);
      }, 500);
      this._waitTimers.push(tid);
    }

    // Setup interaction
    this._setupInteraction(step, target);
  }

  // ==================== RENDER TOOLTIP ====================
  _renderTooltip(step) {
    const lang = this._getLang();
    const total = this.steps.length;
    const icon = ICONS[step.icon] || '';
    const isPrimary = step.isPrimary;
    const isFinal = step.action === 'final';

    // Custom final step rendering
    if (isFinal) {
      return this._renderFinalStep(lang, total);
    }

    let description = step.description[lang] || step.description.en;
    if (step.dynamic) {
      description = description.replace(/\{hotkey\}/g, this.assignedHotkey);
    }
    description = description.replace(/\n/g, '<br>');

    const badgeHtml = step.badge
      ? `<div class="tut-badge${isPrimary ? ' tut-badge-primary' : ''}">${step.badge[lang] || step.badge.en}</div>`
      : '';

    return `
      <div class="tut-content">
        <div class="tut-header">
          <div class="tut-step-num">${step.id}/${total}</div>
          <button class="tut-skip" id="tut-skip">${lang === 'ru' ? 'Пропустить' : 'Skip'}</button>
        </div>
        ${icon ? `<div class="tut-icon${isPrimary ? ' tut-icon-primary' : ''}">${icon}</div>` : ''}
        ${badgeHtml}
        <div class="tut-title">${step.title[lang] || step.title.en}</div>
        <div class="tut-desc">${description}</div>
        ${step.action === 'observe' || step.action === 'info' ? `
          <button class="tut-btn-next" id="tut-next">${lang === 'ru' ? 'Далее' : 'Next'}</button>
        ` : ''}
        <div class="tut-progress"><div class="tut-progress-bar" style="width:${(step.id / total) * 100}%"></div></div>
      </div>
    `;
  }

  // ==================== RENDER FINAL STEP ====================
  _renderFinalStep(lang, total) {
    const isRu = lang === 'ru';
    return `
      <div class="tut-content tut-final-content">
        <div class="tut-step-num" style="text-align:center;margin:0 auto 12px;">${total}/${total}</div>
        <div class="tut-icon tut-icon-primary tut-icon-finish">${ICONS.finish}</div>
        <div class="tut-title" style="text-align:center;">${isRu ? 'Вы готовы!' : "You're Ready!"}</div>
        <div class="tut-desc" style="text-align:center;">
          ${isRu
            ? 'Вы настроили Promptory!<br><br>' +
              '<strong>Alt+1/2/3</strong> — мгновенная вставка промптов<br>' +
              '<strong>Alt+S</strong> — быстрый поиск на любом AI-сайте<br><br>' +
              'Удачной работы с AI!'
            : "You've set up Promptory!<br><br>" +
              '<strong>Alt+1/2/3</strong> — instant prompt insertion<br>' +
              '<strong>Alt+S</strong> — quick search on any AI site<br><br>' +
              'Happy prompting!'}
        </div>
        <button class="tut-btn-finish" id="tut-finish">${isRu ? 'Начать работу' : 'Get Started'}</button>
        <div class="tut-progress"><div class="tut-progress-bar" style="width:100%"></div></div>
      </div>
    `;
  }

  // ==================== HIGHLIGHT TARGET (4-panel approach, modal-aware) ====================
  _highlightTarget(element, step) {
    const rect = element.getBoundingClientRect();
    const pad = 6;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Hole dimensions (the area NOT covered by panels)
    const holeLeft = Math.max(0, rect.left - pad);
    const holeTop = Math.max(0, rect.top - pad);
    const holeRight = Math.min(vw, rect.right + pad);
    const holeBottom = Math.min(vh, rect.bottom + pad);

    // Detect if target is inside a modal
    const modalOverlay = element.closest('.modal-overlay');
    const isInsideModal = !!modalOverlay;

    if (isInsideModal) {
      modalOverlay.classList.add('tut-modal-raised');
      this.panels.forEach(p => p.classList.add('tut-inside-modal'));
      log('Target is inside modal — using raised modal z-index');
    } else {
      this.panels.forEach(p => p.classList.remove('tut-inside-modal'));
    }

    // Position the 4 panels around the hole
    const [panelTop, panelRight, panelBottom, panelLeft] = this.panels;

    panelTop.style.cssText = `left:0;top:0;width:${vw}px;height:${holeTop}px`;
    panelRight.style.cssText = `left:${holeRight}px;top:${holeTop}px;width:${vw - holeRight}px;height:${holeBottom - holeTop}px`;
    panelBottom.style.cssText = `left:0;top:${holeBottom}px;width:${vw}px;height:${vh - holeBottom}px`;
    panelLeft.style.cssText = `left:0;top:${holeTop}px;width:${holeLeft}px;height:${holeBottom - holeTop}px`;

    // Raise the target above the panels
    element.classList.add('tut-target-active');
    if (!isInsideModal) {
      this._ensureAncestorStacking(element);
    }

    // Force action buttons visible on prompt/folder cards
    const promptCard = element.closest('.prompt-card') || element.querySelector('.prompt-card');
    if (promptCard) promptCard.classList.add('tut-actions-visible');
    const folderCard = element.closest('.folder-card') || element.querySelector('.folder-card');
    if (folderCard) folderCard.classList.add('tut-actions-visible');

    // Position spotlight ring
    this.spotlight.style.display = 'block';
    this.spotlight.style.left = `${holeLeft}px`;
    this.spotlight.style.top = `${holeTop}px`;
    this.spotlight.style.width = `${holeRight - holeLeft}px`;
    this.spotlight.style.height = `${holeBottom - holeTop}px`;
    this.spotlight.style.borderRadius = step.borderRadius || '8px';
  }

  // Raise positioned ancestors so the target's z-index can escape stacking contexts
  _ensureAncestorStacking(element) {
    let el = element.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      const style = getComputedStyle(el);
      const pos = style.position;
      if (pos === 'relative' || pos === 'absolute' || pos === 'fixed' || pos === 'sticky') {
        const currentZ = parseInt(style.zIndex, 10);
        if (isNaN(currentZ) || currentZ < 9999) {
          el.classList.add('tut-ancestor-raised');
        }
      }
      el = el.parentElement;
    }
  }

  _showPanels() {
    this.panels.forEach(p => {
      p.classList.add('tut-visible');
      p.style.display = '';
    });
    if (this.fullOverlay) {
      this.fullOverlay.classList.remove('tut-visible');
      this.fullOverlay.style.display = 'none';
    }
  }

  _hidePanels() {
    this.panels.forEach(p => { p.style.display = 'none'; });
  }

  _showFullOverlay() {
    if (this.fullOverlay) {
      this.fullOverlay.style.display = '';
      requestAnimationFrame(() => {
        if (!this._destroyed) this.fullOverlay.classList.add('tut-visible');
      });
    }
  }

  _hideSpotlight() {
    this.spotlight.style.display = 'none';
  }

  // ==================== POSITION TOOLTIP ====================
  _positionTooltip(element, preferred = 'bottom') {
    this.tooltip.style.visibility = 'hidden';
    this.tooltip.style.display = 'block';
    const tooltipRect = this.tooltip.getBoundingClientRect();
    this.tooltip.style.visibility = '';

    const elRect = element.getBoundingClientRect();
    const vw = window.innerWidth || 400;
    const vh = window.innerHeight || 600;
    const gap = 16;
    const margin = 8;

    let top, left;

    switch (preferred) {
      case 'top':
        top = elRect.top - tooltipRect.height - gap;
        left = elRect.left + elRect.width / 2 - tooltipRect.width / 2;
        if (top < margin) top = elRect.bottom + gap;
        break;
      case 'right':
        top = elRect.top + elRect.height / 2 - tooltipRect.height / 2;
        left = elRect.right + gap;
        if (left + tooltipRect.width > vw - margin) left = elRect.left - tooltipRect.width - gap;
        break;
      case 'left':
        top = elRect.top + elRect.height / 2 - tooltipRect.height / 2;
        left = elRect.left - tooltipRect.width - gap;
        if (left < margin) left = elRect.right + gap;
        break;
      default: // bottom
        top = elRect.bottom + gap;
        left = elRect.left + elRect.width / 2 - tooltipRect.width / 2;
        if (top + tooltipRect.height > vh - margin) top = elRect.top - tooltipRect.height - gap;
    }

    // Clamp to viewport
    left = Math.max(margin, Math.min(left, vw - tooltipRect.width - margin));
    top = Math.max(margin, Math.min(top, vh - tooltipRect.height - margin));

    // Overlap check
    const tooltipBottom = top + tooltipRect.height;
    const tooltipRight = left + tooltipRect.width;
    if (top < elRect.bottom && tooltipBottom > elRect.top &&
        left < elRect.right && tooltipRight > elRect.left) {
      if (elRect.bottom + gap + tooltipRect.height <= vh - margin) {
        top = elRect.bottom + gap;
      } else if (elRect.top - gap - tooltipRect.height >= margin) {
        top = elRect.top - tooltipRect.height - gap;
      }
      left = Math.max(margin, Math.min(elRect.right + gap, vw - tooltipRect.width - margin));
    }

    this.tooltip.style.position = 'fixed';
    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.transform = 'none';
  }

  _centerTooltip() {
    this.tooltip.style.position = 'fixed';
    this.tooltip.style.top = '50%';
    this.tooltip.style.left = '50%';
    this.tooltip.style.transform = 'translate(-50%, -50%)';
  }

  // ==================== INTERACTION ====================
  _setupInteraction(step, target) {
    // Skip button
    const skipBtn = document.getElementById('tut-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        log('Tutorial skipped');
        this._finish();
      });
    }

    // Final step
    if (step.action === 'final') {
      document.getElementById('tut-finish')?.addEventListener('click', () => {
        this._finish();
      });
      return;
    }

    // Next button (for observe/info steps)
    const nextBtn = document.getElementById('tut-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this._saveCompletedStep(this.currentStep);
        this._nextStep();
      });
    }

    if (!target) return;

    if (step.action === 'click') {
      const handler = () => {
        target.removeEventListener('click', handler);
        log('Click on target, advancing');
        this._saveCompletedStep(this.currentStep);
        const tid = setTimeout(() => this._nextStep(), 400);
        this._waitTimers.push(tid);
      };
      target.addEventListener('click', handler);
      this._cleanup = () => target.removeEventListener('click', handler);
    }
    else if (step.action === 'change') {
      const handler = () => {
        target.removeEventListener('change', handler);
        log('Selection changed, value:', target.value);

        const slotId = target.dataset.hotkeySlot;
        if (slotId) {
          const slotNum = slotId.replace('slot', '');
          this.assignedSlot = slotId;
          this._detectHotkey(slotNum).then(hotkey => {
            this.assignedHotkey = hotkey;
            log(`Detected hotkey for ${slotId}: ${hotkey}`);
          });
        }

        this._saveCompletedStep(this.currentStep);
        const tid = setTimeout(() => this._nextStep(), 500);
        this._waitTimers.push(tid);
      };
      target.addEventListener('change', handler);
      this._cleanup = () => target.removeEventListener('change', handler);

      // Also support clicking other slot dropdowns
      const allSlots = document.querySelectorAll('[data-hotkey-slot]');
      const otherHandlers = [];
      allSlots.forEach(sel => {
        if (sel === target) return;
        const h = () => {
          allSlots.forEach(s => s.removeEventListener('change', h));
          target.removeEventListener('change', handler);
          const sid = sel.dataset.hotkeySlot;
          const sn = sid.replace('slot', '');
          this.assignedSlot = sid;
          this._detectHotkey(sn).then(hotkey => {
            this.assignedHotkey = hotkey;
          });
          this._saveCompletedStep(this.currentStep);
          const tid = setTimeout(() => this._nextStep(), 500);
          this._waitTimers.push(tid);
        };
        sel.addEventListener('change', h);
        otherHandlers.push({ el: sel, handler: h });
      });

      const prevCleanup = this._cleanup;
      this._cleanup = () => {
        prevCleanup();
        otherHandlers.forEach(({ el, handler }) => el.removeEventListener('change', handler));
      };
    }
    else if (step.action === 'focus') {
      const handler = () => {
        target.removeEventListener('focus', handler);
        this._saveCompletedStep(this.currentStep);
        const tid = setTimeout(() => this._nextStep(), 700);
        this._waitTimers.push(tid);
      };
      target.addEventListener('focus', handler);
      this._cleanup = () => target.removeEventListener('focus', handler);
    }
  }

  // ==================== DETECT ACTUAL HOTKEY ====================
  async _detectHotkey(slotNum) {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.commands && chrome.commands.getAll) {
        chrome.commands.getAll(commands => {
          const cmd = commands.find(c => c.name === `hotkey-${slotNum}`);
          if (cmd && cmd.shortcut) {
            resolve(cmd.shortcut);
          } else {
            resolve(`Alt+${slotNum}`);
          }
        });
      } else {
        resolve(`Alt+${slotNum}`);
      }
    });
  }

  // ==================== SCROLL INSIDE SETTINGS MODAL ====================
  async _smoothScrollInSettings(target) {
    log('Smooth scrolling to Quick Insert section in settings');
    const modalBody = target.closest('.modal-body');
    if (!modalBody) return;

    const targetRect = target.getBoundingClientRect();
    const modalRect = modalBody.getBoundingClientRect();
    const scrollTop = modalBody.scrollTop + (targetRect.top - modalRect.top) - modalRect.height / 3;

    modalBody.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: 'smooth'
    });
    await this._wait(600);
  }

  // ==================== AUTO-FILL PROMPT ====================
  _autoFillPrompt() {
    if (this._destroyed) return;
    const titleInput = document.getElementById('pe-title');
    const textInput = document.getElementById('pe-text');

    if (titleInput && textInput) {
      const lang = this._getLang();
      titleInput.value = lang === 'ru' ? 'Мой первый промпт' : 'My First Prompt';
      textInput.value = lang === 'ru'
        ? 'Ты {role}. Помоги мне с {task}. Ответь подробно и структурированно.'
        : 'You are a {role}. Help me with {task}. Give a detailed, structured response.';

      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      textInput.dispatchEvent(new Event('input', { bubbles: true }));
      log('Auto-filled prompt');
    }
  }

  // ==================== AUTO-FILL FOLDER ====================
  _autoFillFolder() {
    if (this._destroyed) return;
    const nameInput = document.getElementById('fe-name');
    if (nameInput) {
      const lang = this._getLang();
      nameInput.value = lang === 'ru' ? 'Мои промпты' : 'My Prompts';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      log('Auto-filled folder name');
    }
  }

  // ==================== AUTO-SELECT FOLDER IN EDITOR ====================
  _autoSelectFolder() {
    if (this._destroyed) return;
    const folderSelect = document.getElementById('pe-folder');
    if (folderSelect && folderSelect.options.length > 1) {
      folderSelect.selectedIndex = 1;
      folderSelect.dispatchEvent(new Event('change', { bubbles: true }));
      folderSelect.classList.add('tut-dropdown-flash');
      const tid = setTimeout(() => folderSelect.classList.remove('tut-dropdown-flash'), 600);
      this._waitTimers.push(tid);
      log('Auto-selected folder in editor');
    }
  }

  // ==================== REPOSITION ON RESIZE ====================
  _repositionCurrent() {
    if (this._destroyed) return;
    if (this.currentStep >= this.steps.length) return;
    const step = this.steps[this.currentStep];
    if (!step || !step.target) return;

    const target = document.querySelector(step.target);
    if (!target) return;

    this._highlightTarget(target, step);
    this._positionTooltip(target, step.tooltipPosition);
  }

  // ==================== NAVIGATION ====================
  _nextStep() {
    if (this._destroyed) return;
    this._showStep(this.currentStep + 1);
  }

  _cleanupStep() {
    // Clear all pending timers
    this._waitTimers.forEach(id => clearTimeout(id));
    this._waitTimers = [];

    if (this._cleanup) {
      this._cleanup();
      this._cleanup = null;
    }

    // Remove active state from all targets
    document.querySelectorAll('.tut-target-active').forEach(el => {
      el.classList.remove('tut-target-active');
    });

    // Remove ancestor stacking overrides
    document.querySelectorAll('.tut-ancestor-raised').forEach(el => {
      el.classList.remove('tut-ancestor-raised');
    });

    // Remove modal-raised class
    document.querySelectorAll('.tut-modal-raised').forEach(el => {
      el.classList.remove('tut-modal-raised');
    });

    // Remove inside-modal mode from panels
    this.panels.forEach(p => p.classList.remove('tut-inside-modal'));

    // Remove forced action button visibility
    document.querySelectorAll('.tut-actions-visible').forEach(el => {
      el.classList.remove('tut-actions-visible');
    });
  }

  // ==================== FINISH ====================
  _finish() {
    if (this._destroyed) return;
    this._destroyed = true;
    log('=== CLOSING TUTORIAL ===');
    this._cleanupStep();

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    // Fade out
    this.panels.forEach(p => p.classList.remove('tut-visible'));
    if (this.fullOverlay) this.fullOverlay.classList.remove('tut-visible');
    if (this.tooltip) this.tooltip.classList.remove('tut-visible');
    if (this.spotlight) this.spotlight.style.display = 'none';

    // Remove elements after fade
    const tid = setTimeout(() => {
      this.panels.forEach(p => p.remove());
      this.panels = [];
      this.fullOverlay?.remove();
      this.fullOverlay = null;
      this.tooltip?.remove();
      this.tooltip = null;
      this.spotlight?.remove();
      this.spotlight = null;
      // Final cleanup of any leftover classes
      document.querySelectorAll('.tut-ancestor-raised,.tut-target-active,.tut-modal-raised,.tut-actions-visible').forEach(el => {
        el.classList.remove('tut-ancestor-raised', 'tut-target-active', 'tut-modal-raised', 'tut-actions-visible');
      });
    }, 400);
    this._waitTimers.push(tid);

    // Mark tutorial as complete
    this._markComplete();

    if (this.onComplete) this.onComplete();
    log('Tutorial saved as complete');
  }

  // ==================== UTILITIES ====================
  _getLang() {
    try {
      if (window.Promptory && window.Promptory.getLang) {
        return window.Promptory.getLang();
      }
    } catch (e) {}
    return navigator.language.startsWith('ru') ? 'ru' : 'en';
  }

  // Wait for element using setTimeout polling (not RAF spin-loop) to prevent memory pressure
  _waitForEl(selector, timeoutMs = 10000) {
    return new Promise(resolve => {
      const start = Date.now();
      const check = () => {
        if (this._destroyed) { resolve(null); return; }
        const el = document.querySelector(selector);
        if (el) { resolve(el); return; }
        if (Date.now() - start > timeoutMs) { resolve(null); return; }
        const tid = setTimeout(check, 100); // Check every 100ms instead of every frame
        this._waitTimers.push(tid);
      };
      check();
    });
  }

  _raf() {
    return new Promise(resolve => requestAnimationFrame(resolve));
  }

  _wait(ms) {
    return new Promise(resolve => {
      const tid = setTimeout(resolve, ms);
      this._waitTimers.push(tid);
    });
  }
}

// ==================== EXPORT ====================
window.OnboardingTutorial = OnboardingTutorial;

})();
