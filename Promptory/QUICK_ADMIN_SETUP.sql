-- =============================================
-- Promptory - БЫСТРАЯ НАСТРОЙКА АДМИНА
-- =============================================
-- Запустить в Supabase SQL Editor
-- ЗАМЕНИ email на свой если нужно!

-- 1. СДЕЛАТЬ ТЕБЯ АДМИНОМ
UPDATE public.profiles
SET is_admin = true
WHERE email = 'alexhalle393@gmail.com';

-- 2. ПРОВЕРИТЬ
SELECT email, is_admin, is_premium, created_at 
FROM public.profiles 
WHERE email = 'alexhalle393@gmail.com';

-- 3. ДОБАВИТЬ ТЕСТОВЫЕ ПРОМПТЫ (исправлено - с LIMIT 1)
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, created_at)
SELECT 
  gen_random_uuid(),
  'Professional Code Review',
  'You are an experienced software engineer. Review the code for best practices, bugs, performance, security, and readability.',
  'Professional code review prompt',
  'Promptory Team',
  u.id,
  ARRAY['code', 'review', 'programming'],
  'Development',
  42,
  156,
  true,
  NOW() - INTERVAL '5 days'
FROM auth.users u 
WHERE u.email = 'alexhalle393@gmail.com' 
LIMIT 1;

INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, created_at)
SELECT 
  gen_random_uuid(),
  'Professional Email Writer',
  'You are a professional communication assistant. Help me write clear, concise, and polite business emails.',
  'Generate professional business emails',
  'Promptory Team',
  u.id,
  ARRAY['writing', 'email', 'business'],
  'Writing',
  38,
  203,
  true,
  NOW() - INTERVAL '4 days'
FROM auth.users u 
WHERE u.email = 'alexhalle393@gmail.com' 
LIMIT 1;

INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, created_at)
SELECT 
  gen_random_uuid(),
  'Data Analysis Expert',
  'You are a senior data analyst. Help me analyze and interpret data with insights and recommendations.',
  'Expert data analysis',
  'Promptory Team',
  u.id,
  ARRAY['data', 'analysis', 'statistics'],
  'Data Science',
  29,
  87,
  true,
  NOW() - INTERVAL '3 days'
FROM auth.users u 
WHERE u.email = 'alexhalle393@gmail.com' 
LIMIT 1;

-- 4. ПРОВЕРИТЬ ПРОМПТЫ
SELECT title, category, likes, downloads, is_approved 
FROM public.library_prompts 
WHERE author = 'Promptory Team'
ORDER BY created_at DESC;

-- 5. ДОБАВИТЬ ТЕСТОВЫЙ РЕПОРТ
INSERT INTO public.prompt_reports (id, user_id, prompt_id, reason, details, status, created_at)
SELECT 
  gen_random_uuid(),
  u.id,
  lp.id,
  'Low Quality',
  'Testing moderation',
  'pending',
  NOW()
FROM auth.users u
CROSS JOIN LATERAL (
  SELECT id FROM public.library_prompts 
  WHERE title = 'Professional Code Review' 
  LIMIT 1
) lp
WHERE u.email = 'alexhalle393@gmail.com' 
LIMIT 1;

-- 6. ПРОВЕРИТЬ РЕПОРТЫ
SELECT r.reason, r.status, lp.title 
FROM public.prompt_reports r
JOIN public.library_prompts lp ON lp.id = r.prompt_id
ORDER BY r.created_at DESC;

-- =============================================
-- ГОТОВО! Теперь открой Settings в расширении
-- =============================================
