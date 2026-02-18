# Promptory Onboarding Tutorial v12

**Version:** 12.0  
**Date:** 18 February 2026

---

## GAME-STYLE SPOTLIGHT TUTORIAL (16 steps)

### Visual Approach
- **4-panel dark overlay** (0.72 opacity) around target — NO clip-path (avoids z-index stacking issues)
- **Pulsing border ring** around highlighted element
- **No blur** — zero performance impact
- **Smooth CSS transitions** on all movements (0.4s cubic-bezier)
- Target element is clickable through the hole (z-index 10000, above panels at 9998)
- Modal ancestors automatically raised with `.tut-ancestor-raised` class

### Step Flow

| Step | Action | Target | Description |
|------|--------|--------|-------------|
| **1** | Click "+ New" | New button | Create first prompt |
| **2** | Click "Create" | Save button | Auto-fills & saves prompt |
| **3** | Click star | Favorite button | Add prompt to Favorites |
| **4** | Click "Folders" | Folders tab | Switch to Folders tab |
| **5** | Click "New Folder" | New Folder button | Open folder creation |
| **6** | Click "Create" | Save button | Auto-fills folder name & saves |
| **7** | Click edit | Edit button | Open prompt editor |
| **8** | Click "Save" | Save button | Auto-selects folder & saves |
| **9** | Click Settings | Settings gear | Open Settings panel |
| **10** | Observe | Hotkey section | Auto-scrolls to Quick Insert, explains hotkeys |
| **11** | Select dropdown | Slot 1 dropdown | Pick prompt for hotkey slot (any slot works) |
| **12** | Click Save | Save button | Save settings |
| **13** | Info | Center modal | Shows assigned hotkey visually (dynamic!) |
| **14** | Observe | Search bar | Mentions search + Alt+S overlay hotkey |
| **15** | Observe | Explore tab | Library teaser — sign in required |
| **16** | Final | Center modal | Structured summary with all features + Alt+1 tip |

---

## KEY FEATURES

### Dynamic Hotkey Detection
If user assigns prompt to Alt+3 instead of Alt+1, the tutorial automatically:
1. Detects the chosen slot via `chrome.commands.getAll()`
2. Updates the hotkey visual in step 13
3. Shows correct key combo in final summary

### Smart Auto-Interactions
- **Auto-fill** prompt title/text with sample data (step 2)
- **Auto-fill** folder name (step 6)
- **Auto-select** folder in prompt editor dropdown (step 8)
- **Auto-scroll** settings modal to Quick Insert section (step 10)
- **Auto-focus** dropdown with flash animation (step 11)
- User can pick ANY slot (not just Slot 1)

### New Steps (v12)
- **Favorites** — teaches user to star prompts
- **Folders** — creates a folder and moves prompt into it
- **Search** — mentions the search bar + Alt+S overlay
- **Final step** — redesigned as structured list, not plain text

### Library Teaser (No Full Tour)
- Step 15 just mentions the Library tab
- Says "sign in to browse, save and share"
- Does NOT open the Library tab (per spec)

---

## FILES

- `popup/onboarding-tutorial.js` — Tutorial logic (class OnboardingTutorial)
- `popup/onboarding-tutorial.css` — All styles

### CSS Architecture
- `.tut-overlay-panel` (x4) — Dark panels around the spotlight hole
- `.tut-overlay-full` — Full overlay for center-modal steps
- `.tut-spotlight` — Pulsing border ring
- `.tut-tooltip` — Instruction card (z-index 10002)
- `.tut-target-active` — Target element raised above overlay (z-index 10000)
- `.tut-ancestor-raised` — Raises positioned ancestors (z-index 9999)
- `.tut-key` — Keyboard key visual (for hotkey display)
- `.tut-final-*` — Final step structured list layout
- `.tut-inline-key` — Inline keyboard shortcut badge

### Z-Index Hierarchy
```
9998  — 4 overlay panels + full overlay
9999  — spotlight ring + ancestor containers
10000 — target element (.tut-target-active)
10001 — modal overlays raised during tutorial
10002 — tooltip card
```

---

## TESTING

### Reset tutorial:
```javascript
chrome.storage.local.remove(['onboardingTutorialComplete', 'hasLaunched'], () => {
  console.log('Tutorial reset. Close and reopen popup.');
});
```

### Expected behavior:
1. Dark overlay covers entire popup (4-panel approach)
2. Target element visible through the hole between panels
3. Pulsing border ring around target
4. Tooltip card appears near target with smart positioning
5. Click/change on target advances to next step
6. Favorites, Folders, Edit steps work with proper modal raising
7. Settings modal auto-scrolls to Quick Insert
8. Dropdown selection detects chosen slot
9. Search step highlights search bar + mentions Alt+S
10. Final step shows structured list with all features
11. Skip available on every step (except final)

---

## STATUS: DONE
