// Promptory Popup - Explore/Library Module
// Library browsing, sharing, likes, reports

window.Promptory = window.Promptory || {};

(function(P) {
'use strict';

// Image cache with LRU eviction (max 100 entries to prevent memory leaks)
const IMAGE_CACHE_MAX = 100;
const _imageCache = new Map();

P.imageCache = {
  get(key) {
    const entry = _imageCache.get(key);
    if (!entry) return undefined;
    // LRU: move to end
    _imageCache.delete(key);
    _imageCache.set(key, entry);
    return entry;
  },
  set(key, value) {
    // Evict oldest if at capacity
    if (_imageCache.size >= IMAGE_CACHE_MAX) {
      const oldest = _imageCache.keys().next().value;
      _imageCache.delete(oldest);
    }
    _imageCache.set(key, value);
  },
  has(key) {
    return _imageCache.has(key);
  },
  delete(key) {
    _imageCache.delete(key);
  },
  get size() {
    return _imageCache.size;
  }
};

// Category colors for visual distinction
P.CATEGORY_COLORS = {
  'business': { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  'development': { bg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  'marketing': { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  'creative': { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  'learning': { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  'ai': { bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  'general': { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
};

// ==================== WORD-BOUNDARY TRUNCATION ====================
// Truncate text at word boundaries, respecting multi-byte characters
P.truncateSmart = function(text, max = 50) {
  if (!text || text.length <= max) return text || '';
  // Find last word boundary before max
  const sub = text.substring(0, max);
  const lastSpace = sub.lastIndexOf(' ');
  const lastPunct = Math.max(
    sub.lastIndexOf('.'),
    sub.lastIndexOf(','),
    sub.lastIndexOf(';'),
    sub.lastIndexOf('-'),
    sub.lastIndexOf('\u3000'), // CJK space
    sub.lastIndexOf('\u3001'), // CJK comma
    sub.lastIndexOf('\u3002')  // CJK period
  );
  const breakAt = Math.max(lastSpace, lastPunct);
  // If no word boundary found in first half, just cut at max
  if (breakAt <= max * 0.3) return sub + '...';
  return text.substring(0, breakAt) + '...';
};

})(window.Promptory);
