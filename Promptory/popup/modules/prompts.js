// Promptory Popup - Prompts Module
// Virtual scrolling, prompt card rendering helpers

window.Promptory = window.Promptory || {};

(function(P) {
'use strict';

// ==================== VIRTUAL SCROLLING (200+ prompts) ====================
const VIRTUAL_SCROLL_THRESHOLD = 50;
const VIRTUAL_BATCH_SIZE = 20;

class VirtualFolderRenderer {
  constructor(container, prompts, renderFn) {
    this.container = container;
    this.allPrompts = prompts;
    this.renderFn = renderFn;
    this.rendered = 0;
    this.observer = null;
  }

  init() {
    if (this.allPrompts.length <= VIRTUAL_SCROLL_THRESHOLD) {
      this.container.innerHTML = this.allPrompts.map((p, i) => this.renderFn(p, i)).join('');
      return;
    }
    this.rendered = Math.min(VIRTUAL_BATCH_SIZE, this.allPrompts.length);
    let html = this.allPrompts.slice(0, this.rendered).map((p, i) => this.renderFn(p, i)).join('');
    if (this.rendered < this.allPrompts.length) {
      html += `<div class="virtual-scroll-sentinel" data-remaining="${this.allPrompts.length - this.rendered}">
        <div class="virtual-scroll-hint">${this.allPrompts.length - this.rendered} more prompts...</div>
      </div>`;
    }
    this.container.innerHTML = html;
    const sentinel = this.container.querySelector('.virtual-scroll-sentinel');
    if (sentinel) {
      this.observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) this.loadMore();
      }, { rootMargin: '100px' });
      this.observer.observe(sentinel);
    }
  }

  loadMore() {
    if (this.rendered >= this.allPrompts.length) return;
    const nextBatch = this.allPrompts.slice(this.rendered, this.rendered + VIRTUAL_BATCH_SIZE);
    const frag = document.createDocumentFragment();
    const temp = document.createElement('div');
    temp.innerHTML = nextBatch.map((p, i) => this.renderFn(p, this.rendered + i)).join('');
    while (temp.firstChild) frag.appendChild(temp.firstChild);
    this.rendered += nextBatch.length;
    const oldSentinel = this.container.querySelector('.virtual-scroll-sentinel');
    if (oldSentinel) {
      this.container.insertBefore(frag, oldSentinel);
      if (this.rendered >= this.allPrompts.length) {
        if (this.observer) this.observer.disconnect();
        oldSentinel.remove();
      } else {
        oldSentinel.dataset.remaining = String(this.allPrompts.length - this.rendered);
        oldSentinel.querySelector('.virtual-scroll-hint').textContent =
          `${this.allPrompts.length - this.rendered} more prompts...`;
      }
    }
  }

  destroy() {
    if (this.observer) this.observer.disconnect();
  }
}

P.VirtualFolderRenderer = VirtualFolderRenderer;

// ==================== CSV LINE PARSER ====================
// Handles quoted fields with commas/newlines
P.parseCSVLine = function(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
};

})(window.Promptory);
