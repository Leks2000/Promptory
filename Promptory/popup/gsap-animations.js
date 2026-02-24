// ============================================
// Promptory GSAP Animations Module
// Comprehensive animation suite for the extension popup
// Uses GSAP 3.x with ScrollTrigger
// ============================================

(function() {
'use strict';

// Wait for GSAP to load
if (typeof gsap === 'undefined') {
  console.warn('GSAP not loaded, skipping animations');
  return;
}

// Register plugins
if (typeof ScrollTrigger !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// ============================================
// CONFIGURATION
// ============================================
const GSAP_CONFIG = {
  cardStagger: 0.06,
  cardDuration: 0.5,
  tabTransitionDuration: 0.35,
  modalDuration: 0.4,
  welcomeDuration: 0.8,
  hoverScale: 1.03,
  magneticStrength: 0.15,
  maxStaggerItems: 20
};

// ============================================
// UTILITY: Safe GSAP wrapper
// ============================================
function safeAnimate(target, vars) {
  if (!target || (typeof target === 'string' && !document.querySelector(target))) return null;
  return gsap.to(target, vars);
}

// ============================================
// 1. WELCOME SCREEN ANIMATIONS
// ============================================
function animateWelcomeScreen() {
  const screen = document.getElementById('welcome-screen');
  if (!screen || screen.style.display === 'none') return;
  
  const tl = gsap.timeline({
    defaults: { ease: 'power3.out' }
  });
  
  tl
    // Background radial glow pulse
    .from(screen, {
      opacity: 0,
      duration: 0.6
    })
    // Logo: 3D spin-in with elastic bounce
    .from('#welcome-logo', {
      scale: 0,
      rotation: -360,
      opacity: 0,
      duration: 0.9,
      ease: 'back.out(2.5)'
    }, '-=0.3')
    // Continuous logo float (replaces CSS animation)
    .to('#welcome-logo', {
      y: -8,
      duration: 2.5,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    })
    // Title: slide up with blur effect
    .from('#welcome-title', {
      y: 30,
      opacity: 0,
      filter: 'blur(8px)',
      duration: 0.6,
    }, '-=2.5')
    // Subtitle text
    .from('#welcome-text', {
      y: 20,
      opacity: 0,
      duration: 0.5,
    }, '-=2')
    // Feature items: staggered cascade from left
    .from('.welcome-feature', {
      x: -40,
      opacity: 0,
      scale: 0.9,
      stagger: 0.12,
      duration: 0.5,
      ease: 'back.out(1.5)'
    }, '-=1.5')
    // Get Started button: scale bounce
    .from('#get-started-btn', {
      scale: 0.6,
      opacity: 0,
      duration: 0.5,
      ease: 'back.out(3)'
    }, '-=0.8');
  
  // Button continuous pulse glow
  gsap.to('#get-started-btn', {
    boxShadow: '0 0 30px rgba(108, 92, 231, 0.6)',
    duration: 1.5,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
    delay: 2
  });
  
  return tl;
}

// ============================================
// 2. MAIN APP HEADER ANIMATIONS
// ============================================
function animateHeader() {
  const header = document.querySelector('.header');
  if (!header) return;
  
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  
  tl
    .from('.header', {
      y: -60,
      opacity: 0,
      duration: 0.5,
    })
    .from('.app-title', {
      x: -20,
      opacity: 0,
      duration: 0.4,
    }, '-=0.3')
    .from('.header-right button', {
      scale: 0,
      opacity: 0,
      stagger: 0.1,
      duration: 0.3,
      ease: 'back.out(3)'
    }, '-=0.2');
    
  // Settings gear: continuous slow rotation on hover
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('mouseenter', () => {
      gsap.to(settingsBtn.querySelector('svg'), {
        rotation: 180,
        duration: 0.6,
        ease: 'power2.inOut'
      });
    });
    settingsBtn.addEventListener('mouseleave', () => {
      gsap.to(settingsBtn.querySelector('svg'), {
        rotation: 0,
        duration: 0.5,
        ease: 'power2.inOut'
      });
    });
  }
  
  return tl;
}

// ============================================
// 3. SEARCH BAR ANIMATIONS
// ============================================
function animateSearchBar() {
  const searchBar = document.querySelector('.search-bar');
  if (!searchBar) return;
  
  gsap.from(searchBar, {
    y: -20,
    opacity: 0,
    duration: 0.4,
    delay: 0.2,
    ease: 'power3.out'
  });
  
  const input = document.getElementById('search-input');
  if (input) {
    // Focus: expand with glow
    input.addEventListener('focus', () => {
      gsap.to(searchBar, {
        boxShadow: '0 0 20px rgba(108, 92, 231, 0.15)',
        duration: 0.3,
        ease: 'power2.out'
      });
      gsap.to(input, {
        scale: 1.01,
        duration: 0.2,
        ease: 'power2.out'
      });
    });
    
    input.addEventListener('blur', () => {
      gsap.to(searchBar, {
        boxShadow: 'none',
        duration: 0.3,
        ease: 'power2.out'
      });
      gsap.to(input, {
        scale: 1,
        duration: 0.2,
        ease: 'power2.out'
      });
    });
  }
}

// ============================================
// 4. TAB NAVIGATION ANIMATIONS
// ============================================
function animateTabs() {
  const tabs = document.querySelector('.tabs');
  if (!tabs) return;
  
  // Initial entrance
  gsap.from('.tabs', {
    y: -15,
    opacity: 0,
    duration: 0.4,
    delay: 0.3,
    ease: 'power3.out'
  });
  
  gsap.from('.tab-btn', {
    y: -10,
    opacity: 0,
    stagger: 0.06,
    duration: 0.3,
    delay: 0.4,
    ease: 'back.out(2)'
  });
  
  // Enhanced tab click animation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Active tab bounce
      gsap.fromTo(btn, 
        { scale: 0.9 },
        { scale: 1, duration: 0.4, ease: 'elastic.out(1.2, 0.5)' }
      );
      
      // Content area transition
      const tabId = btn.dataset.tab + '-tab';
      const content = document.getElementById(tabId);
      if (content) {
        gsap.fromTo(content,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: GSAP_CONFIG.tabTransitionDuration, ease: 'power3.out' }
        );
      }
    });
  });
}

