-- =============================================
-- Promptory - Supabase Storage Setup
-- Настройка бакета для изображений
-- =============================================

-- ==================== 1. CREATE STORAGE BUCKET ====================
-- Создаём бакет для изображений библиотечных промптов

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'Lib_img',
  'Lib_img',
  true,  -- public bucket для простоты
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;


-- ==================== 2. ENABLE RLS POLICIES ====================
-- Политики доступа для бакета

-- Разрешить всем читать изображения (public bucket)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'Lib_img');

-- Разрешить авторизованным пользователям загружать файлы
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Lib_img');

-- Разрешить пользователям удалять только свои файлы
CREATE POLICY "User Delete Own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'Lib_img' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);


-- ==================== 3. VERIFY BUCKET ====================
-- Проверить что бакет создан
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'Lib_img';


-- =============================================
-- ИНСТРУКЦИЯ ПО ЗАГРУЗКЕ ИЗОБРАЖЕНИЙ:
-- =============================================

-- ВАРИАНТ 1: Через Supabase Dashboard (рекомендуется)
-- 1. Открой https://vofgfvlgchqheksvlibl.supabase.co
-- 2. Перейди в Storage → Lib_img
-- 3. Загрузи изображения (drag & drop)
-- 4. Скопируй public URL для каждого файла
-- 5. Обнови library_prompts.image_url в SQL ниже

-- ВАРИАНТ 2: Программно через extension
-- Extension использует background.js → handleStorageUpload()
-- Изображения сжимаются до 500KB перед загрузкой

-- ВАРИАНТ 3: Через SQL API (для тестовых данных)
-- См. файл: supabase-setup-admin-test-data-with-images.sql


-- =============================================
-- ПРИМЕР: Обновление image_url для промптов
-- =============================================

-- После загрузки изображений обнови промпты:
/*
UPDATE public.library_prompts 
SET image_url = 'https://vofgfvlgchqheksvlibl.supabase.co/storage/v1/object/public/Lib_img/your-image.jpg'
WHERE title = 'Professional Code Review';
*/


-- =============================================
-- ПОЛИТИКИ БЕЗОПАСНОСТИ:
-- =============================================

-- Проверить существующие политики
SELECT tablename, policyname, cmd, roles, qual 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- Если нужно сделать бакет приватным:
/*
UPDATE storage.buckets 
SET public = false 
WHERE id = 'Lib_img';
*/

-- Для приватного бакета нужны signed URLs
-- Extension автоматически генерирует их через background.js
