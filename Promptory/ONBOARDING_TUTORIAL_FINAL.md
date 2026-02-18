# Promptory Onboarding Tutorial v9

**Version:** 9.0  
**Date:** 18 February 2026

---

## COMPLETE 11-STEP TUTORIAL (covering all 6 key features)

| Step | Feature | Action | Description |
|------|---------|--------|-------------|
| **1** | Setup | Click "+ New" | Create your first prompt |
| **2** | Setup | Click "Create Prompt" | Auto-fills title + text with {variables} demo |
| **3** | **INSERT** | Click arrow button | **MAIN FEATURE** - insert prompt into AI chat |
| **4** | **COPY** | Click prompt card | Copy prompt text to clipboard |
| **5** | **FAVORITES** | Click star | Add prompt to favorites |
| **6** | **FAVORITES** | Click Favorites tab | View all starred prompts |
| **7** | **SEARCH** | Focus search input | Search prompts by title/tags/content |
| **8** | **EDIT** | Click pencil icon | Edit prompt (title, text, tags, folder) |
| **9** | **EXPLORE** | Click Explore tab | Browse community prompt library |
| **10** | Settings | Click Settings gear | Configure hotkeys, theme, cloud sync |
| **11** | Final | Click "Get Started!" | Summary of all 6 features + pro tip |

---

## 6 KEY FEATURES COVERED

1. **Insert (MAIN)** - Step 3 - Paste prompts directly into AI chats
2. **Copy** - Step 4 - Click card to copy to clipboard
3. **Favorites** - Steps 5-6 - Star prompts for quick access
4. **Search** - Step 7 - Find prompts instantly
5. **Edit** - Step 8 - Modify any prompt
6. **Explore** - Step 9 - Discover community prompts

---

## VISUAL FEATURES

### Overlay (Dark background with cutout)
- `rgba(0, 0, 0, 0.75)` overlay
- `clip-path` polygon creates "hole" around target
- Smooth transitions between steps

### Spotlight (Animated border)
- 3px solid accent border
- Pulsating glow animation (2s infinite)
- Transitions smoothly between targets

### Tutorial Card
- Step counter badge (e.g., "3/11")
- Feature-specific icon
- Feature badge ("MAIN FEATURE", "COPY", etc.)
- Skip button on every step (except final)
- Progress bar showing completion

### New in v9
- **Skip button** on every step
- **Feature badges** for the 6 key features
- **Icons** per step type
- **Progress bar** at bottom
- **Variables demo** in auto-fill (`{role}`, `{task}`)
- **Improved positioning** with better boundary checks
- **Cleanup** between steps (no stale handlers)

---

## TECHNICAL IMPLEMENTATION

### Files
- `popup/onboarding-tutorial.js` - Logic (class OnboardingTutorial)
- `popup/onboarding-tutorial.css` - Styles

### Class: `window.OnboardingTutorial`

**Key Methods:**
- `start(onComplete)` - Start the tutorial tour
- `showStep(index)` - Show a specific step
- `highlightTarget(element)` - Highlight target with spotlight
- `positionTutorialNear(element, position)` - Smart positioning
- `updateOverlayHole(rect, padding)` - Create overlay cutout
- `setupInteraction(step, target)` - Setup click/focus handlers
- `cleanupStep()` - Remove handlers/highlights from previous step
- `waitForElementAsync(selector, timeout)` - Wait for DOM element
- `close()` - Close tutorial and save completion state

### Storage
```javascript
chrome.storage.local.set({ onboardingTutorialComplete: true });
```

---

## TESTING

### Reset storage to re-run tutorial:
```javascript
chrome.storage.local.remove(['onboardingTutorialComplete', 'hasLaunched'], () => {
  console.log('Tutorial reset. Close and reopen popup.');
});
```

### Expected behavior:
- Overlay darkens everything except target
- Spotlight pulses around target element
- Tutorial card appears near target with smart positioning
- Click/focus on target advances to next step
- Skip button closes tutorial at any point
- Progress bar shows completion percentage
- Final step summarizes all 6 features

---

## STATUS

| Component | Status |
|-----------|--------|
| Logic (JS) | DONE |
| Styles (CSS) | DONE |
| Integration | DONE |
| 6 Features Covered | DONE |
| Skip Button | DONE |
| Progress Bar | DONE |
| i18n (EN/RU) | DONE |
