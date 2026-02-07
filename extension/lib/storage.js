/**
 * PromptVault Storage Layer
 * Handles all CRUD operations for prompts, folders, tags
 * Uses chrome.storage.local (FREE) with option for sync
 */

const StorageKeys = {
  PROMPTS: 'pv_prompts',
  FOLDERS: 'pv_folders',
  TAGS: 'pv_tags',
  SETTINGS: 'pv_settings',
  HOTKEYS: 'pv_hotkeys',
  STATS: 'pv_stats',
  USAGE_HISTORY: 'pv_usage_history'
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function now() {
  return new Date().toISOString();
}

// ============ STORAGE ADAPTER ============

const Storage = {
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] || null);
      });
    });
  },

  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  },

  async getAll(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result);
      });
    });
  },

  async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], resolve);
    });
  }
};

// ============ PROMPTS CRUD ============

const PromptStore = {
  async getAll() {
    return (await Storage.get(StorageKeys.PROMPTS)) || [];
  },

  async getById(id) {
    const prompts = await this.getAll();
    return prompts.find(p => p.id === id) || null;
  },

  async create(data) {
    const prompts = await this.getAll();
    const prompt = {
      id: generateId(),
      title: data.title || 'Untitled Prompt',
      text: data.text || '',
      folderId: data.folderId || null,
      tags: data.tags || [],
      color: data.color || null,
      isFavorite: false,
      usageCount: 0,
      lastUsed: null,
      createdAt: now(),
      updatedAt: now()
    };
    prompts.push(prompt);
    await Storage.set(StorageKeys.PROMPTS, prompts);
    return prompt;
  },

  async update(id, data) {
    const prompts = await this.getAll();
    const index = prompts.findIndex(p => p.id === id);
    if (index === -1) return null;
    prompts[index] = { ...prompts[index], ...data, id, updatedAt: now() };
    await Storage.set(StorageKeys.PROMPTS, prompts);
    return prompts[index];
  },

  async delete(id) {
    const prompts = await this.getAll();
    await Storage.set(StorageKeys.PROMPTS, prompts.filter(p => p.id !== id));
    return true;
  },

  async recordUsage(id) {
    const prompts = await this.getAll();
    const index = prompts.findIndex(p => p.id === id);
    if (index === -1) return;
    prompts[index].usageCount = (prompts[index].usageCount || 0) + 1;
    prompts[index].lastUsed = now();
    await Storage.set(StorageKeys.PROMPTS, prompts);
    await StatsStore.recordUsage(id, prompts[index].title);
    return prompts[index];
  },

  async search(query) {
    const prompts = await this.getAll();
    const q = query.toLowerCase();
    return prompts.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.text.toLowerCase().includes(q) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
    );
  },

  async sort(prompts, sortBy = 'date') {
    const sorted = [...prompts];
    switch (sortBy) {
      case 'date':
        sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'alpha':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'usage':
        sorted.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
        break;
      case 'recent':
        sorted.sort((a, b) => {
          if (!a.lastUsed) return 1;
          if (!b.lastUsed) return -1;
          return new Date(b.lastUsed) - new Date(a.lastUsed);
        });
        break;
    }
    return sorted;
  },

  async toggleFavorite(id) {
    const prompts = await this.getAll();
    const index = prompts.findIndex(p => p.id === id);
    if (index === -1) return null;
    prompts[index].isFavorite = !prompts[index].isFavorite;
    prompts[index].updatedAt = now();
    await Storage.set(StorageKeys.PROMPTS, prompts);
    return prompts[index];
  },

  async getCount() {
    return (await this.getAll()).length;
  }
};

// ============ FOLDERS CRUD ============

const FolderStore = {
  async getAll() {
    return (await Storage.get(StorageKeys.FOLDERS)) || [];
  },

  async create(data) {
    const folders = await this.getAll();
    const folder = {
      id: generateId(),
      name: data.name || 'New Folder',
      parentId: data.parentId || null,
      icon: data.icon || '📁',
      color: data.color || '#6366f1',
      createdAt: now()
    };
    folders.push(folder);
    await Storage.set(StorageKeys.FOLDERS, folders);
    return folder;
  },

  async update(id, data) {
    const folders = await this.getAll();
    const index = folders.findIndex(f => f.id === id);
    if (index === -1) return null;
    folders[index] = { ...folders[index], ...data, id };
    await Storage.set(StorageKeys.FOLDERS, folders);
    return folders[index];
  },

  async delete(id) {
    let folders = await this.getAll();
    folders = folders.filter(f => f.id !== id);
    // Move child prompts to root
    const prompts = await PromptStore.getAll();
    const updated = prompts.map(p => p.folderId === id ? { ...p, folderId: null } : p);
    await Storage.set(StorageKeys.PROMPTS, updated);
    // Move child folders to root
    folders = folders.map(f => f.parentId === id ? { ...f, parentId: null } : f);
    await Storage.set(StorageKeys.FOLDERS, folders);
    return true;
  }
};

