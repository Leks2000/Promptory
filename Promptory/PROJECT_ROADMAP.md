# Promptory - Project Roadmap, Monetization & TODO

## Current Status: v1.8.0

### What's Done (MVP Core)
- [x] Chrome Extension (MV3) with popup UI
- [x] Prompt CRUD (create, read, update, delete)
- [x] Folder organization
- [x] Favorites system
- [x] Tag system
- [x] Variable substitution ({name}, {topic}, etc.)
- [x] Quick Insert to AI platforms (ChatGPT, Claude, Gemini, etc.)
- [x] 3 hotkey slots (Alt+1/2/3)
- [x] Search overlay (Ctrl+Shift+P)
- [x] Context menu "Save selection as Prompt"
- [x] Dark/Light/System themes
- [x] i18n (English + Russian)
- [x] Google Auth via Supabase
- [x] Cloud sync (prompts, folders to Supabase)
- [x] Public Prompt Library (Explore tab)
- [x] Share prompts to library with cover images
- [x] Like/Report system for library prompts
- [x] Premium/Free tier with prompt limits
- [x] Export/Import backup (JSON)
- [x] Statistics dashboard
- [x] Usage tracking

---

## Project Roadmap

### Phase 1: Stability & Polish (v1.2.0) - 2-3 weeks
- [ ] Fix remaining sync edge cases (conflict resolution, offline queue)
- [ ] Full end-to-end tests in browser
- [ ] Error reporting/logging (Sentry or similar)
- [ ] Onboarding flow improvements (interactive tutorial)
- [ ] Performance audit (Lighthouse for popup, memory profiling)
- [ ] Accessibility audit (ARIA labels, keyboard navigation)
- [ ] Landing page improvements (promptory.app)

### Phase 2: Growth Features (v1.3.0) - 4-6 weeks
- [ ] Prompt Templates marketplace (curated collections)
- [ ] AI-powered prompt enhancement (rewrite/improve via API)
- [ ] Team/workspace sharing (invite users, shared folders)
- [ ] Prompt versioning (edit history, rollback)
- [ ] Advanced search (filters by platform, date, usage)
- [ ] Prompt analytics (which prompts perform best)
- [ ] Browser support: Firefox, Edge, Safari
- [ ] Chrome Web Store listing optimization (ASO)

### Phase 3: Monetization (v2.0.0) - 6-10 weeks
- [ ] Premium subscription model
- [ ] Payment integration
- [ ] Team plans (per-seat pricing)
- [ ] API access for power users
- [ ] White-label/enterprise option
- [ ] Affiliate/referral program

### Phase 4: Platform (v3.0.0) - 12+ weeks
- [ ] Web app (standalone, no extension needed)
- [ ] Mobile companion app (PWA or native)
- [ ] API marketplace for prompt chains
- [ ] Integration with Zapier/Make
- [ ] Prompt A/B testing
- [ ] Community features (profiles, following, collections)

---

## Monetization Strategy

### Revenue Model Options

#### 1. Freemium SaaS (Recommended)
**Free Tier:**
- 20 prompts limit
- 3 folders
- Basic search
- Manual sync
- Community library access (read-only)

**Premium ($4.99/month or $39.99/year):**
- Unlimited prompts
- Unlimited folders
- AI prompt enhancement
- Priority cloud sync
- Share to library
- Advanced analytics
- Export in multiple formats
- Priority support

**Team Plan ($9.99/user/month):**
- Everything in Premium
- Shared team workspace
- Admin dashboard
- SSO/SAML integration
- Audit logs

#### 2. Payment Methods (Russia-compatible)

**Primary (International):**
- Stripe (cards, Apple Pay, Google Pay) - via offshore entity
- PayPal - limited in Russia but works for some users

**Russia-specific:**
- **Boosty** (boosty.to) - native Russian subscription platform
  - Accepts Russian cards (Mir, Visa, MasterCard)
  - Withdrawal to Russian bank cards
  - Monthly subscriptions supported
  - Commission: 10-15%
  - Pros: legal in Russia, easy withdrawal
  - Cons: limited international audience

- **YooMoney (ex-Yandex.Money)**
  - Accepts all Russian payment methods
  - Withdrawal to any Russian bank card
  - API for automation
  - Commission: 3-5%

- **CloudPayments** (Russian payment gateway)
  - Accepts Russian and international cards
  - Recurring payments
  - Withdrawal to Russian bank accounts

- **Tinkoff Acquiring**
  - Low commission (1.5-2.5%)
  - Fast settlements
  - Easy integration

