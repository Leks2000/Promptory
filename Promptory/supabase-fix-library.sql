-- Fix library_prompts: set is_approved to true for all existing prompts
-- Run this in Supabase SQL Editor
-- This fixes the issue where library prompts have NULL is_approved and don't show up

-- Step 1: Set is_approved = true for all existing library prompts that are NULL
UPDATE public.library_prompts 
SET is_approved = true 
WHERE is_approved IS NULL;

-- Step 2: Set a default value so future inserts always have is_approved = true
ALTER TABLE public.library_prompts 
ALTER COLUMN is_approved SET DEFAULT true;

-- Step 3: Make is_approved NOT NULL to prevent future NULL values  
ALTER TABLE public.library_prompts 
ALTER COLUMN is_approved SET NOT NULL;

-- Step 4: Verify the fix
SELECT id, title, author, is_approved, image_url 
FROM public.library_prompts 
ORDER BY created_at DESC;

-- Step 5: Verify the storage bucket is public
-- (This needs to be done in Supabase Dashboard > Storage > Lib_img > Settings)
-- Make sure the bucket is set to "Public"

SELECT 'Library prompts fix applied! All prompts now have is_approved=true' as message;
SELECT COUNT(*) as total_approved FROM public.library_prompts WHERE is_approved = true;
