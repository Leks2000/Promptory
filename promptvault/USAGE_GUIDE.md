# PromptVault Usage Guide

Complete guide to using PromptVault effectively.

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Prompts](#creating-prompts)
3. [Organizing with Folders](#organizing-with-folders)
4. [Using Variables](#using-variables)
5. [Inserting Prompts](#inserting-prompts)
6. [Import & Export](#import--export)
7. [Tips & Tricks](#tips--tricks)

## 🚀 Getting Started

### First Launch

When you first open PromptVault, you'll see a welcome screen. Click **"Get Started"** to begin.

### Interface Overview

```
┌─────────────────────────────────────┐
│ PromptVault          [+New] [⚙]    │  ← Header
├─────────────────────────────────────┤
│ 🔍 Search prompts...                │  ← Search
├─────────────────────────────────────┤
│ Prompts │ Folders │ ★ │ Explore    │  ← Tabs
├─────────────────────────────────────┤
│                                     │
│  Your prompts appear here           │
│                                     │
└─────────────────────────────────────┘
```

## 📝 Creating Prompts

### Basic Prompt

1. Click **"New"** button in the header
2. Enter a **Title** (required)
3. Enter your **Prompt Text** (required)
4. Click **"Create Prompt"**

**Example:**
```
Title: Summarize Article
Text: Please summarize the following article in 3-5 sentences.
```

### Advanced Prompt with Variables

Use `{variable_name}` syntax for dynamic content:

```
Title: Email Reply
Text: Write a {tone} email reply to {recipient} addressing:
- {point_1}
- {point_2}
- {point_3}

Keep it concise and professional.
```

When you use this prompt, you'll be asked to fill in:
- `tone` (e.g., "formal", "friendly")
- `recipient` (e.g., "my manager")
- `point_1`, `point_2`, `point_3`

### Prompt Fields Explained

| Field | Required | Purpose |
|-------|----------|---------|
| **Title** | ✅ Yes | Short name to identify your prompt |
| **Text** | ✅ Yes | The actual prompt content |
| **Description** | ❌ No | Notes about what this prompt does |
| **Folder** | ❌ No | Organize into folders |
| **Tags** | ❌ No | Add hashtags for searching |
| **Platform** | ❌ No | Optimize for ChatGPT/Claude/Gemini |

### Tags

Tags help you find prompts quickly:

```
Tags: #productivity #email #business
```

- Type a tag and press **Enter**
- Click the **×** to remove a tag
- Don't include # when typing (it's added automatically)

## 📁 Organizing with Folders

### Create a Folder

1. Go to **Folders** tab
2. Click **"New Folder"**
3. Enter a name (e.g., "Marketing")
4. Choose an emoji icon (e.g., 📢)
5. Click **"Create Folder"**

### Organize Prompts

When creating/editing a prompt:
1. Click the **Folder** dropdown
2. Select a folder
3. Save the prompt

### Folder Features

- **Collapse/Expand**: Click the folder header to show/hide prompts
- **Edit**: Click the pencil icon ✏️
- **Delete**: Click the trash icon 🗑️ (prompts move to "Uncategorized")
- **Count**: See how many prompts are in each folder

## 🔧 Using Variables

Variables make prompts reusable with different inputs.

### Variable Syntax

Wrap variable names in curly braces:
```
{variable_name}
```

### Variable Examples

**Simple:**
```
Explain {concept} to a beginner.
```
Variables: `concept`

**Multiple:**
```
Write a {length} blog post about {topic} for {audience}.
Tone: {tone}
```
Variables: `length`, `topic`, `audience`, `tone`

**Complex:**
```
Create a {social_platform} post about {product}.

Target audience: {audience}
Key benefits: {benefit_1}, {benefit_2}, {benefit_3}
Call to action: {cta}
```

### Filling Variables

When you insert a prompt with variables:

1. A popup appears with input fields for each variable
2. Fill in the values
3. Click **"Insert"**
4. The prompt is inserted with your values

**Example:**
```
Input:
- tone: "friendly"
- recipient: "Sarah"

Output:
Write a friendly email reply to Sarah addressing...
```

## 💉 Inserting Prompts

### Method 1: Direct Insert

1. Open a supported AI platform (ChatGPT, Claude, Gemini)
2. Click the PromptVault extension icon
3. Find your prompt
4. Click the **⋮** menu
5. Select **"Insert to page"**

### Method 2: Copy to Clipboard

1. Click the **⋮** menu on any prompt
2. Select **"Copy prompt"**
3. Paste anywhere with `Ctrl+V`

### Supported Platforms

✅ ChatGPT (chat.openai.com, chatgpt.com)  
✅ Claude (claude.ai)  
✅ Google Gemini (gemini.google.com)  
✅ Perplexity AI (perplexity.ai)  
✅ Poe (poe.com)

### Use Count

PromptVault tracks how many times you use each prompt. View this in the prompt card footer:
```
Used 12 times
```

## ⭐ Favorites

### Add to Favorites

Click the **⭐ star icon** on any prompt card to mark it as favorite.

### View Favorites

Click the **★** tab to see all your favorite prompts in one place.

### Use Case

Mark your most-used prompts as favorites for quick access:
- Email templates
- Code review prompts
- Daily standup summaries
- Brainstorming templates

## 🔍 Search

The search bar finds prompts by:
- Title
- Tags
- Description
- Prompt text

**Tips:**
- Search updates instantly as you type
- Use tags for category-based searching
- Clear search by clicking the ✕

## 💾 Import & Export

### Export Your Data

Perfect for:
- Backups
- Moving to another computer
- Sharing prompt collections

**Steps:**
1. Click **⚙️ Settings**
2. Scroll to **Data Management**
3. Click **"Export All Data (JSON)"**
4. Save the `.json` file

**Export includes:**
- All prompts
- All folders
- Settings
- Export timestamp

### Import Data

**Steps:**
1. Click **⚙️ Settings**
2. Click **"Import Data (JSON)"**
3. Select your `.json` file
4. Confirm replacement (⚠️ overwrites current data)
5. Extension reloads automatically

### Sample Data

Test import/export with the included sample data:
```
promptvault/sample-data.json
```

Contains:
- 7 example prompts
- 3 folders (Marketing, Development, Business)
- Various tags and use cases

## 🎨 Customization

### Theme

Choose your preferred theme:

1. Click **⚙️ Settings**
2. Select **Theme**:
   - **System** (default): Matches your OS
   - **Light**: Always light mode
   - **Dark**: Always dark mode

### Keyboard Shortcut

Default: `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`)

To change:
1. Go to `chrome://extensions/shortcuts`
2. Find **PromptVault**
3. Click the pencil icon
4. Set your preferred shortcut

## 🌐 Explore Tab (Coming Soon)

The Explore tab will feature:
- Public prompt library
- Community-shared prompts
- Like and save popular prompts
- Filter by category

**Note:** Requires sign-in with Supabase account.

## 💡 Tips & Tricks

### 1. Use Descriptive Titles

❌ Bad: "Prompt 1"  
✅ Good: "Email: Professional Follow-up"

### 2. Tag Strategically

Create a consistent tagging system:
```
#work #personal #creative #technical
#email #code #writing #brainstorm
```

### 3. Template Prompts

Create generic templates and use variables:
```
Write a {type} about {topic} targeting {audience}.

Include:
- {section_1}
- {section_2}
- {section_3}

Tone: {tone}
```

### 4. Folder Structure

Organize by:
- **Type**: Email, Code, Writing, etc.
- **Project**: Project A, Project B
- **Platform**: ChatGPT-specific, Claude-specific
- **Frequency**: Daily, Weekly, Monthly

### 5. Regular Backups

Export your prompts monthly:
```
promptvault-backup-2024-02-08.json
```

### 6. Context Menu Power User

Right-click workflow:
1. ⋮ menu → "Copy prompt" (fast copy)
2. ⋮ menu → "Insert to page" (direct insert)
3. ⋮ menu → "Edit" (quick edit)

### 7. Bulk Organization

1. Create folders first
2. Use Folders tab to see organization
3. Edit prompts to assign folders
4. Use search to find unorganized prompts

## 🐛 Troubleshooting

### Prompt Won't Insert

**Solutions:**
1. Refresh the AI platform page
2. Make sure content script is loaded
3. Try "Copy prompt" instead
4. Check console for errors

### Variables Not Appearing

**Check:**
- Variables use `{curly_braces}`
- No spaces in variable names
- Variables are in prompt text, not description

### Extension Not Loading

**Steps:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click refresh icon on PromptVault
4. Check for errors in console

### Import Failed

**Common issues:**
- Invalid JSON format
- Missing required fields
- Corrupted file

**Solution:** Use the sample data file to test.

## 📚 Real-World Examples

### Example 1: Code Review Prompt

```
Title: Comprehensive Code Review
Folder: Development
Tags: #code #review #programming

Text:
Review the following {language} code:

```{code}```

Analyze:
1. Performance & efficiency
2. Security vulnerabilities
3. Code readability
4. Best practices
5. Potential bugs

Provide specific improvement suggestions with examples.
```

### Example 2: Email Templates

```
Title: Professional Email Reply
Folder: Business
Tags: #email #communication

Text:
Write a professional email reply to {recipient}.

Context: {context}

Points to address:
- {point_1}
- {point_2}
- {point_3}

Tone: {tone}
Keep it concise, clear, and action-oriented.
```

### Example 3: Content Creation

```
Title: Social Media Caption
Folder: Marketing
Tags: #social-media #content #marketing

Text:
Create a {platform} caption for a post about {topic}.

Target audience: {audience}
Tone: {tone}
Length: {length}

Include:
- Hook in first sentence
- Clear value proposition
- Call to action
- Relevant hashtags
- Appropriate emojis
```

## 🎓 Advanced Usage

### Multi-Step Prompts

Create a series of related prompts:

```
1. "Brainstorm: {topic}" → Generate ideas
2. "Outline: {topic}" → Structure ideas
3. "Draft: {topic}" → Write content
4. "Edit: {topic}" → Polish content
```

### Prompt Chains

Use output from one prompt as input for another:

```
Step 1: "Analyze {data}" → Get insights
Step 2: "Visualize {insights}" → Create charts
Step 3: "Report {visualizations}" → Generate report
```

### Platform-Specific Optimization

**ChatGPT prompts:**
- Use system/user role instructions
- Leverage code interpreter features

**Claude prompts:**
- Longer context windows
- Document analysis focus

**Gemini prompts:**
- Multimodal capabilities
- Image understanding

---

## Need Help?

- 📖 [README.md](README.md) - Project overview
- 🐛 [Report Issue](https://github.com/Leks2000/PromptVault/issues)
- 💡 [Request Feature](https://github.com/Leks2000/PromptVault/issues)

Made with ❤️ for AI power users
