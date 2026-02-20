// Promptory Popup - Settings Module
// Settings modal, shortcuts display, upgrade modal, hotkey sync

window.Promptory = window.Promptory || {};

(function(P) {
'use strict';

const state = P.state;
const t = P.t.bind(P);
const escapeHtml = P.escapeHtml;
const showToast = P.showToast;
const saveData = P.saveData;
const closeModal = P.closeModal;
const supabaseMsg = P.supabaseMsg;
const supabaseMsgWithRetry = P.supabaseMsgWithRetry;

// ==================== OPEN SETTINGS (DOM API for user data) ====================
P.openSettingsModal = function(opts = {}) {
  const {
    renderExplore,
    renderPrompts,
    renderFolders,
    renderFavorites,
    renderLimitBanner,
    syncAllData,
    loadLibraryPrompts,
    checkPremiumStatus,
    showUpgradeModal,
    loadAdminDashboard,
    loadPendingReports,
    renderModerationPanel,
    parseCSVLine,
    setSuppressRender,
    updateStaticTexts,
    FREE_PROMPT_LIMIT,
    SETTINGS_PROMPT_SELECT_LIMIT
  } = opts;

  const s = state.settings;
  const user = state.user;
  const hotkeys = s.hotkeys || {};

  const commandNames = {
    'open-search': { label: t('searchOverlay'), default: 'Alt+S' },
    'hotkey-1': { label: t('quickInsertSlot', '1'), default: 'Alt+1' },
    'hotkey-2': { label: t('quickInsertSlot', '2'), default: 'Alt+2' },
    'hotkey-3': { label: t('quickInsertSlot', '3'), default: 'Alt+3' }
  };

  const modal = document.createElement('div');
  modal.className = 'modal-overlay no-blur';
  modal.id = 'settings-modal';

  // Build modal structure using DOM API for user data sections
  const modalInner = document.createElement('div');
  modalInner.className = 'modal';
  modalInner.style.maxWidth = '500px';

  // === HEADER ===
  const header = document.createElement('div');
  header.className = 'modal-header';
  const titleEl = document.createElement('h2');
  titleEl.className = 'modal-title';
  titleEl.textContent = t('settings');
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-icon btn-ghost close-modal-btn';
  closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  modalInner.appendChild(header);

  // === BODY ===
  const body = document.createElement('div');
  body.className = 'modal-body';

  // -- Account section (DOM API for user data) --
  const accountGroup = document.createElement('div');
  accountGroup.className = 'form-group';
  const accountLabel = document.createElement('label');
  accountLabel.className = 'form-label';
  accountLabel.textContent = t('account');
  accountGroup.appendChild(accountLabel);

  if (user) {
    const accountCard = document.createElement('div');
    accountCard.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);border:1px solid var(--border);';

    const accountInfo = document.createElement('div');
    const emailDiv = document.createElement('div');
    emailDiv.style.fontWeight = '500';
    emailDiv.textContent = user.email || user.name || t('signedIn'); // textContent = safe

    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = 'font-size:var(--font-size-xs);color:var(--text-tertiary);margin-top:2px;';
    statusDiv.textContent = `${t('cloudSyncActive')}${state.isPremium ? ' | Premium' : ` | ${t('free')} (${state.prompts.length}/${P.getEffectiveLimit()})`}`;

    accountInfo.appendChild(emailDiv);
    accountInfo.appendChild(statusDiv);
    accountCard.appendChild(accountInfo);

    const signOutBtn = document.createElement('button');
    signOutBtn.className = 'btn btn-secondary btn-sm';
    signOutBtn.id = 'settings-signout-btn';
    signOutBtn.textContent = t('signOut');
    accountCard.appendChild(signOutBtn);
    accountGroup.appendChild(accountCard);
  } else {
    const signInBtn = document.createElement('button');
    signInBtn.className = 'btn btn-primary';
    signInBtn.id = 'settings-signin-btn';
    signInBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/></svg>${escapeHtml(t('signInWithGoogle'))}`;
    const hint = document.createElement('span');
    hint.className = 'form-hint';
    hint.textContent = t('signInHint');
    accountGroup.appendChild(signInBtn);
    accountGroup.appendChild(hint);
  }
  body.appendChild(accountGroup);
  body.appendChild(_divider());

  // The remaining settings sections use innerHTML since they don't contain untrusted user data.
  // Only the account section above needed DOM API protection.
  const remainingSections = document.createElement('div');
  remainingSections.innerHTML = `
    <div class="form-group"><label class="form-label">${t('language')}</label><select id="settings-lang"><option value="en" ${P.getLang() === 'en' ? 'selected' : ''}>${t('langEnglish')}</option><option value="ru" ${P.getLang() === 'ru' ? 'selected' : ''}>${t('langRussian')}</option></select></div><div class="divider"></div>
    <div class="form-group"><label class="form-label">${t('keyboardShortcuts')}</label><span class="form-hint" style="margin-bottom:12px;display:block;">${t('shortcutsHint')} <a href="#" id="open-shortcuts-link" style="color:var(--accent);">${t('chromeShortcuts')}</a></span><div class="hotkey-rebind-section" id="shortcuts-display"></div></div><div class="divider"></div>
    <div class="form-group"><label class="form-label">${t('quickInsertPrompts')}</label><span class="form-hint" style="margin-bottom:12px;display:block;">${t('quickInsertHint')}</span><span class="form-hint" style="margin-bottom:8px;display:block;">${state.prompts.length > SETTINGS_PROMPT_SELECT_LIMIT ? `Showing recent ${SETTINGS_PROMPT_SELECT_LIMIT} prompts for faster settings` : ''}</span><div class="hotkey-section" data-hotkey-section="true">
      ${(() => {
        const maxSlots = P.getQuickInsertSlots ? P.getQuickInsertSlots() : 3;
        return [1, 2, 3].map(n => {
        const slotId = `slot${n}`;
        const slot = hotkeys[slotId] || {};
        const assigned = slot.promptId ? state.prompts.find(p => p.id === slot.promptId) : null;
        const isLocked = n > maxSlots;
        if (isLocked) {
          return `<div class="hotkey-item" style="opacity:0.5;"><div class="hotkey-info"><div class="hotkey-name">${t('slot', n)} 🔒</div><div class="hotkey-description">${t('signInToUnlock') || 'Sign in to unlock'}</div></div><div class="hotkey-key"><div class="hotkey-badge">Alt+${n}</div></div></div>`;
        }
        return `<div class="hotkey-item"><div class="hotkey-info"><div class="hotkey-name">${t('slot', n)}</div><div class="hotkey-description">${assigned ? escapeHtml(P.truncate(assigned.title, 25)) : t('noPromptAssigned')}</div></div><div class="hotkey-key"><select class="hotkey-prompt-select" data-hotkey-slot="${slotId}"><option value="">${t('selectPrompt')}</option>${P.getSettingsPromptOptions(slot.promptId)}</select><div class="hotkey-badge">Alt+${n}</div></div></div>`;
      }).join('');
      })()}
    </div></div><div class="divider"></div>
    <div class="form-group"><label class="form-label">${t('theme')}</label><select id="settings-theme"><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>${t('themeDark')}</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>${t('themeLight')}</option><option value="system" ${s.theme === 'system' ? 'selected' : ''}>${t('themeSystem')}</option></select></div><div class="divider"></div>
    <div class="form-group"><label class="form-label">${t('dataManagement')}</label><div style="display:flex;flex-direction:column;gap:8px;">${P.canExportImport && P.canExportImport() ? `<button class="btn btn-secondary" id="settings-export-btn">${t('exportAllData')}</button><button class="btn btn-secondary" id="settings-import-btn">${t('importData')}</button>` : `<div style="font-size:var(--font-size-sm);color:var(--text-tertiary);padding:8px 0;">${t('signInForExport') || 'Sign in with Google to export/import data'}</div>`}</div></div><div class="divider"></div>
    <div class="form-group"><label class="form-label">${t('proSubscription')}</label>
      <div class="pro-settings-card">
        <div class="pro-settings-header">
          <div class="pro-settings-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
          <div class="pro-settings-info">
            <div class="pro-settings-title">${state.isPremium ? t('premiumActive') : t('proSubscription')}</div>
            <div class="pro-settings-subtitle">${state.isPremium ? t('premiumActiveDesc') : t('proSubtitleShort')}</div>
          </div>
          ${state.isPremium ? '<span class="pro-badge-active">PRO</span>' : ''}
        </div>
        ${!state.isPremium ? `<div class="pro-settings-features">
          <div class="pro-feature-mini"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>${t('premiumFeature1')}</span></div>
          <div class="pro-feature-mini"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>${t('premiumFeature2')}</span></div>
          <div class="pro-feature-mini"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>${t('premiumFeature3')}</span></div>
        </div>` : ''}
        <button class="btn ${state.isPremium ? 'btn-secondary' : 'btn-primary'} ripple" id="settings-upgrade-btn" style="width:100%;justify-content:center;gap:6px;margin-top:12px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${state.isPremium ? '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>' : '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'}</svg>
          ${state.isPremium ? t('manageSubscription') : t('upgradeToPro')}
        </button>
      </div>
    </div><div class="divider"></div>
    <div class="form-group"><label class="form-label">${t('community') || 'Community & Links'}</label>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <a href="https://t.me/user_Alexander" target="_blank" class="settings-link telegram-link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-16.5 7.5a2.25 2.25 0 0 0 .126 4.133l3.978 1.326 1.518 4.854a1.5 1.5 0 0 0 2.565.535l2.012-2.324 3.845 2.884a2.25 2.25 0 0 0 3.503-1.193l3.75-16.5a2.25 2.25 0 0 0-2.775-2.43z"/></svg>
          <div class="settings-link-text"><div class="settings-link-title">Telegram</div><div class="settings-link-subtitle">@user_Alexander</div></div>
        </a>
        <a href="https://t.me/WORLD_ArIn_NEWS" target="_blank" class="settings-link telegram-link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-16.5 7.5a2.25 2.25 0 0 0 .126 4.133l3.978 1.326 1.518 4.854a1.5 1.5 0 0 0 2.565.535l2.012-2.324 3.845 2.884a2.25 2.25 0 0 0 3.503-1.193l3.75-16.5a2.25 2.25 0 0 0-2.775-2.43z"/></svg>
          <div class="settings-link-text"><div class="settings-link-title">AI News</div><div class="settings-link-subtitle">@WORLD_ArIn_NEWS</div></div>
        </a>
        <a href="https://softerror-studios.itch.io" target="_blank" class="settings-link itch-link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          <div class="settings-link-text"><div class="settings-link-title">itch.io Games</div><div class="settings-link-subtitle">softerror-studios.itch.io</div></div>
        </a>
      </div>
    </div><div class="divider"></div>
    <div class="form-group"><label class="form-label">${t('supportDeveloper') || 'Support Developer'}</label>
      <a href="https://donationalerts.com/r/knightcoreking" target="_blank" class="settings-link donation-link">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <div class="settings-link-text"><div class="settings-link-title">${t('supportViaDonation') || 'Support via DonationAlerts'}</div><div class="settings-link-subtitle">${t('helpDevelopment') || 'Help us improve Promptory'}</div></div>
      </a>
    </div><div class="divider"></div>
    ${state.isAdmin ? `
    <div class="form-group"><label class="form-label">${t('adminModeration')} <span class="admin-badge">ADMIN</span></label><div id="moderation-panel-container"></div></div><div class="divider"></div>
    <div class="form-group"><label class="form-label">${t('adminDashboard')} <span class="admin-badge">ADMIN</span></label>
      <div id="admin-dashboard-container"><button class="btn btn-secondary btn-sm" id="load-admin-dashboard-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>${t('loadDashboard')}</button></div>
    </div><div class="divider"></div>
    ` : ''}
    ${state.user ? `
    <div class="form-group"><label class="form-label">${t('yourRights')}</label>
      <div class="gdpr-rights"><div class="gdpr-rights-list">
        <div class="gdpr-right-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>${t('rightToAccess')}</span></div>
        <div class="gdpr-right-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>${t('rightToExport')}</span></div>
        <div class="gdpr-right-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>${t('rightToDelete')}</span></div>
      </div>
      <button class="btn btn-sm btn-danger" id="request-deletion-btn" style="width:100%;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>${t('requestDeletion')}</button></div>
    </div><div class="divider"></div>
    ` : ''}
    <div class="form-group"><label class="form-label">${t('about')}</label><div style="font-size:var(--font-size-sm);color:var(--text-secondary);line-height:1.6;"><strong>Promptory</strong> v${CONFIG.VERSION}<br>${t('aboutDescription')}<div style="margin-top:8px;display:flex;gap:12px;"><a href="${chrome.runtime.getURL('privacy.html')}" target="_blank" style="color:var(--accent);font-size:var(--font-size-xs);">Privacy Policy</a><a href="${chrome.runtime.getURL('terms.html')}" target="_blank" style="color:var(--accent);font-size:var(--font-size-xs);">Terms of Service</a></div></div></div>
  `;
  body.appendChild(remainingSections);
  modalInner.appendChild(body);

  // === FOOTER ===
  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.innerHTML = `<button class="btn btn-ghost close-modal-btn">${t('cancel')}</button><button class="btn btn-primary" id="settings-save-btn">${t('saveChanges')}</button>`;
  modalInner.appendChild(footer);
  modal.appendChild(modalInner);
  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    modal.classList.add('visible');
    _loadShortcutsDisplay(commandNames);
    if (state.isAdmin && loadPendingReports && renderModerationPanel) {
      loadPendingReports().then(() => renderModerationPanel());
    }
    document.getElementById('load-admin-dashboard-btn')?.addEventListener('click', () => {
      if (loadAdminDashboard) loadAdminDashboard(30);
    });
  });

  // Wire up all event listeners (same logic as before)
  document.getElementById('open-shortcuts-link')?.addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }); });

  // GDPR deletion
  document.getElementById('request-deletion-btn')?.addEventListener('click', async () => {
    if (!confirm(t('deleteAccountConfirm'))) return;
    window.open('https://t.me/user_Alexander?text=' + encodeURIComponent(`Account Deletion Request\nEmail: ${state.user?.email || 'Unknown'}\nUser ID: ${state.user?.id || 'Unknown'}\n\nPlease delete all my data from Promptory.`), '_blank');
    showToast(t('accountDeletionRequested'), 'success');
  });

  // Sign in
  document.getElementById('settings-signin-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('settings-signin-btn');
    btn.classList.add('loading');
    P.analyticsTrackGoogleLoginClicked('settings');
    const savedEmail = state.user?.email || '';
    const result = await new Promise(resolve => chrome.runtime.sendMessage({ action: 'signInWithGoogle', loginHint: savedEmail }, resolve));
    btn.classList.remove('loading');
    if (result?.success) {
      state.user = result.user;
      state.session = result.session;
      // Update limit to free tier (100) immediately on sign-in
      if (!state.isPremium) {
        state.promptLimit = CONFIG.FREE_PROMPT_LIMIT;
        await saveData('promptLimit', state.promptLimit);
      }
      await saveData('user', state.user);
      await saveData('session', state.session);
      closeModal('settings-modal');
      // Analytics: track sign in
      P.analyticsTrackSignIn(state.user, 'google', true);
      showToast(t('signedInSuccess'), 'success');
      if (renderExplore) renderExplore();
      setTimeout(() => {
        Promise.allSettled([
          syncAllData ? syncAllData() : Promise.resolve(),
          loadLibraryPrompts ? loadLibraryPrompts() : Promise.resolve(),
          checkPremiumStatus ? checkPremiumStatus() : Promise.resolve()
        ]);
      }, 50);
    } else {
      // Analytics: track sign in failure
      P.analyticsTrackSignIn(null, 'google', false);
      showToast(t('signInFailed') + ': ' + (result?.error || ''), 'error');
    }
  });

  // Sign out
  document.getElementById('settings-signout-btn')?.addEventListener('click', async () => {
    if (!confirm(t('signOutConfirm'))) return;
    const btn = document.getElementById('settings-signout-btn');
    if (btn) btn.classList.add('loading');
    try {
      await new Promise((resolve) => chrome.runtime.sendMessage({ action: 'signOut' }, (r) => resolve(r || { success: true })));
    } catch (e) { /* non-critical */ }
    state.user = null; state.session = null; state.isPremium = false;
    // Analytics: track sign out
    P.analyticsTrackSignOut();
    state.prompts = []; state.folders = [];
    state.settings.hotkeys = { slot1: { promptId: null }, slot2: { promptId: null }, slot3: { promptId: null } };
    state.libraryPrompts = []; state.userLikes = new Set(); state.userReports = new Set();
    state.promptLimit = CONFIG.GUEST_PROMPT_LIMIT; state.isAdmin = false; state.pendingReports = [];
    state.searchOriginalPrompts = null;
    if (setSuppressRender) setSuppressRender(true);
    await saveData('prompts', []); await saveData('folders', []); await saveData('settings', state.settings);
    await saveData('isPremium', false); await saveData('promptLimit', CONFIG.GUEST_PROMPT_LIMIT);
    await saveData('libraryPromptsCache', []); await saveData('user', null); await saveData('session', null);
    if (setSuppressRender) setSuppressRender(false);
    if (btn) btn.classList.remove('loading');
    showToast(t('signedOutSuccess'), 'success');
    closeModal('settings-modal');
    requestAnimationFrame(() => {
      if (renderPrompts) renderPrompts();
      if (renderFolders) renderFolders();
      if (renderFavorites) renderFavorites();
      if (renderExplore) renderExplore();
      if (renderLimitBanner) renderLimitBanner();
    });
  });

  // Export
  document.getElementById('settings-export-btn')?.addEventListener('click', () => {
    const data = { prompts: state.prompts, folders: state.folders, settings: state.settings, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `promptory-backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(a.href);
    // Analytics: track export
    P.analyticsTrackExport(state.prompts.length, state.folders.length);
    showToast(t('dataExported'), 'success');
  });

  // Upgrade
  document.getElementById('settings-upgrade-btn')?.addEventListener('click', () => {
    if (state.isPremium && CONFIG.LEMONSQUEEZY_CUSTOMER_PORTAL) {
      window.open(CONFIG.LEMONSQUEEZY_CUSTOMER_PORTAL, '_blank');
    } else if (showUpgradeModal) {
      showUpgradeModal();
    }
  });

  // Import (with schema validation)
  document.getElementById('settings-import-btn')?.addEventListener('click', () => {
    _handleImport(opts);
  });

  // Save
  document.getElementById('settings-save-btn').addEventListener('click', async () => {
    state.settings.theme = document.getElementById('settings-theme').value;
    const newLang = document.getElementById('settings-lang').value;
    document.querySelectorAll('[data-hotkey-slot]').forEach(sel => {
      const slotId = sel.dataset.hotkeySlot;
      if (!state.settings.hotkeys) state.settings.hotkeys = {};
      if (!state.settings.hotkeys[slotId]) state.settings.hotkeys[slotId] = {};
      state.settings.hotkeys[slotId].promptId = sel.value || null;
    });
    await saveData('settings', state.settings);
    P.applyTheme(state.settings.theme);
    if (newLang !== P.getLang()) {
      P.setLang(newLang);
      await saveData('language', newLang);
      if (updateStaticTexts) updateStaticTexts();
    }
    if (state.session) P.syncHotkeysToSupabase();
    showToast(t('settingsSaved'), 'success');
    closeModal('settings-modal');
    if (renderPrompts) renderPrompts();
    if (renderFolders) renderFolders();
    if (renderFavorites) renderFavorites();
    if (renderLimitBanner) renderLimitBanner();
  });

  modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => closeModal('settings-modal')));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal('settings-modal'); });
};

