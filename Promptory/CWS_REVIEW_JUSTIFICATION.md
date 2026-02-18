# Chrome Web Store (CWS) Review - Permissions Justification

## Extension Overview
**Name:** Promptory  
**Version:** 1.9.0  
**Description:** AI Prompt Manager — Save, organize, and instantly insert prompts into ChatGPT, Claude, Gemini, Perplexity, and 11+ AI platforms.

---

## Permissions Justification

### 1. `storage`
**Purpose:** Save prompts, folders, and user settings locally in the browser.

**Why it's needed:**
- Stores user's prompt library (titles, text, tags, variables, favorites)
- Stores folder organization structure
- Stores user preferences (theme, hotkeys, language)
- Stores authentication tokens (encrypted) for cloud sync
- Stores offline queue for sync operations

**Data stored:**
```javascript
{
  prompts: [...],      // User's saved prompts
  folders: [...],      // Folder structure
  settings: {...},     // User preferences
  user: {...},         // Auth state
  session: {...}       // Session tokens
}
```

**CWS Policy Compliance:** This permission is used solely for extension functionality. No data is transmitted to third parties without user consent.

---

### 2. `activeTab`
**Purpose:** Insert prompts into the currently active AI chat page.

**Why it's needed:**
- Allows the extension to interact with the active tab when user clicks "Insert to page"
- Temporarily grants access only to the tab the user is currently viewing
- More privacy-respecting than `tabs` permission alone

**When it's used:**
- User clicks "Insert to page" button on a prompt card
- User triggers hotkey (Alt+1/2/3) for quick insert
- User uses context menu "Save selection as Prompt"

**CWS Policy Compliance:** This permission is triggered only by explicit user action. The extension does not access tabs without user interaction.

---

### 3. `scripting`
**Purpose:** Inject content script into AI platform pages for prompt insertion.

**Why it's needed:**
- Injects `content/content.js` into supported AI platforms (ChatGPT, Claude, etc.)
- Inserts CSS styles for search overlay and UI elements
- Executes prompt insertion logic in the page context
- Required for Manifest V3 (replaces `chrome.tabs.executeScript`)

**When it's used:**
- User opens extension popup on an AI platform page
- User triggers search overlay (Alt+S)
- User clicks "Insert to page" button

**CWS Policy Compliance:** Content scripts are injected only into domains explicitly listed in `host_permissions`. No code is injected into unrelated websites.

---

### 4. `identity`
**Purpose:** Enable Google OAuth sign-in for cloud sync feature.

**Why it's needed:**
- Authenticates users via Google OAuth 2.0
- Receives authentication tokens from Google
- Enables cloud sync across devices (premium feature)
- Manages session tokens securely

**OAuth Flow:**
1. User clicks "Sign in with Google"
2. Extension opens Google OAuth consent screen
3. User grants permission
4. Google redirects to Supabase callback with auth code
5. Extension receives session token

**CWS Policy Compliance:** OAuth is used only for authentication. User credentials are never stored or transmitted insecurely.

---

### 5. `contextMenus`
**Purpose:** Add "Save selection as Prompt" to browser context menu.

**Why it's needed:**
- Allows users to quickly save selected text as a new prompt
- Provides convenient workflow for capturing AI prompts
- Enhances user experience with right-click shortcut

**Menu item:**
```javascript
{
  id: 'save-as-prompt',
  title: 'Save selection as Prompt',
  contexts: ['selection']
}
```

**When it's used:**
- User selects text on any webpage
- User right-clicks and sees "Save selection as Prompt"
- Extension saves the selected text as a new prompt

**CWS Policy Compliance:** Context menu is only shown when text is selected. No data is collected without user action.

---

### 6. `notifications`
**Purpose:** Notify users when prompts are saved or actions are completed.

**Why it's needed:**
- Confirms successful prompt save from context menu
- Provides feedback for background operations
- Alerts user to important events (sync complete, errors)

**Notification types:**
- "Prompt saved successfully!" (after context menu save)
- "Sync complete" (after cloud synchronization)
- "Error: [message]" (when operations fail)

**CWS Policy Compliance:** Notifications are user-triggered and relevant. No spam or promotional notifications.

---

### 7. `clipboardWrite`
**Purpose:** Copy prompts to clipboard when user requests.

**Why it's needed:**
- Allows users to copy prompt text to clipboard
- Enables pasting into AI platforms manually if needed
- Supports "Copy to clipboard" button on prompt cards

**When it's used:**
- User clicks "Copy" button on a prompt card
- User uses keyboard shortcut for copy
- Extension uses `document.execCommand('copy')` or Clipboard API

**CWS Policy Compliance:** Clipboard access is only triggered by explicit user action. No automatic clipboard monitoring.

---

