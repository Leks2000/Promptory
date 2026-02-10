-- Promptory Database Schema and Test Data
-- Supabase PostgreSQL
-- Use: Run in Supabase SQL Editor

-- ===========================================
-- DROP EXISTING POLICIES (prevents "already exists" errors)
-- ===========================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service can insert profiles" ON public.profiles;

DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;

DROP POLICY IF EXISTS "Users can view own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can insert own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can update own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can delete own prompts" ON public.prompts;

DROP POLICY IF EXISTS "Anyone can view library prompts" ON public.library_prompts;
DROP POLICY IF EXISTS "Authenticated can view library prompts" ON public.library_prompts;
DROP POLICY IF EXISTS "Admins can insert library prompts" ON public.library_prompts;
DROP POLICY IF EXISTS "Users can share to library" ON public.library_prompts;
DROP POLICY IF EXISTS "Admins can update library prompts" ON public.library_prompts;
DROP POLICY IF EXISTS "Admins can delete library prompts" ON public.library_prompts;
DROP POLICY IF EXISTS "Authors can delete own library prompts" ON public.library_prompts;

DROP POLICY IF EXISTS "Users can view own likes" ON public.library_likes;
DROP POLICY IF EXISTS "Users can insert own likes" ON public.library_likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON public.library_likes;

DROP POLICY IF EXISTS "Users can view own hotkeys" ON public.hotkey_settings;
DROP POLICY IF EXISTS "Users can manage own hotkeys" ON public.hotkey_settings;

DROP POLICY IF EXISTS "Users can view own usage" ON public.usage_history;
DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage_history;

DROP POLICY IF EXISTS "Users can view own reports" ON public.prompt_reports;
DROP POLICY IF EXISTS "Users can insert reports" ON public.prompt_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON public.prompt_reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.prompt_reports;

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
  is_premium BOOLEAN DEFAULT false,
  prompt_limit INTEGER DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Folders table
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
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
  image_url TEXT,
  platform TEXT DEFAULT 'universal',
  tags TEXT[] DEFAULT '{}',
  variables TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Public prompts library (user submissions + admin curated)
CREATE TABLE IF NOT EXISTS public.library_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  author TEXT NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  variables TEXT[] DEFAULT '{}',
  likes INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  category TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add author_id column if table already exists without it
DO $$ BEGIN
  ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS image_url TEXT;
  ALTER TABLE public.library_prompts ADD COLUMN IF NOT EXISTS image_url TEXT;
  ALTER TABLE public.library_prompts ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  ALTER TABLE public.library_prompts ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Usage history table
CREATE TABLE IF NOT EXISTS public.usage_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  prompt_id UUID NOT NULL,
  prompt_title TEXT,
  platform TEXT,
  action TEXT DEFAULT 'insert',
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add prompt_title and action columns if they don't exist
DO $$ BEGIN
  ALTER TABLE public.usage_history ADD COLUMN IF NOT EXISTS prompt_title TEXT;
  ALTER TABLE public.usage_history ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'insert';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Prompt reports table (moderation)
CREATE TABLE IF NOT EXISTS public.prompt_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  prompt_id UUID REFERENCES public.library_prompts(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, prompt_id)
);

-- Add is_premium and prompt_limit to profiles if not present
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS prompt_limit INTEGER DEFAULT 20;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotkey_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_reports ENABLE ROW LEVEL SECURITY;

-- Profiles policies (IMPORTANT: Allow SELECT for all authenticated to enable foreign key lookups)
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow authenticated users to read any profile (needed for author lookups in library_prompts)
CREATE POLICY "Authenticated can read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow users to create their own profile (auth.uid() matches the id being inserted)
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Also allow service role to create profiles during signup trigger
CREATE POLICY "Service can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (true);

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

-- Library prompts policies (public read for authenticated, user can share, admin can manage)
CREATE POLICY "Authenticated can view library prompts" ON public.library_prompts
  FOR SELECT TO authenticated USING (true);

-- Allow any authenticated user to insert into library_prompts
-- The author_id must match the current user OR be NULL
CREATE POLICY "Users can share to library" ON public.library_prompts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (author_id IS NULL OR author_id = auth.uid())
  );

CREATE POLICY "Admins can update library prompts" ON public.library_prompts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    OR author_id = auth.uid()
  );

CREATE POLICY "Authors can delete own library prompts" ON public.library_prompts
  FOR DELETE USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
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

