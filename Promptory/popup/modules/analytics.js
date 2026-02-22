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
    api_host: 'https://api-js.mixpanel.com'
    // NOTE: autocapture and record_sessions_percent are intentionally DISABLED.
    // They require loading an external script from cdn.mxpnl.com which is blocked
    // by Manifest V3 CSP (script-src 'self' does not allow external JS).
  });
  console.log('[Analytics] Mixpanel initialized with token:', MIXPANEL_TOKEN.substring(0, 8) + '...');
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

// ==================== SUPER PROPERTIES (set once, sent with every event) ====================
P.analyticsSetSuperProperties = function() {
  try {
    if (typeof mixpanel !== 'undefined' && mixpanel.register) {
      mixpanel.register({
        'app_version': CONFIG.VERSION || '1.10.0',
        'extension_type': 'chrome',
        'plan': P.state?.isPremium ? 'Premium' : 'Free',
        'total_prompts': P.state?.prompts?.length || 0,
        'total_folders': P.state?.folders?.length || 0
      });
    }
  } catch (e) { /* silent */ }
};

// ==================== POPUP LIFECYCLE ====================
const _popupOpenTime = Date.now();

P.analyticsTrackPopupOpen = function() {
  P.analyticsSetSuperProperties();
  _track('Page View', {
    page_url: 'chrome-extension://popup',
    page_title: 'Promptory Popup',
    page_name: 'Popup',
    total_prompts: P.state?.prompts?.length || 0,
    total_folders: P.state?.folders?.length || 0,
    is_premium: P.state?.isPremium || false,
    is_logged_in: !!P.state?.user
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
    'plan': isPremium ? 'Premium' : 'Free',
    'total_prompts': P.state?.prompts?.length || 0,
    'total_folders': P.state?.folders?.length || 0
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

// ==================== PROMPT EDITOR STEP TRACKING ====================
// Tracks the full editing lifecycle: open → field edits → draft save → save/cancel

let _promptEditorOpenTime = 0;
let _promptEditorFieldsEdited = new Set();

// Track when user STARTS creating/editing a prompt (opens editor)
P.analyticsTrackPromptEditorOpen = function(isEdit, promptId) {
  _promptEditorOpenTime = Date.now();
  _promptEditorFieldsEdited = new Set();
  _track('Prompt Editor Opened', {
    is_edit: isEdit,
    prompt_id: promptId || null,
    total_prompts: P.state?.prompts?.length || 0
  });
};

// Track individual field changes during editing (throttled per field)
let _fieldEditTimers = {};
P.analyticsTrackPromptFieldEdit = function(fieldName, isEdit, promptId) {
  _promptEditorFieldsEdited.add(fieldName);
  // Throttle: max once per 30 seconds per field
  const key = `${fieldName}_${promptId || 'new'}`;
  const now = Date.now();
  if (_fieldEditTimers[key] && (now - _fieldEditTimers[key]) < 30000) return;
  _fieldEditTimers[key] = now;
  _track('Prompt Field Edited', {
    field_name: fieldName, // title, text, description, folder, platform, tags, image
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
    prompt_id: promptId || null,
    fields_edited: Array.from(_promptEditorFieldsEdited),
    editing_duration_sec: _promptEditorOpenTime ? Math.round((now - _promptEditorOpenTime) / 1000) : 0
  });
};

// Track when user closes editor WITHOUT saving (cancel/abandon)
P.analyticsTrackPromptEditorClose = function(isEdit, promptId, hadChanges) {
  const duration = _promptEditorOpenTime ? Math.round((Date.now() - _promptEditorOpenTime) / 1000) : 0;
  _track('Prompt Editor Closed', {
    is_edit: isEdit,
    prompt_id: promptId || null,
    had_unsaved_changes: hadChanges,
    fields_edited: Array.from(_promptEditorFieldsEdited),
    editing_duration_sec: duration,
    outcome: hadChanges ? 'abandoned_with_changes' : 'closed_clean'
  });
  _promptEditorOpenTime = 0;
  _promptEditorFieldsEdited = new Set();
};

// Track when a prompt is SUCCESSFULLY created
P.analyticsTrackPromptCreated = function(prompt) {
  const duration = _promptEditorOpenTime ? Math.round((Date.now() - _promptEditorOpenTime) / 1000) : 0;
  _track('Prompt Created', {
    prompt_id: prompt?.id || '',
    has_tags: (prompt?.tags?.length || 0) > 0,
    has_variables: (prompt?.variables?.length || 0) > 0,
    has_image: !!prompt?.imageUrl,
    has_folder: !!prompt?.folderId,
    platform: prompt?.platform || 'universal',
    tags_count: prompt?.tags?.length || 0,
    variables_count: prompt?.variables?.length || 0,
    editing_duration_sec: duration,
    fields_edited: Array.from(_promptEditorFieldsEdited),
    total_prompts: (P.state?.prompts?.length || 0)
  });
  _track('Conversion', {
    'Conversion Type': 'prompt_created',
    'Conversion Value': null
  });
  // Reset editor tracking state
  _promptEditorOpenTime = 0;
  _promptEditorFieldsEdited = new Set();
};

// Track when a prompt is SUCCESSFULLY updated
P.analyticsTrackPromptUpdated = function(prompt) {
  const duration = _promptEditorOpenTime ? Math.round((Date.now() - _promptEditorOpenTime) / 1000) : 0;
  _track('Prompt Updated', {
    prompt_id: prompt?.id || '',
    has_tags: (prompt?.tags?.length || 0) > 0,
    has_variables: (prompt?.variables?.length || 0) > 0,
    has_image: !!prompt?.imageUrl,
    has_folder: !!prompt?.folderId,
    platform: prompt?.platform || 'universal',
    editing_duration_sec: duration,
    fields_edited: Array.from(_promptEditorFieldsEdited)
  });
  // Reset editor tracking state
  _promptEditorOpenTime = 0;
  _promptEditorFieldsEdited = new Set();
};

// Track prompt deletion
P.analyticsTrackPromptDeleted = function(promptId) {
  _track('Prompt Deleted', {
    prompt_id: promptId || '',
    total_prompts: (P.state?.prompts?.length || 0)
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

// ==================== FOLDER EDITOR STEP TRACKING ====================

let _folderEditorOpenTime = 0;

// Track when user opens folder editor
P.analyticsTrackFolderEditorOpen = function(isEdit, folderId) {
  _folderEditorOpenTime = Date.now();
  _track('Folder Editor Opened', {
    is_edit: isEdit,
    folder_id: folderId || null,
    total_folders: P.state?.folders?.length || 0
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
    folder_id: folderId || null,
    editing_duration_sec: _folderEditorOpenTime ? Math.round((now - _folderEditorOpenTime) / 1000) : 0
  });
};

// Track when user closes folder editor WITHOUT saving
P.analyticsTrackFolderEditorClose = function(isEdit, folderId, hadChanges) {
  const duration = _folderEditorOpenTime ? Math.round((Date.now() - _folderEditorOpenTime) / 1000) : 0;
  _track('Folder Editor Closed', {
    is_edit: isEdit,
    folder_id: folderId || null,
    had_unsaved_changes: hadChanges,
    editing_duration_sec: duration,
    outcome: hadChanges ? 'abandoned_with_changes' : 'closed_clean'
  });
  _folderEditorOpenTime = 0;
};

// Track folder created
P.analyticsTrackFolderCreated = function(folder) {
  const duration = _folderEditorOpenTime ? Math.round((Date.now() - _folderEditorOpenTime) / 1000) : 0;
  _track('Folder Created', {
    folder_id: folder?.id || '',
    editing_duration_sec: duration,
    total_folders: (P.state?.folders?.length || 0)
  });
  _track('Conversion', {
    'Conversion Type': 'folder_created',
    'Conversion Value': null
  });
  _folderEditorOpenTime = 0;
};

// Track folder updated
P.analyticsTrackFolderUpdated = function(folder) {
  const duration = _folderEditorOpenTime ? Math.round((Date.now() - _folderEditorOpenTime) / 1000) : 0;
  _track('Folder Updated', {
    folder_id: folder?.id || '',
    editing_duration_sec: duration
  });
  _folderEditorOpenTime = 0;
};

// Track folder deleted
P.analyticsTrackFolderDeleted = function(folderId) {
  _track('Folder Deleted', {
    folder_id: folderId || '',
    total_folders: (P.state?.folders?.length || 0)
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
  _track('Upgrade Modal Opened', {
    total_prompts: P.state?.prompts?.length || 0,
    is_logged_in: !!P.state?.user
  });
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

// ==================== INSTALL / WELCOME PAGE ====================
P.analyticsTrackInstall = function() {
  _track('Extension Installed', {
    app_version: CONFIG.VERSION || '1.10.0'
  });
};

P.analyticsTrackWelcomePageView = function() {
  _track('Page View', {
    page_url: 'chrome-extension://onboarding/welcome',
    page_title: 'Promptory Welcome',
    page_name: 'Welcome'
  });
};

P.analyticsTrackWelcomePageClose = function(autoClose) {
  _track('Page Close', {
    page_url: 'chrome-extension://onboarding/welcome',
    page_title: 'Promptory Welcome',
    page_name: 'Welcome',
    auto_closed: !!autoClose
  });
};

// ==================== DRAFT RESTORE ====================
P.analyticsTrackDraftRestored = function(type) {
  _track('Draft Restored', {
    draft_type: type || 'prompt' // 'prompt' or 'folder'
  });
};

// ==================== SYNC ====================
P.analyticsTrackSyncComplete = function(promptCount, folderCount, isPremium) {
  _track('Cloud Sync Completed', {
    prompt_count: promptCount || 0,
    folder_count: folderCount || 0,
    is_premium: isPremium || false
  });
};

// ==================== EXPOSE MIXPANEL TOKEN FOR OTHER PAGES ====================
P.MIXPANEL_TOKEN = MIXPANEL_TOKEN;

// ==================== CUSTOM EVENT TRACKING ====================
// Specific events requested for analytics dashboard

P.analyticsTrackExtensionOpened = function() {
  _track('extension_opened', {
    total_prompts: P.state?.prompts?.length || 0,
    total_folders: P.state?.folders?.length || 0,
    is_premium: P.state?.isPremium || false,
    is_logged_in: !!P.state?.user,
    tier: P.getUserTier ? P.getUserTier() : (P.state?.isPremium ? 'pro' : (P.state?.user ? 'free' : 'guest'))
  });
};

// Fires alongside the existing Prompt Created tracking
P.analyticsTrackPromptCreatedEvent = function(prompt) {
  _track('prompt_created', {
    prompt_id: prompt?.id || '',
    has_tags: (prompt?.tags?.length || 0) > 0,
    has_variables: (prompt?.variables?.length || 0) > 0,
    platform: prompt?.platform || 'universal',
    total_prompts: P.state?.prompts?.length || 0
  });
};

P.analyticsTrackPromptDeletedEvent = function(promptId) {
  _track('prompt_deleted', {
    prompt_id: promptId || '',
    total_prompts: P.state?.prompts?.length || 0
  });
};

P.analyticsTrackPromptUsed = function(prompt, platform) {
  _track('prompt_used', {
    prompt_id: prompt?.id || '',
    platform: platform || 'unknown',
    has_variables: (prompt?.variables?.length || 0) > 0
  });
};

P.analyticsTrackFolderCreatedEvent = function(folder) {
  _track('folder_created', {
    folder_id: folder?.id || '',
    total_folders: P.state?.folders?.length || 0
  });
};

P.analyticsTrackLimitHit = function(limitType) {
  _track('limit_hit', {
    limit_type: limitType || 'unknown', // 'prompts' or 'folders'
    tier: P.getUserTier ? P.getUserTier() : (P.state?.isPremium ? 'pro' : (P.state?.user ? 'free' : 'guest')),
    current_count: limitType === 'prompts' ? (P.state?.prompts?.length || 0) : (P.state?.folders?.length || 0),
    limit: limitType === 'prompts' ? (P.getEffectiveLimit ? P.getEffectiveLimit() : 0) : (P.getEffectiveFolderLimit ? P.getEffectiveFolderLimit() : 0)
  });
};

P.analyticsTrackProUpgradeClicked = function(planType) {
  _track('pro_upgrade_clicked', {
    plan_type: planType || 'unknown', // 'monthly', 'yearly', 'lifetime'
    is_logged_in: !!P.state?.user,
    tier: P.getUserTier ? P.getUserTier() : 'unknown'
  });
};

P.analyticsTrackGoogleLoginClicked = function(source) {
  _track('google_login_clicked', {
    source: source || 'unknown' // 'welcome', 'settings', 'popup'
  });
};

P.analyticsTrackAgeConfirmed = function(page) {
  _track('age_confirmed', {
    page: page || 'welcome'
  });
};

})(window.Promptory);