// ============ SETTINGS ============

const DEFAULT_SETTINGS = {
  theme: 'dark',
  insertMode: 'replace',
  showNotifications: true,
  defaultSort: 'date',
  compactView: false,
  maxFreePrompts: 20
};

const SettingsStore = {
  async get() {
    const settings = await Storage.get(StorageKeys.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...(settings || {}) };
  },

  async update(data) {
    const current = await this.get();
    const updated = { ...current, ...data };
    await Storage.set(StorageKeys.SETTINGS, updated);
    return updated;
  },

  async reset() {
    await Storage.set(StorageKeys.SETTINGS, DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
};

// ============ HOTKEYS ============

const HotkeyStore = {
  async getAll() {
    return (await Storage.get(StorageKeys.HOTKEYS)) || {};
  },

  async set(slot, promptId) {
    const hotkeys = await this.getAll();
    hotkeys[slot] = promptId;
    await Storage.set(StorageKeys.HOTKEYS, hotkeys);
    return hotkeys;
  },

  async remove(slot) {
    const hotkeys = await this.getAll();
    delete hotkeys[slot];
    await Storage.set(StorageKeys.HOTKEYS, hotkeys);
    return hotkeys;
  },

  async getPromptForHotkey(slot) {
    const hotkeys = await this.getAll();
    const promptId = hotkeys[slot];
    if (!promptId) return null;
    return PromptStore.getById(promptId);
  }
};

// ============ STATS ============

const StatsStore = {
  async get() {
    const stats = await Storage.get(StorageKeys.STATS);
    return stats || {
      totalInsertions: 0,
      todayInsertions: 0,
      todayDate: new Date().toDateString(),
      weeklyData: {}
    };
  },

  async recordUsage(promptId, promptTitle) {
    const stats = await this.get();
    const today = new Date().toDateString();
    if (stats.todayDate !== today) {
      stats.todayInsertions = 0;
      stats.todayDate = today;
    }
    stats.totalInsertions++;
    stats.todayInsertions++;

    const dayKey = new Date().toISOString().split('T')[0];
    stats.weeklyData[dayKey] = (stats.weeklyData[dayKey] || 0) + 1;

    // Clean old data (30 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    for (const key of Object.keys(stats.weeklyData)) {
      if (new Date(key) < cutoff) delete stats.weeklyData[key];
    }

    await Storage.set(StorageKeys.STATS, stats);

    const history = (await Storage.get(StorageKeys.USAGE_HISTORY)) || [];
    history.unshift({ promptId, promptTitle, timestamp: now() });
    await Storage.set(StorageKeys.USAGE_HISTORY, history.slice(0, 100));
  },

  async getMostUsed(limit = 5) {
    const prompts = await PromptStore.getAll();
    return prompts
      .filter(p => p.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }
};

// ============ VARIABLES ============

const VariableUtils = {
  extract(text) {
    const regex = /\{(\w+)\}/g;
    const variables = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!variables.includes(match[1])) variables.push(match[1]);
    }
    return variables;
  },

  replace(text, values) {
    let result = text;
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  },

  hasVariables(text) {
    return /\{\w+\}/.test(text);
  }
};

// ============ EXPORT/IMPORT ============

const ExportImport = {
  async exportAll() {
    const data = await Storage.getAll([
      StorageKeys.PROMPTS, StorageKeys.FOLDERS,
      StorageKeys.SETTINGS, StorageKeys.HOTKEYS
    ]);
    return {
      version: '1.0.0',
      exportedAt: now(),
      app: 'PromptVault',
      data: {
        prompts: data[StorageKeys.PROMPTS] || [],
        folders: data[StorageKeys.FOLDERS] || [],
        settings: data[StorageKeys.SETTINGS] || {},
        hotkeys: data[StorageKeys.HOTKEYS] || {}
      }
    };
  },

  async importData(jsonData) {
    try {
      const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (parsed.app !== 'PromptVault') throw new Error('Invalid PromptVault export file');

      if (parsed.data.prompts) {
        const existing = await PromptStore.getAll();
        const existingIds = new Set(existing.map(p => p.id));
        const newPrompts = parsed.data.prompts.filter(p => !existingIds.has(p.id));
        await Storage.set(StorageKeys.PROMPTS, [...existing, ...newPrompts]);
      }

      if (parsed.data.folders) {
        const existing = await FolderStore.getAll();
        const existingIds = new Set(existing.map(f => f.id));
        const newFolders = parsed.data.folders.filter(f => !existingIds.has(f.id));
        await Storage.set(StorageKeys.FOLDERS, [...existing, ...newFolders]);
      }

      return { success: true, imported: { prompts: parsed.data.prompts?.length || 0, folders: parsed.data.folders?.length || 0 } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.PromptVault = {
    Storage, PromptStore, FolderStore, SettingsStore,
    HotkeyStore, StatsStore, VariableUtils, ExportImport, StorageKeys
  };
}
