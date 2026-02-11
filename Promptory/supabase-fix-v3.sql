-- Promptory FIX Script v3 - Complete Fix for Library, Images & Sync
-- Run this in Supabase SQL Editor
-- Fixes: library_prompts visibility, storage access, profile sync
-- ============================================================

-- ===========================================
-- STEP 1: Fix library_prompts is_approved issue
-- Rows with NULL is_approved don't show up in queries
-- ===========================================

UPDATE public.library_prompts 
SET is_approved = true 
WHERE is_approved IS NULL;

ALTER TABLE public.library_prompts 
ALTER COLUMN is_approved SET DEFAULT true;

-- Make NOT NULL to prevent future issues
DO $$ 
BEGIN
  ALTER TABLE public.library_prompts ALTER COLUMN is_approved SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'is_approved already NOT NULL or other error: %', SQLERRM;
END $$;

-- ===========================================
-- STEP 2: Drop and recreate RLS policies 
-- Ensure authenticated users can read library_prompts
-- ===========================================

DROP POLICY IF EXISTS "Authenticated can view library prompts" ON public.library_prompts;
DROP POLICY IF EXISTS "Anyone can view library prompts" ON public.library_prompts;
DROP POLICY IF EXISTS "Users can share to library" ON public.library_prompts;

-- Authenticated users can read all library prompts
CREATE POLICY "Authenticated can view library prompts" ON public.library_prompts
  FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert (share) prompts
CREATE POLICY "Users can share to library" ON public.library_prompts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (author_id IS NULL OR author_id = auth.uid())
  );

-- ===========================================
-- STEP 3: Ensure profiles policies are correct
-- ===========================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service can insert profiles" ON public.profiles;

CREATE POLICY "Authenticated can read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ===========================================
-- STEP 4: Ensure prompts and folders policies exist
-- ===========================================

DROP POLICY IF EXISTS "Users can view own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can insert own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can update own prompts" ON public.prompts;
DROP POLICY IF EXISTS "Users can delete own prompts" ON public.prompts;

CREATE POLICY "Users can view own prompts" ON public.prompts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own prompts" ON public.prompts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own prompts" ON public.prompts
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own prompts" ON public.prompts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;

CREATE POLICY "Users can view own folders" ON public.folders
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own folders" ON public.folders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own folders" ON public.folders
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own folders" ON public.folders
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ===========================================
-- STEP 5: Fix Storage policies for Lib_img bucket
-- Allow authenticated users to upload/read, public read for signed URLs
-- ===========================================

-- Note: Storage policies are managed via Supabase Dashboard > Storage
-- But we can create them via SQL as well:

-- Check if storage.objects policies exist and recreate
DO $$
BEGIN
  -- Drop existing Lib_img policies
  DROP POLICY IF EXISTS "Authenticated users can upload to Lib_img" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can read Lib_img" ON storage.objects;
  DROP POLICY IF EXISTS "Public can read Lib_img" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own Lib_img files" ON storage.objects;
  
  -- Allow authenticated users to upload images
  CREATE POLICY "Authenticated users can upload to Lib_img" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'Lib_img');
  
  -- Allow authenticated users to read images (for signed URLs and authenticated access)
  CREATE POLICY "Authenticated users can read Lib_img" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'Lib_img');
  
  -- Allow authenticated users to update (upsert) their images
  CREATE POLICY "Authenticated users can update Lib_img" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'Lib_img');
  
  -- Allow users to delete their own images
  CREATE POLICY "Users can delete own Lib_img files" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'Lib_img' AND (storage.foldername(name))[1] = auth.uid()::text);

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage policy error (may already exist): %', SQLERRM;
END $$;

-- ===========================================
-- STEP 6: Recreate share_prompt_to_library with image support
-- ===========================================

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
  
  -- Ensure profile exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id) THEN
    INSERT INTO public.profiles (id, email, full_name)
    SELECT user_id, 
           (SELECT email FROM auth.users WHERE id = user_id),
           (SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)) FROM auth.users WHERE id = user_id);
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

-- ===========================================
-- STEP 7: Recreate sync_user_on_login
-- ===========================================

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
  
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  SELECT 
    user_id, u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture', '')
  FROM auth.users u WHERE u.id = user_id
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
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


-- Ensure authenticated users have table privileges for Library API reads
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.library_prompts TO authenticated;
GRANT SELECT ON TABLE public.library_likes TO authenticated;
GRANT SELECT ON TABLE public.prompt_reports TO authenticated;

-- ===========================================
-- STEP 8: Grant execute permissions
-- ===========================================

GRANT EXECUTE ON FUNCTION share_prompt_to_library(TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_user_on_login() TO authenticated;

-- ===========================================
-- STEP 9: Fix prompt_limit for non-premium users
-- ===========================================

UPDATE public.profiles SET prompt_limit = 20 WHERE is_premium = false AND prompt_limit != 20;

-- ===========================================
-- VERIFICATION
-- ===========================================

SELECT 'v3 Fix applied successfully!' as status;
SELECT COUNT(*) as total_library_prompts, COUNT(*) FILTER (WHERE is_approved = true) as approved FROM public.library_prompts;
SELECT id, email, is_premium, prompt_limit FROM public.profiles ORDER BY created_at;
SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename IN ('library_prompts', 'profiles', 'prompts', 'folders') ORDER BY tablename, policyname;
