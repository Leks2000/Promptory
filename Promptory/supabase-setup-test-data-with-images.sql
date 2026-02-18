-- =============================================
-- Promptory - Test Data with Images
-- Тестовые промпты с изображениями
-- =============================================

-- ==================== ВАЖНО ====================
-- Перед запуском:
-- 1. Загрузи изображения в Supabase Storage (бакет: Lib_img)
-- 2. Или используй placeholder URLs (как в этом скрипте)
-- 3. Замени 'alexhalle393@gmail.com' на свою почту

-- ==================== 1. MAKE ADMIN ====================
UPDATE public.profiles
SET is_admin = true
WHERE email = 'alexhalle393@gmail.com';


-- ==================== 2. ADD PROMPTS WITH IMAGES ====================
-- Используем placeholder изображения (для тестирования)

-- Prompt 1: Code Review
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, image_url, created_at)
VALUES (
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
  (SELECT id FROM auth.users WHERE email = 'alexhalle393@gmail.com'),
  ARRAY['code', 'review', 'programming', 'development'],
  'Development',
  42,
  156,
  true,
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=300&fit=crop',  -- Coding image
  NOW() - INTERVAL '5 days'
);

-- Prompt 2: Writing Assistant
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, image_url, created_at)
VALUES (
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
  (SELECT id FROM auth.users WHERE email = 'alexhalle393@gmail.com'),
  ARRAY['writing', 'email', 'business', 'communication'],
  'Writing',
  38,
  203,
  true,
  'https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=400&h=300&fit=crop',  -- Email/writing image
  NOW() - INTERVAL '4 days'
);

-- Prompt 3: Data Analysis
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, image_url, created_at)
VALUES (
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
  (SELECT id FROM auth.users WHERE email = 'alexhalle393@gmail.com'),
  ARRAY['data', 'analysis', 'statistics', 'insights'],
  'Data Science',
  29,
  87,
  true,
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop',  -- Data/chart image
  NOW() - INTERVAL '3 days'
);

-- Prompt 4: Learning & Education
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, image_url, created_at)
VALUES (
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
  (SELECT id FROM auth.users WHERE email = 'alexhalle393@gmail.com'),
  ARRAY['learning', 'education', 'teaching', 'feynman'],
  'Education',
  56,
  312,
  true,
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop',  -- Education image
  NOW() - INTERVAL '2 days'
);

-- Prompt 5: Creative Writing
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, image_url, created_at)
VALUES (
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
  (SELECT id FROM auth.users WHERE email = 'alexhalle393@gmail.com'),
  ARRAY['writing', 'creative', 'storytelling', 'fiction'],
  'Creative',
  44,
  178,
  true,
  'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=300&fit=crop',  -- Writing/notebook image
  NOW() - INTERVAL '1 day'
);

-- Prompt 6: Productivity
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, image_url, created_at)
VALUES (
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
  (SELECT id FROM auth.users WHERE email = 'alexhalle393@gmail.com'),
  ARRAY['productivity', 'planning', 'time-management', 'prioritization'],
  'Productivity',
  67,
  421,
  true,
  'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=400&h=300&fit=crop',  -- Planning image
  NOW() - INTERVAL '12 hours'
);

-- Prompt 7: Health & Fitness
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, image_url, created_at)
VALUES (
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
  (SELECT id FROM auth.users WHERE email = 'alexhalle393@gmail.com'),
  ARRAY['fitness', 'workout', 'health', 'exercise'],
  'Health',
  51,
  267,
  true,
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=300&fit=crop',  -- Fitness/gym image
  NOW() - INTERVAL '6 hours'
);

-- Prompt 8: Marketing
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, image_url, created_at)
VALUES (
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
  (SELECT id FROM auth.users WHERE email = 'alexhalle393@gmail.com'),
  ARRAY['marketing', 'social-media', 'content', 'strategy'],
  'Marketing',
  35,
  189,
  true,
  'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop',  -- Social media image
  NOW()
);


-- ==================== 3. VERIFY ====================
-- Проверить что промпты с изображениями добавлены
SELECT 
  title, 
  category, 
  likes, 
  downloads,
  image_url,
  is_approved
FROM public.library_prompts
WHERE author = 'Promptory Team'
ORDER BY created_at DESC;


-- ==================== 4. ADD MORE TEST PROMPTS (optional) ====================
-- Ещё промптов для теста прокрутки и кнопки "Load More"

