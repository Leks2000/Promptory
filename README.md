<div align="center">

<img src="assets/icon128.png" width="80" height="80" alt="Promtly - AI Prompt Improver Chrome Extension" />

# Promtly

**AI Prompt Improver & Image Analyzer — Free Chrome Extension for ChatGPT, Claude, Gemini & Stable Diffusion**

[![Install on Chrome](https://img.shields.io/badge/Install_on_Chrome-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://github.com/Leks2000/Promtly)
[![License: MIT](https://img.shields.io/badge/License-MIT-7c3aed?style=flat-square)](LICENSE)
[![React 18](https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Open Source](https://img.shields.io/badge/Open_Source-✓-brightgreen?style=flat-square)](https://github.com/Leks2000/Promtly)

[**→ Install Promtly for Chrome**](https://github.com/Leks2000/Promtly) · [Report a Bug](https://github.com/Leks2000/Promtly/issues) · [Request a Feature](https://github.com/Leks2000/Promtly/issues)

</div>

---

## What is Promtly?

**Promtly** is a free, open-source Chrome extension that automatically improves your AI prompts — turning rough ideas into precise, high-quality instructions that actually get results.

Whether you're generating images in Stable Diffusion, writing with ChatGPT, or building something with Claude — Promtly rewrites your prompt using AI so you don't need prompt engineering experience. Just type what you want, pick a mode, and get a better version in seconds.

**Drop any image** into Promtly and it will generate a ready-to-use prompt for you — perfect for recreating styles in Stable Diffusion or describing visuals for text-based AI models.

> Your prompts are processed through **your own API keys** and stored **locally in your browser**. Nothing goes through our servers.

---

## Table of Contents

- [Key Features](#key-features)
- [Three Prompt Improvement Modes](#three-prompt-improvement-modes)
- [Image Analysis → Prompt Generation](#image-analysis--prompt-generation)
- [Prompt Library & History](#prompt-library--history)
- [Supported AI Platforms](#supported-ai-platforms)
- [Supported API Providers](#supported-api-providers)
- [Installation](#installation)
- [Privacy](#privacy)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)

---

## Key Features

| Feature | Description |
|---|---|
| ✍️ **3 Prompt Modes** | Image generation, conversational AI, and universal improvement |
| 🖼️ **Image → Prompt** | Analyze any image and generate a prompt in all three formats |
| 📚 **Prompt Library** | Save, tag, search, and export your best prompts |
| 🔗 **Prompt Sharing** | Share prompts via public links, QR codes, or Telegram/X |
| 🔒 **Privacy First** | Your own API keys, local storage, no data collection |
| 🆓 **Free & Open Source** | MIT license, no paywalls on core features |

---

## Three Prompt Improvement Modes

### 🎨 Image Generation — Stable Diffusion / Midjourney / Civitai / DALL·E
Rewrites your prompt with proper style tags, composition details, quality modifiers, and technical parameters. Output is always in English for maximum model compatibility.

**Before:** `a girl in a forest`  
**After:** `portrait of a young woman in an enchanted forest, soft volumetric lighting, f/1.8 bokeh, detailed foliage, photorealistic, 8k, trending on ArtStation, shot on Canon EOS R5`

---

### 🌐 Universal — Any AI Task
Improves any prompt for any AI model — adds context, structure, and examples so the model understands exactly what you need. Works for research, writing, coding, analysis, and more.

---

### 💬 Conversational — ChatGPT / Claude / Gemini / Copilot
Structures your prompt as a proper instruction: defines the AI role, expected output format, tone, and interaction style. Gets you consistent, on-target responses every time.

---

## Image Analysis → Prompt Generation

Drop any image into Promtly and instantly get a ready-to-use prompt in **all three formats**:

- 🎨 **Stable Diffusion prompt** — recreate the image style in any diffusion model
- 🌐 **Universal description** — detailed visual description for any text-based AI
- 💬 **Conversational prompt** — ask an AI to generate something similar

**Use cases:** recreating a style in ComfyUI, generating image variants, reverse-engineering reference images, or describing visuals to a text-only model.

---

## Prompt Library & History

Every improved prompt is automatically saved with full metadata — provider, model, tokens used, and timestamp.

- **Full search** across all saved prompts
- **Tags and categories** for organization
- **Filters** by type, provider, date, or tag
- **Export** to JSON, TXT, or Markdown

### Prompt Sharing

- Generate a **public shareable link** for any prompt
- **Auto-generated QR codes** for mobile sharing
- **One-click share** to Telegram or Twitter/X
- **Embed code** for websites and docs

---

## Supported AI Platforms

Works with every major AI platform — no setup or configuration required.

| Platform | Supported |
|---|---|
| ChatGPT (chatgpt.com) | ✅ |
| Claude (claude.ai) | ✅ |
| Gemini (gemini.google.com) | ✅ |
| Microsoft Copilot | ✅ |
| Stable Diffusion / ComfyUI | ✅ |
| Midjourney | ✅ |
| DALL·E | ✅ |
| Civitai | ✅ |
| Perplexity | ✅ |

---

## Supported API Providers

Promtly uses **your own API keys** — you're never locked into a single provider.

| Provider | Free Tier | Models |
|---|---|---|
| OpenRouter | ✅ Free $5 credits on signup | WizardLM-2, Mixtral, LLaMA 3.1 |
| HuggingFace | ✅ 1000+ free requests/day | Mixtral, DialoGPT |
| Poe | ✅ Free tier available | Claude, GPT-4, Gemini |

---

## Installation

**Option 1 — Chrome Web Store** *(coming soon)*

1. Go to Chrome Web Store → Promtly
2. Click **Add to Chrome**
3. Open any AI platform and start improving prompts

**Option 2 — Manual Install (Developer Mode)**

```bash
git clone https://github.com/Leks2000/Promtly.git
cd Promtly
npm install
npm run build
```

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `dist/` folder
4. Open ChatGPT, Claude, or Gemini and start using Promtly

---

## Privacy

Promtly is built privacy-first:

- ✅ **Your own API keys** — prompts are processed through your provider, not ours
- ✅ **Local storage by default** — all data stays in your browser
- ✅ **No tracking, no analytics, no data selling**
- ✅ **Cloud sync is optional** and requires explicit Google sign-in
- ✅ **Open source** — read every line of the code yourself

---

## Tech Stack

- **React 18** — UI components
- **TypeScript** — type-safe codebase
- **Vite** — fast build tooling
- **Tailwind CSS** — utility-first styling
- **Chrome Extension Manifest V3** — modern extension architecture
- **Google OAuth 2.0** — optional cloud sync authentication

---

## Contributing

Issues, feature requests, and PRs are welcome.

1. Fork the repo
2. Create your branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT © [Leks2000](https://github.com/Leks2000)

---

<div align="center">

**[⭐ Star this repo if it helped you](https://github.com/Leks2000/Promtly)**

*Bad prompts = bad results. Fix the prompt, fix the output.*

</div>
