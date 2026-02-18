# 🛡️ Promptory - Юридический Аудит & CWS Compliance

**Дата аудита:** 18 февраля 2026 г.  
**Версия:** 1.9.0  
**Статус:** ✅ ГОТОВО К CWS REVIEW

---

## ✅ ЧЕК-ЛИСТ CWS ТРЕБОВАНИЙ

### 1. Privacy Policy (Политика Конфиденциальности)
| Требование | Статус | Файл |
|------------|--------|------|
| Наличие Privacy Policy | ✅ | `privacy.html` |
| Описание собираемых данных | ✅ | Раздел 2 |
| Как данные используются | ✅ | Раздел 4 |
| Как данные хранятся | ✅ | Раздел 3 |
| Data sharing disclosure | ✅ | Раздел 5 |
| GDPR/CCPA права | ✅ | Раздел 8a |
| Children's privacy (13+) | ✅ | Раздел 10 |
| Contact information | ✅ | Раздел 12 |
| **Age Verification Mechanism** | ✅ | `onboarding/welcome.html` |

**Вердикт:** ✅ Полностью соответствует

---

### 2. Terms of Service (Условия Использования)
| Требование | Статус | Файл |
|------------|--------|------|
| Наличие Terms of Service | ✅ | `terms.html` |
| Acceptance clause | ✅ | Раздел 1 |
| Description of service | ✅ | Раздел 2 |
| User content policy | ✅ | Раздел 3, 5b |
| Acceptable use policy | ✅ | Раздел 4 |
| Payment terms (Premium) | ✅ | Раздел 5 |
| **Refund Policy** | ✅ | Раздел 5a |
| Disclaimer of warranties | ✅ | Раздел 6 |
| Limitation of liability | ✅ | Раздел 7 |
| Third-party services | ✅ | Раздел 8 |
| Modifications clause | ✅ | Раздел 9 |
| Termination clause | ✅ | Раздел 10 |
| Governing law (Kazakhstan) | ✅ | Раздел 10a |
| Contact information | ✅ | Раздел 11 |
| **DMCA reference** | ✅ | Раздел 5b + футер |

**Вердикт:** ✅ Полностью соответствует

---

### 3. DMCA & Copyright Policy
| Требование | Статус | Файл |
|------------|--------|------|
| Наличие DMCA Policy | ✅ | `dmca.html` |
| Copyright Agent contact | ✅ | Раздел 8 |
| Takedown process | ✅ | Раздел 4 |
| Counter-notice process | ✅ | Раздел 5 |
| Repeat infringer policy | ✅ | Раздел 6 |
| User responsibilities | ✅ | Раздел 7 |
| Legal basis (DMCA, EU) | ✅ | Раздел 9 |

**Вердикт:** ✅ Полностью соответствует

---

### 4. Age Verification
| Требование | Статус | Файл |
|------------|--------|------|
| Age restriction statement | ✅ | `privacy.html` Раздел 10 |
| **Age gate UI** | ✅ | `onboarding/welcome.html` |
| **Checkbox "I am 13+"** | ✅ | Age Verification блок |
| **Terms/Privacy acceptance** | ✅ | Age Verification блок |
| **Confirm button** | ✅ | Кнопка "Подтверждаю" |
| **Storage in chrome.storage** | ✅ | `ageVerified: true` |

**Вердикт:** ✅ Полностью соответствует

---

### 5. Permissions Justification
| Permission | Обоснование | Статус |
|------------|-------------|--------|
| `storage` | Хранение промптов локально | ✅ |
| `activeTab` | Вставка промптов в активную вкладку | ✅ |
| `scripting` | Инъекция content script | ✅ |
| `identity` | Google OAuth для синхронизации | ✅ |
| `contextMenus` | "Save selection as Prompt" | ✅ |
| `notifications` | Уведомления о действиях | ✅ |
| `clipboardWrite` | Копирование промптов | ✅ |
| `tabs` | Определение AI платформы | ✅ |
| `alarms` | Периодические задачи (token refresh) | ✅ |

**Файл обоснования:** `CWS_REVIEW_JUSTIFICATION.md`

**Вердикт:** ✅ Полностью соответствует

---

### 6. Single Purpose Declaration
| Требование | Статус |
|------------|--------|
| Четкая цель расширения | ✅ "AI Prompt Manager" |
| Все функции относятся к цели | ✅ |
| Нет скрытого функционала | ✅ |
| Нет affiliate injection | ✅ |
| Нет ad injection | ✅ |
| Нет crypto mining | ✅ |

**Вердикт:** ✅ Полностью соответствует

---

### 7. License (Лицензия)
| Требование | Статус | Файл |
|------------|--------|------|
| Лицензионное соглашение | ✅ | `LICENSE` |
| **Proprietary (не MIT)** | ✅ | Изменено |
| Copyright notice | ✅ | "All Rights Reserved" |
| Restrictions clearly stated | ✅ | Раздел RESTRICTIONS |
| Ownership clause | ✅ | Раздел OWNERSHIP |
| Termination clause | ✅ | Раздел TERMINATION |
| Governing law | ✅ | Раздел GOVERNING LAW |

