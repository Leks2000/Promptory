-- ================================================================
-- PROMPTORY MASTER FIX SCRIPT v4.0
-- ================================================================
-- Run this ONCE in Supabase SQL Editor to fix ALL issues:
--   1. Permission denied on prompts, folders, hotkeys, reports
--   2. Sync not working (profile not created, FK violations)
--   3. Library prompts not loading (RLS, is_approved NULL)
--   4. Report submission failing
--   5. Storage (Lib_img) access
--   6. All RPC functions (sync_user_on_login, share_prompt_to_library, etc.)
--   7. Proper GRANT statements for PostgREST
-- ================================================================
-- SAFE TO RUN MULTIPLE TIMES (idempotent)
-- ================================================================

BEGIN;

-- ============================================================
-- PART 1: ENSURE ALL TABLES EXIST WITH CORRECT SCHEMA
-- ============================================================

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

CREATE TABLE IF NOT EXISTS public.folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  is_approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.library_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  prompt_id UUID REFERENCES public.library_prompts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, prompt_id)
);

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

CREATE TABLE IF NOT EXISTS public.usage_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  prompt_id UUID NOT NULL,
  prompt_title TEXT,
  platform TEXT,
  action TEXT DEFAULT 'insert',
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Add any missing columns safely
DO $$ BEGIN
  ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS image_url TEXT;
  ALTER TABLE public.library_prompts ADD COLUMN IF NOT EXISTS image_url TEXT;
  ALTER TABLE public.library_prompts ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  ALTER TABLE public.library_prompts ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS prompt_limit INTEGER DEFAULT 20;
  ALTER TABLE public.usage_history ADD COLUMN IF NOT EXISTS prompt_title TEXT;
  ALTER TABLE public.usage_history ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'insert';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Fix NULL is_approved values
UPDATE public.library_prompts SET is_approved = true WHERE is_approved IS NULL;

-- Fix wrong prompt_limit for non-premium users
UPDATE public.profiles SET prompt_limit = 20 WHERE is_premium = false AND (prompt_limit IS NULL OR prompt_limit != 20);

-- ============================================================
-- PART 2: ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotkey_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_reports ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 3: DROP ALL EXISTING POLICIES (clean slate)
-- ============================================================

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service can insert profiles" ON public.profiles;

-- folders
DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;

-- prompts
DROP POLICY IF EXISTS "Users can view own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can insert own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can update own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can delete own prompts" ON public.prompts;

-- library_prompts
DROP POLICY IF EXISTS "Anyone can view library prompts" ON public.library_prompts;
DROP POLICY IF EXISTS "Authenticated can view library prompts" ON public.library_prompts;
DROP POLICY IF EXISTS "Users can share to library" ON public.library_prompts;
DROP POLICY IF EXISTS "Admins can insert library prompts" ON public.library_prompts;
DROP POLICY IF EXISTS "Admins can update library prompts" ON public.library_prompts;
DROP POLICY IF EXISTS "Admins can delete library prompts" ON public.library_prompts;
DROP POLICY IF EXISTS "Authors can delete own library prompts" ON public.library_prompts;

-- library_likes
DROP POLICY IF EXISTS "Users can view own likes" ON public.library_likes;
DROP POLICY IF EXISTS "Users can insert own likes" ON public.library_likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON public.library_likes;

-- hotkey_settings
DROP POLICY IF EXISTS "Users can view own hotkeys" ON public.hotkey_settings;
DROP POLICY IF EXISTS "Users can manage own hotkeys" ON public.hotkey_settings;

-- usage_history
DROP POLICY IF EXISTS "Users can view own usage" ON public.usage_history;
DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage_history;

-- prompt_reports
DROP POLICY IF EXISTS "Users can view own reports" ON public.prompt_reports;
DROP POLICY IF EXISTS "Users can insert reports" ON public.prompt_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON public.prompt_reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.prompt_reports;

-- ============================================================
-- PART 4: CREATE ALL RLS POLICIES
-- ============================================================

