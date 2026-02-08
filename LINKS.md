# 🔗 Quick Links

## 📦 Repository
- **GitHub**: https://github.com/Leks2000/PromptVault
- **Clone**: `git clone https://github.com/Leks2000/PromptVault.git`

## 📚 Documentation
- **README**: [README.md](promptvault/README.md)
- **Installation Guide**: [INSTALL.md](promptvault/INSTALL.md)
- **Examples**: [EXAMPLES.md](promptvault/EXAMPLES.md)
- **License**: [LICENSE](promptvault/LICENSE)
- **Project Summary**: [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)

## 🎯 Key Features

### ✅ For Users
- Save unlimited AI prompts
- Organize with folders and tags
- Quick insert into ChatGPT/Claude/Gemini
- Dark mode support
- Export/Import backups
- Variable substitution `{like_this}`

### ✅ For Developers
- Clean vanilla JavaScript (no frameworks!)
- Modular component architecture
- Chrome Manifest V3
- Well-documented code
- Easy to extend

## 🚀 Quick Start

```bash
# 1. Clone repository
git clone https://github.com/Leks2000/PromptVault.git
cd PromptVault

# 2. Load in Chrome
# - Open chrome://extensions/
# - Enable Developer Mode
# - Click "Load unpacked"
# - Select the "promptvault" folder

# 3. Start using!
# - Click extension icon
# - Create your first prompt
# - Try it on ChatGPT
```

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| **Files** | 32 |
| **Lines of Code** | ~4,500 |
| **Components** | 9 |
| **Supported Platforms** | 6 |
| **Size** | <1MB |
| **Framework** | None (Vanilla JS) |

## 🎨 Design

- **Inspiration**: Notion
- **Theme**: Light/Dark/System
- **Colors**: Blue accent (#2383E2)
- **Typography**: System fonts
- **Layout**: 400x600px popup

## 🌐 Supported AI Platforms

1. **ChatGPT** (chat.openai.com, chatgpt.com)
2. **Claude** (claude.ai)
3. **Google Gemini** (gemini.google.com)
4. **Perplexity AI** (perplexity.ai)
5. **Poe** (poe.com)
6. More coming soon!

## 📁 Project Structure

```
PromptVault/
├── promptvault/              # Extension files
│   ├── popup/               # Main UI
│   │   ├── components/      # 9 modular components
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── content/             # Content scripts
│   ├── background/          # Service worker
│   ├── options/             # Settings page
│   ├── lib/                 # Libraries
│   ├── assets/              # Icons
│   ├── styles/              # Global CSS
│   └── manifest.json        # Extension config
├── index.html               # Landing page
└── PROJECT_SUMMARY.md       # This file
```

## 🎓 Technologies

- **Languages**: JavaScript (ES6+), HTML5, CSS3
- **APIs**: Chrome Extensions API, Chrome Storage API
- **Storage**: Local (chrome.storage.local)
- **Design**: Custom CSS (no frameworks)
- **Icons**: Inline SVG (Lucide-inspired)

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT License - See [LICENSE](promptvault/LICENSE)

## 💬 Support

- **Issues**: https://github.com/Leks2000/PromptVault/issues
- **Discussions**: https://github.com/Leks2000/PromptVault/discussions

## 🎯 Roadmap

### v1.1 (Next)
- [ ] Supabase cloud sync
- [ ] Hotkey per prompt
- [ ] Drag-and-drop sorting
- [ ] More AI platforms

### v2.0 (Future)
- [ ] Team sharing
- [ ] Prompt templates marketplace
- [ ] AI-powered suggestions
- [ ] Analytics dashboard

## ⭐ Star the Project

If you find PromptVault useful, please star the repository!

https://github.com/Leks2000/PromptVault

---

**Made with ❤️ for AI power users**

Last updated: 2024-02-08
