# 🔧 Admin Panel Troubleshooting

## ❌ ПРОБЛЕМА: Не открывается админ панель

### Симптомы
- Кнопка Settings → нет раздела "Admin Moderation"
- Или есть но пустой
- Или кнопка "Load Dashboard" не работает

---

## ✅ РЕШЕНИЕ ПО ШАГАМ

### Шаг 1: Проверить что ты залогинен

1. Открой расширение
2. Кликни Settings (⚙️)
3. Должно быть показано: `Signed in as: your_email@gmail.com`

**Если нет — войди через Google:**
```
Settings → Sign in with Google
```

---

### Шаг 2: Установить is_admin = true

**В Supabase SQL Editor:**
```sql
-- 1. Узнать свой email
SELECT email, is_admin FROM public.profiles;

-- 2. Установить is_admin = true
UPDATE public.profiles
SET is_admin = true
WHERE email = 'your_email@gmail.com';

-- 3. Проверить
SELECT email, is_admin FROM public.profiles;
```

**Должно вернуть:**
```
email                   | is_admin
------------------------|----------
your_email@gmail.com    | true
```

---

### Шаг 3: Перезагрузить расширение

**Важно!** Extension кэширует `state.isAdmin`

1. Закрой popup (кликни вне расширения)
2. Открой снова
3. ИЛИ: `chrome://extensions/` → Refresh на Promptory

---

### Шаг 4: Проверить консоль

1. Открой popup
2. `F12` → Console
3. Ищи сообщения:
```
✅ Admin status: true
```

**Если `false` или нет сообщения:**
- Проверь что `loadData()` вызывается
- Проверь что `state.user` и `state.session` не null

---

### Шаг 5: Открыть Settings

1. Кликни ⚙️ в popup
2. Прокрути вниз
3. Должно появиться:

```
┌─────────────────────────────────────┐
│ Admin Moderation [ADMIN]            │
├─────────────────────────────────────┤
│ Pending Reports: 0                  │
│ [Moderate]                          │
├─────────────────────────────────────┤
│ Admin Dashboard [ADMIN]             │
├─────────────────────────────────────┤
│ [📊 Load Dashboard]                 │
└─────────────────────────────────────┘
```

---

### Шаг 6: Нажать "Load Dashboard"

Должна открыться панель:
```
┌─────────────────────────────────────┐
│ Admin Dashboard [ADMIN]             │
├─────────────────────────────────────┤
│ 📊 Total Library Prompts: 12        │
│ 👥 Total Users: 1                   │
│ 📈 Total Likes: 523                 │
│ 📈 Total Downloads: 2890            │
│                                     │
│ Reports by Status:                  │
│ 🟡 Pending: 1                       │
│ 🔵 Reviewed: 1                      │
│ 🔴 Actioned: 0                      │
│ 🟢 Dismissed: 0                     │
└─────────────────────────────────────┘
```

---

## 🔍 ДИАГНОСТИКА

### Проверка через консоль

Открой DevTools (F12) в popup и выполни:

```javascript
// 1. Проверить state
console.log('isAdmin:', window.Promptory.state.isAdmin);
console.log('user:', window.Promptory.state.user);
console.log('session:', window.Promptory.state.session);

// 2. Проверить что кнопка есть
console.log('Button:', document.getElementById('load-admin-dashboard-btn'));

// 3. Попробовать загрузить dashboard
await loadAdminDashboard(30);
```

---

### Проверка через Supabase

```sql
-- 1. Проверить профиль
SELECT id, email, is_admin, created_at 
FROM public.profiles 
WHERE email = 'your_email@gmail.com';

-- 2. Проверить что промпты есть
SELECT COUNT(*) AS total_prompts FROM public.library_prompts;

-- 3. Проверить репорты
SELECT status, COUNT(*) AS count 
FROM public.prompt_reports 
GROUP BY status;
```

---

## ⚠️ ВОЗМОЖНЫЕ ОШИБКИ

### 1. "is_admin" колонка не существует

**Ошибка:**
```
column "is_admin" does not exist
```

**Решение:**
```sql
-- Добавить колонку
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Установить admin
UPDATE public.profiles 
SET is_admin = true 
WHERE email = 'your_email@gmail.com';
```

---

### 2. RLS блокирует доступ

**Ошибка:**
```
new row violates row-level security policy
```

**Решение:**
```sql
-- Включить RLS (если выключен)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Добавить политику для чтения профиля
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Добавить политику для админов
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  )
);
```

---

### 3. Кнопка не работает

**Проверка:**
```javascript
// В консоли popup
document.getElementById('load-admin-dashboard-btn')?.click();
```

**Если не кликается:**
- Проверь что `state.isAdmin === true`
- Проверь что `state.user` и `state.session` не null

---

### 4. Dashboard пустой

**Причина:** Нет данных в БД

**Решение:**
```bash
# Запусти тестовые данные:
supabase-setup-test-data-with-images.sql
```

---

## 📊 БЫСТРАЯ ПРОВЕРКА

Выполни в SQL Editor:

```sql
-- Всё в одном запросе
SELECT 
  'Profile' AS check_type,
  email,
  is_admin,
  'OK' AS status
FROM public.profiles 
WHERE email = 'your_email@gmail.com'

UNION ALL

SELECT 
  'Library Prompts',
  COUNT(*)::text,
  SUM(likes)::text,
  'OK'
FROM public.library_prompts

UNION ALL

SELECT
  'Reports',
  COUNT(*)::text,
  status,
  'OK'
FROM public.prompt_reports
GROUP BY status;
```

---

## 🆘 ЕСЛИ ВСЁ ЕЩЁ НЕ РАБОТАЕТ

1. **Проверь логи в Supabase:**
   - Dashboard → Logs → Query

2. **Проверь консоль extension:**
   - Popup → F12 → Console

3. **Перезагрузи extension полностью:**
   - `chrome://extensions/`
   - Remove Promptory
   - Load unpacked снова

4. **Напиши в поддержку:**
   - Telegram: @user_Alexander
   - Приложи скриншот консоли

---

**Удачи!** 🚀