// ==================== IMPORT HANDLER (with schema validation) ====================
function _handleImport(opts) {
  const { parseCSVLine, renderPrompts, renderFolders, renderFavorites, setSuppressRender } = opts;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.csv';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileName = file.name.toLowerCase();

    try {
      const fileText = await file.text();

      if (fileName.endsWith('.csv')) {
        _importCSV(fileText, opts);
        return;
      }

      // JSON import with full schema validation
      let data;
      try { data = JSON.parse(fileText); }
      catch (parseErr) { throw new Error('Invalid JSON: ' + parseErr.message.substring(0, 100)); }

      // Validate root structure
      if (typeof data !== 'object' || data === null) throw new Error('JSON root must be an object, got: ' + typeof data);
      if (!data.prompts && !data.folders) throw new Error('JSON must contain "prompts" and/or "folders" arrays. Found keys: ' + Object.keys(data).join(', '));

      // Validate prompts array schema
      if (data.prompts) {
        if (!Array.isArray(data.prompts)) throw new Error('"prompts" must be an array, got: ' + typeof data.prompts);
        const invalid = [];
        data.prompts.forEach((p, i) => {
          if (typeof p !== 'object' || p === null) { invalid.push(`prompts[${i}]: not an object`); return; }
          if (!p.title && !p.text) invalid.push(`prompts[${i}]: missing title and text`);
          if (p.id && typeof p.id !== 'string') invalid.push(`prompts[${i}]: id must be string`);
          if (p.tags && !Array.isArray(p.tags)) invalid.push(`prompts[${i}]: tags must be array`);
          if (p.variables && !Array.isArray(p.variables)) invalid.push(`prompts[${i}]: variables must be array`);
          if (p.useCount !== undefined && typeof p.useCount !== 'number') invalid.push(`prompts[${i}]: useCount must be number`);
        });
        if (invalid.length > 0) {
          throw new Error(`${invalid.length} invalid prompt(s):\n${invalid.slice(0, 5).join('\n')}${invalid.length > 5 ? '\n...' : ''}`);
        }
        // Sanitize imported prompts: ensure required fields, strip unexpected properties
        data.prompts = data.prompts.map(p => ({
          id: (typeof p.id === 'string' && p.id) ? p.id : crypto.randomUUID(),
          title: String(p.title || p.text || '').substring(0, 500),
          text: String(p.text || p.title || '').substring(0, 50000),
          description: String(p.description || '').substring(0, 2000),
          folderId: p.folderId || null,
          platform: ['universal', 'chatgpt', 'claude', 'gemini', 'perplexity'].includes(p.platform) ? p.platform : 'universal',
          tags: Array.isArray(p.tags) ? p.tags.filter(t => typeof t === 'string').slice(0, 20) : [],
          variables: Array.isArray(p.variables) ? p.variables.filter(v => typeof v === 'string').slice(0, 50) : [],
          imageUrl: (typeof p.imageUrl === 'string') ? p.imageUrl : null,
          isFavorite: !!p.isFavorite,
          useCount: (typeof p.useCount === 'number' && p.useCount >= 0) ? Math.floor(p.useCount) : 0,
          createdAt: (typeof p.createdAt === 'number') ? p.createdAt : Date.now(),
          updatedAt: (typeof p.updatedAt === 'number') ? p.updatedAt : Date.now()
        }));
      }
      if (data.folders) {
        if (!Array.isArray(data.folders)) throw new Error('"folders" must be an array, got: ' + typeof data.folders);
        data.folders = data.folders.filter(f => typeof f === 'object' && f !== null && (f.name || f.id)).map(f => ({
          id: (typeof f.id === 'string' && f.id) ? f.id : crypto.randomUUID(),
          name: String(f.name || 'Untitled').substring(0, 200),
          createdAt: (typeof f.createdAt === 'number') ? f.createdAt : Date.now(),
          updatedAt: (typeof f.updatedAt === 'number') ? f.updatedAt : Date.now()
        }));
      }

      if (!confirm(t('replaceAllData'))) return;
      if (data.prompts) state.prompts = data.prompts;
      if (data.folders) state.folders = data.folders;
      if (data.settings) state.settings = { ...state.settings, ...data.settings };
      await saveData('prompts', state.prompts);
      await saveData('folders', state.folders);
      await saveData('settings', state.settings);
      showToast(t('dataImported'), 'success');
      // Analytics: track import
      P.analyticsTrackImport(state.prompts.length, state.folders.length);
      closeModal('settings-modal');
      if (renderPrompts) renderPrompts();
      if (renderFolders) renderFolders();
      if (renderFavorites) renderFavorites();
    } catch (err) {
      showToast((t('importFailed') || 'Import failed') + ': ' + (err.message || String(err)), 'error');
    }
  };
  input.click();
}

