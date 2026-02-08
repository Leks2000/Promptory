# PromptVault

> AI Prompt Manager — Save, organize, and instantly insert prompts into ChatGPT, Claude, Gemini, and more.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **📝 Prompt Management**: Create, edit, and organize your AI prompts
- **📁 Folder Organization**: Group prompts into customizable folders
- **⭐ Favorites**: Quick access to your most-used prompts
- **🔍 Smart Search**: Instant search by title, tags, or content
- **🌐 Public Library**: Discover and save prompts from the community
- **🎨 Beautiful UI**: Clean, minimal design inspired by Notion
- **🌙 Dark Mode**: Automatic theme switching (Light/Dark/System)
- **⚡ Quick Insert**: Insert prompts directly into AI chat interfaces
- **🔄 Sync**: Cloud sync for premium users (Supabase)
- **💾 Export/Import**: Backup and restore your prompts as JSON
- **{Variables}**: Dynamic prompts with variable substitution

## 🚀 Supported Platforms

- ChatGPT (chat.openai.com, chatgpt.com)
- Claude (claude.ai)
- Google Gemini (gemini.google.com)
- Perplexity AI (perplexity.ai)
- Poe (poe.com)

## 📦 Installation

### From Source

1. Clone this repository:
```bash
git clone https://github.com/yourusername/promptvault.git
cd promptvault
```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in top-right)

4. Click "Load unpacked" and select the `promptvault` folder

5. The extension icon should appear in your toolbar!

### From Chrome Web Store

Coming soon!

## 🎯 Quick Start

1. **Click the extension icon** or press `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`)

2. **Create your first prompt**:
   - Click "New" button
   - Enter a title and prompt text
   - Add tags and choose a folder (optional)
   - Use `{variables}` for dynamic content
   - Click "Create Prompt"

3. **Use your prompt**:
   - Go to ChatGPT, Claude, or any supported AI platform
   - Open PromptVault
   - Click on a prompt to open it
   - Click the context menu (⋮) and select "Insert to page"
   - If your prompt has variables, fill them in and click "Insert"

## 🎨 Features in Detail

### Prompt Editor

- **Title**: Short name for your prompt
- **Text**: The actual prompt content (supports multi-line)
- **Description**: Optional notes about the prompt
- **Folder**: Organize into folders
- **Tags**: Add hashtags for better organization
- **Platform**: Optimize for specific AI (Universal/ChatGPT/Claude/Gemini)
- **Variables**: Use `{variable_name}` syntax for dynamic values

Example:
```
Write a {tone} email to {recipient} about {topic}.
```

### Folders

- Create unlimited folders
- Customize with emoji icons
- Nest folders (hierarchy support)
- Drag-and-drop organization
- Collapse/expand sections

### Explore Tab

- Browse public prompts from the community
- Flip cards to read full prompt text
- Like and save prompts to your library
- Filter by tags and categories

### Settings

- **Theme**: Light, Dark, or System
- **Account**: Sign in with Google (Supabase)
- **Export/Import**: Backup your data
- **Keyboard Shortcuts**: Customize hotkeys

## ⌨️ Keyboard Shortcuts

- `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`): Open PromptVault

To customize shortcuts, go to `chrome://extensions/shortcuts`

## 🔧 Configuration

### Supabase Setup (Optional)

For cloud sync and public library features:

1. Create a Supabase project at [supabase.com](https://supabase.com)

2. Get your project URL and anon key

3. Download Supabase JS client:
```bash
curl -o lib/supabase.min.js https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
```

4. Update `popup/components/auth.js` with your credentials:
```javascript
const SUPABASE_URL = 'your-project-url';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### Database Schema

```sql
-- Prompts table
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  description TEXT,
  folder_id UUID,
  tags TEXT[],
  platform TEXT DEFAULT 'universal',
  is_favorite BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Folders table
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📁',
  parent_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🏗️ Architecture

```
promptvault/
├── manifest.json           # Extension configuration
├── popup/
│   ├── popup.html         # Main UI
│   ├── popup.css          # Popup styles
│   ├── popup.js           # Main app logic
│   └── components/        # UI components
│       ├── tabs.js
│       ├── prompts.js
│       ├── folders.js
│       ├── favorites.js
│       ├── explore.js
│       ├── settings.js
│       ├── prompt-editor.js
│       ├── search.js
│       └── auth.js
├── content/
│   ├── content.js         # Inject prompts into pages
│   └── content.css        # Content script styles
├── background/
│   └── background.js      # Service worker
├── options/
│   ├── options.html       # Settings page
│   └── options.js
├── lib/
│   └── supabase.min.js    # Supabase client
├── assets/
│   └── icon-*.png         # Extension icons
└── styles/
    ├── variables.css      # Design tokens
    ├── animations.css     # Animations
    └── components.css     # Reusable styles
```

## 🎨 Design System

- **Colors**: Notion-inspired neutral palette
- **Typography**: System font stack
- **Spacing**: 4px base unit
- **Radius**: 4px/8px/12px
- **Shadows**: Subtle, layered
- **Animations**: Smooth, purposeful (200-300ms)

## 📝 Development

### Prerequisites

- Node.js (optional, for build tools)
- Chrome browser
- Basic knowledge of HTML/CSS/JavaScript

### Local Development

1. Make changes to the code
2. Go to `chrome://extensions/`
3. Click the refresh icon on the PromptVault card
4. Test your changes

### Build for Production

```bash
# Create a zip file for Chrome Web Store
zip -r promptvault-v1.0.0.zip promptvault/
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by Notion's clean design
- Icons from Lucide Icons
- Built with vanilla JavaScript (no frameworks!)

## 📬 Support

- 🐛 [Report a bug](https://github.com/yourusername/promptvault/issues)
- 💡 [Request a feature](https://github.com/yourusername/promptvault/issues)
- 📧 [Contact us](mailto:support@promptvault.com)

---

Made with ❤️ for AI power users
