-- PromptVault Database Schema and Test Data
-- Supabase PostgreSQL

-- ===========================================
-- SCHEMA CREATION
-- ===========================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Folders table
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📁',
  parent_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompts table
CREATE TABLE IF NOT EXISTS public.prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  description TEXT,
  platform TEXT DEFAULT 'universal',
  tags TEXT[] DEFAULT '{}',
  variables TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Public prompts library (curated by admins)
CREATE TABLE IF NOT EXISTS public.library_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  description TEXT,
  author TEXT NOT NULL,
  icon TEXT DEFAULT '📝',
  tags TEXT[] DEFAULT '{}',
  variables TEXT[] DEFAULT '{}',
  likes INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  category TEXT,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User likes on library prompts
CREATE TABLE IF NOT EXISTS public.library_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  prompt_id UUID REFERENCES public.library_prompts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, prompt_id)
);

-- User hotkey settings
CREATE TABLE IF NOT EXISTS public.hotkey_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 4),
  key_combo TEXT NOT NULL,
  prompt_id UUID REFERENCES public.prompts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, slot_number)
);

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotkey_settings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Folders policies
CREATE POLICY "Users can view own folders" ON public.folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folders" ON public.folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders" ON public.folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders" ON public.folders
  FOR DELETE USING (auth.uid() = user_id);

-- Prompts policies
CREATE POLICY "Users can view own prompts" ON public.prompts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prompts" ON public.prompts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prompts" ON public.prompts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own prompts" ON public.prompts
  FOR DELETE USING (auth.uid() = user_id);

