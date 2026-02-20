// Promptory Background Service Worker

// Load shared config (config.js sets globalThis.CONFIG)
importScripts('../config.js');

const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
const FREE_PROMPT_LIMIT = CONFIG.FREE_PROMPT_LIMIT || 25;

// ---------- Mixpanel HTTP API (lightweight, for service worker) ----------
const MIXPANEL_TOKEN = 'c86143cd74824a2d516134f860745000';

function _trackEventHTTP(eventName, properties) {
  try {
    const payload = {
      event: eventName,
      properties: {
        token: MIXPANEL_TOKEN,
        distinct_id: 'anonymous_' + (Date.now().toString(36)),
        time: Math.floor(Date.now() / 1000),
        $insert_id: crypto.randomUUID(),
        app_version: CONFIG.VERSION || '1.9.0',
        source: 'background_service_worker',
        ...(properties || {})
      }
    };
    const data = btoa(JSON.stringify([payload]));
    fetch(`https://api.mixpanel.com/track?ip=1&verbose=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${data}`
    }).catch(() => { /* silent */ });
  } catch (e) { /* silent */ }
}

// Word-boundary-aware truncation (handles multi-byte/CJK characters)
function _truncateAtWordBoundary(text, max = 50) {
  if (!text || text.length <= max) return text || '';
  const sub = text.substring(0, max);
  // Find last word boundary (space, punctuation, CJK delimiters)
  const lastBreak = Math.max(
    sub.lastIndexOf(' '),
    sub.lastIndexOf('.'),
    sub.lastIndexOf(','),
    sub.lastIndexOf(';'),
    sub.lastIndexOf('-'),
    sub.lastIndexOf('\u3000'), // CJK space
    sub.lastIndexOf('\u3001'), // CJK comma
    sub.lastIndexOf('\u3002')  // CJK period
  );
  // If no good break point in the first 30% of the string, just cut at max
  if (lastBreak <= max * 0.3) return sub + '...';
  return text.substring(0, lastBreak) + '...';
}
// Redirect URL is computed dynamically from chrome.identity
const REDIRECT_URL = chrome.identity.getRedirectURL();

// ---------- Installation ----------
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Promptory installed');
    
    // Analytics: track install via HTTP API
    _trackEventHTTP('Extension Installed', {
      install_reason: 'fresh_install',
      app_version: CONFIG.VERSION || '1.9.0'
    });
    
    chrome.storage.local.set({
      prompts: [],
      folders: [],
      settings: {
        theme: 'dark',
        hotkeys: {
          slot1: { promptId: null },
          slot2: { promptId: null },
          slot3: { promptId: null }
        },
        defaultFolder: null
      },
      user: null,
      session: null,
      hasLaunched: false,
      isPremium: false,
      promptLimit: FREE_PROMPT_LIMIT,
      language: null
    });

    // Open a brief install confirmation page (terms are accepted in the popup)
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding/welcome.html'),
      active: true
    });
  } else if (details.reason === 'update') {
    // Analytics: track extension update
    _trackEventHTTP('Extension Updated', {
      previous_version: details.previousVersion || 'unknown',
      new_version: CONFIG.VERSION || '1.9.0'
    });
  }
});

// ---------- Context Menu ----------
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-as-prompt',
    title: 'Save selection as Prompt',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, _tab) => {
  if (info.menuItemId === 'save-as-prompt') {
    const text = info.selectionText;
    if (!text) return;
    const result = await chrome.storage.local.get(['prompts']);
    const prompts = result.prompts || [];
    const newPrompt = {
      id: crypto.randomUUID(),
      title: _truncateAtWordBoundary(text, 50),
      text: text,
      description: 'Saved from selection',
      folderId: null,
      platform: 'universal',
      tags: [],
      variables: [],
      isFavorite: false,
      useCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    prompts.push(newPrompt);
    await chrome.storage.local.set({ prompts });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icon-128.png',
      title: 'Promptory',
      message: 'Prompt saved successfully!'
    });
  }
});

