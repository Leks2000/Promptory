/**
 * Mock chrome.storage for web preview (not in actual extension)
 */
if (typeof chrome === 'undefined' || !chrome.storage) {
  const store = {};
  
  // Sample data
  store['pv_prompts'] = [
    {
      id: 'demo1',
      title: 'Summarize Article',
      text: 'Summarize the following article in 3 concise bullet points. Focus on key takeaways:\n\n{article_text}',
      folderId: 'folder1',
      tags: ['productivity', 'summarize'],
      isFavorite: true,
      usageCount: 24,
      lastUsed: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 3).toISOString()
    },
    {
      id: 'demo2',
      title: 'Code Review',
      text: 'Review the following code for:\n1. Bugs and potential issues\n2. Performance improvements\n3. Best practices\n4. Security vulnerabilities\n\nCode:\n{code}',
      folderId: 'folder2',
      tags: ['development', 'code'],
      isFavorite: false,
      usageCount: 18,
      lastUsed: new Date(Date.now() - 7200000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
      id: 'demo3',
      title: 'Email Writer',
      text: 'Write a {tone} email about {topic} to {recipient}. Keep it {length}. Include a clear call to action.',
      folderId: null,
      tags: ['email', 'communication'],
      isFavorite: true,
      usageCount: 31,
      lastUsed: new Date(Date.now() - 1800000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 7).toISOString()
    },
    {
      id: 'demo4',
      title: 'Midjourney v6 Prompt',
      text: '{subject}, {style} style, {lighting} lighting, {camera} shot, highly detailed, 8k, cinematic --ar {aspect_ratio} --v 6',
      folderId: 'folder3',
      tags: ['ai-art', 'midjourney'],
      isFavorite: false,
      usageCount: 12,
      lastUsed: new Date(Date.now() - 43200000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'demo5',
      title: 'Debug Assistant',
      text: 'I\'m getting this error:\n\n{error_message}\n\nIn this code:\n{code_snippet}\n\nPlease:\n1. Explain the cause\n2. Provide a fix\n3. Explain why it works',
      folderId: 'folder2',
      tags: ['development', 'debug'],
      isFavorite: false,
      usageCount: 9,
      lastUsed: null,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString()
    }
  ];
  
  store['pv_folders'] = [
    { id: 'folder1', name: 'Productivity', parentId: null, icon: '🚀', color: '#7c3aed', createdAt: new Date().toISOString() },
    { id: 'folder2', name: 'Development', parentId: null, icon: '💻', color: '#22c55e', createdAt: new Date().toISOString() },
    { id: 'folder3', name: 'AI Art', parentId: null, icon: '🎨', color: '#ec4899', createdAt: new Date().toISOString() }
  ];
  
  store['pv_settings'] = {
    theme: 'dark',
    insertMode: 'replace',
    showNotifications: true,
    defaultSort: 'date',
    compactView: false,
    maxFreePrompts: 20
  };
  
  store['pv_hotkeys'] = {
    'hotkey-1': 'demo1',
    'hotkey-2': 'demo2'
  };
  
  store['pv_stats'] = {
    totalInsertions: 94,
    todayInsertions: 7,
    todayDate: new Date().toDateString(),
    weeklyData: (() => {
      const data = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        data[d.toISOString().split('T')[0]] = Math.floor(Math.random() * 15) + 2;
      }
      return data;
    })()
  };
  
  store['pv_usage_history'] = [];

  window.chrome = {
    storage: {
      local: {
        get(keys, callback) {
          const result = {};
          const keyArr = Array.isArray(keys) ? keys : [keys];
          keyArr.forEach(k => {
            if (store[k] !== undefined) {
              result[k] = JSON.parse(JSON.stringify(store[k]));
            }
          });
          if (callback) callback(result);
          return Promise.resolve(result);
        },
        set(data, callback) {
          Object.assign(store, JSON.parse(JSON.stringify(data)));
          if (callback) callback();
          return Promise.resolve();
        },
        remove(keys, callback) {
          const keyArr = Array.isArray(keys) ? keys : [keys];
          keyArr.forEach(k => delete store[k]);
          if (callback) callback();
          return Promise.resolve();
        },
        clear(callback) {
          Object.keys(store).forEach(k => delete store[k]);
          if (callback) callback();
          return Promise.resolve();
        }
      }
    },
    runtime: {
      lastError: null,
      openOptionsPage() { console.log('Opening options page'); },
      getURL(path) { return '../' + path; },
      onMessage: { addListener() {} },
      sendMessage() {}
    },
    tabs: {
      query(opts) { return Promise.resolve([{ id: 1 }]); },
      sendMessage() { return Promise.resolve(); },
      create() {}
    },
    commands: { onCommand: { addListener() {} } },
    contextMenus: { removeAll() {}, create() {}, onClicked: { addListener() {} } },
    action: { openPopup() {} }
  };
}
