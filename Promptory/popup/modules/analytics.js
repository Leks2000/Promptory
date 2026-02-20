// Promptory Popup - Analytics Module (Mixpanel)
// Centralized analytics tracking for all user actions
// Loaded after mixpanel.min.js and utils.js

window.Promptory = window.Promptory || {};

(function(P) {
'use strict';

// ==================== MIXPANEL INIT ====================
const MIXPANEL_TOKEN = 'c86143cd74824a2d516134f860745000';

// Init Mixpanel (SDK is loaded via <script> tag in popup.html)
if (typeof mixpanel !== 'undefined') {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: false,
    track_pageview: false,        // We track manually in extension context
    persistence: 'localStorage',
    autocapture: true,
    record_sessions_percent: 100
  });
} else {
  console.warn('[Analytics] Mixpanel SDK not loaded');
}

// Safe wrapper — never throw if mixpanel is unavailable
function _track(eventName, properties) {
  try {
    if (typeof mixpanel !== 'undefined' && mixpanel.track) {
      mixpanel.track(eventName, properties || {});
    }
  } catch (e) { /* silent */ }
}

function _identify(userId, traits) {
  try {
    if (typeof mixpanel !== 'undefined') {
      mixpanel.identify(userId);
      if (traits && mixpanel.people) {
        mixpanel.people.set(traits);
      }
    }
  } catch (e) { /* silent */ }
}

function _reset() {
  try {
    if (typeof mixpanel !== 'undefined' && mixpanel.reset) {
      mixpanel.reset();
    }
  } catch (e) { /* silent */ }
}

// ==================== POPUP LIFECYCLE ====================
const _popupOpenTime = Date.now();

P.analyticsTrackPopupOpen = function() {
  _track('Page View', {
    page_url: 'chrome-extension://popup',
    page_title: 'Promptory Popup',
    page_name: 'Popup'
  });
};

P.analyticsTrackPopupClose = function() {
  _track('Page Close', {
    page_url: 'chrome-extension://popup',
    page_title: 'Promptory Popup',
    page_name: 'Popup',
    time_on_page_sec: Math.round((Date.now() - _popupOpenTime) / 1000)
  });
};

// ==================== USER IDENTITY ====================
P.analyticsIdentify = function(user, isPremium) {
  if (!user) return;
  _identify(user.id, {
    '$name': user.name || user.email?.split('@')[0] || '',
    '$email': user.email || '',
    'plan': isPremium ? 'Premium' : 'Free'
  });
};

P.analyticsReset = function() {
  _reset();
};

// ==================== AUTH EVENTS ====================
P.analyticsTrackSignUp = function(user, method) {
  _track('Sign Up', {
    user_id: user?.id || '',
    email: user?.email || '',
    signup_method: method || 'google'
  });
  // Also identify
  P.analyticsIdentify(user, false);
};

P.analyticsTrackSignIn = function(user, method, success) {
  _track('Sign In', {
    user_id: user?.id || '',
    login_method: method || 'google',
    success: !!success
  });
  if (success && user) {
    P.analyticsIdentify(user, P.state?.isPremium);
  }
};

P.analyticsTrackSignOut = function() {
  _track('Sign Out', {});
  _reset();
};

// ==================== PROMPT EVENTS ====================

// Track when user STARTS creating/editing a prompt (opens editor)
P.analyticsTrackPromptEditorOpen = function(isEdit, promptId) {
  _track('Prompt Editor Opened', {
    is_edit: isEdit,
    prompt_id: promptId || null
  });
};

// Track draft auto-save DURING editing (debounced, not spammy)
let _lastDraftTrackTime = 0;
P.analyticsTrackPromptDraftSave = function(isEdit, promptId) {
  const now = Date.now();
  // Throttle: max once per 10 seconds
  if (now - _lastDraftTrackTime < 10000) return;
  _lastDraftTrackTime = now;
  _track('Prompt Draft Saved', {
    is_edit: isEdit,
    prompt_id: promptId || null
  });
};

// Track when a prompt is SUCCESSFULLY created
P.analyticsTrackPromptCreated = function(prompt) {
  _track('Prompt Created', {
    prompt_id: prompt?.id || '',
    has_tags: (prompt?.tags?.length || 0) > 0,
    has_variables: (prompt?.variables?.length || 0) > 0,
    has_image: !!prompt?.imageUrl,
    has_folder: !!prompt?.folderId,
    platform: prompt?.platform || 'universal',
    tags_count: prompt?.tags?.length || 0,
    variables_count: prompt?.variables?.length || 0
  });
  _track('Conversion', {
    'Conversion Type': 'prompt_created',
    'Conversion Value': null
  });
};

// Track when a prompt is SUCCESSFULLY updated
P.analyticsTrackPromptUpdated = function(prompt) {
  _track('Prompt Updated', {
    prompt_id: prompt?.id || '',
    has_tags: (prompt?.tags?.length || 0) > 0,
    has_variables: (prompt?.variables?.length || 0) > 0,
    has_image: !!prompt?.imageUrl,
    has_folder: !!prompt?.folderId,
    platform: prompt?.platform || 'universal'
  });
};

