// Promptory Shared Configuration
// Single source of truth for Supabase credentials and app-wide constants

const CONFIG = {
  // Supabase
  SUPABASE_URL: 'https://vofgfvlgchqheksvlibl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZmdmdmxnY2hxaGVrc3ZsaWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTgzNzEsImV4cCI6MjA4NjA3NDM3MX0.taoCHiYqJT2mSp5odtaM1p52KO5MnGzSOiz4dhmZnb0',
  
  // LemonSqueezy (Pro payments)
  // Set LEMONSQUEEZY_API_KEY in environment / background config
  LEMONSQUEEZY_STORE_ID: '', // Your store ID from LemonSqueezy dashboard
  LEMONSQUEEZY_PRODUCT_ID: '', // Pro subscription product ID  
  LEMONSQUEEZY_CHECKOUT_URL: '', // e.g. https://yourstore.lemonsqueezy.com/checkout/buy/xxx
  LEMONSQUEEZY_CUSTOMER_PORTAL: '', // e.g. https://yourstore.lemonsqueezy.com/billing
  
  // Free tier limits
  FREE_PROMPT_LIMIT: 20,
  
  // Performance caps
  MAX_ANIM_ITEMS: 8,
  SETTINGS_PROMPT_SELECT_LIMIT: 200,
  
  // Library pagination
  LIBRARY_PAGE_SIZE: 20,
  
  // App info
  VERSION: '1.5.0'
};

// Make available in different contexts (popup, background, options)
if (typeof globalThis !== 'undefined') globalThis.CONFIG = CONFIG;
