-- Fix: Grant INSERT permission on prompt_reports for authenticated users
-- This resolves the "permission denied" error when submitting reports
-- Run this in Supabase SQL Editor

-- Grant INSERT (in addition to existing SELECT) so users can submit reports
GRANT INSERT ON TABLE public.prompt_reports TO authenticated;

-- Also grant to anon role (in case it's needed for PostgREST routing)
GRANT SELECT ON TABLE public.prompt_reports TO anon;

-- Verify RLS policies exist
DO $$ BEGIN
  -- Ensure "Users can insert reports" policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'prompt_reports' 
    AND policyname = 'Users can insert reports'
  ) THEN
    CREATE POLICY "Users can insert reports" ON public.prompt_reports
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  -- Ensure "Users can view own reports" policy exists  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'prompt_reports' 
    AND policyname = 'Users can view own reports'
  ) THEN
    CREATE POLICY "Users can view own reports" ON public.prompt_reports
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Verify the fix
SELECT grantee, privilege_type 
FROM information_schema.table_privileges 
WHERE table_name = 'prompt_reports' AND table_schema = 'public';
