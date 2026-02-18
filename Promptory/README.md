# Promptory

> AI Prompt Manager — Save, organize, and instantly insert prompts into ChatGPT, Claude, Gemini, Perplexity, and 11+ AI platforms.

![Version](https://img.shields.io/badge/version-1.9.0-blue)
![License](https://img.shields.io/badge/license-Proprietary-red)
![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-brightgreen)

## Features

- **Prompt Management**: Create, edit, delete and organize AI prompts with rich editor
- **Folder Organization**: Group prompts into customizable folders with emoji icons
- **Favorites**: Quick access to your most-used prompts
- **Smart Search**: Instant search by title, tags, description or content
- **Public Library**: Discover, like and save community prompts (flip-card UI)
- **Dark / Light / System Theme**: Automatic theme switching
- **Quick Insert**: Insert prompts directly into AI chat interfaces via button or hotkeys
- **Cloud Sync**: Bidirectional additive-merge sync via Supabase (premium)
- **Export / Import**: Backup and restore prompts as JSON or CSV
- **{Variables}**: Dynamic prompts with `{variable_name}` substitution dialog
- **Hotkeys**: Alt+1/2/3 quick-insert slots + Alt+S search overlay
- **Context Menu**: Right-click "Save selection as Prompt"
- **Offline Queue**: Operations queued when offline, replayed on reconnect (24h TTL)
- **Image Attachments**: Upload images to Supabase Storage (auto-compressed to 500KB)
- **Premium Subscription**: LemonSqueezy integration with webhook verification
- **Admin Moderation**: Report/approve/hide/delete community prompts
- **GDPR Compliance**: Right to access, export, and delete personal data
- **Usage Statistics**: Track prompt usage, platforms, activity charts
- **i18n**: Full English + Russian localization (277 keys each)

## Supported Platforms (11)

| Platform | Domain |
|----------|--------|
| ChatGPT | chat.openai.com, chatgpt.com |
| Claude | claude.ai |
| Google Gemini | gemini.google.com |
| Perplexity AI | perplexity.ai |
| Poe | poe.com |
| You.com | you.com |
| Google Bard | bard.google.com |
| Microsoft Copilot | copilot.microsoft.com |
| Bing | bing.com |
| Pi.ai | pi.ai |

## Installation

### From Source (Developer Mode)

1. Clone this repository:
```bash
git clone https://github.com/Leks2000/PromptVault.git
cd PromptVault/Promptory
```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top-right)

4. Click **Load unpacked** and select the `Promptory` folder

5. The extension icon should appear in your toolbar!

### From Chrome Web Store

Coming soon!

## Quick Start

1. **Click the extension icon** or press `Alt+S` to open search overlay

2. **Create your first prompt**:
   - Click "New" button
   - Enter a title and prompt text
   - Add tags and choose a folder (optional)
   - Use `{variables}` for dynamic content
   - Click "Create Prompt"

3. **Use your prompt**:
   - Go to any supported AI platform
   - Open Promptory popup
   - Click on a prompt to expand it
   - Click "Insert to page" or use Alt+1/2/3 hotkeys
   - If your prompt has variables, fill them in the dialog

## Architecture

```
Promptory/
├── manifest.json              # Chrome MV3 extension manifest
├── config.js                  # Shared configuration (Supabase URL, constants)
├── i18n.js                    # i18n helper (runtime language switching)
├── popup/
│   ├── popup.html             # Main popup UI
│   ├── popup.css              # Popup styles (~1590 lines)
│   ├── popup.js               # Main app logic (~3338 lines)
│   └── modules/
│       ├── utils.js           # Shared utilities (i18n, escapeHtml, saveData, etc.)
│       ├── state.js           # Application state, data loading, theme, free tier
│       └── offline.js         # Offline queue with retry, TTL, network status
├── background/
│   └── background.js          # Service Worker (auth, Supabase proxy, hotkeys, alarms)
├── content/
│   ├── content.js             # Content script (prompt insertion + search overlay)
│   └── content.css            # Content script styles
├── options/
│   ├── options.html           # Full-page settings
│   └── options.js             # Options page logic
├── onboarding/
│   └── welcome.html           # First-launch onboarding page
├── styles/
│   ├── variables.css          # CSS custom properties (design tokens)
│   ├── animations.css         # CSS animations (~1180 lines)
│   └── components.css         # Reusable component styles (~625 lines)
├── _locales/
│   ├── en/messages.json       # English translations (277 keys)
│   └── ru/messages.json       # Russian translations (277 keys)
├── assets/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── auth-callback.html         # OAuth redirect handler
├── privacy.html               # Privacy Policy
├── terms.html                 # Terms of Service
└── LICENSE                    # MIT License
```

## Technology Stack

- **Frontend**: Vanilla JavaScript (no build step, zero dependencies)
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions + RPC)
- **Payments**: LemonSqueezy (webhook via Supabase Edge Function)
- **Extension**: Chrome Manifest V3 (Service Worker)
- **i18n**: 277 keys, English + Russian

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+S` | Open prompt search overlay on any AI page |
| `Alt+1` | Quick insert prompt from Slot 1 |
| `Alt+2` | Quick insert prompt from Slot 2 |
| `Alt+3` | Quick insert prompt from Slot 3 |

To customize shortcuts, go to `chrome://extensions/shortcuts`

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Save prompts and settings locally |
| `activeTab` | Insert prompts into the current tab |
| `scripting` | Inject content script for prompt insertion |
| `identity` | Google OAuth authorization |
| `contextMenus` | "Save selection as Prompt" context menu |
| `notifications` | Notify when prompts are saved |
| `clipboardWrite` | Copy prompts to clipboard |
| `tabs` | Detect which AI platform is active |
| `alarms` | Periodic token refresh (every 10 min) |

## Development

### Prerequisites

- Chrome browser (Stable channel)
- No build tools required (vanilla JS)

### Local Development

1. Make changes to the code
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Promptory card
4. Test your changes

### Build for Chrome Web Store

```bash
cd Promptory
bash build.sh
# Output: ../promptory-v1.9.0.zip
```

## Contributing

This is a proprietary closed-source project. Contributions are not accepted from external contributors. If you find a bug or have a feature request, please submit an issue on GitHub.

## License

This project is licensed under the Proprietary License - see the [LICENSE](LICENSE) file for details.

**This is NOT open-source software. All rights reserved.**

## Support

- [Report a bug](https://github.com/Leks2000/PromptVault/issues)
- [Request a feature](https://github.com/Leks2000/PromptVault/issues)
- [Telegram](https://t.me/user_Alexander)

---

Made with care for AI power users