-- ---- profiles ----
CREATE POLICY "Authenticated can read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---- folders ----
CREATE POLICY "Users can view own folders" ON public.folders
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own folders" ON public.folders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own folders" ON public.folders
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own folders" ON public.folders
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---- prompts ----
CREATE POLICY "Users can view own prompts" ON public.prompts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own prompts" ON public.prompts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own prompts" ON public.prompts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own prompts" ON public.prompts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---- library_prompts ----
CREATE POLICY "Authenticated can view library prompts" ON public.library_prompts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can share to library" ON public.library_prompts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (author_id IS NULL OR author_id = auth.uid()));

CREATE POLICY "Admins can update library prompts" ON public.library_prompts
  FOR UPDATE TO authenticated USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Authors can delete own library prompts" ON public.library_prompts
  FOR DELETE TO authenticated USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ---- library_likes ----
CREATE POLICY "Users can view own likes" ON public.library_likes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own likes" ON public.library_likes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own likes" ON public.library_likes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---- hotkey_settings ----
CREATE POLICY "Users can view own hotkeys" ON public.hotkey_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can manage own hotkeys" ON public.hotkey_settings
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- ---- usage_history ----
CREATE POLICY "Users can view own usage" ON public.usage_history
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own usage" ON public.usage_history
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ---- prompt_reports ----
CREATE POLICY "Users can view own reports" ON public.prompt_reports
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert reports" ON public.prompt_reports
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all reports" ON public.prompt_reports
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update reports" ON public.prompt_reports
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================================
-- PART 5: TABLE GRANTS FOR POSTGREST
-- (RLS alone is NOT enough - PostgREST needs explicit table grants)
-- ============================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- profiles: SELECT for all authenticated, INSERT/UPDATE for own
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- folders: full CRUD for authenticated (RLS restricts to own data)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.folders TO authenticated;

-- prompts: full CRUD for authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.prompts TO authenticated;

-- library_prompts: SELECT + INSERT for authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.library_prompts TO authenticated;

-- library_likes: SELECT + INSERT + DELETE for authenticated
GRANT SELECT, INSERT, DELETE ON TABLE public.library_likes TO authenticated;

-- hotkey_settings: full CRUD for authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hotkey_settings TO authenticated;

-- usage_history: SELECT + INSERT for authenticated
GRANT SELECT, INSERT ON TABLE public.usage_history TO authenticated;

-- prompt_reports: SELECT + INSERT for authenticated, UPDATE for admins (via RLS)
GRANT SELECT, INSERT, UPDATE ON TABLE public.prompt_reports TO authenticated;

-- anon needs SELECT on library for any public access (optional, not used by extension)
GRANT SELECT ON TABLE public.library_prompts TO anon;

-- ============================================================
-- PART 6: INDEXES
-- ============================================================

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

-- ============================================================
-- PART 7: TRIGGERS
-- ============================================================

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO NOTHING; -- Don't fail if profile already exists
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PART 8: RPC FUNCTIONS (all SECURITY DEFINER)
-- ============================================================

-- 8.1: sync_user_on_login - ensures profile exists, returns premium status
CREATE OR REPLACE FUNCTION sync_user_on_login()
RETURNS JSON AS $$
DECLARE
  user_id UUID;
  user_profile public.profiles%ROWTYPE;
