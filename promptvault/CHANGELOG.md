# Changelog

All notable changes to PromptVault will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-02-08

### Added
- ✨ Initial release of PromptVault
- 📝 Complete prompt management system (create, edit, delete)
- 📁 Folder organization with custom icons
- ⭐ Favorites system for quick access
- 🔍 Instant search by title, tags, and content
- 🎨 Beautiful Notion-inspired UI design
- 🌙 Dark mode support (Light/Dark/System)
- {Variables} Dynamic variable substitution in prompts
- 💉 Direct prompt insertion into AI platforms:
  - ChatGPT (chat.openai.com, chatgpt.com)
  - Claude (claude.ai)
  - Google Gemini (gemini.google.com)
  - Perplexity AI (perplexity.ai)
  - Poe (poe.com)
- 💾 Export/Import functionality (JSON format)
- 🔐 Supabase integration for cloud sync (configured)
- ⌨️ Keyboard shortcut: Ctrl+Shift+P (Cmd+Shift+P on Mac)
- 📊 Usage tracking (count how many times each prompt is used)
- 🏷️ Tag system for better organization
- 🎯 Platform-specific optimization (Universal/ChatGPT/Claude/Gemini)
- 📱 Context menu for quick actions
- 🎭 Smooth animations and transitions
- 🌐 Explore tab (UI ready for public prompts library)
- ⚙️ Settings panel with theme selection
- 🔗 GitHub repository links (View on GitHub, Report Issue)

### Fixed
- ✅ Uncategorized folder collapse/expand functionality
- ✅ Folder delete and edit buttons now use proper event listeners
- ✅ All modal close buttons (X and Cancel) work correctly
- ✅ Done button in settings modal properly saves and closes
- ✅ Context menu positioning and click-outside-to-close

### Enhanced
- 🎨 Added comprehensive animation system:
  - Staggered card appearances
  - Smooth folder collapse/expand with cubic-bezier easing
  - Context menu slide-in animation
  - Tag pop animation
  - Favorite star bounce effect
  - Hover scale effects for buttons
  - Loading skeleton shimmer
  - Modal fade-in transitions
  - Button press feedback
- 🎨 Settings button special styling with rotation animation on hover
- 🎨 Improved visual hierarchy and spacing
- 📦 Added sample-data.json with 7 example prompts and 3 folders
- 📚 Comprehensive documentation:
  - README.md with full feature list
  - USAGE_GUIDE.md with detailed instructions
  - EXAMPLES.md with real-world use cases
  - INSTALL.md for installation guide

### Technical
- 🏗️ Manifest V3 architecture
- 🚀 Vanilla JavaScript (no frameworks)
- 💾 Dual storage: chrome.storage.local + Supabase
- 🎨 CSS custom properties for theming
- 📐 Modular component structure
- 🔧 Background service worker for context menu
- 💉 Content scripts for prompt injection
- 🎯 Lucide icons inline SVG

### Supabase Configuration
- ✅ URL: https://vofgfvlgchqheksvlibl.supabase.co
- ✅ Anon Key configured in auth.js
- 🔄 Ready for cloud sync (requires database setup)

### Known Issues
- 🌐 Explore tab public library requires Supabase database tables
- 🔐 Google OAuth sign-in uses mock implementation (needs chrome.identity API)
- 📱 No mobile extension support (desktop Chrome only)

---

## [Unreleased]

### Planned Features
- 🌐 Public prompts library (Explore tab backend)
- 🔐 Real Google OAuth authentication
- 🔄 Cloud sync across devices
- 📤 Share prompts with others
- 🔗 Prompt URL sharing
- ⚡ Keyboard shortcuts customization UI
- 🎨 More themes and customization options
- 📊 Analytics and usage insights
- 🏆 Popular prompts ranking
- 🔖 Nested folders (sub-folders)
- 🎯 Drag-and-drop organization
- 📋 Batch operations (select multiple prompts)
- 🔍 Advanced search filters
- 🏷️ Tag suggestions and autocomplete
- 📱 Mobile companion app
- 🔌 Firefox and Edge support
- 🌍 Internationalization (i18n)
- 🎙️ Voice input for prompts
- 🤖 AI-powered prompt suggestions
- 📸 Prompt templates marketplace

---

## Version History

### Version Naming Convention
- **Major** (X.0.0): Breaking changes or major new features
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes and small improvements

### Release Notes URL
- GitHub: https://github.com/Leks2000/PromptVault/releases
- Chrome Web Store: Coming soon

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Reporting bugs
- Suggesting features
- Submitting pull requests
- Code style and conventions

---

## Support

- 🐛 [Report Bug](https://github.com/Leks2000/PromptVault/issues)
- 💡 [Request Feature](https://github.com/Leks2000/PromptVault/issues)
- 📧 Email: support@promptvault.com

---

Made with ❤️ by [Leks2000](https://github.com/Leks2000)
