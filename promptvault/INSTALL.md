# 🚀 Installation Guide

## Quick Install (Chrome/Edge)

### Method 1: Load Unpacked (Development)

1. **Download the extension**
   ```bash
   git clone https://github.com/Leks2000/PromptVault.git
   cd PromptVault
   ```

2. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions/`
   - Or click Menu (⋮) → Extensions → Manage Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the extension**
   - Click "Load unpacked" button
   - Navigate to and select the `promptvault` folder
   - The extension should now appear in your toolbar!

5. **Pin the extension** (optional)
   - Click the extensions icon (puzzle piece) in Chrome toolbar
   - Click the pin icon next to PromptVault

### Method 2: From ZIP file

1. **Download the latest release**
   - Go to [Releases](https://github.com/Leks2000/PromptVault/releases)
   - Download `promptvault-v1.0.0.zip`

2. **Extract the ZIP file**
   - Extract to a permanent location (don't delete after loading!)

3. **Follow steps 2-5 from Method 1**

## First Launch

When you first open PromptVault:

1. **Welcome Screen** appears
   - Click "Get Started" to begin

2. **Create your first prompt**
   - Click the "New" button in the header
   - Fill in the details:
     - Title: "My First Prompt"
     - Text: "Write a professional email about {topic}"
     - Tags: "work, email"
   - Click "Create Prompt"

3. **Try it on an AI platform**
   - Go to [ChatGPT](https://chat.openai.com)
   - Click the PromptVault icon (or press `Ctrl+Shift+P`)
   - Click on your prompt
   - Click the menu (⋮) → "Insert to page"
   - Fill in variables and click "Insert"

## Keyboard Shortcuts

- **Open PromptVault**: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)

To customize shortcuts:
1. Go to `chrome://extensions/shortcuts`
2. Find PromptVault
3. Click the edit icon
4. Set your preferred shortcut

## Troubleshooting

### Extension not loading?
- Make sure Developer mode is enabled
- Check that you selected the correct folder (`promptvault`)
- Try reloading the extension (click refresh icon)

### Prompts not inserting?
- Make sure you're on a supported platform (ChatGPT, Claude, Gemini, etc.)
- Refresh the page and try again
- If still not working, the prompt will be copied to clipboard

### Icons not showing?
- The icons are included in the `assets` folder
- If they're missing, regenerate them using the Python script:
  ```bash
  cd promptvault/assets
  python3 -c "from PIL import Image, ImageDraw; exec(open('create-icons.html').read())"
  ```

### Dark mode not working?
- Go to Settings (⚙️ icon)
- Change theme to "Dark" or "System"
- If "System" is selected, it follows your OS theme

## Optional: Supabase Setup

For cloud sync and public library features:

1. **Create a Supabase account**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project

2. **Get credentials**
   - Copy your project URL
   - Copy your anon/public key

3. **Download Supabase JS**
   ```bash
   cd promptvault/lib
   curl -o supabase.min.js https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
   ```

4. **Update configuration**
   - Edit `popup/components/auth.js`
   - Replace placeholders with your credentials

5. **Set up database**
   - Run the SQL schema from README.md
   - Enable Row Level Security
   - Set up authentication (Google OAuth)

## Uninstall

1. Go to `chrome://extensions/`
2. Find PromptVault
3. Click "Remove"
4. Confirm deletion

**Note**: Your data is stored locally. To backup before uninstalling:
- Open PromptVault
- Click Settings (⚙️)
- Click "Export All Data (JSON)"
- Save the file somewhere safe

## Support

- 📖 [Documentation](https://github.com/Leks2000/PromptVault)
- 🐛 [Report Issue](https://github.com/Leks2000/PromptVault/issues)
- 💬 [Discussions](https://github.com/Leks2000/PromptVault/discussions)

---

**Pro Tips:**
- Create folders to organize prompts by category
- Use tags for quick filtering
- Star (⭐) your most-used prompts
- Use variables `{like_this}` for dynamic prompts
- Export your prompts regularly as backup