// ============================================
// 5. PROMPT CARD ANIMATIONS
// ============================================
function animatePromptCards(container) {
  const cards = container ? 
    container.querySelectorAll('.prompt-card') : 
    document.querySelectorAll('.prompt-card');
  
  if (!cards.length) return;
  
  const visibleCards = Array.from(cards).slice(0, GSAP_CONFIG.maxStaggerItems);
  
  gsap.from(visibleCards, {
    y: 30,
    opacity: 0,
    scale: 0.95,
    stagger: GSAP_CONFIG.cardStagger,
    duration: GSAP_CONFIG.cardDuration,
    ease: 'power3.out',
    clearProps: 'all'
  });
}

// Enhanced card hover with GSAP
function initCardHoverEffects() {
  // Use event delegation for performance
  document.addEventListener('mouseenter', (e) => {
    const card = e.target.closest('.prompt-card, .folder-card, .fav-card');
    if (!card) return;
    
    gsap.to(card, {
      y: -4,
      scale: GSAP_CONFIG.hoverScale,
      boxShadow: '0 12px 40px rgba(108, 92, 231, 0.15)',
      duration: 0.3,
      ease: 'power2.out'
    });
  }, true);
  
  document.addEventListener('mouseleave', (e) => {
    const card = e.target.closest('.prompt-card, .folder-card, .fav-card');
    if (!card) return;
    
    gsap.to(card, {
      y: 0,
      scale: 1,
      boxShadow: 'none',
      duration: 0.4,
      ease: 'elastic.out(1, 0.5)',
      clearProps: 'boxShadow'
    });
  }, true);
  
  // Click feedback on cards
  document.addEventListener('mousedown', (e) => {
    const card = e.target.closest('.prompt-card, .folder-card, .fav-card');
    if (!card) return;
    gsap.to(card, { scale: 0.97, duration: 0.1, ease: 'power2.in' });
  }, true);
  
  document.addEventListener('mouseup', (e) => {
    const card = e.target.closest('.prompt-card, .folder-card, .fav-card');
    if (!card) return;
    gsap.to(card, { scale: 1, duration: 0.3, ease: 'elastic.out(1, 0.5)' });
  }, true);
}

