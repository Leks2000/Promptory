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
      
      // Check for existing session
      checkSession();
      
      // Listen for auth changes
      supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event);
        if (event === 'SIGNED_IN' && session) {
          handleSignIn(session);
        } else if (event === 'SIGNED_OUT') {
          handleSignOut();
        }
      });
    } catch (err) {
      console.warn('Supabase initialization failed:', err);
    }
  } else {
    console.warn('Supabase library not loaded - using local storage only');
  }
  
  // Load library prompts
  loadLibraryPrompts();
}

export function getSupabaseClient() {
  return supabaseClient;
}

async function checkSession() {
  if (!supabaseClient) return;
  
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    
    if (session) {
      handleSignIn(session);
    }
  } catch (err) {
    console.error('Session check failed:', err);
  }
}

async function handleSignIn(session) {
  const user = session.user;
  
  // Update app state
  window.appState.user = {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.email?.split('@')[0]
  };
  
  // Save to storage
  chrome.storage.local.set({ user: window.appState.user });
  
  // Load user data from Supabase
  await syncUserData();
}

async function handleSignOut() {
  window.appState.user = null;
  chrome.storage.local.set({ user: null });
}

async function syncUserData() {
  if (!supabaseClient || !window.appState.user) return;
  
  try {
    // Load folders
    const { data: folders, error: foldersError } = await supabaseClient
      .from('folders')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (!foldersError && folders) {
      const mappedFolders = folders.map(f => ({
        id: f.id,
        name: f.name,
        icon: f.icon,
        createdAt: new Date(f.created_at).getTime(),
        updatedAt: new Date(f.updated_at).getTime()
      }));
      
      window.appState.folders = mappedFolders;
      chrome.storage.local.set({ folders: mappedFolders });
    }
    
    // Load prompts
    const { data: prompts, error: promptsError } = await supabaseClient
      .from('prompts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!promptsError && prompts) {
      const mappedPrompts = prompts.map(p => ({
        id: p.id,
        title: p.title,
        text: p.text,
        description: p.description,
        folderId: p.folder_id,
        platform: p.platform,
        tags: p.tags || [],
        variables: p.variables || [],
        isFavorite: p.is_favorite,
        useCount: p.use_count,
        createdAt: new Date(p.created_at).getTime(),
        updatedAt: new Date(p.updated_at).getTime()
      }));
      
      window.appState.prompts = mappedPrompts;
      chrome.storage.local.set({ prompts: mappedPrompts });
    }
    
    console.log('User data synced from Supabase');
    
    // Trigger re-render
    document.dispatchEvent(new CustomEvent('data-synced'));
  } catch (err) {
    console.error('Failed to sync user data:', err);
  }
}

async function loadLibraryPrompts() {
  if (!supabaseClient) {
    // Use mock data if Supabase not available
    return;
  }
  
  try {
    const { data: libraryPrompts, error } = await supabaseClient
      .from('library_prompts')
      .select('*')
      .order('likes', { ascending: false });
    
    if (!error && libraryPrompts) {
      // Store in window for explore component
      window.libraryPrompts = libraryPrompts.map(p => ({
        id: p.id,
        title: p.title,
        text: p.text,
        description: p.description,
        author: p.author,
        icon: p.icon,
        tags: p.tags || [],
        likes: p.likes,
        downloads: p.downloads,
        category: p.category,
        isFeatured: p.is_featured
      }));
      
      console.log('Library prompts loaded:', window.libraryPrompts.length);
      
      // Trigger explore update
      document.dispatchEvent(new CustomEvent('library-loaded'));
    }
  } catch (err) {
    console.error('Failed to load library prompts:', err);
  }
}

// Export functions for use in settings
export async function signInWithGoogle() {
  if (!supabaseClient) {
    // Mock sign in for development
    const mockUser = {
      id: 'user-' + Date.now(),
      email: 'demo@example.com',
      name: 'Demo User'
    };
    
    window.appState.user = mockUser;
    chrome.storage.local.set({ user: mockUser });
    return { success: true, user: mockUser };
  }
  
  try {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: chrome.runtime.getURL('popup/popup.html')
      }
    });
    
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Google sign in failed:', err);
    return { success: false, error: err.message };
  }
}

export async function signOut() {
  if (!supabaseClient) {
    window.appState.user = null;
    chrome.storage.local.set({ user: null });
    return { success: true };
  }
  
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Sign out failed:', err);
    return { success: false, error: err.message };
  }
}

// Sync local changes to Supabase
export async function syncPromptToSupabase(prompt, action = 'upsert') {
  if (!supabaseClient || !window.appState.user) return;
  
  try {
    if (action === 'delete') {
      await supabaseClient
        .from('prompts')
        .delete()
        .eq('id', prompt.id);
    } else {
      await supabaseClient
        .from('prompts')
        .upsert({
          id: prompt.id,
          user_id: window.appState.user.id,
          folder_id: prompt.folderId,
          title: prompt.title,
          text: prompt.text,
          description: prompt.description,
          platform: prompt.platform,
          tags: prompt.tags,
          variables: prompt.variables,
          is_favorite: prompt.isFavorite,
          use_count: prompt.useCount,
          updated_at: new Date().toISOString()
        });
    }
    console.log('Prompt synced to Supabase:', action);
  } catch (err) {
    console.error('Failed to sync prompt:', err);
  }
}

export async function syncFolderToSupabase(folder, action = 'upsert') {
  if (!supabaseClient || !window.appState.user) return;
  
  try {
    if (action === 'delete') {
      await supabaseClient
        .from('folders')
        .delete()
        .eq('id', folder.id);
    } else {
      await supabaseClient
        .from('folders')
        .upsert({
          id: folder.id,
          user_id: window.appState.user.id,
          name: folder.name,
          icon: folder.icon,
          updated_at: new Date().toISOString()
        });
    }
    console.log('Folder synced to Supabase:', action);
  } catch (err) {
    console.error('Failed to sync folder:', err);
  }
}