BEGIN
  user_id := auth.uid();
  
  IF user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Upsert profile (create if not exists, update metadata if exists)
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  SELECT 
    user_id, u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture', '')
  FROM auth.users u WHERE u.id = user_id
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), public.profiles.avatar_url),
    updated_at = NOW();
  
  SELECT * INTO user_profile FROM public.profiles WHERE id = user_id;
  
  RETURN json_build_object(
    'success', true,
    'user_id', user_id,
    'is_premium', COALESCE(user_profile.is_premium, false),
    'prompt_limit', COALESCE(user_profile.prompt_limit, 20),
    'email', user_profile.email,
    'full_name', user_profile.full_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8.2: share_prompt_to_library - bypasses RLS issues with SECURITY DEFINER
DROP FUNCTION IF EXISTS share_prompt_to_library(TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT);
DROP FUNCTION IF EXISTS share_prompt_to_library(TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT);

CREATE OR REPLACE FUNCTION share_prompt_to_library(
  p_title TEXT,
  p_text TEXT,
  p_description TEXT,
  p_author TEXT,
  p_tags TEXT[],
  p_variables TEXT[],
  p_category TEXT,
  p_image_url TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  new_id UUID;
  user_id UUID;
BEGIN
  user_id := auth.uid();
  
  IF user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Ensure profile exists (handles edge case where trigger didn't fire)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id) THEN
    INSERT INTO public.profiles (id, email, full_name)
    SELECT user_id, 
           (SELECT email FROM auth.users WHERE id = user_id),
           (SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)) FROM auth.users WHERE id = user_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  INSERT INTO public.library_prompts (
    title, text, description, author, author_id, tags, variables, category, is_approved, image_url
  ) VALUES (
    p_title, p_text, p_description, p_author, user_id, p_tags, p_variables, p_category, true, p_image_url
  )
  RETURNING id INTO new_id;
  
  RETURN json_build_object('success', true, 'id', new_id, 'message', 'Prompt shared successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8.3: toggle_library_like
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
  
  RETURN json_build_object('liked', liked, 'likes', COALESCE(new_likes, 0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8.4: increment_download_count
CREATE OR REPLACE FUNCTION increment_download_count(prompt_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.library_prompts SET downloads = downloads + 1 WHERE id = prompt_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8.5: record_usage
CREATE OR REPLACE FUNCTION record_usage(p_prompt_id UUID, p_prompt_title TEXT, p_platform TEXT, p_action TEXT DEFAULT 'insert')
RETURNS void AS $$
BEGIN
  -- Ensure profile exists before inserting usage
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
    INSERT INTO public.profiles (id, email, full_name)
    SELECT auth.uid(), 
           (SELECT email FROM auth.users WHERE id = auth.uid()),
           (SELECT COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)) FROM auth.users WHERE id = auth.uid())
    ON CONFLICT (id) DO NOTHING;
  END IF;

  INSERT INTO public.usage_history (user_id, prompt_id, prompt_title, platform, action)
  VALUES (auth.uid(), p_prompt_id, p_prompt_title, p_platform, p_action);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8.6: get_usage_stats
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
        GROUP BY DATE(used_at) ORDER BY date DESC
      ) d
    ),
    'top_prompts', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT prompt_title as title, COUNT(*) as uses
        FROM public.usage_history 
        WHERE user_id = auth.uid() AND used_at >= NOW() - (days_back || ' days')::INTERVAL AND prompt_title IS NOT NULL
        GROUP BY prompt_title ORDER BY uses DESC LIMIT 10
      ) t
    ),
    'by_platform', (
      SELECT COALESCE(json_agg(row_to_json(p)), '[]'::json)
      FROM (
        SELECT COALESCE(platform, 'unknown') as platform, COUNT(*) as count
        FROM public.usage_history 
        WHERE user_id = auth.uid() AND used_at >= NOW() - (days_back || ' days')::INTERVAL
        GROUP BY platform ORDER BY count DESC
      ) p
    )
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8.7: check_prompt_limit
CREATE OR REPLACE FUNCTION check_prompt_limit()
RETURNS JSON AS $$
DECLARE
  user_profile public.profiles%ROWTYPE;
  prompt_count INTEGER;