function _importCSV(fileText, opts) {
  const { parseCSVLine, renderPrompts, renderFolders, renderFavorites, setSuppressRender } = opts;
  const lines = fileText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');
  const headers = (parseCSVLine || _basicCSVParse)(lines[0]).map(h => h.toLowerCase().trim());
  const titleIdx = headers.findIndex(h => h === 'title' || h === 'name');
  const textIdx = headers.findIndex(h => h === 'text' || h === 'prompt' || h === 'content');
  if (titleIdx === -1 && textIdx === -1) throw new Error('CSV must have a "title" or "text" column');

  const descIdx = headers.findIndex(h => h === 'description' || h === 'desc');
  const tagsIdx = headers.findIndex(h => h === 'tags');
  const folderIdx = headers.findIndex(h => h === 'folder');
  const platformIdx = headers.findIndex(h => h === 'platform');
  const imported = [];
  const errors = [];
  const parse = parseCSVLine || _basicCSVParse;

  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = parse(lines[i]);
      const title = (titleIdx >= 0 ? cols[titleIdx] : '').trim();
      const text = (textIdx >= 0 ? cols[textIdx] : '').trim();
      if (!title && !text) { errors.push(`Row ${i + 1}: empty`); continue; }
      const tags = tagsIdx >= 0 && cols[tagsIdx] ? cols[tagsIdx].split(/[,;|]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean) : [];
      const variables = [...new Set((text.match(/\{([^}]+)\}/g) || []).map(m => m.slice(1, -1)))];
      let folderId = null;
      if (folderIdx >= 0 && cols[folderIdx]) {
        const fn = cols[folderIdx].trim();
        const f = state.folders.find(f => f.name.toLowerCase() === fn.toLowerCase());
        folderId = f ? f.id : null;
      }
      imported.push({
        id: crypto.randomUUID(), title: title || text.substring(0, 50), text: text || title,
        description: descIdx >= 0 ? (cols[descIdx] || '').trim() : '',
        folderId, platform: platformIdx >= 0 ? (cols[platformIdx] || 'universal').trim() : 'universal',
        tags, variables, isFavorite: false, useCount: 0, createdAt: Date.now(), updatedAt: Date.now()
      });
    } catch (rowErr) { errors.push(`Row ${i + 1}: ${rowErr.message}`); }
  }
  if (imported.length === 0) throw new Error('No valid prompts in CSV');
  if (!confirm(`Import ${imported.length} prompts?`)) return;
  state.prompts = [...imported, ...state.prompts];
  saveData('prompts', state.prompts);
  showToast(`Imported ${imported.length} prompts`, 'success');
  // Analytics: track CSV import
  P.analyticsTrackImport(imported.length, 0);
  closeModal('settings-modal');
  if (renderPrompts) renderPrompts();
  if (renderFolders) renderFolders();
  if (renderFavorites) renderFavorites();
}

