// Promptory Popup - Offline Queue Module
// Queues operations when offline and replays them when back online

window.Promptory = window.Promptory || {};

(function(P) {
'use strict';

const QUEUE_STORAGE_KEY = 'offlineQueue';
const MAX_RETRIES = 3; // Max retry attempts per operation before dropping
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // Drop operations older than 24h

// Operation queue for offline mode
let _queue = [];
let _isOnline = navigator.onLine;
let _isProcessing = false;

P.offline = {
  get isOnline() { return _isOnline; },
  get queueLength() { return _queue.length; }
};

// ==================== QUEUE MANAGEMENT ====================
async function loadQueue() {
  return new Promise(resolve => {
    chrome.storage.local.get([QUEUE_STORAGE_KEY], (result) => {
      _queue = result[QUEUE_STORAGE_KEY] || [];
      resolve();
    });
  });
}

async function saveQueue() {
  await P.saveData(QUEUE_STORAGE_KEY, _queue);
}

// Add an operation to the queue
P.enqueueOperation = async function(operation) {
  // operation: { type: 'syncPrompt'|'deletePrompt'|'syncFolder'|'deleteFolder'|'shareToLibrary'|'likeToggle', data: {...}, timestamp: number }
  operation.timestamp = Date.now();
  operation.id = crypto.randomUUID();
  
  // Deduplicate: if same type+target exists, replace with newer
  const existingIdx = _queue.findIndex(op => 
    op.type === operation.type && op.data?.id === operation.data?.id
  );
  if (existingIdx >= 0) {
    _queue[existingIdx] = operation;
  } else {
    _queue.push(operation);
  }
  
  await saveQueue();
  updateOfflineIndicator();
  return operation.id;
};

// Check if an error is permanent (not worth retrying)
function isPermanentError(errorStr) {
  if (!errorStr) return false;
  const s = (typeof errorStr === 'string' ? errorStr : JSON.stringify(errorStr)).toLowerCase();
  return s.includes('not authenticated') || s.includes('jwt') || s.includes('permission') 
    || s.includes('rls') || s.includes('row-level security') 
    || s.includes('401') || s.includes('403') || s.includes('42501')
    || s.includes('not found') || s.includes('does not exist');
}

// Process the queue when we go back online
P.processQueue = async function() {
  if (_isProcessing || _queue.length === 0 || !_isOnline) return;
  if (!P.state.session || !P.state.user) return;
  
  _isProcessing = true;
  console.log(`Processing ${_queue.length} offline operations...`);
  
  const toRemove = [];
  const now = Date.now();
  
  for (const op of [..._queue]) {
    // Drop expired operations
    if (op.timestamp && (now - op.timestamp) > MAX_AGE_MS) {
      console.warn('Dropping expired operation:', op.type, op.data?.id);
      toRemove.push(op.id);
      continue;
    }
    
    // Drop operations that exceeded max retries
    if ((op.retries || 0) >= MAX_RETRIES) {
      console.warn('Dropping operation after max retries:', op.type, op.data?.id);
      toRemove.push(op.id);
      continue;
    }
    
    try {
      let result = { success: false, error: null };
      
      switch (op.type) {
        case 'syncPrompt':
          result = await replaySyncPrompt(op.data);
          break;
        case 'deletePrompt':
          result = await replayDeletePrompt(op.data.id);
          break;
        case 'syncFolder':
          result = await replaySyncFolder(op.data);
          break;
        case 'deleteFolder':
          result = await replayDeleteFolder(op.data.id);
          break;
        default:
          console.warn('Unknown offline operation type:', op.type);
          result = { success: true };
      }
      
      if (result.success) {
        toRemove.push(op.id);
      } else if (isPermanentError(result.error)) {
        // Permanent error - drop it, retrying won't help
        console.warn('Dropping operation due to permanent error:', op.type, result.error);
        toRemove.push(op.id);
      } else {
        // Transient error - increment retry counter
        op.retries = (op.retries || 0) + 1;
      }
    } catch (e) {
      console.warn('Failed to replay operation:', op.type, e);
      op.retries = (op.retries || 0) + 1;
    }
  }
  
  // Remove processed/dropped operations
  const prevLen = _queue.length;
  _queue = _queue.filter(op => !toRemove.includes(op.id));
  await saveQueue();
  
  _isProcessing = false;
  updateOfflineIndicator();
  
  const removedCount = prevLen - _queue.length;
  if (removedCount > 0) {
    console.log(`Processed ${removedCount} offline operations, ${_queue.length} remaining`);
    if (_queue.length === 0) {
      P.showToast(P.t('offlineSynced') || 'All changes synced', 'success');
    }
  }
};

// ==================== REPLAY FUNCTIONS ====================
// Return { success: boolean, error: string|null }
async function replaySyncPrompt(prompt) {
  // Validate folder_id: only include if the folder exists locally
  const validFolderId = prompt.folderId && P.state.folders && P.state.folders.some(f => f.id === prompt.folderId)
    ? prompt.folderId : null;
  
  const body = {
    id: prompt.id,
    user_id: P.state.user.id,
    folder_id: validFolderId,
    title: prompt.title,
    text: prompt.text,
    description: prompt.description,
    image_url: prompt.imageUrl || null,
    platform: prompt.platform || 'universal',
    tags: prompt.tags || [],
    variables: prompt.variables || [],
    is_favorite: prompt.isFavorite || false,
    use_count: prompt.useCount || 0,
    updated_at: new Date(prompt.updatedAt || Date.now()).toISOString()
  };
  const res = await P.supabaseMsg({
    action: 'supabaseRequest', method: 'POST', path: 'prompts', body
  });
  if (!res?.error) return { success: true };
  
  // FK violation on folder_id — retry without folder
  const errStr = typeof res.error === 'string' ? res.error : JSON.stringify(res.error);
  if (errStr.includes('folder_id') || errStr.includes('foreign key') || errStr.includes('23503')) {
    body.folder_id = null;
    const retry = await P.supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'prompts', body });
    if (!retry?.error) return { success: true };
    return { success: false, error: typeof retry.error === 'string' ? retry.error : JSON.stringify(retry.error) };
  }
  
  return { success: false, error: errStr };
}

