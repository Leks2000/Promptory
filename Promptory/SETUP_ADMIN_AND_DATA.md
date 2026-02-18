# 🚀 Promptory - Настройка Админки и Тестовых Данных

## 📋 ЧТО БЫЛО СДЕЛАНО

### ✅ Исправления
1. **Прокрутка в библиотеке (Explore)** — работает
2. **Поиск переключает на Prompts** — автоматически
3. **Кнопка "Load More"** — сохранена и работает

### ✅ Новые файлы
1. `supabase-setup-admin-test-data.sql` — админ + тестовые промпты
2. `supabase-setup-test-data-with-images.sql` — промпты с изображениями
3. `supabase-storage-setup.sql` — настройка бакета для изображений

---

## 🔧 ИНСТРУКЦИЯ ПО НАСТРОЙКЕ

### Шаг 1: Сделать себя админом

**Вариант A: Быстрый (только админка)**
```sql
-- Замени email на свой!
UPDATE public.profiles
SET is_admin = true
WHERE email = 'your_email@gmail.com';
```

**Вариант B: Полный (админ + тестовые данные)**
```bash
# 1. Открой Supabase Dashboard
https://vofgfvlgchqheksvlibl.supabase.co

# 2. Перейди в SQL Editor

# 3. Запусти файл:
supabase-setup-admin-test-data.sql

# 4. НЕ ЗАБУДЬ заменить 'your_email@gmail.com' на свой email!
```

---

### Шаг 2: Добавить тестовые промпты

**С изображениями (рекомендуется):**
```bash
# Запусти в SQL Editor:
supabase-setup-test-data-with-images.sql
```

**Что будет добавлено:**
- ✅ 12 тестовых промптов в разных категориях
- ✅ Изображения с Unsplash (placeholder)
- ✅ Разные значения likes/downloads
- ✅ Разные даты создания

**Без изображений:**
```bash
# Запусти в SQL Editor:
supabase-setup-admin-test-data.sql
```

---

### Шаг 3: Настроить Storage для изображений

```bash
# 1. Открой Supabase Dashboard
# 2. Перейди в Storage
# 3. Нажми "New Bucket"
# 4. Создай бакет с именем: Lib_img
# 5. Сделай public (для простоты)

# Или запусти SQL:
supabase-storage-setup.sql
```

---

### Шаг 4: Загрузить свои изображения (опционально)

**Вариант A: Supabase Dashboard**
1. Storage → Lib_img → Upload
2. Загрузи изображения (max 5MB)
3. Скопируй public URL
4. Обнови `image_url` в `library_prompts`

**Вариант B: Использовать placeholder URL**
- В скрипте уже используются URL с Unsplash
- Ничего загружать не нужно!

---

## 🎯 КАК ПРОВЕРИТЬ

### 1. Открыть расширение
```
chrome://extensions/ → Promptory → Open popup
```

### 2. Открыть Settings
- Кликни на иконку ⚙️ в правом верхнем углу

### 3. Прокрутить вниз до "Admin Moderation"
Должно появиться:
```
Admin Moderation [ADMIN]
├── Pending Reports (0)
└── Load Dashboard [кнопка]
```

### 4. Нажать "Load Dashboard"
Откроется панель со статистикой:
- 📊 Total Library Prompts
- 👥 Total Users
- 📈 Total Likes/Downloads
- 🚩 Reports by Status

---

## 📊 ТАБЛИЦА С КАТЕГОРИЯМИ

| Категория | Промптов | Пример |
|-----------|----------|--------|
| Development | 1 | Code Review |
| Writing | 1 | Email Writer |
| Data Science | 1 | Data Analysis |
| Education | 1 | Feynman Technique |
| Creative | 1 | Storytelling |
| Productivity | 1 | Task Prioritization |
| Health | 1 | Workout Planner |
| Marketing | 1 | Social Media Calendar |
| Travel | 1 | Itinerary Planner |
| Food | 1 | Recipe Creator |
| Career | 1 | Career Coach |
| Finance | 1 | Finance Advisor |

**Итого:** 12 промптов

---

## 🔍 ПОИСК ПРОМПТОВ

Для проверки поиска:
1. Введи в строку поиска: "code"
2. **Автоматически переключит на вкладку Prompts**
3. Покажет промпт "Professional Code Review"

---

## 📜 МОДЕРАЦИЯ (Admin Panel)

### Pending Reports
В скрипте добавлены 2 тестовых репорта:
1. **Pending** — "Professional Code Review" (Low Quality)
2. **Reviewed** — "Professional Email Writer" (Spam)

### Как модерировать:
1. Settings → Admin Moderation
2. Кликни на репорт
3. Выбери действие:
   - ✅ **Dismiss** — отклонить репорт
   - 🚫 **Hide Prompt** — скрыть промпт
   - 🗑️ **Delete** — удалить промпт

---

## 🎨 ВИЗУАЛЬНЫЕ ПРОВЕРКИ

### 1. Прокрутка в Explore
- Открой вкладку **Explore**
- Добавлено 12 промптов → должна появиться прокрутка
- Кнопка **"Load More"** внизу (если есть ещё промпты)

### 2. Поиск переключает на Prompts
- Будь на вкладке **Folders** или **Explore**
- Начни вводить текст в поиск
- **Автоматически переключит на Prompts**

### 3. Нет скролла страницы
- Высота popup фиксирована: **600px**
- Скролл **только внутри списков**
- Header, Search, Tabs — фиксированные

---

## ⚠️ ВОЗМОЖНЫЕ ПРОБЛЕМЫ

### ❌ Не видно Admin панель
**Причина:** `is_admin = false`

**Решение:**
```sql
UPDATE public.profiles
SET is_admin = true
WHERE email = 'your_email@gmail.com';

-- Проверить:
SELECT email, is_admin FROM public.profiles;
```

### ❌ Не работает кнопка "Load Dashboard"
**Причина:** Нет данных или ошибка RLS

**Решение:**
1. Проверь что промпты добавлены:
```sql
SELECT COUNT(*) FROM public.library_prompts;
```

2. Проверь RLS политики:
```sql
-- Запусти из файла supabase-fix-rls.sql
```

### ❌ Нет изображений
**Причина:** Бакет не создан или private

**Решение:**
```sql
-- Проверить бакет:
SELECT id, public FROM storage.buckets WHERE id = 'Lib_img';

-- Если нет — создать:
-- Запусти supabase-storage-setup.sql
```

---

## 📞 CONTACT

Если что-то не работает:
- Telegram: @user_Alexander
- GitHub Issues: /Leks2000/PromptVault/issues

---

**Готово!** 🎉

Теперь у тебя есть:
- ✅ Админ панель для модерации
- ✅ 12 тестовых промптов с изображениями
- ✅ Прокрутка в библиотеке
- ✅ Автоматическое переключение на Prompts при поиске

**Версия:** 1.9.0  
**Дата:** 18 февраля 2026
