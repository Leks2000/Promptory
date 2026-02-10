-- Promptory: Add image_url column to prompts and library_prompts
-- Run this in Supabase SQL Editor to add image support

-- Add image_url column to prompts table
ALTER TABLE public.prompts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add image_url column to library_prompts table
ALTER TABLE public.library_prompts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket policy (if bucket Lib_img already exists)
-- Note: You need to create the bucket "Lib_img" in Supabase Dashboard > Storage first

-- Drop existing policies if they exist (to avoid errors)
DROP POLICY IF EXISTS "Users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view images" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage own images" ON storage.objects;

-- Policy to allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'Lib_img'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy to allow public read of all images in Lib_img bucket
CREATE POLICY "Public can view images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'Lib_img');

-- Policy to allow users to update/delete their own images
CREATE POLICY "Users can manage own images" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'Lib_img'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

SELECT 'Image support added successfully!' as message;