// ============================================
// 6. FOLDER SECTION ANIMATIONS
// ============================================
function animateFolderToggle(section, expanding) {
  if (!section) return;
  
  const content = section.querySelector('.folder-content');
  const arrow = section.querySelector('.folder-arrow svg');
  
  if (expanding) {
    // Arrow rotate
    gsap.to(arrow, {
      rotation: 90,
      duration: 0.35,
      ease: 'back.out(2)'
    });
    
    // Content reveal
    gsap.fromTo(content, 
      { maxHeight: 0, opacity: 0 },
      { maxHeight: 2000, opacity: 1, duration: 0.5, ease: 'power3.out' }
    );
    
    // Stagger cards inside
    const cards = content.querySelectorAll('.prompt-card');
    if (cards.length) {
      gsap.from(cards, {
        y: 15,
        opacity: 0,
        stagger: 0.04,
        duration: 0.3,
        delay: 0.15,
        ease: 'power3.out',
        clearProps: 'all'
      });
    }
  } else {
    gsap.to(arrow, {
      rotation: 0,
      duration: 0.3,
      ease: 'power2.inOut'
    });
    
    gsap.to(content, {
      maxHeight: 0,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in'
    });
  }
}

function animateFolderCards() {
  const cards = document.querySelectorAll('.folder-card');
  if (!cards.length) return;
  
  gsap.from(cards, {
    x: -30,
    opacity: 0,
    stagger: 0.08,
    duration: 0.4,
    ease: 'power3.out',
    clearProps: 'all'
  });
}

// ============================================
// 7. FAVORITES ANIMATIONS
// ============================================
function animateFavorites() {
  const list = document.getElementById('favorites-list');
  if (!list) return;
  
  // Header
  const header = list.querySelector('.favorites-header');
  if (header) {
    gsap.from(header, {
      y: -10,
      opacity: 0,
      duration: 0.4,
      ease: 'power3.out'
    });
  }
  
  // Fav cards with cascade
  const cards = list.querySelectorAll('.fav-card');
  if (cards.length) {
    gsap.from(cards, {
      x: 30,
      opacity: 0,
      scale: 0.95,
      stagger: 0.06,
      duration: 0.4,
      ease: 'back.out(1.5)',
      clearProps: 'all'
    });
  }
}

// Star toggle animation
function animateStarToggle(button, isFavorite) {
  if (!button) return;
  
  const svg = button.querySelector('svg');
  if (!svg) return;
  
  if (isFavorite) {
    // Add to favorites: star burst
    gsap.timeline()
      .to(svg, { scale: 1.5, rotation: 20, duration: 0.15, ease: 'power2.out' })
      .to(svg, { scale: 0.8, rotation: -10, duration: 0.1 })
      .to(svg, { scale: 1.2, rotation: 5, duration: 0.1 })
      .to(svg, { scale: 1, rotation: 0, duration: 0.2, ease: 'elastic.out(1, 0.5)' });
  } else {
    // Remove from favorites: shrink and fade
    gsap.timeline()
      .to(svg, { scale: 0.6, opacity: 0.3, duration: 0.15 })
      .to(svg, { scale: 1, opacity: 1, duration: 0.3, ease: 'power2.out' });
  }
}

// ============================================
// 8. EXPLORE CARD ANIMATIONS
// ============================================
function animateExploreCards() {
  const cards = document.querySelectorAll('.explore-card-wrapper');
  if (!cards.length) return;
  
  const visibleCards = Array.from(cards).slice(0, GSAP_CONFIG.maxStaggerItems);
  
  gsap.from(visibleCards, {
    y: 40,
    opacity: 0,
    scale: 0.9,
    rotationX: 10,
    stagger: {
      each: 0.08,
      grid: [2, 'auto'],
      from: 'start'
    },
    duration: 0.5,
    ease: 'power3.out',
    clearProps: 'all'
  });
}

// Card flip animation (enhanced with GSAP)
function animateCardFlip(card, flipping) {
  if (!card) return;
  
  gsap.to(card, {
    rotationY: flipping ? 180 : 0,
    duration: 0.6,
    ease: 'power2.inOut'
  });
}

// ============================================
// 9. MODAL ANIMATIONS
// ============================================
function animateModalOpen(modalOverlay) {
  if (!modalOverlay) return;
  
  const modal = modalOverlay.querySelector('.modal');
  if (!modal) return;
  
  const tl = gsap.timeline();
  
  tl
    .fromTo(modalOverlay, 
      { opacity: 0 },
      { opacity: 1, duration: 0.25, ease: 'power2.out' }
    )
    .fromTo(modal,
      { scale: 0.85, y: -30, opacity: 0, rotationX: 5 },
      { scale: 1, y: 0, opacity: 1, rotationX: 0, duration: GSAP_CONFIG.modalDuration, ease: 'back.out(1.7)' },
      '-=0.15'
    );
  
  // Stagger form elements inside modal
  const formElements = modal.querySelectorAll('.form-group, .modal-footer .btn');
  if (formElements.length) {
    gsap.from(formElements, {
      y: 15,
      opacity: 0,
      stagger: 0.06,
      duration: 0.3,
      delay: 0.2,
      ease: 'power3.out'
    });
  }
  
  return tl;
}

