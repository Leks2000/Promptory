-- Add image_url column to library_prompts table
-- Run this in Supabase SQL Editor

-- Add image_url column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE public.library_prompts 
  ADD COLUMN IF NOT EXISTS image_url TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Verify column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'library_prompts' AND column_name = 'image_url';

-- Create Storage bucket for library images (run only once)
-- NOTE: This needs to be done via Supabase Dashboard > Storage > Create bucket
-- Bucket name: Lib_img
-- Make it public for easy access

-- Storage policy for Lib_img bucket (authenticated users can upload)
-- Run these in SQL Editor after creating the bucket:

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Lib_img' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access
CREATE POLICY "Public read access for library images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'Lib_img');

-- Allow users to delete their own images
CREATE POLICY "Users can delete own images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'Lib_img' AND auth.uid()::text = (storage.foldername(name))[1]);
