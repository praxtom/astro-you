# AstroYou — Product Roadmap & Task List

> **Vision**: The definitive AI-powered Vedic astrology platform
> **Quality Bar**: Production-ready, premium, polished
> **Current Score**: A (22/25) vs Competitors' A (22/25) — Sprint 0 quality hardening complete, all features A+
> **API**: astrology-api.io v3.2.10 — 266 endpoints total, 18 wired, 248 available
> **OpenAPI Spec**: `docs/astrology-api-openapi.json` (local copy, formatted)
> **Last Updated**: 2026-03-29

---

## Before You Start Any Task

> **READ FIRST**: [CLAUDE.md](../CLAUDE.md) — architecture patterns, anti-patterns, code conventions

### Key Principles:

1. **Use `netlify/functions/shared/`** for all API integrations (astro-api.ts, gemini.ts)
2. **Use `src/types/`** for TypeScript interfaces — never inline types
3. **Use `src/hooks/`** for data access — never inline Firestore queries
4. **Shared collections** for global data (panchang, transits) — not per-user

### Pre-Implementation Checklist:

- [ ] New API calls? → Use `netlify/functions/shared/astro-api.ts` or `gemini.ts`
- [ ] New types? → Add to `src/types/` and re-export from index.ts
- [ ] New data access? → Create a hook in `src/hooks/`
- [ ] Shared data (transits, panchang)? → Use shared Firestore collections, not per-user

---

## Competitive Intelligence: AstroYou vs AstroTalk vs AstroSage

### Head-to-Head Feature Matrix

| Feature | AstroTalk | AstroSage | AstroYou | Status |
|---------|-----------|-----------|----------|--------|
| **Core Vedic** | | | | |
| Daily Horoscope | ✅ | ✅ | ✅ | DONE |
| Weekly Horoscope | ✅ | ✅ | ✅ | DONE |
| Monthly Horoscope | ✅ | ✅ | ❌ | Sprint A |
| Yearly Horoscope | ✅ | ✅ | ❌ | Sprint A |
| Transit Tracking | ✅ | ✅ | ✅ | DONE |
| Dasha Display | ✅ | ✅ | ✅ | DONE |
| Yogas Detection | ✅ | ✅ | ✅ | DONE |
| Panchang | ✅ | ✅ | ✅ | DONE |
| Kundli Matching (Guna Milan) | ✅ | ✅ | ✅ | DONE |
| Manglik Dosha | ✅ | ✅ | ✅ | DONE |
| Vedic Remedies | ✅ | ⚠️ | ✅ | DONE |
| Sade Sati Check | ✅ | ✅ | ✅ | DONE |
| Kaal Sarpa Dosha | ✅ | ✅ | ✅ | DONE |
| Nakshatra Predictions | ✅ | ✅ | ✅ | DONE |
| Ashtakvarga | ⚠️ | ✅ | ✅ | DONE |
| PDF Reports | ✅ (₹500+) | ✅ | ❌ | Sprint C |
| Shareable Charts | ✅ | ✅ | ❌ | Sprint C |
| **Where AstroYou WINS** | | | | |
| AI Conversational Depth | ⚠️ Basic chatbot | ❌ None | ✅ Gemini + consciousness | MASSIVE LEAD |
| Emotional Intelligence | ❌ | ❌ | ✅ Atman (7 states, decay) | UNIQUE |
| Proactive Spiritual Guidance | ❌ | ❌ | ✅ Guru toasts, dasha prep | UNIQUE |
| 3D Chart Visualization | ❌ | ❌ | ✅ React Three Fiber | UNIQUE |
| Breathing/Meditation (Prana) | ❌ | ❌ | ✅ 3 modes + Nada sounds | UNIQUE |
| Routine Tracking (Dharma) | ❌ | ❌ | ✅ Streak counting, CRUD | UNIQUE |
| Karmic Journal | ❌ | ❌ | ✅ Immersive book view | UNIQUE |
| Relationship Intelligence | ❌ | ❌ | ✅ Inner Circle + context | UNIQUE |
| Chat Persistence + Memory | ❌ | ❌ | ✅ Firestore + Atman | UNIQUE |
| Modern UI/UX | ⚠️ Cluttered | ⚠️ Dated (2015 era) | ✅ Dark cosmic minimal | WINNING |
| **Where Competitors WIN** | | | | |
| Human Astrologers | ✅ 5000+ (chat/call/video) | ❌ | ❌ | Phase 7.5 |
| Push Notifications (FCM) | ✅ Full | ✅ Email | ❌ Browser toasts only | Phase 7.2 (native) |
| Native Mobile App | ✅ iOS + Android (50M+ DL) | ✅ Android | ❌ Web only | Phase 7.2 |
| Regional Languages | ✅ 10+ Indian langs | ✅ Hindi + English | ❌ English only | Phase 7.1 |
| SEO Content Pages | ✅ Thousands | ✅ #1 Google rankings | ❌ None | Sprint A |
| E-commerce (Gemstones, Pujas) | ✅ Full marketplace | ❌ | ❌ | Phase 7.3 |
| User Base / Brand Trust | ✅ 50M+ downloads | ✅ 20+ years, massive SEO | ❌ New, zero users | Growth phase |
| Muhurat Calendar | ✅ | ✅ Full | ❌ | Sprint B |

### Competitor Strengths to Respect

**AstroTalk (Primary Competitor)**
- 50M+ app downloads, ~₹500Cr annual revenue
- Core moat: 5000+ live human astrologers (chat/call/video)
- Revenue model: ₹15-100/min for consultations + gemstone e-commerce
- Strong app store presence and brand recognition
- Weakness: Generic chatbot AI, cluttered UI, fear-based upselling

**AstroSage (SEO Competitor)**
- 20+ years online, #1 Google ranking for most astrology queries in India
- Massive free content: daily/weekly/monthly horoscopes for all 12 signs
- Panchang, Muhurat, festival calendar pages drive seasonal traffic
- Revenue model: Ad-supported + premium reports
- Weakness: Dated UI (looks like 2010), no AI, no mobile app, purely transactional

### AstroYou's Strategic Position

> "The only astrology app that **knows you, grows with you, and never scares you.**"

**This positioning directly attacks:**
- AstroTalk's ₹100/min "human astrologers" (many are bots) — We offer BETTER AI at ₹5/min, transparently
- AstroTalk's fear-based upselling ("Buy ₹5000 gem or suffer!") — We offer empowering guidance with free remedy practices
- AstroSage's generic, dated, transactional experience — We offer personalized, modern, spiritual companion
- Both competitors' lack of emotional intelligence — Our Atman system is an unreplicable moat

**The AstroTalk Killer Insight:**
> AstroTalk charges ₹15-100/min for "human astrologers" — many are actually bots.
> We build the same marketplace UX (browse experts → pick → pay per min) with transparent,
> BETTER AI at 10x cheaper pricing. Same user habit, 10x better value.

**Dual Strategy:**
- **Route A (Acquisition)**: AI Astrologer Marketplace — familiar "talk to expert" UX, ₹5/min, always online
- **Route B (Retention)**: Spiritual Companion — Atman consciousness, Prana, Dharma, Karmic Journal

**User journey:** Discovers via marketplace → gets hooked on AI quality → discovers spiritual companion → never leaves.

**To win, we need (in order):**
1. ~~**Quality hardening** (Sprint 0)~~ — ✅ DONE (all features A+)
2. **AI Astrologer Marketplace** (Phase 5.6) — Match AstroTalk's UX, undercut on price, beat on quality
3. **Content parity** (Sprint A-B) — Monthly/yearly horoscopes, doshas, SEO pages
4. **Monetization** (Phase 6) — Per-minute billing + subscriptions + PDF reports
5. **Discovery** (Sprint A SEO + Phase 7.2 native app) — Organic traffic + app store presence
6. **Moat deepening** (Sprint D-E) — Astrocartography, wellness, tarot, numerology = features NO competitor has

---

## Existing Feature Quality Audit

### Feature Quality Scorecard

| Feature | Grade | vs AstroTalk | vs AstroSage | Key Issues |
|---------|-------|-------------|-------------|------------|
| **AI Chat (Synthesis)** | A+ | CRUSHING | CRUSHING | Production-ready. Full context: kundali, dasha, transits, atman, yoga, panchang. Dual persona (Guru/Jyotish). Streaming. Memory. No competitor comes close. |
| **Kundali Chart** | A | EQUAL | EQUAL | SVG chart + 3D views. Divisional charts working. Caching in Firestore. |
| **Daily Horoscope** | B- | BEHIND | BEHIND | Missing: Rahu Kaal, Panchang summary, Moon phase (fetched but not displayed), remedies of the day. Tab system re-uses same layout for weekly — no period-specific design. |
| **Transit Oracle** | B | AHEAD (UX) | BEHIND (data) | Beautiful UI + AI summary. But: no degree precision, no retrograde indicators, no tabular view, no planet speeds. AstroSage shows full data table. |
| **Compatibility** | B- | BEHIND | BEHIND | Missing: Manglik status display (fetched but not shown), overall recommendation text, Nadi dosha detail, remedies for low scores, 36-point matrix table. |
| **Dashboard** | C+ | DIFFERENT | BEHIND | Beautiful but fragile. Cards assume specific API response format — will show `[object Object]` if API returns nested structures. Missing: Dasha card, sunrise/sunset, upcoming festivals. |
| **Panchang Card** | C | — | BEHIND | Shows 5 fields but no end-times. No sunrise/sunset. No Choghadiya. Response normalization missing — crashes if API returns `{ tithi: { name, endTime } }` instead of `tithi: "string"`. |
| **Yoga Card** | C | — | BEHIND | Shows names but no normalization for API field name variations (`yoga_name` vs `name`). Strength mapping hardcoded to `weak/moderate/strong` — API may return `Low/Medium/High`. |
| **Remedies Card** | B | — | — | Working with add-to-routine feature. But nested access `remedies?.remedies?.slice()` is fragile. Category matching assumes exact English strings. |
| **Dasha System** | A- | AHEAD | AHEAD | Monitor + 30/7/0 day preparation sequence is unique. Missing: visual timeline, display on Dashboard. |
| **Spiritual Framework** | A+ | CRUSHING | CRUSHING | Prana breathing, Nada sounds, Karmic Journal, Dharma routines, Soul Insight — no competitor has ANY of this. |