function animateModalClose(modalOverlay, onComplete) {
  if (!modalOverlay) {
    if (onComplete) onComplete();
    return;
  }
  
  const modal = modalOverlay.querySelector('.modal');
  
  const tl = gsap.timeline({
    onComplete: () => {
      if (onComplete) onComplete();
    }
  });
  
  if (modal) {
    tl.to(modal, {
      scale: 0.9,
      y: 20,
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in'
    });
  }
  
  tl.to(modalOverlay, {
    opacity: 0,
    duration: 0.15,
    ease: 'power2.in'
  }, '-=0.1');
  
  return tl;
}

// ============================================
// 10. TOAST NOTIFICATION ANIMATIONS
// ============================================
function animateToastIn(toast) {
  if (!toast) return;
  
  gsap.fromTo(toast,
    { y: 100, opacity: 0, scale: 0.8 },
    { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }
  );
}

function animateToastOut(toast) {
  if (!toast) return;
  
  gsap.to(toast, {
    y: 80,
    opacity: 0,
    scale: 0.8,
    duration: 0.3,
    ease: 'power2.in'
  });
}

// ============================================
// 11. STATS DASHBOARD ANIMATIONS
// ============================================
function animateStatsDashboard() {
  const dashboard = document.querySelector('.stats-dashboard');
  if (!dashboard) return;
  
  // Stat cards: stagger with counter effect
  const statCards = dashboard.querySelectorAll('.stat-card');
  gsap.from(statCards, {
    y: 30,
    opacity: 0,
    scale: 0.85,
    stagger: 0.12,
    duration: 0.5,
    ease: 'back.out(2)',
    clearProps: 'all'
  });
  
  // Counter animation for stat values
  statCards.forEach((card, i) => {
    const valueEl = card.querySelector('.stat-card-value');
    if (!valueEl) return;
    
    const text = valueEl.textContent;
    const num = parseInt(text);
    
    if (!isNaN(num) && num > 0) {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: num,
        duration: 1.5,
        delay: i * 0.15,
        ease: 'power2.out',
        onUpdate: () => {
          valueEl.textContent = Math.round(obj.val);
        }
      });
    }
  });
  
  // Chart bars: grow from bottom
  const chartBars = dashboard.querySelectorAll('.chart-bar');
  chartBars.forEach((bar, i) => {
    const height = bar.style.height;
    gsap.from(bar, {
      height: '2px',
      duration: 0.8,
      delay: 0.3 + i * 0.08,
      ease: 'elastic.out(1, 0.5)'
    });
  });
  
  // Platform stat bars: width animation
  const platformBars = dashboard.querySelectorAll('.platform-stat-bar');
  platformBars.forEach((bar, i) => {
    const width = bar.style.width;
    gsap.from(bar, {
      width: '0%',
      duration: 0.8,
      delay: 0.5 + i * 0.1,
      ease: 'power3.out'
    });
  });
  
  // Stats sections: cascade reveal
  const sections = dashboard.querySelectorAll('.stats-section');
  gsap.from(sections, {
    y: 20,
    opacity: 0,
    stagger: 0.15,
    duration: 0.5,
    delay: 0.3,
    ease: 'power3.out'
  });
  
  // Top prompt items: slide in from left
  const topItems = dashboard.querySelectorAll('.top-prompt-item');
  gsap.from(topItems, {
    x: -30,
    opacity: 0,
    stagger: 0.08,
    duration: 0.4,
    delay: 0.5,
    ease: 'power3.out'
  });
}

// ============================================
// 12. EMPTY STATE ANIMATIONS
// ============================================
function animateEmptyState() {
  const emptyStates = document.querySelectorAll('.empty-state');
  
  emptyStates.forEach(state => {
    const tl = gsap.timeline();
    
    tl
      .from(state, {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power3.out'
      })
      .from(state.querySelector('.empty-state-title'), {
        y: 15,
        opacity: 0,
        duration: 0.3,
      }, '-=0.2')
      .from(state.querySelector('.empty-state-text'), {
        y: 10,
        opacity: 0,
        duration: 0.3,
      }, '-=0.15')
      .from(state.querySelector('.btn'), {
        scale: 0.8,
        opacity: 0,
        duration: 0.3,
        ease: 'back.out(2)'
      }, '-=0.1');
  });
}