// ---------- Keyboard Shortcuts (Commands) ----------
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command:', command);

  if (command === 'open-search') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'openSearchOverlay' });
      } catch (_e) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/content.js']
          });
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content/content.css']
          });
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id, { action: 'openSearchOverlay' });
            } catch (err) {
              console.error('Failed to open search overlay:', err);
            }
          }, 300);
        } catch (injectErr) {
          console.error('Failed to inject content script:', injectErr);
        }
      }
    }
    return;
  }

  // Handle hotkey-1 through hotkey-3
  const match = command.match(/^hotkey-(\d)$/);
  if (match) {
    const slotNum = parseInt(match[1]);
    if (slotNum > 3) return; // Only 3 slots now
    const slotId = `slot${slotNum}`;
    const result = await chrome.storage.local.get(['settings', 'prompts', 'session', 'user']);
    const hotkeys = result.settings?.hotkeys || {};
    const slot = hotkeys[slotId];
    if (slot?.promptId) {
      const prompts = result.prompts || [];
      const prompt = prompts.find(p => p.id === slot.promptId);
      if (prompt) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          const sendInsert = () => chrome.tabs.sendMessage(tab.id, {
            action: 'insertPrompt',
            text: prompt.text,
            variables: prompt.variables || []
          });
          try {
            await sendInsert();
          } catch (_e) {
            // Content script not present — inject programmatically then retry
            try {
              await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] });
              await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content/content.css'] });
              await new Promise(r => setTimeout(r, 200));
              await sendInsert();
            } catch (injectErr) {
              console.error('Failed to insert hotkey prompt (inject):', injectErr);
              return;
            }
          }
          try {
            prompt.useCount = (prompt.useCount || 0) + 1;
            prompt.updatedAt = Date.now();
            await chrome.storage.local.set({ prompts });

            if (result.session?.access_token && result.user?.id) {
              const platform = new URL(tab.url || '').hostname.replace('www.', '');
              trackUsageInBackground(result.session, prompt, platform);
            }
          } catch (_e) {
            console.error('Failed to update hotkey usage:', _e);
          }
        }
      }
    }
  }
});

// Track usage asynchronously (fire-and-forget)
async function trackUsageInBackground(session, prompt, platform) {
  try {
    const token = session.access_token;
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_usage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_prompt_id: prompt.id,
        p_prompt_title: prompt.title,
        p_platform: platform || 'unknown',
        p_action: 'hotkey'
      })
    });
  } catch (_e) { 
    console.error('Background usage tracking failed:', _e); 
  }
}

// ---------- Message Handler ----------
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'getPrompts') {
    chrome.storage.local.get(['prompts'], (res) => {
      sendResponse({ prompts: res.prompts || [] });
    });
    return true;
  }

  if (message.action === 'insertPromptToTab') {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'insertPrompt',
            text: message.text,
            variables: message.variables || []
          });
          sendResponse({ success: true });
        } catch (_e) {
          // Content script not injected on this tab — inject programmatically then retry
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content/content.js']
            });
            await chrome.scripting.insertCSS({
              target: { tabId: tab.id },
              files: ['content/content.css']
            });
            // Small delay to let the content script initialise
            await new Promise(r => setTimeout(r, 200));
            await chrome.tabs.sendMessage(tab.id, {
              action: 'insertPrompt',
              text: message.text,
              variables: message.variables || []
            });
            sendResponse({ success: true });
          } catch (injectErr) {
            sendResponse({ success: false, error: injectErr.message });
          }
        }
      } else {
        sendResponse({ success: false, error: 'No active tab' });
      }
    })();
    return true;
  }

  if (message.action === 'supabaseRequest') {
    handleSupabaseRequest(message).then(sendResponse);
    return true;
  }

  if (message.action === 'signInWithGoogle') {
    handleGoogleSignIn({ loginHint: message.loginHint }).then(sendResponse);
    return true;
  }

  if (message.action === 'signOut') {
    handleSignOut().then(sendResponse);
    return true;
  }

  if (message.action === 'getSession') {
    chrome.storage.local.get(['session', 'user'], (res) => {
      sendResponse({ session: res.session, user: res.user });
    });
    return true;
  }

  if (message.action === 'uploadToStorage') {
    handleStorageUpload(message).then(sendResponse);
    return true;
  }

  if (message.action === 'getSignedUrl') {
    handleGetSignedUrl(message).then(sendResponse);
    return true;
  }

  if (message.action === 'getImageAsDataUrl') {
    handleGetImageAsDataUrl(message).then(sendResponse);
    return true;
  }
});