async function replayDeletePrompt(id) {
  const res = await P.supabaseMsg({
    action: 'supabaseRequest', method: 'DELETE', path: `prompts?id=eq.${id}`
  });
  // DELETE returning no error OR 404 (already deleted) = success
  if (!res?.error) return { success: true };
  const errStr = typeof res.error === 'string' ? res.error : JSON.stringify(res.error);
  if (errStr.includes('404') || errStr.includes('not found')) return { success: true };
  return { success: false, error: errStr };
}

async function replaySyncFolder(folder) {
  const res = await P.supabaseMsg({
    action: 'supabaseRequest', method: 'POST', path: 'folders',
    body: { id: folder.id, user_id: P.state.user.id, name: folder.name, updated_at: new Date(folder.updatedAt || Date.now()).toISOString() }
  });
  if (!res?.error) return { success: true };
  return { success: false, error: typeof res.error === 'string' ? res.error : JSON.stringify(res.error) };
}

async function replayDeleteFolder(id) {
  const res = await P.supabaseMsg({
    action: 'supabaseRequest', method: 'DELETE', path: `folders?id=eq.${id}`
  });
  if (!res?.error) return { success: true };
  const errStr = typeof res.error === 'string' ? res.error : JSON.stringify(res.error);
  if (errStr.includes('404') || errStr.includes('not found')) return { success: true };
  return { success: false, error: errStr };
}