// ============================================
// 13. CONTEXT MENU ANIMATION
// ============================================
function animateContextMenuOpen(menu) {
  if (!menu) return;
  
  gsap.fromTo(menu,
    { scale: 0.9, opacity: 0, y: -8 },
    { scale: 1, opacity: 1, y: 0, duration: 0.2, ease: 'back.out(2)' }
  );
  
  const items = menu.querySelectorAll('.context-menu-item');
  gsap.from(items, {
    x: -10,
    opacity: 0,
    stagger: 0.03,
    duration: 0.15,
    delay: 0.05,
    ease: 'power2.out'
  });
}

// ============================================
// 14. COPY SUCCESS ANIMATION
// ============================================
function animateCopySuccess(card) {
  if (!card) return;
  
  // Flash green border
  gsap.timeline()
    .to(card, {
      borderColor: 'rgba(0, 184, 148, 0.5)',
      boxShadow: '0 0 20px rgba(0, 184, 148, 0.3)',
      scale: 1.02,
      duration: 0.15,
      ease: 'power2.out'
    })
    .to(card, {
      borderColor: '',
      boxShadow: '',
      scale: 1,
      duration: 0.4,
      ease: 'elastic.out(1, 0.5)',
      clearProps: 'borderColor,boxShadow'
    });
}

// ============================================
// 15. DRAG AND DROP ANIMATIONS
// ============================================
function animateDragStart(card) {
  if (!card) return;
  gsap.to(card, {
    scale: 0.95,
    opacity: 0.7,
    boxShadow: '0 15px 40px rgba(0,0,0,0.3)',
    rotation: 2,
    duration: 0.2,
    ease: 'power2.out'
  });
}

function animateDragEnd(card) {
  if (!card) return;
  gsap.to(card, {
    scale: 1,
    opacity: 1,
    boxShadow: '',
    rotation: 0,
    duration: 0.4,
    ease: 'elastic.out(1, 0.5)',
    clearProps: 'all'
  });
}

function animateDropTarget(section, active) {
  if (!section) return;
  const header = section.querySelector('.folder-header');
  if (!header) return;
  
  if (active) {
    gsap.to(header, {
      scale: 1.02,
      boxShadow: '0 0 25px rgba(108, 92, 231, 0.4)',
      borderColor: 'rgba(108, 92, 231, 0.5)',
      duration: 0.2,
      ease: 'power2.out'
    });
  } else {
    gsap.to(header, {
      scale: 1,
      boxShadow: '',
      borderColor: '',
      duration: 0.3,
      ease: 'power2.out',
      clearProps: 'all'
    });
  }
}

// ============================================
// 16. BUTTON HOVER EFFECTS (GLOBAL)
// ============================================
function initButtonEffects() {
  // Primary buttons: pulse shadow on hover
  document.addEventListener('mouseenter', (e) => {
    const btn = e.target.closest('.btn-primary');
    if (!btn) return;
    
    gsap.to(btn, {
      scale: 1.03,
      boxShadow: '0 6px 25px rgba(108, 92, 231, 0.4)',
      duration: 0.25,
      ease: 'power2.out'
    });
  }, true);
  
  document.addEventListener('mouseleave', (e) => {
    const btn = e.target.closest('.btn-primary');
    if (!btn) return;
    
    gsap.to(btn, {
      scale: 1,
      boxShadow: '',
      duration: 0.3,
      ease: 'elastic.out(1, 0.5)',
      clearProps: 'boxShadow'
    });
  }, true);
  
  // Ghost/Secondary buttons
  document.addEventListener('mouseenter', (e) => {
    const btn = e.target.closest('.btn-secondary, .btn-ghost');
    if (!btn) return;
    gsap.to(btn, { scale: 1.03, duration: 0.2, ease: 'power2.out' });
  }, true);
  
  document.addEventListener('mouseleave', (e) => {
    const btn = e.target.closest('.btn-secondary, .btn-ghost');
    if (!btn) return;
    gsap.to(btn, { scale: 1, duration: 0.3, ease: 'elastic.out(1, 0.5)' });
  }, true);
}

// ============================================
// 17. SKELETON LOADING SHIMMER (GSAP-powered)
// ============================================
function animateSkeletons() {
  const skeletons = document.querySelectorAll('.skeleton');
  
  skeletons.forEach(skeleton => {
    gsap.to(skeleton, {
      opacity: 0.4,
      duration: 0.8,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });
  });
}