BEGIN
  SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();
  SELECT COUNT(*) INTO prompt_count FROM public.prompts WHERE user_id = auth.uid();
  
  RETURN json_build_object(
    'can_create', COALESCE(user_profile.is_premium, false) OR prompt_count < COALESCE(user_profile.prompt_limit, 20),
    'current_count', prompt_count,
    'limit', COALESCE(user_profile.prompt_limit, 20),
    'is_premium', COALESCE(user_profile.is_premium, false)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 9: GRANT EXECUTE ON ALL RPC FUNCTIONS
-- ============================================================

GRANT EXECUTE ON FUNCTION sync_user_on_login() TO authenticated;
GRANT EXECUTE ON FUNCTION share_prompt_to_library(TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_library_like(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_download_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_usage(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_usage_stats(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_prompt_limit() TO authenticated;

-- ============================================================
-- PART 10: STORAGE POLICIES FOR Lib_img BUCKET
-- ============================================================

DO $$
BEGIN
  -- Drop existing policies (safe if they don't exist)
  DROP POLICY IF EXISTS "Authenticated users can upload to Lib_img" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can read Lib_img" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update Lib_img" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own Lib_img files" ON storage.objects;
  DROP POLICY IF EXISTS "Public read access for library images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
  
  -- Upload: any authenticated user can upload to Lib_img
  CREATE POLICY "Authenticated users can upload to Lib_img" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'Lib_img');
  
  -- Read: any authenticated user can read from Lib_img
  CREATE POLICY "Authenticated users can read Lib_img" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'Lib_img');
  
  -- Update: any authenticated user can upsert in Lib_img
  CREATE POLICY "Authenticated users can update Lib_img" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'Lib_img');
  
  -- Delete: only own files (folder = user_id)
  CREATE POLICY "Users can delete own Lib_img files" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'Lib_img' AND (storage.foldername(name))[1] = auth.uid()::text);

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage policy warning (bucket may not exist yet): %', SQLERRM;
  RAISE NOTICE 'Create the Lib_img bucket in Supabase Dashboard > Storage first, then re-run this section.';
END $$;

-- ============================================================
-- PART 11: SEED DATA (only if library is empty)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.library_prompts LIMIT 1) THEN
    INSERT INTO public.library_prompts (title, text, description, author, tags, variables, likes, downloads, category, is_featured, is_approved) VALUES

    ('Professional Email Writer', 
    'Write a professional email about {topic} to {recipient}. The tone should be {tone}.\n\nRequirements:\n- Start with an appropriate greeting\n- Be clear and concise\n- State the purpose in the first paragraph\n- Include a clear call to action\n- End with a professional sign-off\n\nAdditional context: {context}',
    'Craft professional emails for any business situation', 
    'PromptMaster',
    ARRAY['business', 'communication', 'email'], 
    ARRAY['topic', 'recipient', 'tone', 'context'],
    245, 1200, 'business', true, true),

    ('Code Review Assistant',
    'Review the following code and provide constructive feedback:\n\n```{language}\n{code}\n```\n\nPlease analyze:\n1. Code Quality\n2. Best Practices\n3. Potential Bugs\n4. Performance\n5. Security\n6. Suggestions with examples',
    'Get thorough code reviews with actionable feedback',
    'DevGuru',
    ARRAY['coding', 'review', 'development'],
    ARRAY['language', 'code'],
    189, 950, 'development', true, true),

    ('Explain Like I''m 5',
    'Explain {concept} in simple terms that a 5-year-old could understand.\n\nUse:\n- Simple words and short sentences\n- Relatable analogies and examples\n- A friendly, encouraging tone\n- Visual descriptions when helpful\n\nThen provide a slightly more detailed explanation for someone with basic knowledge of {field}.',
    'Break down complex topics into simple explanations',
    'TeacherBot',
    ARRAY['learning', 'explanation', 'education'],
    ARRAY['concept', 'field'],
    267, 1100, 'learning', true, true),

    ('Prompt Improver',
    'Improve this AI prompt to get better results:\n\nOriginal prompt:\n{prompt}\n\nIntended use: {use_case}\nAI model: {model}\n\nPlease:\n1. Analyze weaknesses in the original\n2. Provide an improved version\n3. Explain your improvements',
    'Meta-prompt to improve your other prompts',
    'PromptEngineer',
    ARRAY['prompts', 'AI', 'optimization'],
    ARRAY['prompt', 'use_case', 'model'],
    289, 1350, 'ai', true, true);
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFICATION (run after COMMIT)
-- ============================================================

SELECT '=== MASTER FIX v4.0 APPLIED SUCCESSFULLY ===' AS status;

SELECT 'Tables' AS check_type, COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('profiles', 'folders', 'prompts', 'library_prompts', 'library_likes', 'hotkey_settings', 'usage_history', 'prompt_reports');

SELECT 'RLS Policies' AS check_type, COUNT(*) AS count FROM pg_policies WHERE schemaname = 'public';

SELECT 'RPC Functions' AS check_type, COUNT(*) AS count FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('sync_user_on_login', 'share_prompt_to_library', 'toggle_library_like', 'increment_download_count', 'record_usage', 'get_usage_stats', 'check_prompt_limit', 'handle_new_user');

SELECT 'Library Prompts' AS check_type, COUNT(*) AS count FROM public.library_prompts WHERE is_approved = true;

SELECT 'Profiles' AS check_type, COUNT(*) AS count FROM public.profiles;