// ==================== NETWORK STATUS ====================
function updateOfflineIndicator() {
  let indicator = document.getElementById('offline-indicator');
  
  if (!_isOnline || _queue.length > 0) {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'offline-indicator';
      indicator.className = 'offline-indicator';
      const header = document.querySelector('.header');
      if (header) header.after(indicator);
    }
    
    if (!_isOnline) {
      indicator.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1l22 22"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg><span>${P.t('offlineMode') || 'Offline mode'}</span>`;
      indicator.className = 'offline-indicator offline';
    } else {
      indicator.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/></svg><span>${P.t('syncingChanges') || 'Syncing'} (${_queue.length})</span>`;
      indicator.className = 'offline-indicator syncing';
    }
  } else if (indicator) {
    indicator.remove();
  }
}

// ==================== ONLINE/OFFLINE LISTENERS ====================
function onOnline() {
  _isOnline = true;
  console.log('🌐 Back online');
  updateOfflineIndicator();
  // Process queued operations
  setTimeout(() => P.processQueue(), 1000);
}

function onOffline() {
  _isOnline = false;
  console.log('📴 Gone offline');
  updateOfflineIndicator();
}

// ==================== INIT ====================
P.initOffline = async function() {
  await loadQueue();
  
  // Clean up stale/expired operations on init
  const now = Date.now();
  const prevLen = _queue.length;
  _queue = _queue.filter(op => {
    if (op.timestamp && (now - op.timestamp) > MAX_AGE_MS) return false;
    if ((op.retries || 0) >= MAX_RETRIES) return false;
    return true;
  });
  if (_queue.length !== prevLen) {
    console.log(`Cleaned ${prevLen - _queue.length} stale offline operations`);
    await saveQueue();
  }
  
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  
  _isOnline = navigator.onLine;
  updateOfflineIndicator();
  
  // Process queue if we're online and have pending operations
  if (_isOnline && _queue.length > 0) {
    setTimeout(() => P.processQueue(), 2000);
  }
};

// ==================== WRAPPER: SYNC OR QUEUE ====================
// These replace the direct Supabase sync calls - they queue if offline
P.syncPromptToCloud = async function(prompt) {
  if (!P.state.session || !P.state.user) return;
  
  if (!_isOnline) {
    await P.enqueueOperation({ type: 'syncPrompt', data: { ...prompt } });
    return;
  }
  
  try {
    // Validate folder_id: only include if the folder exists locally
    const validFolderId = prompt.folderId && P.state.folders && P.state.folders.some(f => f.id === prompt.folderId)
      ? prompt.folderId : null;
    
    const body = {
      id: prompt.id,
      user_id: P.state.user.id,
      folder_id: validFolderId,
      title: prompt.title,
      text: prompt.text,
      description: prompt.description,
      image_url: prompt.imageUrl || null,
      platform: prompt.platform || 'universal',
      tags: prompt.tags || [],
      variables: prompt.variables || [],
      is_favorite: prompt.isFavorite || false,
      use_count: prompt.useCount || 0,
      updated_at: new Date().toISOString()
    };
    const res = await P.supabaseMsg({
      action: 'supabaseRequest', method: 'POST', path: 'prompts', body
    });
    if (res?.error) {
      const errStr = typeof res.error === 'string' ? res.error : JSON.stringify(res.error);
      
      // FK violation on folder_id — retry without folder
      if (errStr.includes('folder_id') || errStr.includes('foreign key') || errStr.includes('23503')) {
        body.folder_id = null;
        const retry = await P.supabaseMsg({ action: 'supabaseRequest', method: 'POST', path: 'prompts', body });
        if (retry?.error) {
          // Only queue if it's a transient error
          if (!isPermanentError(retry.error)) {
            await P.enqueueOperation({ type: 'syncPrompt', data: { ...prompt, folderId: null } });
          } else {
            console.warn('Permanent sync error, dropping:', errStr);
          }
        }
      } else if (!isPermanentError(errStr)) {
        // Only queue transient errors (network timeouts, 5xx, etc.)
        await P.enqueueOperation({ type: 'syncPrompt', data: { ...prompt } });
      } else {
        console.warn('Permanent sync error, not queuing:', errStr);
      }
    }
  } catch (e) {
    console.warn('Sync failed, queuing:', e);
    await P.enqueueOperation({ type: 'syncPrompt', data: { ...prompt } });
  }
};

P.syncPromptDeleteToCloud = async function(id) {
  if (!P.state.session || !P.state.user) return;
  if (!_isOnline) {
    await P.enqueueOperation({ type: 'deletePrompt', data: { id } });
    return;
  }
  try {
    await P.supabaseMsg({ action: 'supabaseRequest', method: 'DELETE', path: `prompts?id=eq.${id}` });
  } catch (e) {
    await P.enqueueOperation({ type: 'deletePrompt', data: { id } });
  }
};

P.syncFolderToCloud = async function(folder) {
  if (!P.state.session || !P.state.user) return;
  if (!_isOnline) {
    await P.enqueueOperation({ type: 'syncFolder', data: { ...folder } });
    return;
  }
  try {
    const res = await P.supabaseMsg({
      action: 'supabaseRequest', method: 'POST', path: 'folders',
      body: { id: folder.id, user_id: P.state.user.id, name: folder.name, updated_at: new Date().toISOString() }
    });
    if (res?.error && !isPermanentError(res.error)) {
      await P.enqueueOperation({ type: 'syncFolder', data: { ...folder } });
    }
  } catch (e) {
    await P.enqueueOperation({ type: 'syncFolder', data: { ...folder } });
  }
};

P.syncFolderDeleteToCloud = async function(id) {
  if (!P.state.session || !P.state.user) return;
  if (!_isOnline) {
    await P.enqueueOperation({ type: 'deleteFolder', data: { id } });
    return;
  }
  try {
    await P.supabaseMsg({ action: 'supabaseRequest', method: 'DELETE', path: `folders?id=eq.${id}` });
  } catch (e) {
    await P.enqueueOperation({ type: 'deleteFolder', data: { id } });
  }
};

})(window.Promptory);
