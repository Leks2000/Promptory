// Promptory Auth Callback Page
// Extracted from inline script for CSP compliance (script-src 'self')
(function() {
  var statusEl = document.getElementById('status');
  var messageEl = document.getElementById('message');
  var spinnerEl = document.getElementById('spinner');
  
  // Check for success redirect from background.js
  var hash = window.location.hash;
  var search = window.location.search;
  
  if (hash.includes('success=true')) {
    // Background script already saved the session - show success
    spinnerEl.style.display = 'none';
    statusEl.textContent = 'Signed in successfully!';
    statusEl.className = 'success';
    messageEl.innerHTML = 'You can close this tab and open Promptory from the extensions toolbar.';
    
    // Add helpful arrow hint
    var container = document.querySelector('.container');
    var hint = document.createElement('div');
    hint.className = 'arrow-hint';
    hint.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg><p>Click the Promptory icon in your toolbar to continue</p>';
    container.appendChild(hint);
    
    // Auto-close after 3 seconds
    setTimeout(function() { window.close(); }, 3000);
    return;
  }
  
  // Check for error from background.js redirect
  var errorParam = new URLSearchParams(search).get('error');
  if (errorParam) {
    spinnerEl.style.display = 'none';
    statusEl.textContent = 'Sign in failed';
    statusEl.className = 'error';
    messageEl.textContent = decodeURIComponent(errorParam);
    messageEl.innerHTML += '<br><br><small>You can close this tab and try again from the extension.</small>';
    return;
  }
  
  // Check for tokens in the hash (direct redirect from Supabase - fallback)
  var hashParams = new URLSearchParams(hash.replace('#', ''));
  var accessToken = hashParams.get('access_token');
  
  if (accessToken) {
    // We have tokens in hash - process them
    processTokens(hashParams);
    return;
  }
  
  // No tokens, no success, no error - show waiting message
  statusEl.textContent = 'Waiting for authentication...';
  messageEl.textContent = 'If you completed sign-in in another tab, this page will update automatically.';
  
  // Poll for session (in case background script saved it)
  var pollCount = 0;
  var pollInterval = setInterval(async function() {
    pollCount++;
    try {
      var result = await chrome.storage.local.get(['session', 'user']);
      if (result.session && result.user) {
        clearInterval(pollInterval);
        spinnerEl.style.display = 'none';
        statusEl.textContent = 'Signed in successfully!';
        statusEl.className = 'success';
        messageEl.innerHTML = 'Welcome, ' + (result.user.name || result.user.email) + '! This tab will close automatically.';
        setTimeout(function() { window.close(); }, 1500);
      }
    } catch (e) { /* ignore */ }
    
    if (pollCount >= 60) { // 30 seconds
      clearInterval(pollInterval);
      spinnerEl.style.display = 'none';
      statusEl.textContent = 'Authentication timed out';
      statusEl.className = 'error';
      messageEl.innerHTML = 'Please close this tab and try again from the extension.<br><br><small>Make sure your Google account is set up in Supabase dashboard.</small>';
    }
  }, 500);
  
  // Process tokens directly from URL hash (fallback for direct Supabase redirect)
  async function processTokens(params) {
    try {
      var token = params.get('access_token');
      var refreshToken = params.get('refresh_token');
      var expiresIn = parseInt(params.get('expires_in') || '3600');
      
      statusEl.textContent = 'Getting user info...';
      
      var SUPABASE_URL = 'https://vofgfvlgchqheksvlibl.supabase.co';
      var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZmdmdmxnY2hxaGVrc3ZsaWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTgzNzEsImV4cCI6MjA4NjA3NDM3MX0.taoCHiYqJT2mSp5odtaM1p52KO5MnGzSOiz4dhmZnb0';
      
      var userRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
        headers: {
          'Authorization': 'Bearer ' + token,
          'apikey': SUPABASE_ANON_KEY
        }
      });
      
      if (!userRes.ok) throw new Error('Failed to get user info');
      
      var userData = await userRes.json();
      var user = {
        id: userData.id,
        email: userData.email,
        name: (userData.user_metadata && (userData.user_metadata.full_name || userData.user_metadata.name)) || (userData.email && userData.email.split('@')[0]),
        avatar: (userData.user_metadata && (userData.user_metadata.avatar_url || userData.user_metadata.picture)) || ''
      };
      
      var session = {
        access_token: token,
        refresh_token: refreshToken,
        expires_at: Date.now() + (expiresIn * 1000)
      };
      
      await chrome.storage.local.set({ session: session, user: user });
      
      spinnerEl.style.display = 'none';
      statusEl.textContent = 'Signed in successfully!';
      statusEl.className = 'success';
      messageEl.innerHTML = 'Welcome, ' + (user.name || user.email) + '! This tab will close automatically.';
      
      setTimeout(function() { window.close(); }, 1500);
    } catch (err) {
      spinnerEl.style.display = 'none';
      statusEl.textContent = 'Sign in failed';
      statusEl.className = 'error';
      messageEl.textContent = err.message;
      messageEl.innerHTML += '<br><br><small>You can close this tab and try again.</small>';
    }
  }
})();
