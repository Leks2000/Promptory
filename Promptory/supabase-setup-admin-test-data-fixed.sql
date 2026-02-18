-- =============================================
-- Promptory - Setup Admin & Test Data (FIXED)
-- Запустить в Supabase SQL Editor
-- =============================================
-- Исправлена ошибка "more than one row returned"
-- Используем LIMIT 1 для всех подзапросов

-- ==================== 1. MAKE YOURSELF ADMIN ====================
-- ЗАМЕНИ 'alexhalle393@gmail.com' НА СВОЮ ПОЧТУ!
UPDATE public.profiles
SET is_admin = true
WHERE email = 'alexhalle393@gmail.com';

-- Проверить
SELECT email, is_admin, is_premium FROM public.profiles WHERE email = 'alexhalle393@gmail.com';


-- ==================== 2. ADD TEST LIBRARY PROMPTS ====================
-- Все INSERT используют LIMIT 1 для избежания дубликатов

-- Prompt 1: Code Review
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, created_at)
SELECT 
  gen_random_uuid(),
  'Professional Code Review',
  'You are an experienced software engineer. Review the following code for:
1. Best practices and design patterns
2. Potential bugs and edge cases
3. Performance optimizations
4. Security vulnerabilities
5. Readability and maintainability

Provide specific, actionable feedback with code examples.',
  'Professional code review prompt for any programming language',
  'Promptory Team',
  u.id,
  ARRAY['code', 'review', 'programming', 'development'],
  'Development',
  42,
  156,
  true,
  NOW() - INTERVAL '5 days'
FROM auth.users u 
WHERE u.email = 'alexhalle393@gmail.com' 
LIMIT 1;

-- Prompt 2: Writing Assistant
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, created_at)
SELECT 
  gen_random_uuid(),
  'Professional Email Writer',
  'You are a professional communication assistant. Help me write clear, concise, and polite business emails.

Guidelines:
- Use professional tone
- Keep it concise but friendly
- Include clear call-to-action
- Proofread for grammar and clarity

Context: {{context}}
Recipient: {{recipient}}
Purpose: {{purpose}}',
  'Generate professional business emails with proper tone and structure',
  'Promptory Team',
  u.id,
  ARRAY['writing', 'email', 'business', 'communication'],
  'Writing',
  38,
  203,
  true,
  NOW() - INTERVAL '4 days'
FROM auth.users u 
WHERE u.email = 'alexhalle393@gmail.com' 
LIMIT 1;

-- Prompt 3: Data Analysis
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, created_at)
SELECT 
  gen_random_uuid(),
  'Data Analysis Expert',
  'You are a senior data analyst. Help me analyze and interpret data.

Please:
1. Identify key patterns and trends
2. Highlight anomalies or outliers
3. Suggest statistical tests if applicable
4. Provide clear visualizations descriptions
5. Draw actionable conclusions

Data: {{data}}
Question: {{question}}',
  'Expert data analysis with insights and recommendations',
  'Promptory Team',
  u.id,
  ARRAY['data', 'analysis', 'statistics', 'insights'],
  'Data Science',
  29,
  87,
  true,
  NOW() - INTERVAL '3 days'
FROM auth.users u 
WHERE u.email = 'alexhalle393@gmail.com' 
LIMIT 1;

-- Prompt 4: Learning & Education
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, created_at)
SELECT 
  gen_random_uuid(),
  'Feynman Learning Technique',
  'You are an expert teacher using the Feynman Technique. Help me understand {{topic}} by:

1. Explaining it in simple terms (like I''m 12)
2. Using analogies and real-world examples
3. Identifying common misconceptions
4. Testing my understanding with questions
5. Breaking down complex concepts into smaller parts

Start by asking me what I already know about this topic.',
  'Learn any topic using the proven Feynman Technique',
  'Promptory Team',
  u.id,
  ARRAY['learning', 'education', 'teaching', 'feynman'],
  'Education',
  56,
  312,
  true,
  NOW() - INTERVAL '2 days'
FROM auth.users u 
WHERE u.email = 'alexhalle393@gmail.com' 
LIMIT 1;

-- Prompt 5: Creative Writing
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, created_at)
SELECT 
  gen_random_uuid(),
  'Storytelling Master',
  'You are a master storyteller. Help me craft compelling narratives.

Story elements to consider:
- Character development and motivations
- Plot structure (setup, confrontation, resolution)
- Setting and atmosphere
- Conflict and tension
- Theme and message

Genre: {{genre}}
Main character: {{character}}
Setting: {{setting}}
Conflict: {{conflict}}

Start by asking me questions to develop the story.',
  'Create engaging stories with strong characters and plots',
  'Promptory Team',
  u.id,
  ARRAY['writing', 'creative', 'storytelling', 'fiction'],
  'Creative',
  44,
  178,
  true,
  NOW() - INTERVAL '1 day'
FROM auth.users u 
WHERE u.email = 'alexhalle393@gmail.com' 
LIMIT 1;

-- Prompt 6: Productivity
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, created_at)
SELECT 
  gen_random_uuid(),
  'Task Prioritization Matrix',
  'You are a productivity coach. Help me prioritize my tasks using the Eisenhower Matrix.

Categorize each task:
1. Urgent & Important (Do first)
2. Important, Not Urgent (Schedule)
3. Urgent, Not Important (Delegate)
4. Not Urgent & Not Important (Eliminate)

My tasks: {{tasks}}
My goals: {{goals}}
Deadline: {{deadline}}