-- Usage history policies
CREATE POLICY "Users can view own usage" ON public.usage_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage" ON public.usage_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Report policies
CREATE POLICY "Users can view own reports" ON public.prompt_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert reports" ON public.prompt_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all reports" ON public.prompt_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update reports" ON public.prompt_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON public.prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_folder_id ON public.prompts(folder_id);
CREATE INDEX IF NOT EXISTS idx_prompts_is_favorite ON public.prompts(is_favorite);
CREATE INDEX IF NOT EXISTS idx_library_prompts_category ON public.library_prompts(category);
CREATE INDEX IF NOT EXISTS idx_library_prompts_is_featured ON public.library_prompts(is_featured);
CREATE INDEX IF NOT EXISTS idx_library_prompts_author_id ON public.library_prompts(author_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_user_id ON public.usage_history(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_used_at ON public.usage_history(used_at);
CREATE INDEX IF NOT EXISTS idx_prompt_reports_prompt_id ON public.prompt_reports(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_reports_status ON public.prompt_reports(status);

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
RETURNS JSON AS $$
DECLARE
  existing_like UUID;
  new_likes INTEGER;
  liked BOOLEAN;
BEGIN
  SELECT id INTO existing_like FROM public.library_likes
  WHERE user_id = auth.uid() AND prompt_id = prompt_uuid;
  
  IF existing_like IS NOT NULL THEN
    DELETE FROM public.library_likes WHERE id = existing_like;
    UPDATE public.library_prompts SET likes = GREATEST(likes - 1, 0) WHERE id = prompt_uuid
      RETURNING likes INTO new_likes;
    liked := false;
  ELSE
    INSERT INTO public.library_likes (user_id, prompt_id) VALUES (auth.uid(), prompt_uuid);
    UPDATE public.library_prompts SET likes = likes + 1 WHERE id = prompt_uuid
      RETURNING likes INTO new_likes;
    liked := true;
  END IF;
  
  RETURN json_build_object('liked', liked, 'likes', new_likes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record usage
CREATE OR REPLACE FUNCTION record_usage(p_prompt_id UUID, p_prompt_title TEXT, p_platform TEXT, p_action TEXT DEFAULT 'insert')
RETURNS void AS $$
BEGIN
  INSERT INTO public.usage_history (user_id, prompt_id, prompt_title, platform, action)
  VALUES (auth.uid(), p_prompt_id, p_prompt_title, p_platform, p_action);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get usage stats for a user
CREATE OR REPLACE FUNCTION get_usage_stats(days_back INTEGER DEFAULT 30)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_uses', (SELECT COUNT(*) FROM public.usage_history WHERE user_id = auth.uid() AND used_at >= NOW() - (days_back || ' days')::INTERVAL),
    'daily_stats', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
      FROM (
        SELECT DATE(used_at) as date, COUNT(*) as count
        FROM public.usage_history 
        WHERE user_id = auth.uid() AND used_at >= NOW() - (days_back || ' days')::INTERVAL
        GROUP BY DATE(used_at)
        ORDER BY date DESC
      ) d
    ),
    'top_prompts', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT prompt_title as title, COUNT(*) as uses
        FROM public.usage_history 
        WHERE user_id = auth.uid() AND used_at >= NOW() - (days_back || ' days')::INTERVAL
        AND prompt_title IS NOT NULL
        GROUP BY prompt_title
        ORDER BY uses DESC
        LIMIT 10
      ) t
    ),
    'by_platform', (
      SELECT COALESCE(json_agg(row_to_json(p)), '[]'::json)
      FROM (
        SELECT COALESCE(platform, 'unknown') as platform, COUNT(*) as count
        FROM public.usage_history 
        WHERE user_id = auth.uid() AND used_at >= NOW() - (days_back || ' days')::INTERVAL
        GROUP BY platform
        ORDER BY count DESC
      ) p
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can create more prompts (free tier limit)
CREATE OR REPLACE FUNCTION check_prompt_limit()
RETURNS JSON AS $$
DECLARE
  user_profile public.profiles%ROWTYPE;
  prompt_count INTEGER;
BEGIN
  SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();
  SELECT COUNT(*) INTO prompt_count FROM public.prompts WHERE user_id = auth.uid();
  
  RETURN json_build_object(
    'can_create', user_profile.is_premium OR prompt_count < user_profile.prompt_limit,
    'current_count', prompt_count,
    'limit', user_profile.prompt_limit,
    'is_premium', user_profile.is_premium
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- TEST DATA - PUBLIC LIBRARY PROMPTS
-- ===========================================

-- Only insert if table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.library_prompts LIMIT 1) THEN
    INSERT INTO public.library_prompts (title, text, description, author, tags, variables, likes, downloads, category, is_featured) VALUES

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
    'PromptMaster',
    ARRAY['business', 'communication', 'email'], 
    ARRAY['topic', 'recipient', 'tone', 'context'],
    245, 1200, 'business', true),

    ('Meeting Summarizer',
    'Summarize the following meeting notes into a clear, actionable format:

Meeting Notes:
{notes}

Please provide:
1. Key Decisions Made
2. Action Items (Owner - Task - Due Date)
3. Discussion Points
4. Next Steps
5. Open Questions',
    'Transform messy meeting notes into structured summaries',
    'ProductivityPro',
    ARRAY['productivity', 'meetings', 'summary'],
    ARRAY['notes'],
    156, 780, 'business', false),

    ('Code Review Assistant',
    'Review the following code and provide constructive feedback:

```{language}
{code}
```

Please analyze:
1. Code Quality
2. Best Practices
3. Potential Bugs
4. Performance
5. Security
6. Suggestions with examples',
    'Get thorough code reviews with actionable feedback',
    'DevGuru',
    ARRAY['coding', 'review', 'development'],
    ARRAY['language', 'code'],
    189, 950, 'development', true),

    ('Debug Helper',
    'I''m encountering an error in my {language} code. Help me debug it.

Error Message: {error}

Code:
```{language}
{code}
```

What I''ve tried: {attempts}

Please:
1. Explain what''s causing the error
2. Provide the corrected code
3. Explain why the fix works
4. Suggest how to prevent similar issues',
    'Get help debugging code errors with explanations',
    'CodeHelper',
    ARRAY['coding', 'debug', 'errors'],
    ARRAY['language', 'error', 'code', 'attempts'],
    134, 620, 'development', false),

    ('Social Media Caption',
    'Create an engaging social media caption for {platform} about {topic}.

Target audience: {audience}
Brand voice: {voice}
Goal: {goal}

Requirements:
- Attention-grabbing hook
- Platform-appropriate style
- Clear call-to-action
- 3-5 relevant hashtags
- Appropriate emojis

Optional promotion: {promotion}',
    'Generate engaging social media content',
    'ContentQueen',
    ARRAY['marketing', 'social media', 'content'],
    ARRAY['platform', 'topic', 'audience', 'voice', 'goal', 'promotion'],
    312, 1500, 'marketing', true),

    ('Blog Post Outline',
    'Create a detailed blog post outline about {topic}.

Target audience: {audience}
Word count goal: {wordcount}
SEO keywords: {keywords}

Include:
1. Compelling Title Options (3 variations)
2. Introduction Hook
3. Main Sections with H2 headings
4. Key Takeaways
5. Call to Action
6. Link Suggestions',
    'Plan structured blog posts that rank and engage',
    'ContentStrategist',
    ARRAY['content', 'blogging', 'SEO'],
    ARRAY['topic', 'audience', 'wordcount', 'keywords'],
    198, 890, 'marketing', false),

    ('Explain Like I''m 5',
    'Explain {concept} in simple terms that a 5-year-old could understand.

Use:
- Simple words and short sentences
- Relatable analogies and examples
- A friendly, encouraging tone
- Visual descriptions when helpful

Then provide a slightly more detailed explanation for someone with basic knowledge of {field}.',
    'Break down complex topics into simple explanations',
    'TeacherBot',
    ARRAY['learning', 'explanation', 'education'],
    ARRAY['concept', 'field'],
    267, 1100, 'learning', true),

    ('Research Summary',
    'Summarize the key points from this research/article about {topic}:

{content}

Please provide:
1. Main Thesis/Argument
2. Key Evidence
3. Methodology
4. Limitations
5. Implications
6. Critical Analysis',
    'Extract insights from research papers and articles',
    'ResearchPro',
    ARRAY['research', 'analysis', 'summary'],
    ARRAY['topic', 'content'],
    145, 560, 'learning', false),

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
    'StoryWeaver',
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
    'EditPro',
    ARRAY['writing', 'editing', 'improvement'],
    ARRAY['style', 'text', 'improvement1', 'improvement2', 'audience'],
    178, 720, 'creative', false),

    ('Prompt Improver',
    'Improve this AI prompt to get better results:

Original prompt:
{prompt}

Intended use: {use_case}
AI model: {model}

Please:
1. Analyze weaknesses in the original
2. Provide an improved version
3. Explain your improvements',
    'Meta-prompt to improve your other prompts',
    'PromptEngineer',
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
- Establish knowledge scope
- Set appropriate tone
- Handle edge cases',
    'Design effective system prompts for AI assistants',
    'AIArchitect',
    ARRAY['AI', 'system prompts', 'chatbots'],
    ARRAY['type', 'role', 'personality', 'expertise', 'constraints', 'style'],
    167, 680, 'ai', false);
  END IF;
END $$;

-- ===========================================
-- VERIFICATION QUERIES
-- ===========================================

SELECT COUNT(*) as total_library_prompts FROM public.library_prompts;
SELECT DISTINCT category FROM public.library_prompts;
SELECT title, author, likes, downloads FROM public.library_prompts WHERE is_featured = true;