// ============================================
// 18. SCROLL-BASED ANIMATIONS
// ============================================
function initScrollAnimations() {
  // Animate items as they scroll into view within lists
  const lists = ['#prompts-list', '#folders-list', '#favorites-list', '#explore-list'];
  
  lists.forEach(listSelector => {
    const list = document.querySelector(listSelector);
    if (!list) return;
    
    // Use IntersectionObserver for scroll-triggered card animations
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target._gsapAnimated) {
          entry.target._gsapAnimated = true;
          gsap.from(entry.target, {
            y: 15,
            opacity: 0,
            duration: 0.35,
            ease: 'power3.out'
          });
        }
      });
    }, { threshold: 0.1, rootMargin: '50px' });
    
    const cards = list.querySelectorAll('.prompt-card, .folder-card, .fav-card, .explore-card-wrapper');
    cards.forEach(card => observer.observe(card));
  });
}

// ============================================
// 19. MAGNETIC BUTTON EFFECT
// ============================================
function initMagneticEffects() {
  const magneticElements = document.querySelectorAll('.btn-primary, .prompt-action-btn, .explore-action-btn');
  
  magneticElements.forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      gsap.to(el, {
        x: x * GSAP_CONFIG.magneticStrength,
        y: y * GSAP_CONFIG.magneticStrength,
        duration: 0.3,
        ease: 'power2.out'
      });
    });
    
    el.addEventListener('mouseleave', () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: 'elastic.out(1, 0.5)'
      });
    });
  });
}

// ============================================
// 20. REVIEW BANNER ANIMATION
// ============================================
function animateReviewBanner(banner, visible) {
  if (!banner) return;
  
  if (visible) {
    gsap.fromTo(banner,
      { y: '100%', opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' }
    );
  } else {
    gsap.to(banner, {
      y: '100%',
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in'
    });
  }
}

// ============================================
// 21. LIMIT BANNER ANIMATION
// ============================================
function animateLimitBanner() {
  const banner = document.getElementById('limit-banner');
  if (!banner) return;
  
  gsap.from(banner, {
    height: 0,
    opacity: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    duration: 0.5,
    ease: 'power3.out'
  });
}

// ============================================
// 22. ONBOARDING TUTORIAL ANIMATIONS
// ============================================
function animateOnboardingStep(step) {
  if (!step) return;
  
  gsap.from(step, {
    opacity: 0,
    scale: 0.9,
    y: 20,
    duration: 0.5,
    ease: 'back.out(1.7)'
  });
}

// ============================================
// 23. TAG ANIMATIONS
// ============================================
function animateTagsAppear(container) {
  if (!container) return;
  
  const tags = container.querySelectorAll('.tag');
  gsap.from(tags, {
    scale: 0,
    opacity: 0,
    stagger: 0.05,
    duration: 0.3,
    ease: 'back.out(3)'
  });
}

// ============================================
// INITIALIZATION
// ============================================
function init() {
  // Core hover effects (always active)
  initCardHoverEffects();
  initButtonEffects();
  
  // Wait for DOM to be fully rendered
  requestAnimationFrame(() => {
    // Welcome screen
    if (document.getElementById('welcome-screen')?.style.display !== 'none') {
      animateWelcomeScreen();
    }
    
    // Main app
    if (document.getElementById('main-app')?.style.display !== 'none') {
      animateHeader();
      animateSearchBar();
      animateTabs();
      
      // Delay card animations slightly
      setTimeout(() => {
        animatePromptCards();
        initMagneticEffects();
        initScrollAnimations();
      }, 300);
    }
  });
  
  console.log('Promptory GSAP animations initialized');
}

// ============================================
// EXPOSE API
// ============================================
window.PromptoryGSAP = {
  init,
  animateWelcomeScreen,
  animateHeader,
  animateSearchBar,
  animateTabs,
  animatePromptCards,
  animateFolderCards,
  animateFolderToggle,
  animateFavorites,
  animateStarToggle,
  animateExploreCards,
  animateCardFlip,
  animateModalOpen,
  animateModalClose,
  animateToastIn,
  animateToastOut,
  animateStatsDashboard,
  animateEmptyState,
  animateContextMenuOpen,
  animateCopySuccess,
  animateDragStart,
  animateDragEnd,
  animateDropTarget,
  animateSkeletons,
  animateReviewBanner,
  animateLimitBanner,
  animateOnboardingStep,
  animateTagsAppear,
  initScrollAnimations,
  initMagneticEffects,
  GSAP_CONFIG
};

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
