// Authentication functionality with Supabase

// Supabase credentials
const SUPABASE_URL = 'https://vofgfvlgchqheksvlibl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZmdmdmxnY2hxaGVrc3ZsaWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTgzNzEsImV4cCI6MjA4NjA3NDM3MX0.taoCHiYqJT2mSp5odtaM1p52KO5MnGzSOiz4dhmZnb0';

let supabaseClient = null;

export function initAuth() {
  // Initialize Supabase client if library is available
  if (typeof window.supabase !== 'undefined') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('Supabase client initialized');
    } catch (err) {
      console.warn('Supabase initialization failed:', err);
    }
  } else {
    console.warn('Supabase library not loaded - using local storage only');
  }
}

export function getSupabaseClient() {
  return supabaseClient;
}

// Future auth implementation:
// - chrome.identity.getAuthToken() for Google OAuth
// - Session management
// - Token refresh
