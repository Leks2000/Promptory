# Promptory Onboarding Tutorial v12

**Version:** 12.0  
**Date:** 19 February 2026

---

## GAME-STYLE SPOTLIGHT TUTORIAL (9 steps)

### Visual Approach
- **4-panel overlay** (top/right/bottom/left) surrounds the target — NO clip-path
- **Modal-aware z-index layering** — correctly highlights elements inside modals
- **Pulsing border ring** around highlighted element
- **No blur** — zero performance impact
- **Smooth CSS transitions** on all movements (0.4s cubic-bezier)
- Target element is always clickable — whether in the main page or inside a modal
- **Forced action button visibility** — hover-only buttons (star, edit, etc.) are force-shown during tutorial

### Z-Index Stack (v12)

| Z-Index | Element | Purpose |
|---------|---------|---------|
| **9998** | `.tut-overlay-panel` | Base dark overlay panels (4 panels around target) |
| **9999** | `.tut-ancestor-raised` | Raised parent containers (non-modal) |
| **10000** | `.tut-target-active` | Highlighted target element |
| **10001** | `.tut-modal-raised` | Modal overlay raised above base panels |
| **10002** | `.tut-modal-raised .modal` | Modal box inside raised overlay |
| **10003** | `.tut-inside-modal` panels | Overlay panels re-layered above raised modal |
| **10004** | `.tut-spotlight` | Pulsing border ring |
| **10005** | `.tut-tooltip` | Instruction card tooltip |

### Step Flow

| Step | Action | Target | Description |
|------|--------|--------|-------------|
| **1** | Click "+ New" | New button | Create first prompt |
| **2** | Click "Create" | Save button (inside modal) | Auto-fills & saves prompt |
| **3** | Click Settings | Settings gear | Open Settings panel |
| **4** | Observe | Hotkey section (inside modal) | Auto-scrolls to Quick Insert, explains hotkeys |
| **5** | Select dropdown | Slot 1 dropdown (inside modal) | Pick prompt for hotkey slot (any slot works) |
| **6** | Click Save | Save button (inside modal) | Save settings |
| **7** | Info | Center overlay | Shows assigned hotkey visually (dynamic!) |
| **8** | Observe | Explore tab | Library teaser — sign in required |
| **9** | Final | Center overlay | Summary + Ctrl+Shift+P tip |

---

## KEY FEATURES

### Modal-Aware Z-Index Layering (v12 fix)
When the target element is **inside a modal** (e.g., prompt editor, settings modal):
1. The modal-overlay gets class `tut-modal-raised` (z-index: 10001)
2. The overlay panels get class `tut-inside-modal` (z-index: 10003)
3. This creates the correct stacking: modal is visible, dark panels surround the target INSIDE the modal, spotlight and tooltip float above everything

Previously (v11), the 4 overlay panels at z-index 9998 would render above the modal (z-index 1000), covering it entirely and hiding the target. The "hole" in the overlay was invisible because the modal content was behind the panels.

### Forced Hover Actions (v12 fix)
Prompt cards and folder cards have action buttons (star, edit, export, etc.) that only appear on `:hover`. During the tutorial, when targeting these elements:
- Class `tut-actions-visible` is added to the card
- CSS rule forces `.prompt-actions` and `.folder-card-actions` to `opacity: 1`
- User can see and interact with all action buttons without needing to hover first

### Dynamic Hotkey Detection
If user assigns prompt to Alt+3 instead of Alt+1, the tutorial automatically:
1. Detects the chosen slot via `chrome.commands.getAll()`
2. Updates the hotkey visual in step 7
3. Shows correct key combo in final summary

### Smart Auto-Interactions
- **Auto-fill** prompt title/text with sample data
- **Auto-scroll** settings modal to Quick Insert section
- **Auto-focus** dropdown with flash animation
- User can pick ANY slot (not just Slot 1)

### Library Teaser (No Full Tour)
- Step 8 just mentions the Library tab
- Says "sign in to browse, save and share"
- Does NOT open the Library tab (per spec)

---

## FILES

- `popup/onboarding-tutorial.js` — Tutorial logic (class OnboardingTutorial v12)
- `popup/onboarding-tutorial.css` — All styles with z-index stack documentation

### CSS Architecture
- `.tut-overlay-panel` — 4 dark overlay panels (NOT clip-path)
- `.tut-inside-modal` — Panels promoted to z-index 10003 for modal targets
- `.tut-modal-raised` — Raises modal-overlay above base panels
- `.tut-spotlight` — Pulsing border ring (z-index 10004)
- `.tut-tooltip` — Instruction card (z-index 10005)
- `.tut-target-active` — Target element interactive above overlay
- `.tut-actions-visible` — Forces hover-only action buttons to show
- `.tut-key` — Keyboard key visual (for hotkey display)

---

## TESTING

### Reset tutorial:
```javascript
chrome.storage.local.remove(['onboardingTutorialComplete', 'hasLaunched'], () => {
  console.log('Tutorial reset. Close and reopen popup.');
});
```

### Expected behavior:
1. Dark overlay (4 panels) covers entire popup except target
2. **When target is inside a modal**: modal is visible, spotlight/overlay correctly layered
3. Pulsing border ring around target
4. Tooltip card appears near target with smart positioning (never overlapping)
5. Click/change on target advances to next step
6. Settings modal auto-scrolls to Quick Insert
7. **Action buttons (star, edit) are visible** without hover during tutorial
8. Dropdown selection detects chosen slot
9. Final step shows actual hotkey combo
10. Skip available on every step

### Known areas for future improvement:
- Tutorial could benefit from adding intermediate steps for favorites and folder management
- The 16-step version (deployed previously) has been replaced by 9-step v12
- Consider adding folder editing tutorial steps back with proper modal-aware layering

---

## CHANGELOG

### v12 (19 Feb 2026)
- **FIXED**: Modal z-index layering — targets inside modals now properly visible
- **FIXED**: Forced hover action buttons visible during tutorial
- **ADDED**: `tut-modal-raised` class for modal-aware targeting
- **ADDED**: `tut-inside-modal` class for panel promotion above modals
- **ADDED**: `tut-actions-visible` class for forced hover-button display
- **UPDATED**: Z-index stack: 9998/9999/10000/10001/10002/10003/10004/10005

### v11 (18 Feb 2026)
- Rewrite to 4-panel overlay approach (from clip-path)
- Eliminated clip-path stacking context issues

### v10 (18 Feb 2026)
- Initial game-style spotlight tutorial with clip-path

---

## STATUS: DONE