Provide specific recommendations and time-blocking suggestions.',
  'Prioritize tasks effectively using proven frameworks',
  'Promptory Team',
  u.id,
  ARRAY['productivity', 'planning', 'time-management', 'prioritization'],
  'Productivity',
  67,
  421,
  true,
  NOW() - INTERVAL '12 hours'
FROM auth.users u 
WHERE u.email = 'alexhalle393@gmail.com' 
LIMIT 1;

-- Prompt 7: Health & Fitness
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, created_at)
SELECT 
  gen_random_uuid(),
  'Personal Workout Planner',
  'You are a certified personal trainer. Create a customized workout plan.

Consider:
- Fitness level: {{level}}
- Goals: {{goals}} (weight loss, muscle gain, endurance)
- Available equipment: {{equipment}}
- Time available: {{time}} days/week
- Any injuries/limitations: {{limitations}}

Provide:
1. Warm-up routine
2. Main workout with sets/reps
3. Cool-down stretches
4. Progression plan',
  'Customized workout plans for any fitness level',
  'Promptory Team',
  u.id,
  ARRAY['fitness', 'workout', 'health', 'exercise'],
  'Health',
  51,
  267,
  true,
  NOW() - INTERVAL '6 hours'
FROM auth.users u 
WHERE u.email = 'alexhalle393@gmail.com' 
LIMIT 1;

-- Prompt 8: Marketing
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, created_at)
SELECT 
  gen_random_uuid(),
  'Social Media Content Calendar',
  'You are a social media marketing expert. Create a content calendar.

Platform: {{platform}} (Instagram, Twitter, LinkedIn, etc.)
Target audience: {{audience}}
Brand voice: {{voice}}
Goals: {{goals}}
Duration: {{duration}} weeks

For each post include:
- Content type (image, video, text, poll)
- Caption/copy
- Hashtags
- Best posting time
- Engagement strategy',
  'Plan engaging social media content strategically',
  'Promptory Team',
  u.id,
  ARRAY['marketing', 'social-media', 'content', 'strategy'],
  'Marketing',
  35,
  189,
  true,
  NOW()
FROM auth.users u 
WHERE u.email = 'alexhalle393@gmail.com' 
LIMIT 1;


-- ==================== 3. VERIFY INSERTS ====================
-- Проверить что промпты добавлены
SELECT 
  title, 
  author, 
  category, 
  likes, 
  downloads,
  is_approved,
  created_at
FROM public.library_prompts
WHERE author = 'Promptory Team'
ORDER BY created_at DESC;


-- ==================== 4. ADD TEST REPORTS ====================
-- Используем CTE для получения ID промптов

WITH user_cte AS (
  SELECT id FROM auth.users WHERE email = 'alexhalle393@gmail.com' LIMIT 1
),
prompt1 AS (
  SELECT id FROM public.library_prompts WHERE title = 'Professional Code Review' LIMIT 1
),
prompt2 AS (
  SELECT id FROM public.library_prompts WHERE title = 'Professional Email Writer' LIMIT 1
)
INSERT INTO public.prompt_reports (id, user_id, prompt_id, reason, details, status, created_at)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM user_cte),
  (SELECT id FROM prompt1),
  'Low Quality',
  'This prompt could be more specific about programming languages',
  'pending',
  NOW()
WHERE EXISTS (SELECT 1 FROM user_cte) AND EXISTS (SELECT 1 FROM prompt1);

WITH user_cte AS (
  SELECT id FROM auth.users WHERE email = 'alexhalle393@gmail.com' LIMIT 1
),
prompt2 AS (
  SELECT id FROM public.library_prompts WHERE title = 'Professional Email Writer' LIMIT 1
)
INSERT INTO public.prompt_reports (id, user_id, prompt_id, reason, details, status, created_at)
SELECT 
  gen_random_uuid(),
  (SELECT id FROM user_cte),
  (SELECT id FROM prompt2),
  'Spam',
  'Testing moderation panel',
  'reviewed',
  NOW() - INTERVAL '1 day'
WHERE EXISTS (SELECT 1 FROM user_cte) AND EXISTS (SELECT 1 FROM prompt2);


-- ==================== 5. VIEW MODERATION QUEUE ====================
-- Показать все pending репорты
SELECT
  r.id AS report_id,
  r.reason,
  r.status,
  lp.title AS prompt_title,
  lp.author AS prompt_author,
  r.created_at AS reported_at
FROM public.prompt_reports r
JOIN public.library_prompts lp ON lp.id = r.prompt_id
WHERE r.status = 'pending'
ORDER BY r.created_at DESC;


-- ==================== 6. STATS ====================
-- Общая статистика
SELECT
  COUNT(*) AS total_library_prompts,
  SUM(likes) AS total_likes,
  SUM(downloads) AS total_downloads,
  COUNT(*) FILTER (WHERE is_approved = true) AS approved_prompts,
  COUNT(*) FILTER (WHERE is_approved = false) AS hidden_prompts
FROM public.library_prompts;

-- Статистика по репортам
SELECT
  COUNT(*) AS total_reports,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_reports,
  COUNT(*) FILTER (WHERE status = 'reviewed') AS reviewed_reports,
  COUNT(*) FILTER (WHERE status = 'actioned') AS actioned_reports,
  COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed_reports
FROM public.prompt_reports;


-- =============================================
-- ИНСТРУКЦИЯ:
-- 1. Замени 'alexhalle393@gmail.com' на свою почту
-- 2. Запусти в Supabase SQL Editor
-- 3. Проверь результаты через SELECT запросы
-- 4. В расширении открой Settings → прокрути вниз → нажми "Load Dashboard"
-- =============================================