// Track prompt deletion
P.analyticsTrackPromptDeleted = function(promptId) {
  _track('Prompt Deleted', {
    prompt_id: promptId || ''
  });
};

// Track prompt insertion into AI chat
P.analyticsTrackPromptInserted = function(prompt, platform) {
  _track('Prompt Inserted', {
    prompt_id: prompt?.id || '',
    platform: platform || 'unknown',
    has_variables: (prompt?.variables?.length || 0) > 0
  });
};

// Track prompt copy
P.analyticsTrackPromptCopied = function(promptId) {
  _track('Prompt Copied', {
    prompt_id: promptId || ''
  });
};

// Track prompt favorite toggle
P.analyticsTrackPromptFavoriteToggle = function(promptId, isFavorite) {
  _track('Prompt Favorite Toggled', {
    prompt_id: promptId || '',
    is_favorite: isFavorite
  });
};

// ==================== FOLDER EVENTS ====================

// Track when user opens folder editor
P.analyticsTrackFolderEditorOpen = function(isEdit, folderId) {
  _track('Folder Editor Opened', {
    is_edit: isEdit,
    folder_id: folderId || null
  });
};

// Track folder draft save during editing
let _lastFolderDraftTrackTime = 0;
P.analyticsTrackFolderDraftSave = function(isEdit, folderId) {
  const now = Date.now();
  if (now - _lastFolderDraftTrackTime < 10000) return;
  _lastFolderDraftTrackTime = now;
  _track('Folder Draft Saved', {
    is_edit: isEdit,
    folder_id: folderId || null
  });
};

// Track folder created
P.analyticsTrackFolderCreated = function(folder) {
  _track('Folder Created', {
    folder_id: folder?.id || ''
  });
  _track('Conversion', {
    'Conversion Type': 'folder_created',
    'Conversion Value': null
  });
};

// Track folder updated
P.analyticsTrackFolderUpdated = function(folder) {
  _track('Folder Updated', {
    folder_id: folder?.id || ''
  });
};

// Track folder deleted
P.analyticsTrackFolderDeleted = function(folderId) {
  _track('Folder Deleted', {
    folder_id: folderId || ''
  });
};

// ==================== SEARCH ====================
let _lastSearchTrackTime = 0;
P.analyticsTrackSearch = function(query, resultsCount) {
  const now = Date.now();
  // Throttle: max once per 2 seconds
  if (now - _lastSearchTrackTime < 2000) return;
  _lastSearchTrackTime = now;
  _track('Search', {
    search_query: query || '',
    results_count: resultsCount || 0,
    user_id: P.state?.user?.id || ''
  });
};

// ==================== LIBRARY / EXPLORE ====================
P.analyticsTrackLibrarySave = function(libraryPromptId) {
  _track('Library Prompt Saved', {
    library_prompt_id: libraryPromptId || ''
  });
};

P.analyticsTrackLibraryLike = function(libraryPromptId, liked) {
  _track('Library Prompt Liked', {
    library_prompt_id: libraryPromptId || '',
    liked: liked
  });
};

P.analyticsTrackLibraryPublish = function(promptId) {
  _track('Prompt Published to Library', {
    prompt_id: promptId || ''
  });
};

// ==================== UPGRADE / PURCHASE ====================
P.analyticsTrackUpgradeModalOpen = function() {
  _track('Upgrade Modal Opened', {});
};

P.analyticsTrackCheckoutClick = function() {
  _track('Purchase', {
    user_id: P.state?.user?.id || '',
    transaction_id: '',
    revenue: 0,
    currency: 'USD'
  });
  _track('Conversion', {
    'Conversion Type': 'checkout_initiated',
    'Conversion Value': null
  });
};

// ==================== SETTINGS / EXPORT / IMPORT ====================
P.analyticsTrackExport = function(promptCount, folderCount) {
  _track('Data Exported', {
    prompt_count: promptCount || 0,
    folder_count: folderCount || 0
  });
};

P.analyticsTrackImport = function(promptCount, folderCount) {
  _track('Data Imported', {
    prompt_count: promptCount || 0,
    folder_count: folderCount || 0
  });
};

// ==================== TAB NAVIGATION ====================
P.analyticsTrackTabSwitch = function(tabName) {
  _track('Tab Switched', {
    tab_name: tabName || ''
  });
};

// ==================== ERRORS ====================
P.analyticsTrackError = function(errorType, errorMessage, errorCode) {
  _track('Error', {
    error_type: errorType || 'unknown',
    error_message: (errorMessage || '').substring(0, 200),
    error_code: errorCode || '',
    page_url: 'chrome-extension://popup',
    user_id: P.state?.user?.id || ''
  });
};

// ==================== ONBOARDING ====================
P.analyticsTrackOnboardingStart = function() {
  _track('Onboarding Started', {});
};

P.analyticsTrackOnboardingComplete = function() {
  _track('Onboarding Completed', {});
};

P.analyticsTrackTermsAccepted = function() {
  _track('Terms Accepted', {});
};

// ==================== DRAFT RESTORE ====================
P.analyticsTrackDraftRestored = function(type) {
  _track('Draft Restored', {
    draft_type: type || 'prompt' // 'prompt' or 'folder'
  });
};

})(window.Promptory);
