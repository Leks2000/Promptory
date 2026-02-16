-- =============================================
-- Promptory Admin Moderation Queries
-- Run these in Supabase SQL Editor
-- =============================================

-- ==================== 1. VIEW ALL PENDING REPORTS ====================
-- Shows all pending reports with full details about the reported prompt
SELECT 
  r.id AS report_id,
  r.reason,
  r.details AS report_details,
  r.status AS report_status,
  r.created_at AS reported_at,
  -- Reporter info
  reporter.email AS reporter_email,
  -- Reported prompt info
  lp.id AS library_prompt_id,
  lp.title AS prompt_title,
  lp.text AS prompt_text,
  lp.description AS prompt_description,
  lp.author AS prompt_author,
  lp.author_id,
  lp.tags AS prompt_tags,
  lp.likes,
  lp.downloads,
  lp.is_approved,
  lp.created_at AS prompt_created_at
FROM public.prompt_reports r
JOIN public.profiles reporter ON reporter.id = r.user_id
JOIN public.library_prompts lp ON lp.id = r.prompt_id
WHERE r.status = 'pending'
ORDER BY r.created_at DESC;


-- ==================== 2. VIEW ALL REPORTS (any status) ====================
SELECT 
  r.id AS report_id,
  r.reason,
  r.details,
  r.status,
  r.created_at AS reported_at,
  reporter.email AS reporter_email,
  lp.title AS prompt_title,
  lp.author AS prompt_author,
  lp.is_approved
FROM public.prompt_reports r
JOIN public.profiles reporter ON reporter.id = r.user_id
JOIN public.library_prompts lp ON lp.id = r.prompt_id
ORDER BY 
  CASE r.status WHEN 'pending' THEN 0 WHEN 'reviewed' THEN 1 WHEN 'actioned' THEN 2 ELSE 3 END,
  r.created_at DESC;


-- ==================== 3. MARK REPORT AS REVIEWED (no action needed) ====================
-- Replace 'REPORT_UUID_HERE' with the actual report ID
UPDATE public.prompt_reports 
SET status = 'dismissed' 
WHERE id = 'REPORT_UUID_HERE';


-- ==================== 4. MARK REPORT AS ACTIONED & HIDE PROMPT ====================
-- Step 1: Update report status
UPDATE public.prompt_reports 
SET status = 'actioned' 
WHERE id = 'REPORT_UUID_HERE';

-- Step 2: Hide the prompt from library (soft delete — set is_approved = false)
UPDATE public.library_prompts 
SET is_approved = false 
WHERE id = 'LIBRARY_PROMPT_UUID_HERE';


-- ==================== 5. PERMANENTLY DELETE A LIBRARY PROMPT ====================
-- WARNING: This will also delete all related likes and reports (CASCADE)
-- Only use for clearly illegal/spam content
DELETE FROM public.library_prompts 
WHERE id = 'LIBRARY_PROMPT_UUID_HERE';


-- ==================== 6. FIND A SPECIFIC PROMPT IN LIBRARY ====================
-- Search by title (partial match)
SELECT id, title, text, author, author_id, tags, likes, downloads, is_approved, created_at
FROM public.library_prompts
WHERE title ILIKE '%SEARCH_TERM%'
ORDER BY created_at DESC;

-- Search by author
SELECT id, title, text, author, author_id, tags, likes, downloads, is_approved, created_at
FROM public.library_prompts
WHERE author ILIKE '%AUTHOR_NAME%'
ORDER BY created_at DESC;


-- ==================== 7. VIEW REPORTS STATS DASHBOARD ====================
SELECT 
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_reports,
  COUNT(*) FILTER (WHERE status = 'reviewed') AS reviewed_reports,
  COUNT(*) FILTER (WHERE status = 'actioned') AS actioned_reports,
  COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed_reports,
  COUNT(*) AS total_reports
FROM public.prompt_reports;


-- ==================== 8. MOST REPORTED PROMPTS (priority queue) ====================
SELECT 
  lp.id,
  lp.title,
  lp.author,
  lp.is_approved,
  COUNT(r.id) AS report_count,
  STRING_AGG(DISTINCT r.reason, ', ') AS reasons,
  MIN(r.created_at) AS first_reported
FROM public.library_prompts lp
JOIN public.prompt_reports r ON r.prompt_id = lp.id
WHERE r.status = 'pending'
GROUP BY lp.id, lp.title, lp.author, lp.is_approved
ORDER BY report_count DESC;


-- ==================== 9. BAN/HIDE ALL PROMPTS FROM A SPECIFIC AUTHOR ====================
-- Replace 'AUTHOR_UUID_HERE' with the author's user ID
UPDATE public.library_prompts 
SET is_approved = false 
WHERE author_id = 'AUTHOR_UUID_HERE';

-- Also action all pending reports for this author's prompts
UPDATE public.prompt_reports 
SET status = 'actioned' 
WHERE prompt_id IN (
  SELECT id FROM public.library_prompts WHERE author_id = 'AUTHOR_UUID_HERE'
) AND status = 'pending';


-- ==================== 10. MAKE YOURSELF ADMIN ====================
-- Replace 'YOUR_USER_UUID' with your actual Supabase auth.users id
-- You can find it in Authentication > Users in Supabase dashboard
UPDATE public.profiles 
SET is_admin = true 
WHERE id = 'YOUR_USER_UUID';

-- Or by email:
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'your_email@gmail.com';


-- ==================== 11. VIEW ALL USERS ====================
SELECT 
  id, email, full_name, is_admin, is_premium, prompt_limit, created_at
FROM public.profiles
ORDER BY created_at DESC;


-- ==================== 12. GRANT PREMIUM TO A USER ====================
UPDATE public.profiles 
SET is_premium = true, prompt_limit = 9999 
WHERE email = 'user_email@gmail.com';


-- ==================== 13. REVOKE PREMIUM FROM A USER ====================
UPDATE public.profiles 
SET is_premium = false, prompt_limit = 20 
WHERE email = 'user_email@gmail.com';


-- ==================== 14. VIEW LEMON WEBHOOKS (subscription events) ====================
SELECT 
  id, event_type, user_email, 
  payload->>'subscription' AS subscription_data,
  created_at
FROM public.lemon_webhooks
ORDER BY created_at DESC
LIMIT 50;
