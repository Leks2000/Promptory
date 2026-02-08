// PromptVault Background Service Worker

const SUPABASE_URL = 'https://vofgfvlgchqheksvlibl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZmdmdmxnY2hxaGVrc3ZsaWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTgzNzEsImV4cCI6MjA4NjA3NDM3MX0.taoCHiYqJT2mSp5odtaM1p52KO5MnGzSOiz4dhmZnb0';

// ---------- Installation ----------
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('PromptVault installed');
    chrome.storage.local.set({
      prompts: [],
      folders: [],
      settings: {
        theme: 'dark',
        hotkeys: {
          slot1: { promptId: null },
          slot2: { promptId: null },
          slot3: { promptId: null },
          slot4: { promptId: null }
        },
        defaultFolder: null
      },
      user: null,
      session: null,
      hasLaunched: false,
      isPremium: false,
      promptLimit: 20
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
      title: 'PromptVault',
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
        // Content script not loaded, inject it
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

  // Handle hotkey-1 through hotkey-4
  const match = command.match(/^hotkey-(\d)$/);
  if (match) {
    const slotNum = match[1];
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
            // Update use count
            prompt.useCount = (prompt.useCount || 0) + 1;
            prompt.updatedAt = Date.now();
            await chrome.storage.local.set({ prompts });

            // Track usage in Supabase
            if (result.session?.access_token && result.user?.id) {
              const platform = new URL(tab.url || '').hostname.replace('www.','');
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
});

// ---------- Supabase Auth via REST API ----------
async function handleGoogleSignIn() {
  try {
    const redirectUrl = chrome.identity.getRedirectURL();
    console.log('Redirect URL:', redirectUrl);
    const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;

    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        (callbackUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(callbackUrl);
          }
        }
      );
    });

    // Extract tokens from the redirect URL
    const url = new URL(responseUrl);
    // Supabase returns tokens in hash fragment
    const hashParams = new URLSearchParams(url.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (!accessToken) {
      throw new Error('No access token received');
    }

    // Get user info
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });

    if (!userRes.ok) throw new Error('Failed to get user info');
    const userData = await userRes.json();

    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Date.now() + 3600000
    };

    const user = {
      id: userData.id,
      email: userData.email,
      name: userData.user_metadata?.full_name || userData.user_metadata?.name || userData.email?.split('@')[0],
      avatar: userData.user_metadata?.avatar_url || userData.user_metadata?.picture || ''
    };

    await chrome.storage.local.set({ session, user });
    return { success: true, user, session };
  } catch (err) {
    console.error('Google sign in error:', err);
    return { success: false, error: err.message };
  }
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
      });
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

  // Check if token is expired
  if (session.expires_at && Date.now() > session.expires_at - 60000) {
    // Try refresh
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
      }
    } catch (e) {
      console.error('Token refresh failed:', e);
    }
    return null;
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

  // Clean undefined headers
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

    // Handle empty responses (204 No Content for DELETE)
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

console.log('PromptVault background service worker initialized');
