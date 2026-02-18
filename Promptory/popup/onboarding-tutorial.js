// Promptory Onboarding Tutorial Module v10
// COMPLETE REWRITE — Game-style spotlight overlay tutorial
// Flow: Create prompt → Settings → Quick Insert → Select slot → Save → Use hotkey → Library teaser
// Features: clip-path cutout overlay, pulsing border, smooth scroll, dynamic hotkey detection

(function() {
'use strict';

const DEBUG = true;
function log(...args) {
  if (DEBUG) console.log('[Tutorial v10]', ...args);
}

// ==================== STEP DEFINITIONS ====================
// Steps are built dynamically based on user's actual hotkey config
function buildSteps(assignedSlotKey) {
  // assignedSlotKey is the key user chose a prompt for, e.g. 'slot1' → Alt+1
  // We detect which hotkey the user ends up using
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
      tooltipPosition: 'bottom',
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
      tooltipPosition: 'left',
      icon: 'settings',
      badge: { en: 'SETTINGS', ru: 'НАСТРОЙКИ' },
      switchTab: 'prompts'
    },
    // === STEP 4: Focus on Quick Insert section (scroll to it) ===
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
    // === STEP 7: Show the hotkey to use (dynamic based on which slot user chose) ===
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
      dynamic: true // description is computed at render time
    },
    // === STEP 8: Library teaser (login required) ===
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
    this.overlay = null;
    this.tooltip = null;
    this.spotlight = null;
    this.onComplete = null;
    this._cleanup = null;
    this._resizeObserver = null;
    this.steps = null;
    this.assignedHotkey = 'Alt+1'; // Default; updated if user picks different slot
    this.assignedSlot = 'slot1';
  }

  // ==================== START ====================
  async start(onComplete) {
    this.onComplete = onComplete;
    this.currentStep = 0;
    this.steps = buildSteps();

    log('=== STARTING TUTORIAL v10 (9 steps) ===');

    // Create overlay container (full screen, handles darkening)
    this.overlay = document.createElement('div');
    this.overlay.className = 'tut-overlay';
    this.overlay.id = 'tut-overlay';
    document.body.appendChild(this.overlay);

    // Create spotlight ring (pulsing border around target)
    this.spotlight = document.createElement('div');
    this.spotlight.className = 'tut-spotlight';
    this.spotlight.id = 'tut-spotlight';
    document.body.appendChild(this.spotlight);

    // Create tooltip container
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tut-tooltip';
    this.tooltip.id = 'tut-tooltip';
    document.body.appendChild(this.tooltip);

    // Fade in overlay
    await this._raf();
    this.overlay.classList.add('tut-visible');
    await this._wait(300);

    // Handle resize to reposition
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

      // Wait for element if needed
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
      const modalBody = target.closest('.modal-body');
      if (modalBody) {
        const targetRect = target.getBoundingClientRect();
        const modalRect = modalBody.getBoundingClientRect();
        // Scroll footer area into view
        const footer = target.closest('.modal')?.querySelector('.modal-footer');
        if (footer) {
          footer.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await this._wait(500);
        }
      }
    }

    // Render tooltip content
    this.tooltip.innerHTML = this._renderTooltip(step);
    await this._raf();

    // Position spotlight and tooltip
    if (target) {
      this._highlightTarget(target, step);
      this._positionTooltip(target, step.tooltipPosition);
    } else {
      // Center tooltip for info/final steps
      this._hideSpotlight();
      this._centerTooltip();
      // Darken everything
      this.overlay.style.clipPath = 'none';
      this.overlay.classList.add('tut-full-dim');
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
        // Small flash to draw attention
        target.classList.add('tut-dropdown-flash');
        setTimeout(() => target.classList.remove('tut-dropdown-flash'), 600);
      }, 500);
    }

    // Setup interaction for this step
    this._setupInteraction(step, target);
  }

  // ==================== RENDER TOOLTIP ====================
  _renderTooltip(step) {
    const lang = this._getLang();
    const total = this.steps.length;
    const icon = ICONS[step.icon] || '';
    const isPrimary = step.isPrimary;

    // Process dynamic descriptions (replace {hotkey})
    let description = step.description[lang] || step.description.en;
    if (step.dynamic) {
      description = description.replace(/\{hotkey\}/g, this.assignedHotkey);
    }
    description = description.replace(/\n/g, '<br>');

    // Feature badge
    const badgeHtml = step.badge
      ? `<div class="tut-badge${isPrimary ? ' tut-badge-primary' : ''}">${step.badge[lang] || step.badge.en}</div>`
      : '';

    // Build hotkey visual for step 7
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

  // ==================== HIGHLIGHT TARGET ====================
  _highlightTarget(element, step) {
    const rect = element.getBoundingClientRect();
    const pad = 6;

    // Ensure the target element (and its ancestors) can render above the overlay.
    // Walk up the DOM and force any ancestor with a stacking context that would
    // trap our z-index to also sit above the overlay layer.
    element.classList.add('tut-target-active');
    this._ensureAncestorStacking(element);

    // Position spotlight ring
    this.spotlight.style.display = 'block';
    this.spotlight.style.left = `${rect.left - pad}px`;
    this.spotlight.style.top = `${rect.top - pad}px`;
    this.spotlight.style.width = `${rect.width + pad * 2}px`;
    this.spotlight.style.height = `${rect.height + pad * 2}px`;
    this.spotlight.style.borderRadius = step.borderRadius || '8px';

    // Update overlay clip-path to create "hole"
    this.overlay.classList.remove('tut-full-dim');
    this._updateOverlayHole(rect, pad);
  }

  // Walk up ancestors and temporarily raise any positioned/stacking containers
  // so the target element can paint above the z-index:9998 overlay.
  _ensureAncestorStacking(element) {
    let el = element.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      const style = getComputedStyle(el);
      // If ancestor creates a stacking context (has z-index set, or transform, etc.)
      // we need to raise it above the overlay so the child's z-index works.
      const pos = style.position;
      if (pos === 'relative' || pos === 'absolute' || pos === 'fixed' || pos === 'sticky') {
        const currentZ = parseInt(style.zIndex, 10);
        if (isNaN(currentZ) || currentZ < 10001) {
          el.classList.add('tut-ancestor-raised');
        }
      }
      el = el.parentElement;
    }
  }

  _updateOverlayHole(rect, pad) {
    const l = rect.left - pad;
    const t = rect.top - pad;
    const r = rect.right + pad;
    const b = rect.bottom + pad;

    // Cross-browser clip-path polygon with hole (non-zero winding)
    // Outer rect clockwise, inner rect counter-clockwise
    this.overlay.style.clipPath = `polygon(
      0% 0%, 100% 0%, 100% ${t}px,
      ${r}px ${t}px, ${r}px ${b}px,
      100% ${b}px, 100% 100%, 0% 100%,
      0% ${b}px, ${l}px ${b}px,
      ${l}px ${t}px, 0% ${t}px
    )`;
  }

  _hideSpotlight() {
    this.spotlight.style.display = 'none';
  }

  // ==================== POSITION TOOLTIP ====================
  _positionTooltip(element, preferred = 'bottom') {
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const elRect = element.getBoundingClientRect();
    const vw = window.innerWidth || 400;
    const vh = window.innerHeight || 600;
    const gap = 14;
    const margin = 8;

    let top, left;

    // Calculate based on preferred position
    switch (preferred) {
      case 'top':
        top = elRect.top - tooltipRect.height - gap;
        left = elRect.left + elRect.width / 2 - tooltipRect.width / 2;
        break;
      case 'right':
        top = elRect.top + elRect.height / 2 - tooltipRect.height / 2;
        left = elRect.right + gap;
        break;
      case 'left':
        top = elRect.top + elRect.height / 2 - tooltipRect.height / 2;
        left = elRect.left - tooltipRect.width - gap;
        break;
      default: // bottom
        top = elRect.bottom + gap;
        left = elRect.left + elRect.width / 2 - tooltipRect.width / 2;
    }

    // Boundary checks — flip if out of view
    if (top < margin && preferred === 'top') {
      top = elRect.bottom + gap;
    }
    if (top + tooltipRect.height > vh - margin && preferred === 'bottom') {
      top = elRect.top - tooltipRect.height - gap;
    }

    // Clamp
    left = Math.max(margin, Math.min(left, vw - tooltipRect.width - margin));
    top = Math.max(margin, Math.min(top, vh - tooltipRect.height - margin));

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

    // Make target interactive — it's already raised by tut-target-active class
    // Just ensure pointer-events are explicitly enabled
    target.style.pointerEvents = 'auto';

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
      // For <select> — listen for change event
      const handler = (e) => {
        target.removeEventListener('change', handler);
        log('Selection changed, value:', target.value);

        // Detect which slot the user picked and what prompt
        const slotId = target.dataset.hotkeySlot; // e.g. 'slot1'
        if (slotId) {
          const slotNum = slotId.replace('slot', '');
          this.assignedSlot = slotId;
          // Try to detect the actual Chrome shortcut for this slot
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
          // User picked a different slot
          allSlots.forEach(s => s.removeEventListener('change', h));
          target.removeEventListener('change', handler);
          const slotId = sel.dataset.hotkeySlot;
          const slotNum = slotId.replace('slot', '');
          this.assignedSlot = slotId;
          this._detectHotkey(slotNum).then(hotkey => {
            this.assignedHotkey = hotkey;
            log(`User chose different slot ${slotId}: ${hotkey}`);
          });
          setTimeout(() => this._nextStep(), 500);
        };
        sel.addEventListener('change', h);
        otherHandlers.push({ el: sel, handler: h });
        // Make other slots clickable too
        sel.style.zIndex = '10001';
        sel.style.position = sel.style.position || 'relative';
        sel.style.pointerEvents = 'auto';
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

    // Scroll target into center of modal
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
      el.style.zIndex = '';
      el.style.cursor = '';
      el.style.pointerEvents = '';
    });

    // Remove ancestor stacking overrides
    document.querySelectorAll('.tut-ancestor-raised').forEach(el => {
      el.classList.remove('tut-ancestor-raised');
    });

    // Reset other slot z-indices
    document.querySelectorAll('[data-hotkey-slot]').forEach(el => {
      el.style.zIndex = '';
      el.style.pointerEvents = '';
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
    if (this.overlay) {
      this.overlay.classList.remove('tut-visible');
      this.overlay.classList.remove('tut-full-dim');
      this.overlay.style.clipPath = 'none';
    }
    if (this.tooltip) {
      this.tooltip.classList.remove('tut-visible');
    }
    if (this.spotlight) {
      this.spotlight.style.display = 'none';
    }

    // Remove elements after fade
    setTimeout(() => {
      this.overlay?.remove();
      this.tooltip?.remove();
      this.spotlight?.remove();
      // Final cleanup of any ancestor stacking overrides
      document.querySelectorAll('.tut-ancestor-raised').forEach(el => {
        el.classList.remove('tut-ancestor-raised');
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
      // Use Promptory's lang if available
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