-- Library prompts policies (public read, admin write)
CREATE POLICY "Anyone can view library prompts" ON public.library_prompts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert library prompts" ON public.library_prompts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update library prompts" ON public.library_prompts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete library prompts" ON public.library_prompts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Library likes policies
CREATE POLICY "Users can view own likes" ON public.library_likes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own likes" ON public.library_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON public.library_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Hotkey settings policies
CREATE POLICY "Users can view own hotkeys" ON public.hotkey_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own hotkeys" ON public.hotkey_settings
  FOR ALL USING (auth.uid() = user_id);

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON public.prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_folder_id ON public.prompts(folder_id);
CREATE INDEX IF NOT EXISTS idx_prompts_is_favorite ON public.prompts(is_favorite);
CREATE INDEX IF NOT EXISTS idx_library_prompts_category ON public.library_prompts(category);
CREATE INDEX IF NOT EXISTS idx_library_prompts_is_featured ON public.library_prompts(is_featured);

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Function to increment download count
CREATE OR REPLACE FUNCTION increment_download_count(prompt_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.library_prompts
  SET downloads = downloads + 1
  WHERE id = prompt_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle like
CREATE OR REPLACE FUNCTION toggle_library_like(prompt_uuid UUID)
RETURNS void AS $$
DECLARE
  existing_like UUID;
BEGIN
  SELECT id INTO existing_like FROM public.library_likes
  WHERE user_id = auth.uid() AND prompt_id = prompt_uuid;
  
  IF existing_like IS NOT NULL THEN
    DELETE FROM public.library_likes WHERE id = existing_like;
    UPDATE public.library_prompts SET likes = likes - 1 WHERE id = prompt_uuid;
  ELSE
    INSERT INTO public.library_likes (user_id, prompt_id) VALUES (auth.uid(), prompt_uuid);
    UPDATE public.library_prompts SET likes = likes + 1 WHERE id = prompt_uuid;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- TEST DATA - PUBLIC LIBRARY PROMPTS
-- ===========================================

INSERT INTO public.library_prompts (title, text, description, author, icon, tags, variables, likes, downloads, category, is_featured) VALUES

-- Business & Communication
('Professional Email Writer', 
'Write a professional email about {topic} to {recipient}. The tone should be {tone}.

Requirements:
- Start with an appropriate greeting
- Be clear and concise
- State the purpose in the first paragraph
- Include a clear call to action
- End with a professional sign-off

Additional context: {context}',
'Craft professional emails for any business situation', 
'PromptMaster', '✉️', 
ARRAY['business', 'communication', 'email'], 
ARRAY['topic', 'recipient', 'tone', 'context'],
245, 1200, 'business', true),

('Meeting Summarizer',
'Summarize the following meeting notes into a clear, actionable format:

Meeting Notes:
{notes}

Please provide:
1. **Key Decisions Made** - List all decisions with brief context
2. **Action Items** - Format as: [Owner] - Task - [Due Date]
3. **Discussion Points** - Main topics discussed
4. **Next Steps** - Upcoming milestones or follow-ups
5. **Open Questions** - Unresolved items needing attention',
'Transform messy meeting notes into structured summaries',
'ProductivityPro', '📊',
ARRAY['productivity', 'meetings', 'summary'],
ARRAY['notes'],
156, 780, 'business', false),

-- Development & Coding
('Code Review Assistant',
'Review the following code and provide constructive feedback:

```{language}
{code}
```

Please analyze:
1. **Code Quality** - Readability, naming conventions, structure
2. **Best Practices** - Design patterns, coding standards
3. **Potential Bugs** - Edge cases, error handling, logic issues
4. **Performance** - Optimization opportunities, complexity analysis
5. **Security** - Potential vulnerabilities, input validation
6. **Suggestions** - Specific improvements with examples

Format your response with clear headings and code examples where helpful.',
'Get thorough code reviews with actionable feedback',
'DevGuru', '💻',
ARRAY['coding', 'review', 'development'],
ARRAY['language', 'code'],
189, 950, 'development', true),

('Debug Helper',
'I''m encountering an error in my {language} code. Help me debug it.

**Error Message:**
{error}

**Code:**
```{language}
{code}
```

**What I''ve tried:**
{attempts}

Please:
1. Explain what''s causing the error
2. Provide the corrected code
3. Explain why the fix works
4. Suggest how to prevent similar issues',
'Get help debugging code errors with explanations',
'CodeHelper', '🐛',
ARRAY['coding', 'debug', 'errors'],
ARRAY['language', 'error', 'code', 'attempts'],
134, 620, 'development', false),

-- Content & Marketing
('Social Media Caption',
'Create an engaging social media caption for {platform} about {topic}.

Target audience: {audience}
Brand voice: {voice}
Goal: {goal}

Requirements:
- Attention-grabbing hook in first line
- Relevant to the platform''s style
- Include a clear call-to-action
- Add 3-5 relevant hashtags
- Use appropriate emojis

Optional: Include any key messages or promotions: {promotion}',
'Generate engaging social media content',
'ContentQueen', '📱',
ARRAY['marketing', 'social media', 'content'],
ARRAY['platform', 'topic', 'audience', 'voice', 'goal', 'promotion'],
312, 1500, 'marketing', true),

('Blog Post Outline',
'Create a detailed blog post outline about {topic}.

Target audience: {audience}
Word count goal: {wordcount}
SEO keywords: {keywords}

Include:
1. **Compelling Title Options** (3 variations)
2. **Introduction Hook** - Opening paragraph approach
3. **Main Sections** - H2 headings with bullet points for each
4. **Key Takeaways** - What readers should remember
5. **Call to Action** - How to engage readers further
6. **Internal/External Link Suggestions**',
'Plan structured blog posts that rank and engage',
'ContentStrategist', '📝',
ARRAY['content', 'blogging', 'SEO'],
ARRAY['topic', 'audience', 'wordcount', 'keywords'],
198, 890, 'marketing', false),

-- Learning & Research
('Explain Like I''m 5',
'Explain {concept} in simple terms that a 5-year-old could understand.

Use:
- Simple words and short sentences
- Relatable analogies and examples
- A friendly, encouraging tone
- Visual descriptions when helpful

Then provide a slightly more detailed explanation for someone with basic knowledge of {field}.',
'Break down complex topics into simple explanations',
'TeacherBot', '🎓',
ARRAY['learning', 'explanation', 'education'],
ARRAY['concept', 'field'],
267, 1100, 'learning', true),

('Research Summary',
'Summarize the key points from this research/article about {topic}:

{content}

Please provide:
1. **Main Thesis/Argument** - Core claim or finding
2. **Key Evidence** - Supporting data and examples
3. **Methodology** - How the research was conducted
4. **Limitations** - Acknowledged weaknesses
5. **Implications** - Why this matters
6. **Critical Analysis** - Your assessment of the validity',
'Extract insights from research papers and articles',
'ResearchPro', '🔬',
ARRAY['research', 'analysis', 'summary'],
ARRAY['topic', 'content'],
145, 560, 'learning', false),

-- Creative & Writing
('Story Generator',
'Write a short story with the following elements:

Genre: {genre}
Setting: {setting}
Main character: {character}
Conflict: {conflict}
Tone: {tone}

Requirements:
- Engaging opening hook
- Clear character development
- Rising tension and climax
- Satisfying resolution
- Approximately {length} words',
'Generate creative short stories',
'StoryWeaver', '📚',
ARRAY['creative', 'writing', 'fiction'],
ARRAY['genre', 'setting', 'character', 'conflict', 'tone', 'length'],
223, 890, 'creative', false),

('Rewrite & Improve',
'Rewrite the following text to be {style}:

Original text:
{text}

Specific improvements needed:
- {improvement1}
- {improvement2}

Maintain the original meaning while improving:
- Clarity and readability
- Grammar and punctuation
- Flow and engagement
- Appropriate tone for {audience}',
'Improve and rewrite text for different purposes',
'EditPro', '✍️',
ARRAY['writing', 'editing', 'improvement'],
ARRAY['style', 'text', 'improvement1', 'improvement2', 'audience'],
178, 720, 'creative', false),

-- AI & Prompts
('Prompt Improver',
'Improve this AI prompt to get better results:

Original prompt:
{prompt}

Intended use: {use_case}
AI model: {model}

Please:
1. Analyze weaknesses in the original
2. Provide an improved version with:
   - Clear instructions
   - Specific constraints
   - Output format guidance
   - Examples if helpful
3. Explain your improvements',
'Meta-prompt to improve your other prompts',
'PromptEngineer', '🎯',
ARRAY['prompts', 'AI', 'optimization'],
ARRAY['prompt', 'use_case', 'model'],
289, 1350, 'ai', true),

('System Prompt Builder',
'Create a system prompt for a {type} AI assistant with these characteristics:

Role: {role}
Personality: {personality}
Expertise areas: {expertise}
Constraints: {constraints}
Response style: {style}

The system prompt should:
- Define clear behavioral boundaries
- Establish the assistant''s knowledge scope
- Set appropriate tone and formality
- Include handling for edge cases',
'Design effective system prompts for AI assistants',
'AIArchitect', '🤖',
ARRAY['AI', 'system prompts', 'chatbots'],
ARRAY['type', 'role', 'personality', 'expertise', 'constraints', 'style'],
167, 680, 'ai', false);

-- ===========================================
-- VERIFICATION QUERIES
-- ===========================================

-- Check library prompts count
SELECT COUNT(*) as total_library_prompts FROM public.library_prompts;

-- View all categories
SELECT DISTINCT category FROM public.library_prompts;

-- View featured prompts
SELECT title, author, likes, downloads FROM public.library_prompts WHERE is_featured = true;
