-- Add moderation columns to prompt_reports if they don't exist
-- Run this in Supabase SQL Editor

-- Add reviewed_at column
ALTER TABLE prompt_reports 
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Add reviewed_by column (references profiles)
ALTER TABLE prompt_reports 
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id);

-- Create index for faster filtering by status
CREATE INDEX IF NOT EXISTS idx_prompt_reports_status ON prompt_reports(status);

-- Create index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_prompt_reports_reviewed_by ON prompt_reports(reviewed_by);

-- Update RLS policy to allow admins to update reports
DROP POLICY IF EXISTS "Admins can update any report" ON prompt_reports;
CREATE POLICY "Admins can update any report" ON prompt_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Allow admins to view all reports
DROP POLICY IF EXISTS "Admins can view all reports" ON prompt_reports;
CREATE POLICY "Admins can view all reports" ON prompt_reports
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Allow admins to update library_prompts (hide/approve)
DROP POLICY IF EXISTS "Admins can update any library prompt" ON library_prompts;
CREATE POLICY "Admins can update any library prompt" ON library_prompts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Allow admins to delete library_prompts
DROP POLICY IF EXISTS "Admins can delete any library prompt" ON library_prompts;
CREATE POLICY "Admins can delete any library prompt" ON library_prompts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Make sure is_admin column exists in profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

COMMENT ON COLUMN prompt_reports.reviewed_at IS 'Timestamp when the report was reviewed by an admin';
COMMENT ON COLUMN prompt_reports.reviewed_by IS 'UUID of the admin who reviewed the report';
COMMENT ON COLUMN profiles.is_admin IS 'Whether the user has admin privileges for moderation';
