// Promptory Shared Configuration
// Single source of truth for Supabase credentials and app-wide constants

const CONFIG = {
  // Supabase
  SUPABASE_URL: 'https://vofgfvlgchqheksvlibl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZmdmdmxnY2hxaGVrc3ZsaWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTgzNzEsImV4cCI6MjA4NjA3NDM3MX0.taoCHiYqJT2mSp5odtaM1p52KO5MnGzSOiz4dhmZnb0',
  
  // LemonSqueezy (Pro payments)
  // API key is stored in Supabase Edge Function env (LEMON_SIGNING_SECRET)
  // These are public-facing IDs and URLs — safe to include in client code
  LEMONSQUEEZY_STORE_ID: 'promptory', // Store slug on LemonSqueezy
  LEMONSQUEEZY_PRODUCT_ID: '853245', // Pro subscription product ID  
  LEMONSQUEEZY_CHECKOUT_URL: 'https://promptory.lemonsqueezy.com/checkout/buy/045b2c1d-0a29-4e4a-8471-666a2f6abac3', // IMPORTANT: Set to your LemonSqueezy variant buy URL (e.g., https://store.lemonsqueezy.com/buy/abc123)
  LEMONSQUEEZY_CUSTOMER_PORTAL: 'https://promptory.lemonsqueezy.com/billing', // Customer portal for managing subscriptions

  // ---------- PLAN LIMITS ----------
  // Guest (local only, no account)
  GUEST_PROMPT_LIMIT: 10,
  GUEST_FOLDER_LIMIT: 3,
  GUEST_QUICK_INSERT_SLOTS: 1,
  GUEST_VARIABLE_TEMPLATES: 1,   // max prompt templates with variables
  GUEST_VARIABLE_USES_PER_DAY: 3,
  GUEST_SYNC: false,
  GUEST_LIBRARY: false,
  GUEST_EXPORT_IMPORT: false,

  // Google account (free, signed in)
  FREE_PROMPT_LIMIT: 50,
  FREE_FOLDER_LIMIT: 10,
  FREE_QUICK_INSERT_SLOTS: 3,
  FREE_VARIABLE_TEMPLATES: 3,    // max prompt templates with variables
  FREE_VARIABLE_USES_PER_DAY: 3,
  FREE_SYNC: true,       // cloud sync
  FREE_LIBRARY: true,
  FREE_EXPORT_IMPORT: 'json', // JSON only

  // Pro (paid subscription)
  PRO_PROMPT_LIMIT: Infinity,
  PRO_FOLDER_LIMIT: Infinity,
  PRO_QUICK_INSERT_SLOTS: Infinity,
  PRO_VARIABLE_TEMPLATES: Infinity,
  PRO_VARIABLE_USES_PER_DAY: Infinity,
  PRO_SYNC: true,        // priority sync
  PRO_LIBRARY: true,
  PRO_EXPORT_IMPORT: 'json_csv', // JSON + CSV

  // ---------- PRICING (LemonSqueezy) ----------
  PRICE_MONTHLY: 4.99,
  PRICE_YEARLY: 24.99,
  PRICE_LIFETIME: 39.99,
  
  // Performance caps
  MAX_ANIM_ITEMS: 8,
  SETTINGS_PROMPT_SELECT_LIMIT: 200,
  
  // Library pagination
  LIBRARY_PAGE_SIZE: 20,
  
  // App info
  VERSION: '1.10.0'
};

// Helper: get limits based on user tier
CONFIG.getLimits = function(isPremium, isLoggedIn) {
  if (isPremium) {
    return {
      prompts: CONFIG.PRO_PROMPT_LIMIT,
      folders: CONFIG.PRO_FOLDER_LIMIT,
      quickInsertSlots: CONFIG.PRO_QUICK_INSERT_SLOTS,
      variableTemplates: CONFIG.PRO_VARIABLE_TEMPLATES,
      variableUsesPerDay: CONFIG.PRO_VARIABLE_USES_PER_DAY,
      sync: CONFIG.PRO_SYNC,
      library: CONFIG.PRO_LIBRARY,
      exportImport: CONFIG.PRO_EXPORT_IMPORT,
      tier: 'pro'
    };
  }
  if (isLoggedIn) {
    return {
      prompts: CONFIG.FREE_PROMPT_LIMIT,
      folders: CONFIG.FREE_FOLDER_LIMIT,
      quickInsertSlots: CONFIG.FREE_QUICK_INSERT_SLOTS,
      variableTemplates: CONFIG.FREE_VARIABLE_TEMPLATES,
      variableUsesPerDay: CONFIG.FREE_VARIABLE_USES_PER_DAY,
      sync: CONFIG.FREE_SYNC,
      library: CONFIG.FREE_LIBRARY,
      exportImport: CONFIG.FREE_EXPORT_IMPORT,
      tier: 'free'
    };
  }
  return {
    prompts: CONFIG.GUEST_PROMPT_LIMIT,
    folders: CONFIG.GUEST_FOLDER_LIMIT,
    quickInsertSlots: CONFIG.GUEST_QUICK_INSERT_SLOTS,
    variableTemplates: CONFIG.GUEST_VARIABLE_TEMPLATES,
    variableUsesPerDay: CONFIG.GUEST_VARIABLE_USES_PER_DAY,
    sync: CONFIG.GUEST_SYNC,
    library: CONFIG.GUEST_LIBRARY,
    exportImport: CONFIG.GUEST_EXPORT_IMPORT,
    tier: 'guest'
  };
};

// Make available in different contexts (popup, background, options)
if (typeof globalThis !== 'undefined') globalThis.CONFIG = CONFIG;