**Cryptocurrency:**
- Accept USDT/USDC (TRC-20 for low fees)
- TON (Telegram's crypto - popular in Russia)
- BTC/ETH for international users
- Use services like NOWPayments or CoinGate for processing
- Pros: no censorship, cross-border, low fees
- Cons: volatility, compliance complexity

**Withdrawal to Russian cards:**
- Boosty -> Russian bank card (direct)
- YooMoney -> Russian bank card (direct)
- Crypto -> P2P exchange (Binance P2P, Garantex) -> Russian bank card
- Stripe/PayPal -> Wise/Payoneer -> Russian bank card (complex, may be blocked)

#### 3. Telegram Integration Strategy

**Telegram Bot (@PromptoryBot):**
- `/start` - link Telegram account to Promptory
- `/search <query>` - search your prompts from Telegram
- `/copy <id>` - copy a prompt to clipboard
- `/random` - get a random prompt from library
- `/stats` - view your usage stats
- Premium features: `/ai <prompt>` - enhance prompt with AI

**Telegram Channel:**
- Daily prompt of the day
- Tips for using AI effectively
- New feature announcements
- Community polls

**Telegram Mini App:**
- Full Promptory experience inside Telegram
- TON Connect for payments
- Inline mode: type @PromptoryBot in any chat to insert prompts

**Monetization via Telegram:**
- Stars (Telegram's virtual currency) for premium features
- TON payments for subscriptions
- Referral links with Telegram share

#### 4. Chrome Web Store Compliance

**Key policies to follow:**
- Single purpose: prompt management (compliant)
- No data collection beyond what's needed (compliant with privacy policy)
- No crypto mining or hidden functionality
- Clear privacy policy and terms of service
- No affiliate link injection or ad injection
- Permissions must be justified in listing

**Recommended approach:**
- Keep extension free with limited features
- Premium features activated via external subscription
- Don't process payments inside the extension (CWS policy)
- Use extension to detect premium status via Supabase profile

---

## TODO List

### Critical (This Week)
- [ ] Run `supabase-fix-rls.sql` on all environments
- [ ] Verify library_prompts loading after RLS fix
- [ ] Test prompt publishing end-to-end (with image upload)
- [ ] Verify data sync on fresh Google sign-in
- [ ] Test on Chrome stable + Chrome Canary
- [ ] Fix image preview in prompt editor (Supabase private bucket)

### Important (Next 2 Weeks)
- [ ] Add offline queue for sync operations
- [ ] Add retry logic for failed API calls
- [ ] Implement proper error boundaries in UI
- [ ] Add loading skeletons for better perceived performance
- [ ] Write more comprehensive tests (integration, E2E)
- [ ] Set up CI/CD (GitHub Actions)
- [ ] Publish to Chrome Web Store (beta channel)
- [ ] Create privacy policy page
- [ ] Create terms of service page

### Nice to Have (Month)
- [ ] Add more categories for library
- [ ] Add sorting options (by date, usage, name)
- [ ] Add bulk operations (select multiple, delete/move)
- [ ] Add prompt duplication
- [ ] Add keyboard navigation in popup
- [ ] Add animated transitions between tabs
- [ ] Add prompt preview on hover
- [ ] Dark mode refinements
- [ ] Migrate to Tailwind CSS (optional, current CSS is already clean)

### Future Features
- [ ] AI prompt enhancement (OpenAI/Claude API)
- [ ] Prompt chains (sequences of prompts)
- [ ] Prompt A/B testing with metrics
- [ ] Team workspaces
- [ ] Zapier/Make integration
- [ ] Firefox/Edge/Safari support
- [ ] Web app (React/Next.js)
- [ ] Mobile app (React Native or Flutter)
- [ ] Telegram bot + Mini App
- [ ] API for developers

---

## Project Structure

```
Promptory/
  _locales/            # i18n strings (en, ru)
  assets/              # Icons (16/32/48/128px)
  background/          # Service worker (auth, sync, API)
  content/             # Content scripts (inject into AI pages)
  onboarding/          # Welcome page
  options/             # Options/settings page
  popup/               # Main popup UI
    popup.html         # HTML structure
    popup.js           # Main controller (~2000 lines)
    popup.css          # Popup-specific styles
  styles/              # Shared CSS
    variables.css      # Theme variables
    components.css     # Reusable components
    animations.css     # Animations
  tests/               # Unit tests
  manifest.json        # Chrome MV3 manifest
  supabase-schema.sql  # Database schema
  supabase-fix-rls.sql # RLS policy fixes
```

## Tech Stack
- **Frontend:** Vanilla JS, CSS Custom Properties
- **Backend:** Supabase (PostgreSQL + Auth + Storage + RPC)
- **Auth:** Google OAuth via Supabase + Chrome Identity API
- **Storage:** Chrome Storage API (local) + Supabase (cloud)
- **Build:** None (vanilla, no build step needed)
- **Deployment:** Chrome Web Store + GitHub Releases
