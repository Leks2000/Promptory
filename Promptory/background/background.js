// Promptory Background Service Worker

const SUPABASE_URL = 'https://vofgfvlgchqheksvlibl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZmdmdmxnY2hxaGVrc3ZsaWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTgzNzEsImV4cCI6MjA4NjA3NDM3MX0.taoCHiYqJT2mSp5odtaM1p52KO5MnGzSOiz4dhmZnb0';
// Extension ID for redirect URL
const EXTENSION_ID = 'clachikkapfdfldgkmdhkmpmgagonnml';

// ---------- Installation ----------
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Promptory installed');
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
      promptLimit: 20,
      language: null
    });

    // Open onboarding page on first install
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding/welcome.html'),
      active: true
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

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-as-prompt') {
    const text = info.selectionText;
    if (!text) return;
    const result = await chrome.storage.local.get(['prompts']);
    const prompts = result.prompts || [];
    const newPrompt = {
      id: crypto.randomUUID(),
      title: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
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
      } catch (e) {
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
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'insertPrompt',
              text: prompt.text,
              variables: prompt.variables || []
            });
            prompt.useCount = (prompt.useCount || 0) + 1;
            prompt.updatedAt = Date.now();
            await chrome.storage.local.set({ prompts });

            if (result.session?.access_token && result.user?.id) {
              const platform = new URL(tab.url || '').hostname.replace('www.', '');
              trackUsageInBackground(result.session, prompt, platform);
            }
          } catch (e) {
            console.error('Failed to insert hotkey prompt:', e);
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
  } catch (e) { console.error('Background usage tracking failed:', e); }
}

// ---------- Message Handler ----------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
        } catch (e) {
          sendResponse({ success: false, error: e.message });
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
    handleGoogleSignIn().then(sendResponse);
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

    // Return public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
    return { data: { publicUrl } };
  } catch (err) {
    console.error('Storage upload error:', err);
    return { error: err.message };
  }
}

// ---------- Supabase Auth via Chrome Identity API ----------
async function handleGoogleSignIn() {
  try {
    // Use chrome.identity.getRedirectURL() for proper callback
    const callbackUrl = chrome.identity.getRedirectURL();
    console.log('🔹 Callback URL:', callbackUrl);

    // Build auth URL with Supabase - redirect to extension callback
    const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(callbackUrl)}`;
    console.log('🔹 Auth URL:', authUrl);

    // Try launchWebAuthFlow first (works in most browsers)
    try {
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });

      console.log('🔹 Response URL:', responseUrl);

      if (!responseUrl) {
        throw new Error('No response URL received');
      }

      // Parse tokens from URL hash
      const url = new URL(responseUrl);
      const hashParams = new URLSearchParams(url.hash.replace('#', ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const expiresIn = parseInt(hashParams.get('expires_in') || '3600');

      if (!accessToken) {
        // Check for error in URL
        const errorDesc = hashParams.get('error_description') || url.searchParams.get('error_description');
        throw new Error(errorDesc || 'No access token in response');
      }

      console.log('✅ Got access token');

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
      console.log('✅ Session saved');

      return { success: true, user, session };

    } catch (launchError) {
      console.warn('⚠️ launchWebAuthFlow failed, trying tab method:', launchError.message);
      
      // Fallback: Open in new tab (for Brave and other browsers that block launchWebAuthFlow)
      const tab = await chrome.tabs.create({ 
        url: authUrl, 
        active: true 
      });

      console.log('🔹 Opened auth tab:', tab.id);

      // Wait for auth-callback.html to save session
      return new Promise((resolve) => {
        let checkCount = 0;
        const maxChecks = 120; // 60 seconds (120 * 500ms)
        
        const checkInterval = setInterval(async () => {
          checkCount++;
          
          const { session, user } = await chrome.storage.local.get(['session', 'user']);
          
          if (session && user) {
            clearInterval(checkInterval);
            console.log('✅ Session detected:', user.email);
            
            // Close auth tab if still open
            try {
              await chrome.tabs.remove(tab.id);
            } catch (e) {
              console.log('🔹 Auth tab already closed');
            }
            
            resolve({ success: true, user, session });
          } else if (checkCount >= maxChecks) {
            clearInterval(checkInterval);
            console.error('❌ Timeout waiting for auth');
            resolve({ success: false, error: 'Timeout waiting for authentication' });
          }
        }, 500);
      });
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
      }).catch(() => {});
    }
    await chrome.storage.local.set({ session: null, user: null, isPremium: false });
    return { success: true };
  } catch (err) {
    await chrome.storage.local.set({ session: null, user: null, isPremium: false });
    return { success: true };
  }
}

async function getValidToken() {
  const { session } = await chrome.storage.local.get(['session']);
  if (!session) return null;

  // Check if token is expired (with 60s buffer)
  if (session.expires_at && Date.now() > session.expires_at - 60000) {
    if (!session.refresh_token) return null;
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });

      if (res.ok) {
        const data = await res.json();
        const newSession = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Date.now() + (data.expires_in || 3600) * 1000
        };
        await chrome.storage.local.set({ session: newSession });
        return newSession.access_token;
      } else {
        console.error('Token refresh failed with status:', res.status);
        // Clear invalid session
        await chrome.storage.local.set({ session: null, user: null });
        return null;
      }
    } catch (e) {
      console.error('Token refresh error:', e);
      return null;
    }
  }

  return session.access_token;
}

async function handleSupabaseRequest(message) {
  const token = await getValidToken();
  if (!token) return { error: 'Not authenticated' };

  const { method, path, body } = message;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  };

  // For POST to tables (not rpc), add upsert handling
  if (method === 'POST' && !path.startsWith('rpc/')) {
    headers['Prefer'] = 'return=representation,resolution=merge-duplicates';
  } else if (method === 'POST') {
    headers['Prefer'] = 'return=representation';
  }

  Object.keys(headers).forEach(k => headers[k] === undefined && delete headers[k]);

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: method || 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: text };
    }

    const contentType = res.headers.get('content-type');
    if (res.status === 204 || !contentType || !contentType.includes('application/json')) {
      return { data: null };
    }

    const data = await res.json();
    return { data };
  } catch (err) {
    return { error: err.message };
  }
}

console.log('Promptory background service worker initialized');