// ---------- Supabase Storage Upload ----------
async function handleStorageUpload(message) {
  const token = await getValidToken();
  if (!token) return { error: 'Not authenticated' };

  const { bucket, path, file, contentType } = message;
  
  try {
    // Convert base64 to binary
    const binaryString = atob(file);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Upload to Supabase Storage
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': contentType,
        'x-upsert': 'true' // Overwrite if exists
      },
      body: bytes
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      console.error('Storage upload failed:', errorText);
      return { error: errorText };
    }

    // Generate a signed URL (valid for 1 year = 31536000 seconds)
    // This works for private buckets unlike public URLs
    try {
      const signedRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ expiresIn: 31536000 })
      });
      
      if (signedRes.ok) {
        const signedData = await signedRes.json();
        const signedUrl = signedData.signedURL 
          ? `${SUPABASE_URL}/storage/v1${signedData.signedURL}` 
          : null;
        if (signedUrl) {
          console.log('✅ Upload successful, signed URL generated');
          return { data: { publicUrl: signedUrl, storagePath: `${bucket}/${path}` } };
        }
      }
    } catch (signErr) {
      console.warn('⚠️ Signed URL generation failed, using storage path:', signErr);
    }
    
    // Fallback: return storage path for later resolution
    return { data: { publicUrl: `supabase-storage://${bucket}/${path}`, storagePath: `${bucket}/${path}` } };
  } catch (err) {
    console.error('Storage upload error:', err);
    return { error: err.message };
  }
}

// ---------- Get Signed URL for Private Storage ----------
async function handleGetSignedUrl(message) {
  const token = await getValidToken();
  if (!token) return { error: 'Not authenticated' };

  const { bucket, path, expiresIn } = message;
  
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expiresIn: expiresIn || 3600 })
    });
    
    if (!res.ok) {
      const text = await res.text();
      return { error: text };
    }
    
    const data = await res.json();
    const signedUrl = data.signedURL 
      ? `${SUPABASE_URL}/storage/v1${data.signedURL}` 
      : null;
    return { data: { signedUrl } };
  } catch (err) {
    return { error: err.message };
  }
}

