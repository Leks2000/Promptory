# Promptory Onboarding Tutorial v10

**Version:** 10.0  
**Date:** 18 February 2026

---

## GAME-STYLE SPOTLIGHT TUTORIAL (9 steps)

### Visual Approach
- **Dark overlay** (0.75 opacity) covers everything
- **clip-path cutout** creates transparent hole around target
- **Pulsing border ring** around highlighted element
- **No blur** — zero performance impact
- **Smooth CSS transitions** on all movements (0.45s cubic-bezier)
- Target element is clickable through the overlay (z-index above)

### Step Flow

| Step | Action | Target | Description |
|------|--------|--------|-------------|
| **1** | Click "+ New" | New button | Create first prompt |
| **2** | Click "Create" | Save button | Auto-fills & saves prompt |
| **3** | Click Settings | Settings gear | Open Settings panel |
| **4** | Observe | Hotkey section | Auto-scrolls to Quick Insert, explains hotkeys |
| **5** | Select dropdown | Slot 1 dropdown | Pick prompt for hotkey slot (any slot works) |
| **6** | Click Save | Save button | Save settings |
| **7** | Info | Center modal | Shows assigned hotkey visually (dynamic!) |
| **8** | Observe | Explore tab | Library teaser — sign in required |
| **9** | Final | Center modal | Summary + Ctrl+Shift+P tip |

---

## KEY FEATURES

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

- `popup/onboarding-tutorial.js` — Tutorial logic (class OnboardingTutorial)
- `popup/onboarding-tutorial.css` — All styles

### CSS Architecture
- `.tut-overlay` — Dark dimming layer with clip-path hole
- `.tut-spotlight` — Pulsing border ring
- `.tut-tooltip` — Instruction card
- `.tut-target-active` — Makes target element clickable above overlay
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
1. Dark overlay covers entire popup (0.75 opacity)
2. Target element visible through clip-path hole
3. Pulsing border ring around target
4. Tooltip card appears near target with smart positioning
5. Click/change on target advances to next step
6. Settings modal auto-scrolls to Quick Insert
7. Dropdown selection detects chosen slot
8. Final step shows actual hotkey combo
9. Skip available on every step

---

## STATUS: DONE