### 8. `tabs`
**Purpose:** Detect which AI platform the user is visiting and enable platform-specific features.

**Why it's needed:**
- Identifies the current AI platform (ChatGPT, Claude, Gemini, etc.)
- Enables platform-specific prompt insertion logic
- Shows/hides extension icon based on current tab URL
- Supports tab-based hotkey commands

**How it's used:**
```javascript
chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
  const tab = tabs[0];
  // Check if tab URL matches supported AI platforms
  // Enable/disable features accordingly
});
```

**CWS Policy Compliance:** Tab access is limited to URL checking for feature enablement. No browsing history is stored or transmitted.

---

### 9. `alarms`
**Purpose:** Schedule periodic background tasks (token refresh, sync checks).

**Why it's needed:**
- Refreshes authentication tokens every 10 minutes
- Checks for pending sync operations
- Manages offline queue replay
- Cleans up expired data (24h TTL)

**Alarm schedule:**
```javascript
chrome.alarms.create('tokenRefresh', {periodInMinutes: 10});
chrome.alarms.create('syncCheck', {periodInMinutes: 5});
```

**CWS Policy Compliance:** Alarms are used for essential maintenance. No background activity without purpose.

---

## Host Permissions Justification

### Supported AI Platforms
The extension requires access to these domains to insert prompts:

| Domain | Platform | Purpose |
|--------|----------|---------|
| `*://chat.openai.com/*` | ChatGPT | Prompt insertion |
| `*://chatgpt.com/*` | ChatGPT (new domain) | Prompt insertion |
| `*://claude.ai/*` | Claude | Prompt insertion |
| `*://gemini.google.com/*` | Google Gemini | Prompt insertion |
| `*://perplexity.ai/*` | Perplexity AI | Prompt insertion |
| `*://poe.com/*` | Poe | Prompt insertion |
| `*://you.com/*` | You.com | Prompt insertion |
| `*://bard.google.com/*` | Google Bard | Prompt insertion |
| `*://copilot.microsoft.com/*` | Microsoft Copilot | Prompt insertion |
| `*://bing.com/*` | Bing Chat | Prompt insertion |
| `*://pi.ai/*` | Pi AI | Prompt insertion |

### Backend Services
| Domain | Service | Purpose |
|--------|---------|---------|
| `https://vofgfvlgchqheksvlibl.supabase.co/*` | Supabase | Cloud sync, authentication, public library |

**CWS Policy Compliance:** Host permissions are limited to domains necessary for extension functionality. No data is collected from these domains beyond what's needed for prompt insertion.

---

## Single Purpose Declaration

**This extension has a single, clearly defined purpose:**

> Help users save, organize, and insert AI prompts into supported AI platforms.

All permissions and host permissions are directly related to this core functionality:
- `storage` → Save prompts locally
- `activeTab` + `scripting` → Insert prompts into AI chat pages
- `identity` → Enable cloud sync (optional feature)
- `contextMenus` → Quick-save selected text as prompts
- `notifications` → Confirm user actions
- `clipboardWrite` → Copy prompts for manual insertion
- `tabs` → Detect AI platforms
- `alarms` → Maintain authentication and sync

**No affiliate links, no ads, no crypto mining, no hidden functionality.**

---

## Data Collection & Privacy

### What We Collect
- **User prompts:** Stored locally, optionally synced to Supabase
- **Google email:** For authentication (via OAuth)
- **Usage stats:** Stored locally, shown only to user

### What We DON'T Collect
- Browsing history (beyond AI platform detection)
- Page content (beyond prompt insertion)
- Keystrokes or form inputs
- Passwords or financial information
- Device identifiers or fingerprints

### Third-Party Services
- **Supabase:** Cloud storage and authentication
- **LemonSqueezy:** Payment processing (premium subscriptions)
- **Google OAuth:** Authentication

**Full Privacy Policy:** Available at `privacy.html` in the extension.

---

## Chrome Web Store Compliance Checklist

- [x] **Single purpose:** Yes (prompt management)
- [x] **No hidden functionality:** All features are visible in UI
- [x] **No affiliate injection:** No affiliate links in extension
- [x] **No ad injection:** No ads displayed
- [x] **No crypto mining:** No mining code
- [x] **No data selling:** User data is not sold or shared
- [x] **Privacy Policy:** Included (`privacy.html`)
- [x] **Terms of Service:** Included (`terms.html`)
- [x] **Age restriction:** 13+ with verification
- [x] **Permissions justified:** Documented above

---

## Contact Information

**Developer:** Promptory  
**Email:** Available via Telegram @user_Alexander  
**Privacy Policy:** https://promptory.app/privacy.html  
**Terms of Service:** https://promptory.app/terms.html  

---

*Last updated: February 18, 2026*  
*Version: 1.9.0*