### Feature Quality Summary

```
Feature Grades:
  A+ : AI Chat (Synthesis), Spiritual Framework (Prana/Dharma/Karmic)
  A  : Kundali Chart
  A- : Dasha System
  B  : Transit Oracle
  B- : Daily Horoscope, Compatibility
  C+ : Dashboard (fragile)
  C  : Panchang Card, Yoga Card

Competitor Comparison:
  CRUSHING    : AI, Spiritual Framework, Consciousness — nobody has this
  AHEAD       : Dasha prep, Transit UX, Modern design
  EQUAL       : Kundali charts, basic horoscopes
  BEHIND      : Horoscope depth, Compatibility depth, Panchang, Transit data, SEO
  FAR BEHIND  : Human astrologers, Native app, Regional languages, SEO content
```

---

## API Reference

### API Provider: astrology-api.io (v3)
- **Base URL**: `https://api.astrology-api.io/api/v3`
- **Total Endpoints Available**: 266
- **Currently Using**: 17
- **Auth**: `X-API-Key` header via `ASTROYOU_API_KEY` env var
- **Config**: Whole Sign (W) house system, Sidereal zodiac, Swiss Ephemeris precision

### Payload Format (Standard Subject Object)
```json
{
  "subject": {
    "name": "User",
    "birth_data": {
      "year": 1990, "month": 5, "day": 15,
      "hour": 14, "minute": 30, "second": 0,
      "city": "Mumbai",
      "latitude": 19.076, "longitude": 72.8777
    }
  }
}
```

### Endpoints Currently Wired (in `netlify/functions/shared/astro-api.ts`)

| Function | Endpoint | Status |
|----------|----------|--------|
| `getNatalChart()` | `POST /charts/natal` | ✅ Working |
| `getNavamsaChart()` | `POST /vedic/divisional-chart` | ✅ Fixed (was /charts/divisional) |
| `getCurrentTransits()` | `GET /data/now` | ✅ Fixed (was GET /transits/current) |
| `getTransitChart()` | `POST /charts/transit` | ✅ Fixed payload |
| `getTransitReport()` | `POST /analysis/natal-transit-report` | ✅ Fixed payload |
| `getRenderedTransitChart()` | `POST /render/transit` | ✅ Working |
| `getDashaPeriods()` | `POST /vedic/vimshottari-dasha` | ✅ Fixed (was /dashas/vimshottari) |
| `getDailyHoroscope()` | `POST /horoscope/personal/daily` | ✅ Fixed payload |
| `getDailyHoroscopeText()` | `POST /horoscope/sign/daily/text` | ✅ Fixed payload |
| `getCompatibilityDetails()` | `POST /insights/relationship/compatibility` + `POST /charts/synastry` | ✅ Fixed (was /analysis/relationship) |
| `getYogaAnalysis()` | `POST /vedic/yoga-analysis` | ✅ via kundali.ts (chartType: "YOGAS") |
| `getPanchang()` | `POST /vedic/panchang` | ✅ via kundali.ts (chartType: "PANCHANG") |
| `getKundliMatching()` | `POST /vedic/kundli-matching` | ✅ via compatibility.ts |
| `getManglikDosha()` | `POST /vedic/manglik-dosha` | ✅ via kundali.ts (chartType: "MANGLIK") |
| `getRemedies()` | `POST /vedic/remedies` | ✅ via kundali.ts (chartType: "REMEDIES") |
| `getWeeklyHoroscope()` | `POST /horoscope/personal/weekly` | ✅ via horoscope.ts |
| `getNavamsaChart()` | `POST /vedic/divisional-chart` | ✅ D9 via kundali.ts |

### Vedic Endpoints Available (Not Yet Wired)

| Endpoint | Description | Priority | Roadmap Item |
|----------|------------|----------|-------------|
| `POST /vedic/sade-sati` | Saturn transit analysis + remedies | **P1** | Sprint B |
| `POST /vedic/nakshatra-predictions` | Nakshatra-based predictions | **P1** | Sprint B |
| `POST /vedic/ashtakvarga` | Planetary strength scoring | **P1** | Sprint B |
| `POST /vedic/shadbala` | Six-fold planetary strength | **P1** | Sprint E |
| `POST /vedic/kaal-sarpa-dosha` | Kaal Sarpa detection | **P2** | Sprint B |
| `POST /vedic/birth-details` | Full Vedic birth details | **P2** | Profile enrichment |
| `POST /vedic/chara-dasha` | Jaimini dasha system | **P3** | Phase 7 |
| `POST /vedic/varshaphal` | Annual solar return chart | **P3** | Phase 7 |
| `POST /vedic/kp-system` | KP astrology | **P3** | Phase 7 |

### Analysis & Report Endpoints Available

| Endpoint | Description | Priority |
|----------|------------|----------|
| `POST /analysis/karmic` | Karmic analysis report | **P1** |
| `POST /analysis/spiritual` | Spiritual analysis report | **P1** |
| `POST /analysis/career` | Career analysis | **P2** |
| `POST /analysis/health` | Health analysis | **P2** |
| `POST /analysis/predictive` | Predictive analysis | **P2** |
| `POST /analysis/psychological` | Psychological analysis | **P2** |
| `POST /horoscope/personal/monthly` | Monthly horoscope | **P1** |
| `POST /horoscope/personal/yearly` | Yearly horoscope | **P2** |

### Rendering & Export Endpoints

| Endpoint | Description | Priority |
|----------|------------|----------|
| `POST /svg/natal` | SVG natal chart | **P2** |
| `POST /svg/transit` | SVG transit chart | **P2** |
| `POST /render/natal` | Rendered natal chart image | **P2** |
| `POST /render/synastry` | Rendered synastry chart | **P2** |
| `POST /pdf/natal-report` | PDF natal report | **P2** |
| `POST /pdf/horoscope/daily` | PDF daily horoscope | **P3** |

### Specialty Endpoints (Future Differentiation)

| Category | Key Endpoints | Phase |
|----------|--------------|-------|
| Astrocartography | `/astrocartography/map`, `/power-zones`, `/location-analysis` | Sprint D / Phase 7 |
| Lunar Intelligence | `/lunar/phases`, `/lunar/void-of-course`, `/lunar/mansions` | Sprint D |
| Eclipses | `/eclipses/upcoming`, `/eclipses/natal-check` | Sprint D |
| Numerology | `/numerology/comprehensive`, `/numerology/compatibility` | Sprint E |
| Tarot | `/tarot/reports/celtic-cross`, `/tarot/cards/daily` | Sprint E |
| Traditional | `/traditional/profections`, `/traditional/lots`, `/traditional/dignities` | Phase 7 |
| Fixed Stars | `/fixed-stars/conjunctions`, `/fixed-stars/report` | Phase 7 |

### Full API Utilization Tracker

| Category | Total | Used | Remaining | Priority |
|----------|-------|------|-----------|----------|
| Charts | 13 | 3 | 10 | Sprint C (render) + Phase 7 |
| Data | 10 | 1 | 9 | As needed |
| Vedic | 22 | 7 | 15 | Sprint B (4) + Sprint E (5) |
| Horoscope | 17 | 3 | 14 | Sprint A (8+) |
| Analysis | 26 | 1 | 25 | Phase 6-7 |
| Insights | 31 | 1 | 30 | Sprint D (wellness, relationship) |
| Render/SVG | 8 | 1 | 7 | Sprint C |
| PDF | 4 | 0 | 4 | Sprint C |
| Eclipses | 3 | 0 | 3 | Sprint D |
| Lunar | 5 | 0 | 5 | Sprint D |
| Tarot | 19 | 0 | 19 | Sprint E |
| Numerology | 5 | 0 | 5 | Sprint E |
| Human Design | 10 | 0 | 10 | Sprint E |
| Astrocartography | 13 | 0 | 13 | Sprint D |
| Traditional | 10 | 0 | 10 | Phase 7 |
| Chinese | 8 | 0 | 8 | Phase 7 |
| Horary | 6 | 0 | 6 | Phase 7 |
| Fixed Stars | 4 | 0 | 4 | Phase 7 |
| Palmistry | 4 | 0 | 4 | Phase 7 |
| Runes | 15 | 0 | 15 | Phase 7 |
| Kabbalah | 7 | 0 | 7 | Phase 7 |
| Glossary | 15 | 0 | 15 | As needed |
| Other | 11 | 0 | 11 | As needed |
| **TOTAL** | **266** | **17** | **249** | |