function _basicCSVParse(line) { return line.split(','); }

// ==================== SHORTCUTS DISPLAY ====================
function _loadShortcutsDisplay(commandNames) {
  const container = document.getElementById('shortcuts-display');
  if (!container) return;
  if (typeof chrome !== 'undefined' && chrome.commands && chrome.commands.getAll) {
    chrome.commands.getAll(commands => {
      container.innerHTML = commands.filter(c => commandNames[c.name]).map(c => {
        const cfg = commandNames[c.name];
        const shortcut = c.shortcut || cfg.default || 'Not set';
        return `<div class="hotkey-rebind-row"><span class="hotkey-rebind-label">${cfg.label}</span><span class="hotkey-rebind-key">${shortcut}</span></div>`;
      }).join('');
    });
  }
}

// ==================== HOTKEY SYNC ====================
P.syncHotkeysToSupabase = async function() {
  if (!state.session || !state.user) return;
  const hotkeys = state.settings.hotkeys || {};
  const slotNames = { slot1: 1, slot2: 2, slot3: 3 };
  const keyDefaults = { slot1: 'Alt+1', slot2: 'Alt+2', slot3: 'Alt+3' };
  for (const [slotId, slotNum] of Object.entries(slotNames)) {
    const slot = hotkeys[slotId];
    const promptId = slot?.promptId || null;
    if (promptId) {
      try { await supabaseMsg({ action: 'supabaseRequest', method: 'DELETE', path: `hotkey_settings?user_id=eq.${state.user.id}&slot_number=eq.${slotNum}` }); } catch {}
      try { await supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'hotkey_settings', body: { user_id: state.user.id, slot_number: slotNum, key_combo: keyDefaults[slotId], prompt_id: promptId, updated_at: new Date().toISOString() } }); } catch {}
    } else {
      try { await supabaseMsg({ action: 'supabaseRequest', method: 'DELETE', path: `hotkey_settings?user_id=eq.${state.user.id}&slot_number=eq.${slotNum}` }); } catch {}
    }
  }
};

P.loadHotkeysFromSupabase = async function() {
  if (!state.session || !state.user) return;
  try {
    const res = await supabaseMsg({ action: 'supabaseRequest', method: 'GET', path: `hotkey_settings?user_id=eq.${state.user.id}&select=slot_number,prompt_id` });
    if (res?.data && Array.isArray(res.data)) {
      if (!state.settings.hotkeys) state.settings.hotkeys = {};
      res.data.forEach(row => {
        const slotId = `slot${row.slot_number}`;
        if (!state.settings.hotkeys[slotId]) state.settings.hotkeys[slotId] = {};
        if (row.prompt_id && state.prompts.some(p => p.id === row.prompt_id)) {
          state.settings.hotkeys[slotId].promptId = row.prompt_id;
        }
      });
      await saveData('settings', state.settings);
    }
  } catch {}
};

// ==================== HELPER ====================
function _divider() {
  const d = document.createElement('div');
  d.className = 'divider';
  return d;
}

})(window.Promptory);