// ---------- Get Image as Data URL (for private bucket display) ----------
async function handleGetImageAsDataUrl(message) {
  const token = await getValidToken();
  if (!token) return { error: 'Not authenticated' };

  const { url, bucket, path } = message;
  
  try {
    let fetchUrl;
    if (bucket && path) {
      fetchUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${path}`;
    } else if (url) {
      fetchUrl = url
        .replace('/storage/v1/object/public/', '/storage/v1/object/authenticated/')
        .replace('supabase-storage://', `${SUPABASE_URL}/storage/v1/object/authenticated/`);
    } else {
      return { error: 'No URL or path provided' };
    }
    
    const res = await fetch(fetchUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });
    
    if (!res.ok) {
      return { error: `HTTP ${res.status}` };
    }
    
    // Use arrayBuffer approach (FileReader not available in service workers)
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    const base64 = btoa(binary);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return { data: { dataUrl: `data:${contentType};base64,${base64}` } };
  } catch (err) {
    console.error('getImageAsDataUrl error:', err);
    return { error: err.message };
  }
}

// ---------- Supabase Auth via Chrome Identity API ----------

// Pending auth resolver - used by the tab-based auth flow
let _pendingAuthResolve = null;

// Listen for tab URL changes to intercept OAuth callback
chrome.tabs.onUpdated.addListener((tabId, changeInfo, _tab) => {
  // Check if the tab navigated to our redirect URL
  if (changeInfo.url && changeInfo.url.startsWith(REDIRECT_URL)) {
    console.log('🔹 Intercepted auth redirect:', changeInfo.url);
    finishOAuthFromTab(tabId, changeInfo.url);
  }
});

// Process OAuth tokens from intercepted tab URL
async function finishOAuthFromTab(tabId, url) {
  try {
    // Parse tokens from URL hash
    const parsedUrl = new URL(url);
    const hashParams = new URLSearchParams(parsedUrl.hash.replace('#', ''));
    
    // Check for errors
    const error = hashParams.get('error') || parsedUrl.searchParams.get('error');
    const errorDesc = hashParams.get('error_description') || parsedUrl.searchParams.get('error_description');
    if (error) {
      console.error('❌ OAuth error:', errorDesc || error);
      // Close the tab and show auth-callback with error
      try { 
        await chrome.tabs.update(tabId, { 
          url: chrome.runtime.getURL('auth-callback.html') + '?error=' + encodeURIComponent(errorDesc || error) 
        }); 
      } catch (_e) {
        // Tab may be closed
      }
      if (_pendingAuthResolve) {
        _pendingAuthResolve({ success: false, error: errorDesc || error });
        _pendingAuthResolve = null;
      }
      return;
    }
    
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const expiresIn = parseInt(hashParams.get('expires_in') || '3600');

    if (!accessToken) {
      console.error('❌ No access token in redirect URL');
      if (_pendingAuthResolve) {
        _pendingAuthResolve({ success: false, error: 'No access token received' });
        _pendingAuthResolve = null;
      }
      return;
    }

    console.log('✅ Got access token from tab redirect');

    // Fetch user info from Supabase
    const user = await fetchUserInfo(accessToken);
    console.log('✅ Got user:', user.email);

    // Save session
    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Date.now() + (expiresIn * 1000)
    };

    await chrome.storage.local.set({ session, user });
    console.log('✅ Session saved from tab redirect');

    // Redirect the auth tab to a success page, then close it
    try {
      await chrome.tabs.update(tabId, { url: chrome.runtime.getURL('auth-callback.html') + '#success=true' });
      // Close after a brief delay so user sees success
      setTimeout(async () => {
        try { 
          await chrome.tabs.remove(tabId); 
        } catch (_e) { 
          // Tab may already be closed
        }
      }, 1500);
    } catch (_e) {
      console.log('🔹 Could not update/close auth tab:', _e.message);
    }

    // Resolve the pending auth promise
    if (_pendingAuthResolve) {
      _pendingAuthResolve({ success: true, user, session });
      _pendingAuthResolve = null;
    }
  } catch (err) {
    console.error('❌ finishOAuthFromTab error:', err);
    if (_pendingAuthResolve) {
      _pendingAuthResolve({ success: false, error: err.message });
      _pendingAuthResolve = null;
    }
  }
}

// Utility: base64url decode (JWT-safe, works in Service Workers)
function base64urlDecode(str) {
  // Convert base64url to base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with = if needed
  while (base64.length % 4) base64 += '=';
  
  // Decode base64 to binary string
  const binaryString = atob(base64);
  
  // Convert to UTF-8 string
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Decode UTF-8
  return new TextDecoder().decode(bytes);
}

async function handleGoogleSignIn(options = {}) {
  try {
    const callbackUrl = REDIRECT_URL;

    let authUrl =
      `${SUPABASE_URL}/auth/v1/authorize` +
      `?provider=google` +
      `&redirect_to=${encodeURIComponent(callbackUrl)}` +
      `&access_type=offline`;

    // If we have a known email, add login_hint to skip account picker (faster)
    if (options.loginHint) {
      authUrl += `&login_hint=${encodeURIComponent(options.loginHint)}`;
    } else {
      // No saved email — show account picker
      authUrl += `&prompt=select_account`;
    }

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    if (!responseUrl) {
      throw new Error('No response URL received');
    }

    const url = new URL(responseUrl);
    const hashParams = new URLSearchParams(url.hash.replace('#', ''));

    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const expiresIn = parseInt(hashParams.get('expires_in') || '3600');

    if (!accessToken) {
      const errorDesc =
        hashParams.get('error_description') ||
        url.searchParams.get('error_description');
      throw new Error(errorDesc || 'No access token received');
    }

    // 🚀 Декодируем JWT безопасно для Service Worker
    try {
      const parts = accessToken.split('.');
      if (parts.length !== 3) throw new Error('Invalid JWT format');
      
      const payloadJson = base64urlDecode(parts[1]);
      const payload = JSON.parse(payloadJson);

      const user = {
        id: payload.sub,
        email: payload.email,
        name:
          payload.user_metadata?.full_name ||
          payload.user_metadata?.name ||
          payload.email?.split('@')[0],
        avatar:
          payload.user_metadata?.avatar_url ||
          payload.picture ||
          ''
      };

      const session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: Date.now() + (expiresIn * 1000)
      };

      await chrome.storage.local.set({ session, user });

      console.log('✅ Fast Google login success');

      return { success: true, user, session };
    } catch (jwtErr) {
      console.warn('⚠️ JWT decode failed, falling back to /user endpoint:', jwtErr);
      // Fallback: fetch user info from API
      const user = await fetchUserInfo(accessToken);
      const session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: Date.now() + (expiresIn * 1000)
      };
      await chrome.storage.local.set({ session, user });
      return { success: true, user, session };
    }

  } catch (err) {
    console.error('❌ Sign-in error:', err);
    return { success: false, error: err.message };
  }
}

async function fetchUserInfo(accessToken) {
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_ANON_KEY
    }
  });

  if (!userRes.ok) {
    const text = await userRes.text();
    throw new Error('Failed to get user info: ' + text);
  }
  const userData = await userRes.json();

  return {
    id: userData.id,
    email: userData.email,
    name: userData.user_metadata?.full_name || userData.user_metadata?.name || userData.email?.split('@')[0],
    avatar: userData.user_metadata?.avatar_url || userData.user_metadata?.picture || ''
  };
}

async function handleSignOut() {
  try {
    const { session } = await chrome.storage.local.get(['session']);

    if (session?.access_token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY
        }
      }).catch(() => {
        // Ignore logout API errors
      });
    }

    await chrome.storage.local.clear();

    await chrome.storage.local.set({
      session: null,
      user: null,
      isPremium: false,
      promptLimit: FREE_PROMPT_LIMIT,
      prompts: [],
      folders: [],
      libraryPromptsCache: [],
      offlineQueue: [],
      sessionExpired: false,
      settings: {
        theme: 'dark',
        hotkeys: {
          slot1: { promptId: null },
          slot2: { promptId: null },
          slot3: { promptId: null }
        },
        defaultFolder: null
      }
    });

    await chrome.alarms.clearAll();

    console.log('✅ Clean extension logout');

    return { success: true };

  } catch (err) {
    console.error('❌ Logout error:', err);
    await chrome.storage.local.clear();
    return { success: false };
  }
}


async function getValidToken() {
  const { session } = await chrome.storage.local.get(['session']);
  if (!session) return null;

  if (session.expires_at && Date.now() > session.expires_at - 300000) {
    if (!session.refresh_token) return null;

    try {
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            refresh_token: session.refresh_token
          })
        }
      );

      if (!res.ok) {
        await chrome.storage.local.set({
          session: null,
          user: null,
          sessionExpired: true
        });
        return null;
      }

      const data = await res.json();

      const newSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000
      };

      await chrome.storage.local.set({ session: newSession });

      return newSession.access_token;

    } catch (_e) {
      console.error('Token refresh failed:', _e);
      return null;
    }
  }

  return session.access_token;
}

// ---------- Server-side Rate Limiting ----------
// Check rate limit via Supabase RPC before critical write operations
async function checkServerRateLimit(token, endpoint, maxRequests = 60, windowSeconds = 60) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: null, // Will use auth.uid() server-side via SECURITY DEFINER
        p_endpoint: endpoint,
        p_max_requests: maxRequests,
        p_window_seconds: windowSeconds
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data?.allowed !== false; // Default to allowed if response is unexpected
    }
    return true; // Allow if check fails (don't block users on rate limit infra issues)
  } catch (_e) {
    console.warn('Rate limit check failed (allowing):', _e.message);
    return true;
  }
}

// Rate limit presets: { endpoint: [maxRequests, windowSeconds] }
const RATE_LIMIT_PRESETS = {
  'library_write': [10, 60],     // Share to library: 10/min
  'report_submit': [3, 60],       // Report: 3/min
  'like_toggle': [30, 60],        // Like: 30/min
  'prompt_sync': [120, 60],       // Prompt sync: 120/min
  'storage_upload': [10, 60]      // Image upload: 10/min
};

// Determine rate limit endpoint from request path
function getRateLimitEndpoint(method, path) {
  if (method === 'POST' && path.includes('rpc/share_prompt_to_library')) return 'library_write';
  if (method === 'POST' && path.startsWith('prompt_reports')) return 'report_submit';
  if (method === 'POST' && path.includes('rpc/toggle_library_like')) return 'like_toggle';
  if (method === 'POST' && path.startsWith('storage/')) return 'storage_upload';
  return null; // No rate limit for this endpoint
}

async function handleSupabaseRequest(message) {
  const token = await getValidToken();
  if (!token) return { error: 'Not authenticated' };

  const { method, path, body, isFile, fileData, contentType: fileContentType } = message;
  
  // Server-side rate limit check for write operations
  const rateLimitEndpoint = getRateLimitEndpoint(method, path);
  if (rateLimitEndpoint) {
    const preset = RATE_LIMIT_PRESETS[rateLimitEndpoint];
    if (preset) {
      const allowed = await checkServerRateLimit(token, rateLimitEndpoint, preset[0], preset[1]);
      if (!allowed) {
        console.warn(`Rate limited: ${rateLimitEndpoint}`);
        return { error: 'Rate limited. Please wait a moment and try again.' };
      }
    }
  }
  
  // Handle file uploads to Storage
  if (isFile && path.startsWith('storage/v1/object/')) {
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY
      };
      
      let uploadBody;
      let uploadContentType;
      
      // Handle different file data formats
      if (fileData) {
        // Base64 data passed from popup
        const byteCharacters = atob(fileData.split(',')[1] || fileData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        uploadBody = byteArray;
        uploadContentType = fileContentType || 'image/png';
      } else if (body && typeof body === 'string' && body.startsWith('data:')) {
        // Data URL format
        const matches = body.match(/^data:(.+?);base64,(.+)$/);
        if (matches) {
          uploadContentType = matches[1];
          const byteCharacters = atob(matches[2]);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          uploadBody = new Uint8Array(byteNumbers);
        }
      }
      
      if (!uploadBody) {
        return { error: 'Invalid file data' };
      }
      
      headers['Content-Type'] = uploadContentType;
      headers['x-upsert'] = 'true';
      
      const res = await fetch(`${SUPABASE_URL}/${path}`, {
        method: 'POST',
        headers,
        body: uploadBody
      });
      
      if (!res.ok) {
        const text = await res.text();
        console.error('Storage upload error:', text);
        return { error: text };
      }
      
      const data = await res.json().catch(() => ({}));
      
      // Also generate signed URL for the uploaded file (since bucket may be private)
      const storagePath = path.replace('storage/v1/object/', '');
      const bucketAndPath = storagePath.split('/');
      const bucketName = bucketAndPath[0];
      const filePath = bucketAndPath.slice(1).join('/');
      
      try {
        const signedRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucketName}/${filePath}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ expiresIn: 31536000 }) // 1 year
        });
        
        if (signedRes.ok) {
          const signedData = await signedRes.json();
          if (signedData.signedURL) {
            data.signedUrl = `${SUPABASE_URL}/storage/v1${signedData.signedURL}`;
          }
        }
      } catch (signErr) {
        console.warn('Signed URL generation failed for handleSupabaseRequest upload:', signErr);
      }
      
      data.storagePath = `${bucketName}/${filePath}`;
      return { data };
    } catch (err) {
      console.error('File upload error:', err);
      return { error: err.message };
    }
  }
  
  // Regular REST API request
  const headers = {
    'Authorization': `Bearer ${token}`,
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  };

  // For POST to tables (not rpc), add upsert handling
  // Exception: prompt_reports should use plain INSERT (not upsert) - duplicate is an error
  if (method === 'POST' && !path.startsWith('rpc/') && !path.startsWith('storage/')) {
    if (path.startsWith('prompt_reports')) {
      headers['Prefer'] = 'return=representation';
    } else {
      headers['Prefer'] = 'return=representation,resolution=merge-duplicates';
    }
  } else if (method === 'POST') {
    headers['Prefer'] = 'return=representation';
  }

  Object.keys(headers).forEach(k => headers[k] === undefined && delete headers[k]);

  const maxRetries = (method || 'GET') === 'GET' ? 2 : 0; // Only retry GETs automatically
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: method || 'GET',
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      if (!res.ok) {
        const text = await res.text();
        // Retry on server errors (5xx) for GET requests
        if (res.status >= 500 && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        return { error: text };
      }

      const contentType = res.headers.get('content-type');
      if (res.status === 204 || !contentType || !contentType.includes('application/json')) {
        return { data: null };
      }

      const data = await res.json();
      return { data };
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      return { error: err.message };
    }
  }
}

// ---------- Proactive Token Refresh ----------
// Refresh token 5 minutes before expiry, not just 60 seconds
// Also runs a periodic alarm to catch tokens that expire while popup is closed
chrome.alarms.create('token-refresh', { periodInMinutes: 10 });
chrome.alarms.create('subscription-check', { periodInMinutes: 60 }); // Check subscription hourly

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'token-refresh') {
    const { session } = await chrome.storage.local.get(['session']);
    if (!session?.refresh_token) return;
    // Refresh if token expires within 5 minutes
    if (session.expires_at && Date.now() > session.expires_at - 300000) {
      console.log('🔄 Proactive token refresh triggered');
      const newToken = await getValidToken();
      if (newToken) {
        console.log('✅ Token proactively refreshed');
      } else {
        console.warn('⚠️ Proactive token refresh failed');
      }
    }
  }

  if (alarm.name === 'subscription-check') {
    await periodicSubscriptionCheck();
  }
});

// ---------- Periodic Subscription Status Check ----------
async function periodicSubscriptionCheck() {
  const { session, user } = await chrome.storage.local.get(['session', 'user']);
  if (!session?.access_token || !user?.id) return;

  try {
    const token = await getValidToken();
    if (!token) return;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sync_user_on_login`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (res.ok) {
      const data = await res.json();
      const result = Array.isArray(data) ? data[0] : data;
      if (result) {
        const currentPremium = (await chrome.storage.local.get(['isPremium'])).isPremium;
        const newPremium = result.is_premium || false;
        const newLimit = result.prompt_limit || FREE_PROMPT_LIMIT;

        await chrome.storage.local.set({
          isPremium: newPremium,
          promptLimit: newLimit
        });

        // Notify user if subscription expired
        if (currentPremium && !newPremium) {
          console.log('⚠️ Subscription expired detected');
          chrome.notifications.create('subscription-expired', {
            type: 'basic',
            iconUrl: 'assets/icon-128.png',
            title: 'Promptory',
            message: 'Your Pro subscription has expired. You are now on the Free plan.'
          });
        }
      }
    }
  } catch (_e) {
    console.error('Periodic subscription check error:', _e);
  }
}

console.log('Promptory background service worker initialized');