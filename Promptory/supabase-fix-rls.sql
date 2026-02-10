-- Promptory RLS FIX Script v2
-- Run this in Supabase SQL Editor to fix ALL permission and data sync issues
-- Fixes: permission denied, library sharing, premium status, profile sync

-- ===========================================
-- STEP 1: Drop ALL existing problematic policies
-- ===========================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can share to library" ON public.library_prompts;
DROP POLICY IF EXISTS "Anyone can view library prompts" ON public.library_prompts;
DROP POLICY IF EXISTS "Authenticated can view library prompts" ON public.library_prompts;

-- ===========================================
-- STEP 2: Create correct profiles policies
-- ===========================================

-- Allow ALL authenticated users to read ANY profile (required for FK lookups and author display)
CREATE POLICY "Authenticated can read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Allow users to update ONLY their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to insert their own profile (id must match auth.uid)
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ===========================================
-- STEP 3: Fix library_prompts policies
-- ===========================================

-- Library prompts visible ONLY to authenticated users
CREATE POLICY "Authenticated can view library prompts" ON public.library_prompts
  FOR SELECT TO authenticated USING (true);

-- Allow any authenticated user to share prompts to library
CREATE POLICY "Users can share to library" ON public.library_prompts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (author_id IS NULL OR author_id = auth.uid())
  );

-- ===========================================
-- STEP 4: Create/update share_prompt_to_library function
-- Now supports image_url parameter
-- Uses SECURITY DEFINER to bypass RLS issues
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
  -- Get current user ID
  user_id := auth.uid();
  
  IF user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Check if user profile exists, create if not
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id) THEN
    INSERT INTO public.profiles (id, email, full_name)
    SELECT user_id, 
           (SELECT email FROM auth.users WHERE id = user_id),
           (SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)) FROM auth.users WHERE id = user_id);
  END IF;
  
  -- Insert into library_prompts with image_url
  INSERT INTO public.library_prompts (
    title, text, description, author, author_id, tags, variables, category, is_approved, image_url
  ) VALUES (
    p_title, p_text, p_description, p_author, user_id, p_tags, p_variables, p_category, true, p_image_url
  )
  RETURNING id INTO new_id;
  
  RETURN json_build_object(
    'success', true, 
    'id', new_id,
    'message', 'Prompt shared successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- STEP 5: Create/update sync_user_on_login function
-- Ensures profile exists and returns correct premium status
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
  
  -- Ensure profile exists (upsert)
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  SELECT 
    user_id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture', '')
  FROM auth.users u
  WHERE u.id = user_id
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();
  
  -- Get updated profile with ACTUAL values from DB
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

-- ===========================================
-- STEP 6: Fix any accounts with wrong prompt_limit
-- Reset non-premium accounts to proper limit of 20
-- ===========================================

UPDATE public.profiles 
SET prompt_limit = 20 
WHERE is_premium = false AND prompt_limit != 20;

-- ===========================================
-- STEP 7: Grant execute permissions
-- ===========================================

GRANT EXECUTE ON FUNCTION share_prompt_to_library(TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT[], TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_user_on_login() TO authenticated;

-- ===========================================
-- VERIFICATION
-- ===========================================

SELECT 'RLS policies and functions updated successfully!' as message;
SELECT id, email, is_premium, prompt_limit FROM public.profiles ORDER BY created_at;
