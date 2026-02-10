// PromptVault i18n helper
// Supports runtime language switching (en/ru) without relying solely on chrome.i18n

const PV_LOCALES = {};
let _currentLang = 'en';

async function loadLocale(lang) {
  if (PV_LOCALES[lang]) return;
  try {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const res = await fetch(url);
    PV_LOCALES[lang] = await res.json();
  } catch (e) {
    console.warn('Failed to load locale', lang, e);
  }
}

async function initI18n() {
  const result = await new Promise(r => chrome.storage.local.get(['language'], r));
  _currentLang = result.language || chrome.i18n.getUILanguage().startsWith('ru') ? 'ru' : 'en';
  // re-check stored
  if (result.language) _currentLang = result.language;
  else if (chrome.i18n.getUILanguage().startsWith('ru')) _currentLang = 'ru';
  else _currentLang = 'en';
  await loadLocale('en');
  await loadLocale('ru');
}

function t(key, ...subs) {
  const locale = PV_LOCALES[_currentLang] || PV_LOCALES['en'] || {};
  const fallback = PV_LOCALES['en'] || {};
  const entry = locale[key] || fallback[key];
  if (!entry) return key;
  let msg = entry.message;
  subs.forEach((s, i) => {
    msg = msg.replace(`$${i + 1}`, s);
  });
  return msg;
}

function getCurrentLang() { return _currentLang; }
function setCurrentLang(lang) { _currentLang = lang; }
