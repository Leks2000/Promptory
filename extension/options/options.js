/**
 * PromptVault — Options Page Script
 */

const { PromptStore, FolderStore, SettingsStore, HotkeyStore, ExportImport } = window.PromptVault;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadHotkeys();
  await updateAccountStatus();
  bindEvents();
});

function bindEvents() {
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      $$('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      $$('.section').forEach(s => s.classList.remove('active'));
      $(`#section-${item.dataset.section}`).classList.add('active');
    });
  });

  $('#setting-insert-mode').addEventListener('change', saveSettings);
  $('#setting-default-sort').addEventListener('change', saveSettings);
  $('#setting-notifications').addEventListener('change', saveSettings);
  $('#setting-compact').addEventListener('change', saveSettings);

  $$('.theme-option').forEach(opt => {
    opt.addEventListener('click', () => {
      $$('.theme-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      applyTheme(opt.dataset.theme);
      saveSettings();
    });
  });

  $('#btn-export').addEventListener('click', handleExport);
  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', handleImport);
  $('#btn-clear-all').addEventListener('click', handleClearAll);
  $('#btn-upgrade').addEventListener('click', () => {
    showToast('Upgrade coming soon!');
  });
}

async function loadSettings() {
  const settings = await SettingsStore.get();
  $('#setting-insert-mode').value = settings.insertMode || 'replace';
  $('#setting-default-sort').value = settings.defaultSort || 'date';
  $('#setting-notifications').checked = settings.showNotifications !== false;
  $('#setting-compact').checked = !!settings.compactView;

  const theme = settings.theme || 'dark';
  $$('.theme-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === theme);
  });
  applyTheme(theme);
}

async function saveSettings() {
  const theme = $('.theme-option.active')?.dataset.theme || 'dark';
  await SettingsStore.update({
    insertMode: $('#setting-insert-mode').value,
    defaultSort: $('#setting-default-sort').value,
    showNotifications: $('#setting-notifications').checked,
    compactView: $('#setting-compact').checked,
    theme
  });
  showToast('Settings saved');
}

function applyTheme(theme) {
  let resolved = theme;
  if (theme === 'auto') resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', resolved);
}

async function loadHotkeys() {
  const hotkeys = await HotkeyStore.getAll();
  const prompts = await PromptStore.getAll();

  const container = $('#hotkey-list');
  const slots = [];

  // Only 3 hotkey slots (Chrome max 4 commands total, 1 is _execute_action)
  for (let i = 1; i <= 3; i++) {
    const slot = `hotkey-${i}`;
    const assignedPromptId = hotkeys[slot] || '';
    const keyLabel = `Alt+${i}`;

    slots.push(`
      <div class="hotkey-card">
        <div class="hotkey-key">${keyLabel}</div>
        <select class="hotkey-select" data-slot="${slot}">
          <option value="">— Not assigned —</option>
          ${prompts.map(p => `
            <option value="${p.id}" ${p.id === assignedPromptId ? 'selected' : ''}>
              ${escHtml(p.title)}
            </option>
          `).join('')}
        </select>
        <button class="hotkey-clear" data-slot="${slot}" title="Clear">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `);
  }

  container.innerHTML = slots.join('');

  container.querySelectorAll('.hotkey-select').forEach(select => {
    select.addEventListener('change', async () => {
      const slot = select.dataset.slot;
      if (select.value) {
        await HotkeyStore.set(slot, select.value);
      } else {
        await HotkeyStore.remove(slot);
      }
      showToast('Hotkey updated');
    });
  });

  container.querySelectorAll('.hotkey-clear').forEach(btn => {
    btn.addEventListener('click', async () => {
      const slot = btn.dataset.slot;
      await HotkeyStore.remove(slot);
      const select = container.querySelector(`select[data-slot="${slot}"]`);
      if (select) select.value = '';
      showToast('Hotkey cleared');
    });
  });
}

async function updateAccountStatus() {
  const count = await PromptStore.getCount();
  const settings = await SettingsStore.get();
  $('#account-limit').textContent = `${count}/${settings.maxFreePrompts} prompts`;
}

async function handleExport() {
  const data = await ExportImport.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `promptvault-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Exported successfully!');
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    const result = await ExportImport.importData(event.target.result);
    if (result.success) {
      showToast(`Imported ${result.imported.prompts} prompts, ${result.imported.folders} folders`);
      await loadHotkeys();
      await updateAccountStatus();
    } else {
      showToast(`Import failed: ${result.error}`);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

async function handleClearAll() {
  if (!confirm('This will delete ALL your data.\n\nAre you sure?')) return;
  if (!confirm('LAST CHANCE! This cannot be undone.')) return;
  await chrome.storage.local.clear();
  showToast('All data cleared');
  setTimeout(() => window.location.reload(), 1000);
}

function showToast(msg) {
  const toast = $('#toast');
  $('#toast-msg').textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2500);
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