---

## Product Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AstroYou Platform                        │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                                  │
│  ├── Landing Page → Premium conversion-focused                  │
│  ├── Onboarding → Cosmic birth data collection                  │
│  ├── Dashboard → Personal celestial command center              │
│  ├── Synthesis → AI astrologer chat with charts                 │
│  ├── Reports → Detailed PDF astrological analyses               │
│  └── Settings → Profile, subscriptions, preferences             │
├─────────────────────────────────────────────────────────────────┤
│  Backend (Netlify Functions)                                    │
│  ├── /api/kundali → Birth chart calculation                     │
│  ├── /api/synthesis → AI chat with Kundali context              │
│  ├── /api/horoscope → Daily/weekly/monthly predictions          │
│  ├── /api/transit → Real-time planetary positions               │
│  ├── /api/match → Compatibility analysis                        │
│  └── /api/auth/* → Authentication flows                         │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer (Firebase)                                          │
│  ├── Firestore → Users, Kundalis, Chats, Horoscopes            │
│  ├── Auth → Google, Email OTP, Anonymous                        │
│  └── Storage → Chart images, PDF reports                        │
├─────────────────────────────────────────────────────────────────┤
│  External Services                                              │
│  ├── Gemini API → AI interpretations                            │
│  ├── Astrology API → Vedic calculations                         │
│  ├── Razorpay → Payments & subscriptions                        │
│  └── Resend → Transactional emails                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation ✅ COMPLETE

- [x] Initialize Vite + React + TypeScript project
- [x] Configure Netlify deployment
- [x] Set up Firebase project (Auth, Firestore, Storage)
- [x] Create folder structure and routing
- [x] Create CSS variables and theme (dark cosmic aesthetic, glassmorphism, typography)
- [x] Create 3D CelestialEngine component with North Indian Kundali grid
- [x] Build landing page (hero, feature cards, footer)
- [x] 4-step onboarding wizard (Name/Gender, DOB/Time, Birth Place, Current Location)
- [x] Session storage for guest data, Firestore sync for authenticated users
- [x] Firebase Auth (Google Sign-In + Email OTP via Resend)
- [x] AI Chat connected to Gemini 3 Flash Preview
- [x] 5-minute free trial with auth gate
- [x] Razorpay payment integration ("Celestial Minutes" credit system)

---

## Phase 2: Kundali Engine ✅ COMPLETE

- [x] Astrology API integration (Astrology-API.io) with caching
- [x] Comprehensive Kundali data model (`/src/types/kundali.ts`)
- [x] Birth chart calculation triggered after onboarding (<3s)
- [x] North Indian SVG chart (`KundaliChart.tsx`) — responsive, dark themed
- [x] Chart storage & regeneration on profile update
- [x] Full Kundali fed to Gemini with Vedic terminology (Jyotir persona)
- [x] Multimodal chat: keyword detection opens chart modal, download from chat
- [x] Vision-based Kundali parsing (image upload → Gemini Vision → auto-fill)
- [x] City autocomplete (OSM Nominatim)

---

## Phase 3: Intelligent Experience ✅ COMPLETE

- [x] Chat persistence (Firestore nested sub-collections)
- [x] Immersive 3D Celestial Expansion (Three.js) — Cosmic Circle + Sacred Diamond views
- [x] Full planetary textures & Sanskrit names, WebGL stability optimization
- [x] Conversation management (sidebar, titles, new chat, delete, search)
- [x] Stateful Interactions API (interactionId, send only last message)
- [x] Jyotir AI persona (yogi persona, ultra-short responses, simple language)
- [x] Transit Engine (current positions, natal-transit report, intensity sorting)
- [x] "Celestial Wisdom" fallback dictionary

---

## Phase 4: Daily Engagement ✅ COMPLETE (2026-03-29)

### Week 1-2: Table Stakes ✅

- [x] Daily horoscope generation (`horoscope.ts` + `/horoscope/personal/daily`)
- [x] Current Dasha period display (`useDashaMonitor` hook + 30/7/0 day preparation sequence)
- [x] Basic transit overlay (current positions, key transits highlighted)

### Week 3-4: Astrological Depth ✅

- [x] D9 (Navamsa) chart display (via `/vedic/divisional-chart`)
- [x] Top Yogas detection & display (YogaCard + useYogas)
- [x] Weekly predictions (tab toggle in DailyForecast)
- [x] Panchang integration (PanchangCard + usePanchang)

### Week 5-6: Engagement Loop ✅

- [x] Transit alerts (proactive toasts via useProactiveTriggers)
- [x] Remedy section (RemediesCard + useRemedies)
- [x] Panchang → proactive triggers (Rahu Kaal alerts + Tithi morning nudges)
- [x] Personalized evening reflection (transit/nakshatra-aware)

### Week 7-8: Differentiation Polish ✅

- [x] Conversation management (titles, archive, new chat)
- [x] Kundli matching (36-point Guna Milan in Compatibility page)
- [x] Memory references (Atman consciousness system)
- [x] Shareable chart images (ChartShareModal + `/render/natal` + `/svg/natal`)
- [x] PDF report generation (`/pdf/natal-report` + download button in DailyForecast)
- [x] Monthly horoscope (`/horoscope/personal/monthly` + Monthly tab)

### Dashboard ✅

- [x] Create `src/pages/Dashboard.tsx` with route `/dashboard`
- [x] Kundali summary card with real-time profile data
- [x] Navigation back to Synthesis (Chat)

### Forecasts ✅

- [x] Weekly horoscope (via `POST /horoscope/personal/weekly`)
- [x] Monthly horoscope (via `POST /horoscope/personal/monthly`)
- [x] Yearly horoscope (via `POST /horoscope/personal/yearly`)
- [x] Daily/Weekly/Monthly/Yearly tab toggle in `DailyForecast.tsx`
- [x] Period-specific layouts (weekly: key days, monthly: key dates, yearly: quarters)

### Push Notifications ⏳ DEFERRED (Phase 7.2 — Native App)

### PDF Reports ✅

- [x] Wire `POST /pdf/natal-report` → `getNatalReportPDF()`
- [x] Wire `POST /pdf/horoscope/daily` → `getDailyHoroscopePDF()`
- [x] Wire `POST /pdf/horoscope/weekly` → `getWeeklyHoroscopePDF()`
- [x] Add download button in DailyForecast (`chartType: "PDF_NATAL"`)
- [ ] Premium-gate PDF generation
- [ ] Email delivery option

### Rendered Charts & Social Sharing ✅

- [x] Wire `POST /svg/natal` → `getNatalChartSVG()`
- [x] Wire `POST /svg/transit` → `getTransitChartSVG()`
- [x] Wire `POST /render/natal` → `getRenderedNatalChart()`
- [x] `ChartShareModal` (download + WhatsApp share + copy link)
- [x] "Share My Chart" button on Dashboard
- [ ] Wire `POST /render/synastry` → `getRenderedSynastryChart()`
- [ ] Generate Open Graph images for social previews

### Advanced Predictions ✅

- [x] Dasha timeline visualization (`DashaTimeline.tsx` — horizontal bar with sub-periods)
- [x] Yearly prediction summary (via yearly horoscope API)
- [x] Monthly prediction summary (via monthly horoscope API)
- [x] Upcoming significant transits (via transit alerts in proactive triggers)
- [x] Remedy → routine auto-creation (auto-create Dharma routines from remedies)
- [ ] AI-generated remedies (context-aware remedy suggestions in Synthesis)

---

## Phase 4.5: Advanced Consciousness & Relations (Project Atman) ✅ COMPLETE

- [x] **Relational Mapping UI** — Inner Circle management (Partner, Family, Colleagues)
- [x] **Relational Context Injection** — Gemini prompts reference Inner Circle; Gemini 3 Flash Preview for relational analysis; synastry-aware transition alerts
- [x] **The Guru's Journal (Premium UI)** — Immersive "Book of Soul" + "Spiritual Radar" growth charts
- [x] **Advanced Pattern Sync** — Cross-domain karmic detection (Karmic Threads) + Evolution Timeline
- [ ] **Voice Mode Integration** ⏳ DEFERRED — STT interface + grounding AI voice (TTS)

### Recent Achievements (Phase 3.5)
- Soul Insight Card on Dashboard (vibe shifts and growth)
- Proactive Guru Toasts (anniversary wisdom, chaos detection, daily intention reminders)
- Growth Celebration custom event system
- Prana Mode Polish (immersive 3s countdown, manual sound/breath selection)

### Dasha Transition Preparation (Level 2.4) ✅ COMPLETE
- [x] Dasha Monitor Hook — precisely calculates next Antardasha/Mahadasha
- [x] Preparation Sequence — 30 days, 7 days, and transition-day nudges

### Spiritual Wisdom (Level 4) ✅ COMPLETE
- [x] Guru's Journal UI — full-page book-like immersive view
- [x] Spiritual Radar chart (Groundedness, Awareness, Harmony)
- [x] Karmic Thread Detection — AI connects dots across life domains

---

## Phase 5: Vedic Depth ✅ COMPLETE (2026-03-29)

> Wired P0 Vedic API endpoints to close competitive gaps.

### 1. Yoga Analysis ✅ COMPLETE
- [x] Wire `POST /vedic/yoga-analysis` → `getYogaAnalysis()`
- [x] Unified into `kundali.ts` endpoint (`chartType: "YOGAS"`)
- [x] Built `YogaCard.tsx` + `useYogas.ts` hook
- [x] Integrated into Dashboard (Vedic Insights row)

### 2. Panchang Integration ✅ COMPLETE
- [x] Wire `POST /vedic/panchang` → `getPanchang()`
- [x] Unified into `kundali.ts` endpoint (`chartType: "PANCHANG"`)
- [x] Built `PanchangCard.tsx` + `usePanchang.ts` hook
- [x] Integrated into Dashboard (Vedic Insights row)

### 3. Vedic Kundli Matching ✅ COMPLETE
- [x] Wire `POST /vedic/kundli-matching` → `getKundliMatching()`
- [x] Wire `POST /vedic/manglik-dosha` → `getManglikDosha()`
- [x] Updated `compatibility.ts` — Vedic matching runs in parallel with insights
- [x] Built Guna Milan UI (36-point breakdown, progress bars, quality labels)
- [x] Manglik dosha available via `kundali.ts` (`chartType: "MANGLIK"`)

### 4. Vedic Remedies ✅ COMPLETE
- [x] Wire `POST /vedic/remedies` → `getRemedies()`
- [x] Unified into `kundali.ts` (`chartType: "REMEDIES"`)
- [x] Built `RemediesCard.tsx` + `useRemedies.ts` hook
- [x] Integrated into Dashboard sidebar

### 5. Weekly Horoscope ✅ COMPLETE
- [x] Wire `POST /horoscope/personal/weekly` → `getWeeklyHoroscope()`
- [x] Extended `horoscope.ts` to accept `period: 'daily' | 'weekly'`
- [x] Added Daily/Weekly tab toggle to `DailyForecast.tsx`

### API Architecture Cleanup (2026-03-29)
- [x] Fixed 3 broken endpoint paths (dashas, divisional, transits)
- [x] Fixed payload formats for all 10 existing endpoints
- [x] Replaced `/analysis/relationship` with `/charts/synastry`
- [x] Unified `astro-api.ts` — 16 functions, ~340 lines, organized by API category
- [x] Merged all vedic functions into single `kundali.ts` endpoint (7 chartTypes)
- [x] Fixed `useUserProfile.ts` — robust Firestore extraction + localStorage sync
- [x] Fixed `useDashaMonitor.ts` — Firestore profile nesting bug
- [x] Fixed onboarding save reliability + logout data persistence
- [x] Added guest→logged-in profile migration in `AuthContext.tsx`
- [x] `OnboardingModal` now accepts `existingProfile` prop for re-editing

---

## Sprint 0: Quality Hardening ✅ COMPLETE (2026-03-29)

> All quality issues identified and fixed. Every feature now at A+ quality.

### P0: Production Crash Prevention ✅

- [x] **PanchangCard normalization** — `usePanchang.ts` normalizes both flat strings and `{ name, endTime }` objects. Added sunrise/sunset + end-times.
- [x] **RemediesCard nesting** — `useRemedies.ts` normalizes multiple response shapes. Card uses safe `Array.isArray()` extraction.
- [x] **YogaCard field mapping** — `useYogas.ts` normalizes `yoga_name`→`name`, `High`→`strong` strength, `planets_involved`→`planets`. Added category/type badges.
- [x] **SoulInsightCard** — Already had `length >= 3` guard (verified safe).

### P1: Competitive Parity ✅

- [x] **Moon data in DailyForecast** — `horoscope.ts` now fetches panchang in parallel. Moon phase card + Rahu Kaal warning banner in sidebar.
- [x] **Period-specific layouts** — Weekly shows key days, Monthly shows key dates calendar, Yearly shows quarterly breakdown + major transits.
- [x] **Manglik status in Compatibility** — Extracted from vedicMatching. Shows Manglik/Non-Manglik per person. Dosha neutralization logic. Overall recommendation text.
- [x] **Transit Oracle precision** — Visual/Table toggle. Degree°arcminute display. Retrograde (R/D) status. Planet speeds. Aspect orbs.
- [x] **DashaCard on Dashboard** — Shows current Mahadasha + Antardasha with end date + time remaining.

### P2: Polish ✅

- [x] **Panchang end-times + sunrise/sunset** — End-times shown as "until {time}". Sunrise/sunset row added.
- [x] **FestivalCard** — Wired `POST /vedic/festival-calendar`. Shows next 4 upcoming festivals on Dashboard.
- [x] **Compatibility remedies** — 36-point matrix table (color-coded). Remedies section for scores < 18. Nadi analysis warning for < 12.
- [x] **Yoga/Remedies expand** — View all / Show less toggle on both cards.

---

## Phase 5 Remaining: Context & Cache ✅ COMPLETE

### Yoga + Panchang Context Injection into Gemini

- [x] Add Yoga section to `buildJyotishPrompt()` in `gemini.ts` (active yogas, strengths)
- [x] Add Panchang section to `buildJyotishPrompt()` (Tithi, Nakshatra, Rahu Kaal)
- [x] Pass yoga/panchang data from Synthesis page to synthesis API
- [x] Personalize evening reflection with day's dominant transit (Atman Module D)

### Shared Firestore Cache

- [x] Created `shared/cache.ts` with `getCachedOrFetch()`
- [x] Panchang handler uses cache via `getCachedOrFetch("panchang", ...)`
- [x] Update `firestore.rules` to allow read access to shared collections
- [x] Add transit caching: `getCachedOrFetch("transits", date, ...)`

### Feed Panchang into Proactive Triggers
- [x] Feed Panchang data into `useProactiveTriggers` for daily spiritual context
- [x] Cache daily panchang in Firestore (shared collection, not per-user)

### Connect Remedies to Routines
- [x] Auto-create routines from remedy suggestions (Dharma Framework)

### Daily Synastry Alerts (Brain Model Level 3 — Compassion Nudges)

- [x] Fetch partner transits in `useProactiveTriggers.ts` from `keyRelationships`
- [x] Compare partner transits with user's natal chart
- [x] Trigger "Relational Alert" toasts (e.g., "Patience is key today; your communication with [Partner] might be strained")
- [x] Respect relationship types (Partner, Family, Colleague) for tone

### Maintenance & Polish
- [x] **Dasha Timeline Visualization**: Build a beautiful SVG/Canvas horizontal timeline to see current and future dasha periods.
- [x] **Data Export / GDPR Compliance**: Allow users to export all personal data (profile, kundali, chat history, atman consciousness).

---

## Phase 5.5: API Depth Sprint 🔄 (Sprints A-C ✅, D-E partial)

> Wire up remaining high-ROI endpoints to close every competitive gap.
> API: astrology-api.io v3.2.10 — 266 endpoints, currently using 17.

### Sprint A: Horoscope Completeness (4 endpoints → SEO + engagement)

*Neither competitor has AI-personalized monthly/yearly. AstroSage's #1 traffic = sign-based horoscope pages.*

- [x] **Monthly Horoscope**
    - Wire `POST /horoscope/personal/monthly` in `astro-api.ts` → `getMonthlyHoroscope()`
    - Wire `POST /horoscope/personal/monthly/text` → `getMonthlyHoroscopeText()`
    - Add "Monthly" tab to `DailyForecast.tsx` (alongside Daily/Weekly)
    - Add `period: 'monthly'` to `horoscope.ts` handler
- [x] **Yearly Horoscope**
    - Wire `POST /horoscope/personal/yearly` in `astro-api.ts` → `getYearlyHoroscope()`
    - Wire `POST /horoscope/personal/yearly/text` → `getYearlyHoroscopeText()`
    - Create dedicated Yearly Forecast page
    - Premium-gate the full yearly report
- [ ] **SEO Sign Pages** (12 signs x 4 periods = 48 pages)
    - Wire `POST /horoscope/sign/weekly`, `/sign/monthly`, `/sign/yearly` (+ text variants)
    - Create `src/pages/seo/SignHoroscope.tsx` with SSR-friendly layout
    - URL structure: `/horoscope/:sign/:period` (e.g., `/horoscope/aries/monthly`)
    - Add schema markup (Article, HoroscopeCreativeWork)
    - Auto-generate sitemap entries

### Sprint B: Dosha & Advanced Vedic (4 endpoints → competitive parity)

*Every Indian astrology user asks "Sade Sati?", "Kaal Sarpa?", "Manglik?" — AstroSage has dedicated pages.*

- [x] **Sade Sati Detection**
    - Wire `POST /vedic/sade-sati` in `astro-api.ts` → `getSadeSati()`
    - Add `chartType: "SADE_SATI"` to `kundali.ts` handler
    - [x] Build SadeSatiCard component (status, phase, start/end dates, remedies)
    - [x] Integrate into Dashboard + feed into proactive alerts
- [x] **Kaal Sarpa Dosha**
    - Wire `POST /vedic/kaal-sarpa-dosha` in `astro-api.ts` → `getKaalSarpaDosha()`
    - Add `chartType: "KAAL_SARPA"` to `kundali.ts` handler
    - [x] Display in Kundali analysis section
- [x] **Nakshatra Predictions**
    - Wire `POST /vedic/nakshatra-predictions` in `astro-api.ts` → `getNakshatraPredictions()`
    - Add `chartType: "NAKSHATRA"` to `kundali.ts` handler
    - [x] Build NakshatraCard for Dashboard
- [x] **Ashtakvarga Strength**
    - Wire `POST /vedic/ashtakvarga` in `astro-api.ts` → `getAshtakvarga()`
    - Add `chartType: "ASHTAKVARGA"` to `kundali.ts` handler
    - [x] Build strength scoring visualization

### Sprint C: PDF Reports & Shareable Charts (8 endpoints → monetization + virality)

*AstroTalk charges ₹500+ per report. Shareable charts = free organic growth.*

- [x] **PDF Reports**
    - Wire `POST /pdf/natal-report` → `getNatalReportPDF()`
    - Wire `POST /pdf/horoscope/daily` → `getDailyHoroscopePDF()`
    - Wire `POST /pdf/horoscope/weekly` → `getWeeklyHoroscopePDF()`
    - Create download UI in Dashboard + Forecast pages
    - [ ] Premium-gate PDF generation
- [x] **Rendered Chart Images (SVG/PNG)**
    - Wire `POST /svg/natal` → `getNatalChartSVG()`
    - Wire `POST /svg/transit` → `getTransitChartSVG()`
    - Wire `POST /render/natal` → `getRenderedNatalChart()`
    - [ ] Wire `POST /render/synastry` → `getRenderedSynastryChart()`
    - Build ChartShareModal (download as image + share to WhatsApp/Twitter/Instagram)
    - [ ] Generate Open Graph images from chart SVGs

### Sprint D: Unique Differentiators (endpoints no competitor uses)

*These features don't exist in AstroTalk or AstroSage — pure competitive moat.*

- [ ] **Astrocartography** (13 endpoints)
    - Wire `POST /astrocartography/map` → `getAstrocartographyMap()`
    - Wire `POST /astrocartography/power-zones` → `getPowerZones()`
    - Wire `POST /astrocartography/location-analysis` → `getLocationAnalysis()`
    - Create AstroMap page with interactive map ("Where should I live/travel?")
    - Premium feature
- [ ] **Wellness & Biorhythms** (6 endpoints)
    - Wire `POST /insights/wellness/biorhythms` → `getBiorhythms()`
    - Wire `POST /insights/wellness/wellness-score` → `getWellnessScore()`
    - Wire `POST /insights/wellness/moon-wellness` → `getMoonWellness()`
    - Wire `POST /insights/wellness/energy-patterns` → `getEnergyPatterns()`
    - Build Wellness Dashboard tab (biorhythm chart, energy forecast, moon wellness)
    - Feed into Dharma Framework (routine suggestions based on energy patterns)
- [ ] **Relationship Intelligence** (4 endpoints — beyond basic matching)
    - Wire `POST /insights/relationship/love-languages` → `getLoveLanguages()`
    - Wire `POST /insights/relationship/red-flags` → `getRedGreenFlags()`
    - Wire `POST /insights/relationship/timing` → `getRelationshipTiming()`
    - Wire `POST /insights/relationship/davison` → `getDavisonChart()`
    - Enhance Compatibility page with red/green flags + timing + Davison chart
- [x] **Eclipses** (3 endpoints)
    - Wire `GET /eclipses/upcoming` → `getUpcomingEclipses()`
    - Wire `POST /eclipses/natal-check` → `getEclipseNatalImpact()`
    - [ ] Wire `POST /eclipses/interpretation` → `getEclipseInterpretation()`
    - [x] Build Eclipse Alert system in proactive triggers
    - [x] Create Eclipse page with impact analysis
- [x] **Lunar Intelligence** (5 endpoints)
    - Wire `POST /lunar/phases` → `getLunarPhases()`
    - Wire `POST /lunar/void-of-course` → `getVoidOfCourse()`
    - [ ] Wire `POST /lunar/mansions` → `getLunarMansions()`
    - [x] Feed Void of Course + Moon Phase into proactive alerts
    - [x] Add lunar phase indicator to Dashboard

### Sprint E: Expansion Systems (Phase 7 enablers)

*Wire now for future pages — tarot, numerology, human design.*

- [x] **Numerology** (5 endpoints)
    - Wire `POST /numerology/comprehensive` → `getNumerologyReading()`
    - Wire `POST /numerology/core-numbers` → `getCoreNumbers()`
    - [ ] Wire `POST /numerology/compatibility` → `getNumerologyCompatibility()`
    - [x] Create Numerology page
- [x] **Tarot** (7 key endpoints)
    - Wire `GET /tarot/cards/daily` → `getDailyTarotCard()`
    - Wire `POST /tarot/reports/three-card` → `getThreeCardReading()`
    - [ ] Wire `POST /tarot/reports/celtic-cross` → `getCelticCrossReading()`
    - [ ] Wire `POST /tarot/cards/draw` → `drawTarotCards()`
    - [x] Create Tarot page with daily card + on-demand readings
- [ ] **Human Design** (4 key endpoints)
    - Wire `POST /human-design/bodygraph` → `getBodygraph()`
    - Wire `POST /human-design/bodygraph-svg` → `getBodygraphSVG()`
    - Wire `POST /human-design/type` → `getHumanDesignType()`
    - Wire `POST /human-design/compatibility` → `getHDCompatibility()`
    - Create Human Design page
- [ ] **Advanced Vedic** (5 endpoints)
    - Wire `POST /vedic/shadbala` → `getShadbala()`
    - Wire `POST /vedic/varshaphal` → `getVarshaphal()`
    - Wire `POST /vedic/kp-system` → `getKPSystem()`
    - Wire `POST /vedic/chara-dasha` → `getCharaDasha()`
    - Wire `POST /vedic/regional-panchang` → `getRegionalPanchang()`

---

## Phase 5.5B: Growth & Acquisition Mechanics 🔄 (Core items ✅, SEO/email/referral pending)

> **Reality check**: Features alone don't win. These are the growth mechanics that
> AstroSage/AstroTalk use to acquire and retain millions of users. Without these,
> nobody discovers our superior product.

### Free Kundali SEO Trap (AstroSage's #1 Growth Hack)

*"free kundali" = millions of monthly Google searches. AstroSage captures all of it.*

- [x] Create `/free-kundali` page — NO signup required
    - [x] Simple form: name, DOB, TOB, POB
    - [x] Instant chart generation via `/api/kundali` (guest mode)
    - [x] Show: basic chart SVG, Moon sign, Sun sign, Ascendant, current Dasha
    - [ ] Show 1-2 yogas as teaser ("You have Gajakesari Yoga — create account for full analysis")
    - [x] CTA: "Get your complete AI-powered reading — Free account"
- [ ] SEO optimization for `/free-kundali`:
    - [ ] Title: "Free Kundali Online | Instant Birth Chart & Predictions | AstroYou"
    - [ ] Schema markup: `SoftwareApplication` + `FAQPage`
    - [ ] Target keywords: "free kundali", "kundli online", "birth chart free", "janam kundali"
    - [ ] Internal links to sign pages, compatibility, dashboard
- [x] Create `/free-kundali-matching` page — same pattern for matching
    - [x] Two-person form, instant Guna Milan score (teaser: 3 of 8 gunas shown free)
    - [x] CTA: "See all 36 points + AI analysis — Create account"
    - [ ] Target: "kundli matching free", "gun milan online"

### Daily Email & WhatsApp Digest

*AstroSage sends millions of daily emails. AstroTalk sends WhatsApp messages. We send nothing.*

- [ ] **Morning Horoscope Email** (7 AM IST)
    - [ ] Create `netlify/functions/scheduled/morning-digest.ts` (Netlify scheduled function)
    - [ ] Query all users with `profile.email` + `notifications.dailyEmail: true`
    - [ ] Generate personalized 3-line horoscope per user (batch Gemini calls or sign-based)
    - [ ] Send via Resend API (already integrated)
    - [ ] Include: today's theme, lucky color/number, Rahu Kaal timing
    - [ ] CTA: "Open full forecast →" deep link to DailyForecast
- [ ] **Weekly Digest Email** (Monday 7 AM IST)
    - [ ] Week-ahead summary: key days, major transits, dasha updates
    - [ ] "Your week at a glance" format
- [ ] **WhatsApp Integration** (via WhatsApp Business API)
    - [ ] Apply for WhatsApp Business API access
    - [ ] Create message templates (daily horoscope, Rahu Kaal alert, transit alert)
    - [ ] User opt-in during onboarding: "Get daily horoscope on WhatsApp?"
    - [ ] Store WhatsApp number in user profile
    - [ ] Send daily horoscope at 7 AM via template message
- [ ] **Notification Preferences** in settings page:
    - [ ] Toggle: daily email, weekly email, WhatsApp daily, transit alerts
    - [ ] Store in `users/{uid}/notifications` sub-object

### Onboarding Value Hook (Show Value Before Signup)

*Current flow: give us everything → see nothing → dashboard. Users drop off.*

- [x] **Instant Preview after birth data entry** (before account creation):
    - [x] After Step 3 (birth place), show a "Quick Preview" card:
        - Moon Sign + element
        - Current Dasha lord + one-line meaning
        - One detected yoga (if any)
        - "Your full chart has 12 houses, 9 planets, and 27 nakshatras analyzed. Create account to explore →"
    - [x] Call `/api/kundali` with guest data in background during steps 3-4
    - [x] Preview appears on Step 4 (current location) as a motivational element
- [x] **Progress gamification**:
    - [x] "Spiritual Profile: 40% complete" progress bar on Dashboard
    - [x] Sections: Birth chart, Daily practice, Relationships, Consciousness
    - [x] Each section unlocks as user engages with features
    - [x] Completing all → special "Evolved Soul" badge

### PWA (Progressive Web App) — Free "Native" Install

*No native app yet (Phase 7.2). PWA is free, works today, puts us on home screen.*

- [x] Create `public/manifest.json` with app metadata
    - [x] App name, short name, description
    - [ ] Icons: 192x192, 512x512 (dark cosmic themed)
    - [x] Theme color: #030308, background color: #030308
    - [x] Display: standalone, orientation: portrait
- [x] Create service worker (`public/sw.js`)
    - [x] Cache critical assets (app shell, fonts, icons)
    - [ ] Cache last-viewed horoscope + chart for offline access
    - [ ] Background sync: queue messages sent while offline
- [x] Add install prompt component
    - [x] Detect `beforeinstallprompt` event
    - [x] Show subtle "Add to Home Screen" banner after 2nd visit
    - [ ] "Install AstroYou" button in settings
- [ ] Add `<meta>` tags for iOS PWA support
    - [ ] `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`
    - [ ] Apple touch icons

### Viral Sharing Mechanics

*Charts and horoscopes are inherently shareable. We have no sharing flow.*

- [ ] **Share Your Sign Card** (Instagram Story format: 1080x1920)
    - [ ] Auto-generate image: user's Moon sign + key trait + AstroYou branding
    - [ ] "Share to Instagram Story" / "Share to WhatsApp" / "Download" buttons
    - [ ] Template: cosmic dark background, gold text, sign symbol
- [ ] **Share Compatibility Result**
    - [ ] Generate shareable card: "We're 78% compatible! ♥ Check yours →"
    - [ ] Unique link: `astroyou.com/match?ref={userId}` (tracks referral)
    - [ ] WhatsApp share with preview image
- [x] **Share Daily Horoscope**
    - [x] "Share today's forecast" button on DailyForecast page
    - [x] Generates card with today's theme + rating + sign
    - [ ] Link back to free sign horoscope page (SEO + acquisition)
- [ ] **Referral System** (early — don't wait for Phase 7)
    - [ ] Unique referral code per user: `STAR{userId[:6]}`
    - [ ] Share link: `astroyou.com/?ref=STAR123ABC`
    - [ ] Reward: referrer gets 5 free consultation minutes, referee gets 3 free minutes
    - [ ] Track referrals in `users/{uid}/referrals` sub-collection
    - [ ] Referral dashboard: "You've invited 3 friends, earned 15 minutes"

### Analytics & Conversion Funnel

*You can't optimize what you don't measure.*

- [x] **Firebase Analytics** setup
    - [x] Track: page views, feature usage, session duration
    - [x] Custom events: `onboarding_complete`, `first_chat`, `first_payment`, `consultation_start`
    - [ ] User properties: sign, subscription tier, credits balance
- [ ] **Conversion funnel tracking**
    - [ ] Landing → Onboarding start (%)
    - [ ] Onboarding start → Onboarding complete (%)
    - [ ] Onboarding complete → First chat (%)
    - [ ] First chat → First payment (%)
    - [ ] Free → Premium conversion rate
    - [ ] D1/D7/D30 retention curves
- [ ] **Revenue metrics**
    - [ ] ARPU (average revenue per user)
    - [ ] LTV (lifetime value)
    - [ ] Per-minute consultation revenue
    - [ ] Subscription MRR
- [ ] **A/B testing infrastructure**
    - [ ] Firebase Remote Config for feature flags
    - [ ] Test: pricing (₹5 vs ₹8/min), free minutes (3 vs 5), onboarding steps

### First-Day Experience Optimization

*After onboarding, what makes a user come back tomorrow?*

- [ ] **Immediate value delivery** (within 30 seconds of account creation):
    - [ ] Auto-navigate to Dashboard (already done ✅)
    - [ ] Show personalized "Welcome, {name}. Your Moon is in {sign}" message
    - [ ] First daily horoscope already loaded (pre-fetched during onboarding)
    - [ ] Proactive toast: "Your first cosmic insight is ready" pointing to daily forecast
- [ ] **Day 1 engagement hooks**:
    - [ ] Evening (8 PM): Email/WhatsApp: "How was your day? Your stars predicted {theme}. See tomorrow's forecast →"
    - [ ] If user hasn't returned by 6 PM: Push "Your evening reflection is waiting" (if PWA installed)
- [ ] **Day 2-7 nurture sequence**:
    - [ ] Day 2: "Your Dasha period: what it means for this year" (email)
    - [ ] Day 3: "Try our AI Astrologer — 3 free minutes" (email/WhatsApp)
    - [ ] Day 5: "Your weekly forecast is ready" (email)
    - [ ] Day 7: "You've been with us a week! Here's your growth summary" (in-app + email)
- [ ] **Gamification hooks**:
    - [ ] Daily login streak counter (visible on Dashboard)
    - [ ] "Cosmic Explorer" badges: first chat, first match, 7-day streak, 30-day streak
    - [ ] Streak benefits: 7-day streak = 1 free consultation minute

### Customer Support

- [x] Create `/help` FAQ page
    - [x] Accordion-style FAQ: "How accurate is AI?", "How is my data stored?", "How do credits work?"
    - [x] Contact form / email link
- [ ] In-app help button (? icon in header)
    - [ ] Opens FAQ or starts support chat
- [ ] Create `support@astroyou.com` email
- [ ] Add "Report Issue" option in settings

---

## Phase 5 (Relationships): Synastry ✅ / Profiles & Friends ⏳

### Relationship Synthesis (Synastry) ✅ COMPLETE

- [x] Partner details input form + Kundali calculation
- [x] Modern Synastry Engine (Emotional, Communication, Physical, Long-term)
- [x] Love Blueprint (Love Languages)
- [x] AI interpretation of compatibility (`Compatibility.tsx`)

### User Profiles ⏳

- [ ] Add `username` field to user schema
- [ ] Username uniqueness validation
- [ ] Create public profile page `/u/{username}`
- [ ] Privacy settings (public/private chart)
- [ ] Profile picture upload + Bio
- [ ] Share profile link button

### Friends System ⏳

- [ ] Create `friends` subcollection in Firestore
- [ ] Search users by email or username
- [ ] Send/receive friend requests, accept/decline UI
- [ ] Friends list in dashboard, view friends' public charts
- [ ] Unfriend functionality

### Chart Comparison ⏳

- [ ] Synastry view (two charts overlaid)
- [ ] Side-by-side chart comparison
- [ ] Highlight inter-chart aspects
- [ ] AI-powered relationship insights
- [ ] Save comparison for future reference

---

## Phase 5.6: AI Astrologer Marketplace 🔄 (Personas ✅, Chat ✅, Billing/Reviews partial)

> **Insight**: AstroTalk charges ₹15-100/min for "human astrologers" — many are actually bots.
> We build the same UX pattern (browse experts → pick one → pay per min) but with transparent,
> BETTER AI. 10x cheaper. Always online. Actually remembers your chart.
>
> **Strategy**: Route A (marketplace UX) for ACQUISITION → Route B (spiritual companion) for RETENTION.
> Users discover us through the familiar "talk to astrologer" pattern, then stay for Atman/Prana/Dharma.

### AI Astrologer Personas

- [x] Design 6-8 AI personas with distinct specialties:
    - [x] **Guru Vidyanath** — Spiritual guidance, meditation, karma (uses Guru prompt persona)
    - [x] **Arjun Sharma** — Career, finance, business timing (uses career-focused prompt)
    - [x] **Meera Devi** — Love, marriage, relationships (uses relationship prompt)
    - [x] **Pandit Raghunath** — Traditional Vedic, doshas, remedies (uses classical Jyotish prompt)
    - [x] **Dr. Shanti** — Health, wellness, biorhythms (uses wellness prompt)
    - [x] **Nanda Ji** — Family, children, property, muhurat (uses practical life prompt)
- [x] Create persona data model (`src/lib/personas.ts`)
    ```
    { name, title, specialty, avatar, bio, languages, rating, totalConsultations,
      pricePerMin, systemPrompt, isOnline: true, responseStyle }
    ```
- [ ] Generate high-quality avatar images for each persona
- [x] Write distinct system prompts per persona (promptModifier in each persona)
- [x] Each persona uses the SAME Atman/Kundali/Transit engine underneath

### Marketplace UI (AstroTalk-style UX)

- [x] Create `/consult` page — Browse AI Astrologers grid
    - [x] Persona cards: avatar, name, specialty, rating, price, "Online" badge
    - [x] Filter by specialty (Career, Love, Spiritual, Health, Family)
    - [x] Sort by rating / price / popularity
- [ ] Create `/consult/:personaId` — Astrologer profile page (currently navigates directly to chat)
    - [ ] Full bio, specialties, languages, sample responses
    - [ ] "Start Consultation" CTA with price display
    - [ ] Rating display + review count
    - [ ] "Always Available" badge (competitive advantage)
- [x] Create `/consult/:personaId/chat` — Consultation chat view
    - [x] Same Synthesis streaming engine, different persona prompt
    - [x] Per-minute timer with live cost display
    - [ ] "Add more time" button
    - [x] Auto-end when credits/balance exhausted
    - [ ] Consultation summary generated at end (partial)
- [ ] Consultation history page — past sessions with each astrologer

### Per-Minute Billing System

- [ ] Credit-to-minutes conversion: 1 credit = 1 minute
- [ ] Real-time minute counter during consultation (visible to user)
- [ ] Auto-deduct credits per minute (not per message — timer-based like AstroTalk)
- [ ] "Low balance" warning at 2 minutes remaining
- [ ] Session auto-end with graceful "time's up" message
- [ ] "Buy more minutes" inline during consultation
- [ ] Consultation receipt (persona, duration, cost, summary)

### Rating & Review System

- [x] Post-consultation rating prompt (1-5 stars)
- [ ] Optional text review
- [ ] Display average rating + review count on persona cards
- [ ] Store in `astrologers/{personaId}/reviews/{reviewId}`
- [ ] Sort/filter personas by rating

### Competitive Pricing (AstroTalk Disruption)

- [ ] Price tiers per persona complexity:
    - [ ] Standard personas: ₹5/min (vs AstroTalk ₹15-40/min)
    - [ ] Premium personas: ₹10/min (vs AstroTalk ₹40-100/min)
- [ ] First 3 minutes free (hook users)
- [ ] Subscription benefit: Premium users get 50% off per-minute rates
- [ ] "Why pay ₹100/min?" — comparison marketing on pricing page

### Technical Implementation

- [ ] Create `netlify/functions/consult.ts` — Consultation session manager
    - [ ] Start session: create session doc, set timer, load persona prompt
    - [ ] Stream messages: reuse `synthesizeStream()` with persona-specific prompt
    - [ ] End session: generate summary, save review prompt, deduct final credits
- [ ] Create `src/hooks/useConsultation.ts` — Client-side session manager
    - [ ] Timer state, credit tracking, auto-end logic
    - [ ] Session persistence in Firestore
- [ ] Extend `shared/gemini.ts` — Add `buildPersonaPrompt(personaId, userContext)`
    - [ ] Load persona config from Firestore or hardcoded map
    - [ ] Inject same Atman/Kundali/Transit context as Synthesis
    - [ ] Add persona-specific response style (formal, warm, direct, spiritual)
- [x] Create `src/pages/Consult.tsx` — Marketplace browse page
- [x] Create `src/pages/ConsultChat.tsx` — Per-minute chat page
- [x] Add `/consult` to main navigation

### Marketing Angle

> "Expert AI astrologers. ₹5/min. Always online. Actually know your chart."
>
> Unlike other platforms where you wait 10 minutes, pay ₹100/min, and get generic answers
> from someone who hasn't studied your chart — our AI experts have already analyzed your
> complete Kundali, current Dasha, active transits, and life patterns before you even say hello.

---

## Phase 6: Premium Business ⏳

### Subscription Tiers (Updated with Marketplace)

- [ ] Define tier structure:
    - [ ] **Free**: 5 credits, basic horoscope, 3 free consultation minutes
    - [ ] **Premium (₹499/mo)**: Unlimited Synthesis chat, daily/weekly/monthly horoscopes, 60 consultation minutes/mo, PDF reports
    - [ ] **Pro (₹999/mo)**: All Premium + unlimited consultation minutes, yearly reports, priority personas, astrocartography
- [ ] Create pricing page with AstroTalk comparison ("₹5/min vs ₹100/min")
- [ ] Implement feature gating
- [ ] Show upgrade prompts at right moments (after free minutes exhausted)

### Razorpay Subscriptions

- [ ] Integrate Razorpay Subscriptions API
- [ ] Create subscription plans in Razorpay dashboard
- [ ] Implement subscription checkout flow
- [ ] Handle subscription webhooks
- [ ] Update user tier on webhook events
- [ ] Implement grace period for failed payments

### Subscription Management

- [ ] Create `/settings/subscription` page
- [ ] Show current plan and billing date
- [ ] Upgrade / downgrade options
- [ ] View payment history
- [ ] Cancel subscription (with retention flow)
- [ ] Invoice download

### Admin Dashboard

- [ ] Create `/admin` protected route
- [ ] Role-based access control
- [ ] User analytics (total users, DAU/MAU, conversion rate, churn rate)
- [ ] Revenue dashboard (MRR, transaction history, subscription breakdown)
- [ ] Content moderation tools
- [ ] User management (view, suspend, delete)

---

## Phase 7: Market Leadership ⏳

> **Goal**: Close competitive gaps and establish market dominance

### 7.1 Regional Language Support

- [ ] Implement i18n infrastructure (react-i18next)
- [ ] Hindi interface translation (primary)
  - [ ] All UI strings
  - [ ] Onboarding flow
  - [ ] Dashboard & Synthesis
  - [ ] Error messages
- [ ] AI responses in Hindi
  - [ ] Update Gemini system prompt for Hindi output
  - [ ] Language preference in user profile
- [ ] Tamil language support
- [ ] Telugu language support
- [ ] Bengali language support
- [ ] Marathi language support
- [ ] Voice input in regional languages
- [ ] Language switcher component
- [ ] RTL support for Urdu (future)

### 7.2 Native Mobile Apps

- [ ] Set up React Native / Expo project
- [ ] Wrap existing PWA with WebView (Phase 1)
- [ ] iOS App Store submission
  - [ ] Apple Developer account
  - [ ] App Store Connect listing
  - [ ] Screenshots & preview video
  - [ ] App Review compliance
- [ ] Android Play Store submission
  - [ ] Google Play Console setup
  - [ ] Store listing optimization
  - [ ] Privacy policy compliance
- [ ] Native push notifications
  - [ ] Firebase Cloud Messaging (Android)
  - [ ] Apple Push Notification Service (iOS)
- [ ] Offline access
  - [ ] Cache birth chart data
  - [ ] Cache daily horoscope
  - [ ] Sync on reconnect
- [ ] App Store Optimization (ASO)
  - [ ] Keyword research
  - [ ] A/B test icons & screenshots
  - [ ] Review solicitation flow

### 7.3 Marketplace & E-commerce

- [ ] Gemstone recommendation engine
  - [ ] Map planets to gemstones
  - [ ] Weak planet analysis
  - [ ] AI-powered recommendations
- [ ] E-commerce integration
  - [ ] Product catalog (gemstones, rudraksha, yantras)
  - [ ] Shopping cart
  - [ ] Razorpay payment for products
  - [ ] Order management
- [ ] Puja booking services
  - [ ] Temple partnership outreach
  - [ ] Puja catalog (Satyanarayan, Navagraha, etc.)
  - [ ] Date/slot selection
  - [ ] Booking confirmation & tracking
- [ ] Personalized remedy kits
  - [ ] Curated based on Kundali
  - [ ] Subscription boxes (monthly)
- [ ] Shipping integration
  - [ ] Shiprocket / Delhivery API
  - [ ] Order tracking
  - [ ] Returns handling

### 7.4 SEO Content Moat

- [ ] Daily horoscope pages (12 signs x 365 days)
  - [ ] URL structure: `/horoscope/aries/today`
  - [ ] Auto-generation from AI
  - [ ] Schema markup (Article, HoroscopeCreativeWork)
- [ ] Weekly & monthly horoscope pages
- [ ] Celebrity Kundali database
  - [ ] Bollywood stars (Shah Rukh Khan, Deepika, etc.)
  - [ ] Cricketers (Virat, Dhoni, Rohit)
  - [ ] Politicians (Modi, historical figures)
  - [ ] URL structure: `/celebrity/shah-rukh-khan`
- [ ] Festival & Muhurat pages
  - [ ] Diwali 2026 Muhurat
  - [ ] Navratri dates
  - [ ] Karwa Chauth timing
  - [ ] Griha Pravesh Muhurat
- [ ] Panchang calendar pages
  - [ ] Daily Panchang: `/panchang/2026-01-05`
  - [ ] Tithi, Nakshatra, Yoga, Karana
  - [ ] Rahu Kaal, Choghadiya
- [ ] Transit analysis articles
  - [ ] Saturn transit predictions
  - [ ] Rahu/Ketu transit effects
  - [ ] Jupiter transit opportunities
- [ ] Utility pages
  - [ ] "Best time to buy property"
  - [ ] "Best time to start business"
  - [ ] "Auspicious wedding dates 2026"
- [ ] Internal linking strategy
- [ ] Sitemap auto-generation
- [ ] Structured data for rich snippets

### 7.5 Human Astrologers Marketplace

- [ ] Astrologer onboarding portal
  - [ ] Application form
  - [ ] Document verification (certificates, ID)
  - [ ] Test consultation review
  - [ ] Approval workflow
- [ ] Astrologer profile pages
  - [ ] Photo, bio, specializations
  - [ ] Credentials & certifications
  - [ ] Languages spoken
  - [ ] Availability calendar
  - [ ] Reviews & ratings
- [ ] Consultation infrastructure
  - [ ] Video call (WebRTC or Agora/Twilio)
  - [ ] Voice call
  - [ ] Chat-based consultation
  - [ ] Screen sharing for chart review
- [ ] Booking system
  - [ ] Real-time availability
  - [ ] Slot booking with payment
  - [ ] Reminder notifications
  - [ ] Rescheduling & cancellation
- [ ] Payment & commission
  - [ ] Platform fee (20-30%)
  - [ ] Astrologer payout dashboard
  - [ ] Weekly/monthly settlements
- [ ] Quality control
  - [ ] Post-call rating prompt
  - [ ] Dispute resolution
  - [ ] Performance analytics

### 7.6 Advanced Astrological Features (API Endpoints Available)

- [ ] Prashna Kundali (horary astrology)
  - API: `POST /horary/analyze`, `POST /horary/chart`, `POST /horary/aspects`
  - [ ] Question-based chart casting
  - [ ] AI interpretation for horary
- [ ] Varshphal (annual chart)
  - API: `POST /vedic/varshaphal`
  - [ ] Solar return calculation + year lord + annual predictions
- [ ] Ashtakvarga scoring
  - API: `POST /vedic/ashtakvarga`
  - [ ] Sarvashtakvarga table + Bhinnashtak charts + transit strength
- [ ] Shadbala (six-fold strength)
  - API: `POST /vedic/shadbala`
  - [ ] Planet strength visualization
- [ ] Full divisional charts
  - API: `POST /vedic/divisional-chart` (already wired, pass charts: ["D3","D4","D7","D10","D12","D24"])
  - [ ] D10 (Dashamsha - career), D7 (Saptamsha - children), D12 (parents), D3 (siblings)
- [ ] KP (Krishnamurti Paddhati) system
  - API: `POST /vedic/kp-system`
  - [ ] Sub-lord theory, cuspal positions, significators
- [ ] Chara Dasha (Jaimini)
  - API: `POST /vedic/chara-dasha`
  - [ ] Alternative dasha system
- [ ] Yogini Dasha
  - API: `POST /vedic/yogini-dasha`
  - [ ] Simpler dasha system popular in North India
- [ ] Traditional Western techniques
  - API: `POST /traditional/profections`, `/traditional/lots`, `/traditional/dignities`
  - [ ] Annual profections, Arabic lots, essential dignities
- [ ] Fixed Stars
  - API: `POST /fixed-stars/conjunctions`, `/fixed-stars/report`
  - [ ] Star conjunctions with natal planets
- [ ] Chinese Astrology (BaZi)
  - API: `POST /chinese/bazi`, `/chinese/compatibility`, `/chinese/yearly-forecast`
  - [ ] Four Pillars of Destiny
- [ ] Palmistry
  - API: `POST /palmistry/reading`, `/palmistry/astro` (uses image upload)
  - [ ] Palm reading from uploaded photo
- [ ] Feng Shui
  - API: `POST /fengshui/flying-stars/chart`, `GET /fengshui/flying-stars/annual/{year}`
  - [ ] Annual flying stars + afflictions
- [ ] Runes
  - API: `GET /runes/runes/daily`, `POST /runes/reports/three-rune`
  - [ ] Daily rune + spread readings
- [ ] Kabbalah
  - API: `POST /kabbalah/birth-angels`, `/kabbalah/tikkun`, `/kabbalah/tree-of-life-chart`
  - [ ] Tree of Life chart + birth angels

### 7.7 Community & Virality

- [ ] Discussion forums
  - [ ] Categories by zodiac sign
  - [ ] Topic threads (career, love, health)
  - [ ] Moderation tools
  - [ ] Upvotes & best answers
- [ ] WhatsApp integration
  - [ ] Daily horoscope sharing
  - [ ] One-click share buttons
  - [ ] WhatsApp Business API for notifications
- [ ] Social media features
  - [ ] Auto-generate shareable chart images
  - [ ] Instagram story templates
  - [ ] Twitter/X card optimization
- [ ] Astrology courses
  - [ ] Beginner: "Understand Your Kundali"
  - [ ] Intermediate: "Predict with Transits"
  - [ ] Advanced: "Professional Astrologer Training"
  - [ ] Video lessons + quizzes
  - [ ] Certification on completion
- [ ] Referral program
  - [ ] Unique referral codes
  - [ ] Credit rewards for referrer & referee
  - [ ] Leaderboard
- [ ] Influencer partnerships
  - [ ] Affiliate program
  - [ ] Sponsored content guidelines
  - [ ] Tracking & attribution

### 7.8 Social Proof & Trust Signals

- [ ] Testimonials collection
  - [ ] Post-consultation prompt
  - [ ] "My prediction came true" submissions
  - [ ] Photo + story format
- [ ] Display testimonials on landing page
- [ ] Astrologer credentials showcase
  - [ ] University degrees
  - [ ] Years of experience
  - [ ] Certifications (Jyotish Acharya, etc.)
- [ ] Media mentions section
  - [ ] Press coverage collection
  - [ ] "As seen in..." badges
- [ ] Prediction accuracy tracking
  - [ ] User feedback on past predictions
  - [ ] Aggregate accuracy metrics
  - [ ] Transparency reports
- [ ] Trust badges
  - [ ] SSL secure
  - [ ] Payment security (PCI compliance)
  - [ ] Data privacy certifications

---

## Infrastructure & Launch

### Deployment & Production Setup

- [ ] Configure Netlify environment variables
- [ ] Add production domain to Firebase Auth
- [ ] Configure Resend production domain (for deliverability)
- [ ] Set up error monitoring (Sentry or similar)
- [ ] Configure CDN caching headers
- [ ] Set up staging environment

### Security Hardening

- [ ] Audit Firebase security rules
- [ ] Add API rate limiting
- [ ] Implement CSRF protection
- [ ] Add input sanitization on all endpoints
- [ ] Validate all user inputs server-side
- [ ] Security audit before launch

### Performance Optimization

- [ ] Bundle analysis and optimization
- [ ] Image optimization pipeline
- [ ] Lazy load non-critical components
- [ ] Preload critical assets
- [ ] Measure and optimize Core Web Vitals

### Technical Excellence

**Error Handling**
- [x] Global error boundary component
- [x] Friendly error messages for all failures
- [x] Retry mechanisms for network errors
- [x] Offline state detection and handling
- [ ] Error logging to monitoring service

**Loading States**
- [x] Skeleton loaders for all data-fetching views
- [ ] Progress indicators for long operations
- [ ] Optimistic UI updates where appropriate
- [ ] Smooth transitions between states

**Accessibility**
- [x] ARIA labels on all interactive elements
- [x] Keyboard navigation support
- [ ] Screen reader testing
- [ ] Color contrast compliance (WCAG AA)
- [x] Focus management for modals

**SEO & Discoverability**
- [x] Meta tags on all pages
- [x] Open Graph tags for social sharing
- [x] Twitter Card tags
- [x] Structured data (JSON-LD)
- [x] Sitemap.xml + robots.txt
- [x] Canonical URLs

### Testing

- [ ] Unit tests for utility functions
- [ ] Component tests for critical UI
- [ ] Integration tests for auth flows
- [ ] E2E tests with Playwright
- [ ] Visual regression tests

### Documentation

- [ ] API documentation for all endpoints
- [ ] Component storybook (optional)
- [ ] README with setup instructions
- [ ] Contributing guidelines

### Launch Checklist

**Pre-Launch**
- [ ] All Phase 1-4 features complete
- [ ] Full security audit passed
- [ ] Performance benchmarks met
- [ ] Cross-browser testing complete
- [ ] Mobile responsiveness verified
- [ ] Accessibility audit passed
- [ ] Legal: Privacy Policy
- [ ] Legal: Terms of Service
- [ ] Data Export / GDPR compliance (export all user data: profile, kundali, chats, atman consciousness)
- [ ] Analytics setup (Firebase Analytics)
- [ ] Error monitoring active

**Launch Day**
- [ ] DNS configured for production domain
- [ ] SSL certificate active
- [ ] CDN configured
- [ ] Database backups enabled
- [ ] Monitoring dashboards ready
- [ ] Support channels ready

**Post-Launch**
- [ ] Monitor error rates
- [ ] Monitor performance metrics
- [ ] Gather user feedback
- [ ] Iterate based on usage patterns
- [ ] Plan Phase 6-7 features

---

## Quality Standards

### Code Quality
- TypeScript strict mode
- Comprehensive error handling
- Loading states for all async operations
- Proper accessibility (ARIA, keyboard nav)
- Performance optimization (lazy loading, memoization)

### User Experience
- <3 second page loads
- Smooth 60fps animations
- Mobile-first responsive design
- Intuitive navigation
- Delightful micro-interactions

### Security
- Firebase security rules enforced
- API rate limiting
- Input validation (client + server)
- Secrets never exposed to client
- HTTPS everywhere

---

## Success Metrics

| Metric                 | Target                    |
| ---------------------- | ------------------------- |
| Page Load              | <3s on 3G                 |
| Kundali Calculation    | <3s                       |
| AI Response            | <5s                       |
| Chat Satisfaction      | 4.5+ star rating (future) |
| Free → Paid Conversion | >5%                       |
| Daily Active Users     | Growth metric (future)    |

---

## Current Priority

After Phase 5 Vedic Sprint, we score **A- (20/25)** vs competitors' **A (22/25)**.
Remaining gaps: PDF reports, shareable charts, monthly/yearly horoscopes, SEO pages.
Push notifications deferred to native app (Phase 7.2).

**Definition of Done for Phase 7**:
- Hindi language live with 90%+ coverage
- Native apps with 4.5+ star ratings
- Organic traffic growing 20%+ MoM
- Marketplace generating revenue
- Community active with daily engagement
