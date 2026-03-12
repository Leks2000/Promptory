// Promptory Welcome Page — Core UI + Analytics + Localisation
// Extracted from inline <script> blocks for CSP compliance.
// CSP: script-src 'self' blocks inline scripts in Manifest V3 extensions.
(function() {
  'use strict';

  // ==================== PHASE 1: Core UI Logic ====================
  // Checkbox listener attached FIRST so buttons always work
  // even if analytics scripts (mixpanel) fail to load.

  // === DOM elements ===
  const checkbox     = document.getElementById('age-terms-checkbox');
  const googleBtn    = document.getElementById('google-signin-btn');
  const skipBtn      = document.getElementById('skip-btn');
  const statusEl     = document.getElementById('status-message');

  // === Core function: sync button states with checkbox ===
  function syncButtonState() {
    const checked = checkbox.checked;
    googleBtn.disabled = !checked;
    skipBtn.disabled   = !checked;
    if (statusEl) { statusEl.classList.remove('visible'); statusEl.textContent = ''; }
    console.log('[Promptory] Checkbox state:', checked, '-> buttons disabled:', !checked);
  }

  // === Checkbox change event (native toggle via clicking the input directly) ===
  checkbox.addEventListener('change', function() {
    syncButtonState();
    if (checkbox.checked && typeof trackEvent === 'function') {
      trackEvent('age_confirmed', { page: 'welcome' });
    }
  });

  // === Text-wrap click: toggle checkbox when clicking the text (not links) ===
  // This replaces the broken <label> approach where <a> tags with preventDefault
  // would prevent the checkbox from toggling.
  var termsTextWrap = document.getElementById('terms-text-wrap');
  if (termsTextWrap) {
    termsTextWrap.addEventListener('click', function(e) {
      // If user clicked a link (<a>), don't toggle — let the link handler fire
      if (e.target.closest('.terms-link')) return;
      // Otherwise, toggle the checkbox
      checkbox.checked = !checkbox.checked;
      // Manually dispatch change event (programmatic .checked doesn't trigger it)
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  // === Link click handlers — open in new tab, do NOT affect checkbox ===
  function attachTermsLinks() {
    var termsLink = document.getElementById('terms-link');
    var privacyLink = document.getElementById('privacy-link');

    if (termsLink) {
      termsLink.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation(); // Prevent checkbox toggle
        try { chrome.tabs.create({ url: 'https://leks2000.github.io/promptory-privacy/terms.html' }); }
        catch (err) { console.warn('[Promptory] openExtPage error:', err); }
      });
    }

    if (privacyLink) {
      privacyLink.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation(); // Prevent checkbox toggle
        try { chrome.tabs.create({ url: 'https://leks2000.github.io/promptory-privacy' }); }
        catch (err) { console.warn('[Promptory] openExtPage error:', err); }
      });
    }
  }
  attachTermsLinks();

  // === Helper: show error ===
  function showStatus(msg) {
    if (statusEl) { statusEl.textContent = msg; statusEl.classList.add('visible'); }
  }

  // === Store acceptance flags + mark hasLaunched ===
  function storeAcceptance() {
    try {
      chrome.storage.local.set({
        ageVerified: true,
        ageVerifiedDate: Date.now(),
        termsAccepted: true,
        privacyAccepted: true,
        hasLaunched: true
      });
    } catch (e) { console.warn('[Promptory] storage.set error:', e); }
  }

  // === Close this tab ===
  function closePage() {
    if (typeof trackEvent === 'function') {
      trackEvent('Page Close', {
        page_url: 'chrome-extension://onboarding/welcome',
        page_title: 'Promptory Welcome',
        page_name: 'Welcome',
        auto_closed: false
      });
    }
    // Close the current tab
    setTimeout(function() {
      try {
        chrome.tabs.getCurrent(function(tab) {
          if (tab) chrome.tabs.remove(tab.id);
        });
      } catch (e) {
        window.close();
      }
    }, 300);
  }

  // === Google Sign-in ===
  googleBtn.addEventListener('click', async function() {
    if (!checkbox.checked) return;

    if (typeof trackEvent === 'function') {
      trackEvent('google_login_clicked', { page: 'welcome' });
    }

    // Show loading state
    googleBtn.disabled = true;
    googleBtn.classList.add('loading');
    document.getElementById('google-btn-text').textContent = 'Signing in...';

    // Store acceptance
    storeAcceptance();

    try {
      // Send message to background service worker for Google OAuth
      var result = await new Promise(function(resolve, reject) {
        chrome.runtime.sendMessage({ action: 'signInWithGoogle' }, function(response) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });

      if (result && result.success) {
        if (typeof trackEvent === 'function') {
          trackEvent('google_login_success', { page: 'welcome' });
        }
        // Success! Close this page
        closePage();
      } else {
        // Login failed — reset button
        showStatus((result && result.error) || 'Sign-in failed. Please try again.');
        googleBtn.disabled = false;
        googleBtn.classList.remove('loading');
        var lang = document.getElementById('page-title').textContent.indexOf('\u0414\u043E\u0431\u0440\u043E') !== -1 ? 'ru' : 'en';
        document.getElementById('google-btn-text').textContent = lang === 'ru' ? '\u0412\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Google' : 'Sign in with Google';
        if (typeof trackEvent === 'function') {
          trackEvent('google_login_failed', { page: 'welcome', error: result && result.error });
        }
      }
    } catch (e) {
      console.warn('[Promptory] Google sign-in error:', e);
      showStatus('Sign-in error: ' + (e.message || 'Unknown error'));
      googleBtn.disabled = false;
      googleBtn.classList.remove('loading');
      document.getElementById('google-btn-text').textContent = 'Sign in with Google';
    }
  });

  // === Skip (start without account) ===
  skipBtn.addEventListener('click', function() {
    if (!checkbox.checked) return;

    storeAcceptance();

    if (typeof trackEvent === 'function') {
      trackEvent('extension_opened', { page: 'welcome', method: 'skip_account' });
    }

    // Close this page
    closePage();
  });

  // === Track manual page close ===
  window.addEventListener('beforeunload', function() {
    if (typeof trackEvent === 'function') {
      trackEvent('Page Close', {
        page_url: 'chrome-extension://onboarding/welcome',
        page_title: 'Promptory Welcome',
        page_name: 'Welcome',
        auto_closed: false
      });
    }
  });

  // === DEBUG: Log that Phase 1 loaded successfully ===
  console.log('[Promptory] Welcome page Phase 1 loaded. Checkbox:', checkbox, 'GoogleBtn:', googleBtn, 'SkipBtn:', skipBtn);


  // ==================== PHASE 2: Analytics & Localisation ====================
  // May safely fail without affecting UI.

  // === Safe trackEvent — global for Phase 1 callers ===
  window.trackEvent = function(name, props) {
    try {
      if (typeof mixpanel !== 'undefined' && mixpanel.track) {
        mixpanel.track(name, props || {});
      }
    } catch (e) { /* silent */ }
  };

  // === Initialise Mixpanel ===
  try {
    var MIXPANEL_TOKEN = 'c86143cd74824a2d516134f860745000';
    if (typeof mixpanel !== 'undefined') {
      mixpanel.init(MIXPANEL_TOKEN, {
        debug: false,
        track_pageview: false,
        persistence: 'localStorage',
        api_host: 'https://api-js.mixpanel.com'
      });

      var appVersion = (typeof CONFIG !== 'undefined' && CONFIG.VERSION)
        ? CONFIG.VERSION : '1.10.0';

      mixpanel.track('Extension Installed', {
        app_version: appVersion,
        page_url: 'chrome-extension://onboarding/welcome',
        page_name: 'Welcome'
      });

      mixpanel.track('Page View', {
        page_url: 'chrome-extension://onboarding/welcome',
        page_title: 'Promptory Welcome',
        page_name: 'Welcome'
      });
    }
  } catch (e) {
    console.warn('[Promptory] Mixpanel init error:', e);
  }

  // === Localisation (Russian detection) ===
  function localise() {
    try {
      chrome.storage.local.get(['language'], function(res) {
        try {
          var lang = (res && res.language) || (navigator.language.startsWith('ru') ? 'ru' : 'en');
          if (lang === 'ru') {
            document.getElementById('page-title').textContent = '\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C \u0432 Promptory!';
            document.getElementById('page-subtitle').textContent = '\u0412\u0430\u0448 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 AI-\u043F\u0440\u043E\u043C\u043F\u0442\u043E\u0432. \u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0439\u0442\u0435, \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0443\u0439\u0442\u0435 \u0438 \u043C\u0433\u043D\u043E\u0432\u0435\u043D\u043D\u043E \u0432\u0441\u0442\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u043F\u0440\u043E\u043C\u043F\u0442\u044B \u0432 ChatGPT, Claude, Gemini \u0438 \u0434\u0440\u0443\u0433\u0438\u0435.';
            document.getElementById('terms-text-before').textContent = '\u041C\u043D\u0435 \u0435\u0441\u0442\u044C 13 \u043B\u0435\u0442, \u0438 \u044F \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u044E';
            document.getElementById('terms-link').textContent = '\u0423\u0441\u043B\u043E\u0432\u0438\u044F \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F';
            document.getElementById('privacy-link').textContent = '\u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0443 \u043A\u043E\u043D\u0444\u0438\u0434\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u0438';
            document.getElementById('google-btn-text').textContent = '\u0412\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Google';
            document.getElementById('google-hint-text').textContent = '\u041F\u043E\u043B\u0443\u0447\u0438 100 \u043F\u0440\u043E\u043C\u043F\u0442\u043E\u0432 \u0432\u043C\u0435\u0441\u0442\u043E 25';
            document.getElementById('skip-btn-text').textContent = '\u041D\u0430\u0447\u0430\u0442\u044C \u0431\u0435\u0437 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430';
          }
        } catch (e) {
          console.warn('[Promptory] Localisation callback error:', e);
        }
      });
    } catch (e) {
      console.warn('[Promptory] chrome.storage.local.get error:', e);
    }
  }

  localise();
})();