**Вердикт:** ✅ Полностью соответствует

---

### 8. Payment & Refund Policy
| Требование | Статус | Файл |
|------------|--------|------|
| Payment processor disclosed | ✅ LemonSqueezy (MoR) |
| Subscription terms | ✅ `terms.html` Раздел 5 |
| **Refund Policy explicit** | ✅ Раздел 5a |
| Cancellation process | ✅ LemonSqueezy portal |
| No in-extension payments | ✅ (CWS policy compliant) |

**Вердикт:** ✅ Полностью соответствует

---

### 9. User-Generated Content (Public Library)
| Требование | Статус | Файл |
|------------|--------|------|
| Content ownership clause | ✅ `terms.html` Раздел 5b |
| License grant disclosure | ✅ "non-exclusive license" |
| User responsibility | ✅ "You are responsible" |
| **DMCA takedown process** | ✅ `dmca.html` |
| **Moderation system** | ✅ Admin dashboard в коде |
| Repeat infringer policy | ✅ `dmca.html` Раздел 6 |

**Вердикт:** ✅ Полностью соответствует

---

### 10. Third-Party Services Disclosure
| Сервис | Цель | Раскрыто |
|--------|------|----------|
| Supabase | Cloud sync, auth | ✅ `privacy.html` Раздел 6 |
| Google OAuth | Authentication | ✅ `privacy.html` Раздел 6 |
| LemonSqueezy | Payments | ✅ `terms.html` Раздел 5 |
| DonationAlerts | Donations | ✅ `terms.html` Раздел 5 |

**Вердикт:** ✅ Полностью соответствует

---

## 📋 ИТОГОВЫЙ СТАТУС

| Категория | Статус |
|-----------|--------|
| ✅ Privacy Policy | ГОТОВО |
| ✅ Terms of Service | ГОТОВО |
| ✅ DMCA/Copyright Policy | ГОТОВО |
| ✅ Age Verification | ГОТОВО |
| ✅ Permissions Justification | ГОТОВО |
| ✅ Single Purpose | ГОТОВО |
| ✅ License (Proprietary) | ГОТОВО |
| ✅ Payment/Refund Policy | ГОТОВО |
| ✅ User Content Policy | ГОТОВО |
| ✅ Third-Party Disclosure | ГОТОВО |

---

## 🎯 ГОТОВНОСТЬ К CWS REVIEW

### Файлы для CWS Dashboard
| Поле | Значение | Файл |
|------|----------|------|
| Privacy Policy URL | `https://promptory.app/privacy.html` | `privacy.html` |
| Terms of Service URL | `https://promptory.app/terms.html` | `terms.html` |
| DMCA Policy URL | `https://promptory.app/dmca.html` | `dmca.html` |
| License | Proprietary | `LICENSE` |

### Файлы для Reviewer
| Файл | Назначение |
|------|------------|
| `CWS_REVIEW_JUSTIFICATION.md` | Обоснование permissions |
| `LEGAL_AUDIT_COMPLETE.md` | Этот файл (чек-лист) |

### Тестовые данные для Reviewer
```
Email: test@promptory.app (для демонстрации OAuth)
Premium: Не требуется (free tier функционал)
```

---

## ⚠️ ПОТЕНЦИАЛЬНЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ

### 1. Google OAuth
**Проблема:** Может потребоваться обоснование  
**Решение:** ✅ Обосновано в `CWS_REVIEW_JUSTIFICATION.md`

### 2. External Requests (Supabase)
**Проблема:** host_permissions должны быть обоснованы  
**Решение:** ✅ Обосновано в `CWS_REVIEW_JUSTIFICATION.md`

### 3. User-Generated Content
**Проблема:** Может потребоваться модерация  
**Решение:** ✅ Админка + DMCA policy + RLS в БД

### 4. Premium Subscription
**Проблема:** Нельзя продавать внутри CWS  
**Решение:** ✅ LemonSqueezy внешний, не внутри расширения

---

## 🚀 СЛЕДУЮЩИЕ ШАГИ

1. **Создать landing page** с ссылками на политики
   - `https://promptory.app/privacy.html`
   - `https://promptory.app/terms.html`
   - `https://promptory.app/dmca.html`

2. **Подготовить скриншоты для CWS**
   - 1280x800 (минимум 1)
   - 640x400 (рекомендуется)
   - Promo video (опционально)

3. **Заполнить CWS Dashboard**
   - Название: "Promptory - AI Prompt Manager"
   - Описание: (короткое + длинное)
   - Категория: "Productivity"
   - Языки: English, Russian

4. **Отправить на review**
   - Прикрепить `CWS_REVIEW_JUSTIFICATION.md`
   - Указать тестовые данные (если нужны)

---

## 📞 CONTACT FOR REVIEWERS

**Email:** Available via Telegram @user_Alexander  
**Telegram:** https://t.me/user_Alexander  
**GitHub:** https://github.com/Leks2000/PromptVault/issues  

---

**Аудит проведен:** 18 февраля 2026 г.  
**Статус:** ✅ ГОТОВО К CWS REVIEW  
**Версия:** 1.9.0