-- Prompt 9: Travel
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, image_url, created_at)
VALUES (
  gen_random_uuid(),
  'Travel Itinerary Planner',
  'You are a professional travel agent. Plan a detailed itinerary.

Destination: {{destination}}
Duration: {{days}} days
Budget: {{budget}}
Interests: {{interests}} (culture, food, adventure, relaxation)
Travel style: {{style}} (backpacker, luxury, family, solo)

Include:
1. Day-by-day schedule
2. Recommended accommodations
3. Transportation options
4. Must-see attractions
5. Local tips and customs',
  'Create personalized travel itineraries',
  'Promptory Team',
  (SELECT id FROM auth.users WHERE email = 'alexhalle393@gmail.com'),
  ARRAY['travel', 'planning', 'vacation', 'itinerary'],
  'Travel',
  23,
  145,
  true,
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=300&fit=crop',
  NOW() - INTERVAL '3 hours'
);

-- Prompt 10: Cooking
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, image_url, created_at)
VALUES (
  gen_random_uuid(),
  'Personal Chef Recipe Creator',
  'You are a professional chef. Create custom recipes.

Dietary restrictions: {{restrictions}}
Available ingredients: {{ingredients}}
Cuisine preference: {{cuisine}}
Servings: {{servings}}
Cooking skill: {{skill}} (beginner, intermediate, advanced)

Provide:
1. Ingredient list with measurements
2. Step-by-step instructions
3. Cooking tips and substitutions
4. Nutritional information
5. Plating suggestions',
  'Generate custom recipes based on available ingredients',
  'Promptory Team',
  (SELECT id FROM auth.users WHERE email = 'alexhalle393@gmail.com'),
  ARRAY['cooking', 'recipes', 'food', 'chef'],
  'Food',
  78,
  523,
  true,
  'https://images.unsplash.com/photo-1556910103-1c02745a30bf?w=400&h=300&fit=crop',
  NOW() - INTERVAL '2 hours'
);

-- Prompt 11: Career
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, image_url, created_at)
VALUES (
  gen_random_uuid(),
  'Career Coach & Resume Review',
  'You are an experienced career coach. Help me advance my career.

Services:
1. Resume/CV review and optimization
2. Cover letter writing
3. Interview preparation
4. Salary negotiation strategies
5. Career path planning

My background: {{background}}
Target role: {{role}}
Industry: {{industry}}
Years of experience: {{years}}

Start by asking about my specific goals.',
  'Professional career coaching and resume advice',
  'Promptory Team',
  (SELECT id FROM auth.users WHERE email = 'alexhalle393@gmail.com'),
  ARRAY['career', 'resume', 'interview', 'job'],
  'Career',
  91,
  612,
  true,
  'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=300&fit=crop',
  NOW() - INTERVAL '1 hour'
);

-- Prompt 12: Finance
INSERT INTO public.library_prompts (id, title, text, description, author, author_id, tags, category, likes, downloads, is_approved, image_url, created_at)
VALUES (
  gen_random_uuid(),
  'Personal Finance Advisor',
  'You are a certified financial planner. Provide personalized money advice.

Topics:
1. Budget creation and expense tracking
2. Debt reduction strategies
3. Investment portfolio allocation
4. Retirement planning
5. Tax optimization

My situation:
- Income: {{income}}
- Expenses: {{expenses}}
- Debt: {{debt}}
- Savings: {{savings}}
- Goals: {{goals}}

Provide actionable, step-by-step recommendations.',
  'Smart personal finance and investment advice',
  'Promptory Team',
  (SELECT id FROM auth.users WHERE email = 'alexhalle393@gmail.com'),
  ARRAY['finance', 'money', 'investing', 'budget'],
  'Finance',
  64,
  387,
  true,
  'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&h=300&fit=crop',
  NOW()
);


-- ==================== 5. FINAL STATS ====================
-- Итоговая статистика
SELECT
  COUNT(*) AS total_prompts,
  SUM(likes) AS total_likes,
  SUM(downloads) AS total_downloads,
  COUNT(DISTINCT category) AS categories,
  STRING_AGG(DISTINCT category, ', ') AS category_list
FROM public.library_prompts
WHERE author = 'Promptory Team';


-- =============================================
-- ИНСТРУКЦИЯ:
-- 1. Замени 'alexhalle393@gmail.com' на свою почту
-- 2. Запусти в Supabase SQL Editor
-- 3. Проверь вкладку Explore в расширении
-- =============================================
