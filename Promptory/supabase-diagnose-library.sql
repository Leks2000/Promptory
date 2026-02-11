-- Promptory Library Diagnostics
-- Run in Supabase SQL editor to check why Library tab may be empty.

-- 1) Table health
SELECT COUNT(*) AS total_rows FROM public.library_prompts;
SELECT COUNT(*) AS rows_with_null_approved FROM public.library_prompts WHERE is_approved IS NULL;
SELECT id, title, author, author_id, is_approved, created_at
FROM public.library_prompts
ORDER BY created_at DESC
LIMIT 20;

-- 2) RLS/policy health
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN ('library_prompts', 'profiles', 'library_likes', 'prompt_reports')
ORDER BY relname;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('library_prompts', 'profiles', 'library_likes', 'prompt_reports')
ORDER BY tablename, cmd, policyname;

-- 3) Recommended minimum policy for library read

-- 3.1) Required table privileges (RLS alone is not enough)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.library_prompts TO authenticated;
GRANT SELECT ON TABLE public.library_likes TO authenticated;
GRANT SELECT ON TABLE public.prompt_reports TO authenticated;
-- (idempotent: safe to run many times)
DROP POLICY IF EXISTS "Authenticated can view library prompts" ON public.library_prompts;
CREATE POLICY "Authenticated can view library prompts" ON public.library_prompts
  FOR SELECT TO authenticated USING (true);

-- 4) Ensure is_approved defaults are sane (some old rows may be NULL)
UPDATE public.library_prompts SET is_approved = true WHERE is_approved IS NULL;
ALTER TABLE public.library_prompts ALTER COLUMN is_approved SET DEFAULT true;

-- 5) Verify helper RPCs used by extension
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('sync_user_on_login', 'share_prompt_to_library')
ORDER BY routine_name;

SELECT 'Diagnostics complete. If Library is still empty: check extension console for "Library load error" text.' AS message;
