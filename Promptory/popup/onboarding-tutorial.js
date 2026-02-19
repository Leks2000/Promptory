// Promptory Onboarding Tutorial Module v12
// REWRITE — 4-panel overlay approach (no clip-path z-index issues)
// Flow: Create prompt -> Settings -> Quick Insert -> Select slot -> Save -> Use hotkey -> Library teaser
// KEY FIX v12: Modal-aware z-index layering.
// When the target element is inside a modal (e.g. prompt editor, settings),
// the modal-overlay is raised above the base tutorial panels, then
// "inside-modal" panels are layered ON TOP of the raised modal to create
// the dark surround. This ensures the highlighted element inside the modal
// is ALWAYS visible and clickable, never hidden behind the overlay.
// Z-index stack: base panels (9998) < modal raised (10001/10002) <
//   inside-modal panels (10003) < spotlight (10004) < tooltip (10005).

(function() {
'use strict';

const DEBUG = false;
function log(...args) {
  if (DEBUG) console.log('[Tutorial v12]', ...args);
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
    // === STEP 3: Open Settings ===
    {
      id: 3,
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
    // === STEP 4: Focus on Quick Insert section ===
    {
      id: 4,
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
    // === STEP 5: Select prompt in Slot 1 dropdown ===
    {
      id: 5,
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
    // === STEP 6: Save Settings ===
    {
      id: 6,
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
    // === STEP 7: Show the hotkey to use ===
    {
      id: 7,
      title: { en: 'Try Your Hotkey!', ru: 'Попробуйте горячую клавишу!' },
      description: {
        en: `Now go to any AI chat (ChatGPT, Claude, Gemini...) and press {hotkey} to instantly insert your prompt!`,
        ru: `Теперь перейдите в любой AI-чат (ChatGPT, Claude, Gemini...) и нажмите {hotkey} для мгновенной вставки промпта!`
      },
      target: null,
      action: 'info',
      tooltipPosition: 'center',
      icon: 'hotkey',
      badge: { en: 'MAIN FEATURE', ru: 'ГЛАВНАЯ ФУНКЦИЯ' },
      isPrimary: true,
      dynamic: true
    },
    // === STEP 8: Library teaser ===
    {
      id: 8,
      title: { en: 'Explore the Library', ru: 'Откройте Библиотеку' },
      description: {
        en: 'Discover ready-made prompts from the community in the Library tab. Sign in to browse, save, and share prompts!',
        ru: 'Откройте готовые промпты от сообщества во вкладке Библиотека. Войдите в аккаунт, чтобы просматривать, сохранять и делиться промптами!'
      },
      target: '[data-tab="explore"]',
      action: 'observe',
      tooltipPosition: 'bottom',
      icon: 'explore',
      badge: { en: 'LIBRARY', ru: 'БИБЛИОТЕКА' }
    },
    // === STEP 9: Final ===
    {
      id: 9,
      title: { en: 'You\'re All Set!', ru: 'Всё готово!' },
      description: {
        en: 'Here\'s what you learned:\n\n' +
            '1. Create & save prompts\n' +
            '2. Quick Insert via hotkeys ({hotkey})\n' +
            '3. Library — discover community prompts\n\n' +
            'Pro tip: Use Ctrl+Shift+P on any AI site for quick search overlay!',
        ru: 'Вот что вы узнали:\n\n' +
            '1. Создание и сохранение промптов\n' +
            '2. Быстрая вставка через горячие клавиши ({hotkey})\n' +
            '3. Библиотека — промпты от сообщества\n\n' +
            'Совет: Ctrl+Shift+P на любом AI-сайте для быстрого поиска!'
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
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  hotkey: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>',
  select: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  explore: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  finish: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
};

// ==================== TUTORIAL CLASS ====================
class OnboardingTutorial {
  constructor() {
    this.currentStep = 0;
    this.panels = []; // 4 overlay panels (top, right, bottom, left)
    this.fullOverlay = null; // Full overlay for info/final steps
    this.tooltip = null;
    this.spotlight = null;
    this.onComplete = null;
    this._cleanup = null;
    this._resizeObserver = null;
    this.steps = null;
    this.assignedHotkey = 'Alt+1';
    this.assignedSlot = 'slot1';
  }

  // ==================== START ====================
  async start(onComplete) {
    this.onComplete = onComplete;
    this.currentStep = 0;
    this.steps = buildSteps();

    log('=== STARTING TUTORIAL v12 (9 steps) ===');

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
    this.panels.forEach(p => p.classList.add('tut-visible'));
    await this._wait(300);

    // Handle resize
    this._resizeObserver = new ResizeObserver(() => this._repositionCurrent());
    this._resizeObserver.observe(document.body);

    await this._showStep(0);
  }

  // ==================== SHOW STEP ====================
  async _showStep(index) {
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
    await this._wait(200);

    // Switch tab if needed
    if (step.switchTab) {
      const tabBtn = document.querySelector(`[data-tab="${step.switchTab}"]`);
      if (tabBtn) {
        tabBtn.click();
        await this._wait(200);
      }
    }

    // Wait for settings modal if needed
    if (step.waitForSettings) {
      log('Waiting for settings modal...');
      const settingsModal = await this._waitForEl('#settings-modal.visible', 5000);
      if (!settingsModal) {
        log('Settings modal not found, skipping');
        this._nextStep();
        return;
      }
      await this._wait(400);
    }

    // Find target element
    let target = null;
    if (step.target) {
      target = document.querySelector(step.target);

      if (!target && (step.waitForPrompt || step.waitForModal)) {
        log(`Waiting for target: ${step.target}`);
        const waitSelector = step.waitForPrompt ? '.prompt-card:first-child' : step.target;
        await this._waitForEl(waitSelector, 10000);
        target = document.querySelector(step.target);
        if (!target && step.waitForPrompt) {
          target = document.querySelector('.prompt-card:first-child');
        }
      }

      if (!target) {
        log(`Target ${step.target} not found, auto-advancing`);
        setTimeout(() => this._nextStep(), 1500);
        return;
      }
    }

    // Scroll to target inside settings modal if needed
    if (step.scrollInSettings && target) {
      await this._smoothScrollInSettings(target);
    }

    // Scroll save button into view
    if (step.scrollToBottom && target) {
      const footer = target.closest('.modal')?.querySelector('.modal-footer');
      if (footer) {
        footer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this._wait(500);
      }
    }

    // Render tooltip content
    this.tooltip.innerHTML = this._renderTooltip(step);
    await this._raf();

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
    this.tooltip.classList.add('tut-visible');

    // Auto-fill prompt editor
    if (step.autoFill) {
      setTimeout(() => this._autoFillPrompt(), 350);
    }

    // Auto-open dropdown
    if (step.autoOpenDropdown && target) {
      setTimeout(() => {
        log('Auto-opening dropdown');
        target.focus();
        target.classList.add('tut-dropdown-flash');
        setTimeout(() => target.classList.remove('tut-dropdown-flash'), 600);
      }, 500);
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

    let description = step.description[lang] || step.description.en;
    if (step.dynamic) {
      description = description.replace(/\{hotkey\}/g, this.assignedHotkey);
    }
    description = description.replace(/\n/g, '<br>');

    const badgeHtml = step.badge
      ? `<div class="tut-badge${isPrimary ? ' tut-badge-primary' : ''}">${step.badge[lang] || step.badge.en}</div>`
      : '';

    let hotkeyVisualHtml = '';
    if (step.id === 7) {
      const keys = this.assignedHotkey.split('+');
      hotkeyVisualHtml = `<div class="tut-hotkey-visual">
        ${keys.map(k => `<span class="tut-key">${k.trim()}</span>`).join('<span class="tut-key-plus">+</span>')}
      </div>`;
    }

    const isFinal = step.action === 'final';

    return `
      <div class="tut-content">
        <div class="tut-header">
          <div class="tut-step-num">${step.id}/${total}</div>
          ${!isFinal ? `<button class="tut-skip" id="tut-skip">${lang === 'ru' ? 'Пропустить' : 'Skip'}</button>` : ''}
        </div>
        ${icon ? `<div class="tut-icon${isPrimary ? ' tut-icon-primary' : ''}">${icon}</div>` : ''}
        ${badgeHtml}
        ${hotkeyVisualHtml}
        <div class="tut-title">${step.title[lang] || step.title.en}</div>
        <div class="tut-desc">${description}</div>
        ${isFinal ? `
          <button class="tut-btn-finish" id="tut-finish">${lang === 'ru' ? 'Начать!' : 'Get Started!'}</button>
        ` : step.action === 'observe' || step.action === 'info' ? `
          <button class="tut-btn-next" id="tut-next">${lang === 'ru' ? 'Далее' : 'Next'}</button>
        ` : ''}
        ${!isFinal ? `<div class="tut-progress"><div class="tut-progress-bar" style="width:${(step.id / total) * 100}%"></div></div>` : ''}
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
      // MODAL-AWARE MODE:
      // 1. Raise the modal-overlay above base tutorial panels
      modalOverlay.classList.add('tut-modal-raised');
      // 2. Switch panels to inside-modal mode (z-index above the raised modal)
      this.panels.forEach(p => p.classList.add('tut-inside-modal'));
      log('Target is inside modal — using raised modal z-index');
    } else {
      // Normal mode — remove any previous modal-raised classes
      this.panels.forEach(p => p.classList.remove('tut-inside-modal'));
    }

    // Position the 4 panels around the hole
    // Top panel: full width, from top of screen to top of hole
    const [panelTop, panelRight, panelBottom, panelLeft] = this.panels;

    panelTop.style.left = '0';
    panelTop.style.top = '0';
    panelTop.style.width = `${vw}px`;
    panelTop.style.height = `${holeTop}px`;

    // Right panel: from right of hole to right of screen, from top of hole to bottom of hole
    panelRight.style.left = `${holeRight}px`;
    panelRight.style.top = `${holeTop}px`;
    panelRight.style.width = `${vw - holeRight}px`;
    panelRight.style.height = `${holeBottom - holeTop}px`;

    // Bottom panel: full width, from bottom of hole to bottom of screen
    panelBottom.style.left = '0';
    panelBottom.style.top = `${holeBottom}px`;
    panelBottom.style.width = `${vw}px`;
    panelBottom.style.height = `${vh - holeBottom}px`;

    // Left panel: from left of screen to left of hole, from top of hole to bottom of hole
    panelLeft.style.left = '0';
    panelLeft.style.top = `${holeTop}px`;
    panelLeft.style.width = `${holeLeft}px`;
    panelLeft.style.height = `${holeBottom - holeTop}px`;

    // The target element itself is not covered by any panel — it's in the "hole".
    // Raise it above the panels so it's fully interactive.
    element.classList.add('tut-target-active');
    if (!isInsideModal) {
      this._ensureAncestorStacking(element);
    }

    // If target is a prompt-card or contains one, force actions visible
    const promptCard = element.closest('.prompt-card') || element.querySelector('.prompt-card');
    if (promptCard) {
      promptCard.classList.add('tut-actions-visible');
    }
    // Also for folder cards
    const folderCard = element.closest('.folder-card') || element.querySelector('.folder-card');
    if (folderCard) {
      folderCard.classList.add('tut-actions-visible');
    }

    // Position spotlight ring around the hole
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
      // Only raise ancestors that actually create a stacking context
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
    this.panels.forEach(p => {
      p.style.display = 'none';
    });
  }

  _showFullOverlay() {
    if (this.fullOverlay) {
      this.fullOverlay.style.display = '';
      // Delay to allow display change before opacity transition
      requestAnimationFrame(() => {
        this.fullOverlay.classList.add('tut-visible');
      });
    }
  }

  _hideSpotlight() {
    this.spotlight.style.display = 'none';
  }

  // ==================== POSITION TOOLTIP ====================
  _positionTooltip(element, preferred = 'bottom') {
    // Need to measure tooltip first
    this.tooltip.style.visibility = 'hidden';
    this.tooltip.style.display = 'block';
    const tooltipRect = this.tooltip.getBoundingClientRect();
    this.tooltip.style.visibility = '';

    const elRect = element.getBoundingClientRect();
    const vw = window.innerWidth || 400;
    const vh = window.innerHeight || 600;
    const gap = 16; // Increased gap to prevent overlap
    const margin = 8;

    let top, left;

    switch (preferred) {
      case 'top':
        top = elRect.top - tooltipRect.height - gap;
        left = elRect.left + elRect.width / 2 - tooltipRect.width / 2;
        // If tooltip would go above viewport, flip to bottom
        if (top < margin) {
          top = elRect.bottom + gap;
        }
        break;
      case 'right':
        top = elRect.top + elRect.height / 2 - tooltipRect.height / 2;
        left = elRect.right + gap;
        if (left + tooltipRect.width > vw - margin) {
          left = elRect.left - tooltipRect.width - gap;
        }
        break;
      case 'left':
        top = elRect.top + elRect.height / 2 - tooltipRect.height / 2;
        left = elRect.left - tooltipRect.width - gap;
        if (left < margin) {
          left = elRect.right + gap;
        }
        break;
      default: // bottom
        top = elRect.bottom + gap;
        left = elRect.left + elRect.width / 2 - tooltipRect.width / 2;
        // If tooltip would go below viewport, flip to top
        if (top + tooltipRect.height > vh - margin) {
          top = elRect.top - tooltipRect.height - gap;
        }
    }

    // Clamp to viewport
    left = Math.max(margin, Math.min(left, vw - tooltipRect.width - margin));
    top = Math.max(margin, Math.min(top, vh - tooltipRect.height - margin));

    // Final overlap check: if tooltip still overlaps target, push it away
    const tooltipBottom = top + tooltipRect.height;
    const tooltipRight = left + tooltipRect.width;
    if (top < elRect.bottom && tooltipBottom > elRect.top &&
        left < elRect.right && tooltipRight > elRect.left) {
      // Overlap detected — push tooltip below or above with extra gap
      if (elRect.bottom + gap + tooltipRect.height <= vh - margin) {
        top = elRect.bottom + gap;
      } else if (elRect.top - gap - tooltipRect.height >= margin) {
        top = elRect.top - tooltipRect.height - gap;
      }
      // If still overlapping horizontally, push to the right
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
        this._nextStep();
      });
    }

    if (!target) return;

    // The target is in the "hole" between panels — it's already fully clickable.
    // We just need to listen for the interaction event.

    if (step.action === 'click') {
      const handler = () => {
        target.removeEventListener('click', handler);
        log('Click on target, advancing');
        setTimeout(() => this._nextStep(), 400);
      };
      target.addEventListener('click', handler);
      this._cleanup = () => target.removeEventListener('click', handler);
    }
    else if (step.action === 'change') {
      const handler = (e) => {
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

        setTimeout(() => this._nextStep(), 500);
      };
      target.addEventListener('change', handler);
      this._cleanup = () => target.removeEventListener('change', handler);

      // Also support clicking other slot dropdowns
      const allSlots = document.querySelectorAll('[data-hotkey-slot]');
      const otherHandlers = [];
      allSlots.forEach(sel => {
        if (sel === target) return;
        const h = (e) => {
          allSlots.forEach(s => s.removeEventListener('change', h));
          target.removeEventListener('change', handler);
          const sid = sel.dataset.hotkeySlot;
          const sn = sid.replace('slot', '');
          this.assignedSlot = sid;
          this._detectHotkey(sn).then(hotkey => {
            this.assignedHotkey = hotkey;
          });
          setTimeout(() => this._nextStep(), 500);
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
        setTimeout(() => this._nextStep(), 700);
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

  // ==================== REPOSITION ON RESIZE ====================
  _repositionCurrent() {
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
    this._showStep(this.currentStep + 1);
  }

  _cleanupStep() {
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
    setTimeout(() => {
      this.panels.forEach(p => p.remove());
      this.fullOverlay?.remove();
      this.tooltip?.remove();
      this.spotlight?.remove();
      // Final cleanup
      document.querySelectorAll('.tut-ancestor-raised').forEach(el => {
        el.classList.remove('tut-ancestor-raised');
      });
      document.querySelectorAll('.tut-target-active').forEach(el => {
        el.classList.remove('tut-target-active');
      });
      document.querySelectorAll('.tut-modal-raised').forEach(el => {
        el.classList.remove('tut-modal-raised');
      });
      document.querySelectorAll('.tut-actions-visible').forEach(el => {
        el.classList.remove('tut-actions-visible');
      });
    }, 400);

    // Save completion
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ onboardingTutorialComplete: true });
    }

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

  _waitForEl(selector, timeoutMs = 10000) {
    return new Promise(resolve => {
      const start = Date.now();
      const check = () => {
        const el = document.querySelector(selector);
        if (el) { resolve(el); return; }
        if (Date.now() - start > timeoutMs) { resolve(null); return; }
        requestAnimationFrame(check);
      };
      check();
    });
  }

  _raf() {
    return new Promise(resolve => requestAnimationFrame(resolve));
  }

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== EXPORT ====================
window.OnboardingTutorial = OnboardingTutorial;

})();
