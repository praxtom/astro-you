# 🏗️ AstroYou Architecture Blueprint

> **Purpose**: Ensure all TASKS.md items (Phases 1-7) can be implemented without code duplication, redundant collections, or maintenance issues.

---

## 📊 Current State Analysis

### Existing Backend Functions (6)

```
netlify/functions/
├── kundali.ts          → Birth chart calculation
├── synthesis.ts        → AI chat with Gemini
├── razorpay-order.ts   → Payment initiation
├── razorpay-verify.ts  → Payment verification
├── send-otp.ts         → Email OTP generation
└── verify-otp.ts       → Email OTP verification
```

### Existing Firestore Schema

```
users/{uid}/
├── profile: { name, dob, tob, pob, gender, coordinates }
├── kundaliData: { planetary_positions, house_cusps }
├── credits: number
├── subscription: { tier, expiresAt }
└── chats/{chatId}/
    ├── title, createdAt, updatedAt
    └── messages/{msgId}/
        └── role, content, timestamp
```

### Existing Frontend Structure

```
src/
├── lib/
│   ├── astrology.ts      → Zodiac/planet data + interfaces
│   ├── firebase.ts       → Firebase config
│   └── AuthContext.tsx   → Auth state management
├── components/
│   ├── astrology/        → Chart visualizations
│   └── ui/               → Reusable UI components
└── pages/
    ├── Dashboard.tsx     → Summary view
    ├── Synthesis.tsx     → AI chat
    ├── Landing.tsx       → Marketing page
    └── Onboarding.tsx    → Data collection
```

---

## 🎯 Recommended Architecture

### 1. FIRESTORE SCHEMA (Unified)

```
users/{uid}/
├── profile: {             ← Single source of truth for user data
│     name, dob, tob, pob, gender,
│     coordinates, moonSign, ascendant,
│     fcmToken, language, timezone,
│     subscription: { tier, expiresAt, razorpaySubId },
│     credits: number
│   }
│
├── kundali: {             ← Calculated chart data (immutable after calc)
│     planetary_positions: [...],
│     house_cusps: [...],
│     nakshatras: [...],
│     yogas: [...],
│     dashas: { current, periods: [...] },
│     navamsa: { positions: [...] },
│     calculatedAt: Timestamp
│   }
│
├── horoscopes/{date}/     ← Daily/weekly/monthly predictions
│     daily: { content, generatedAt },
│     weekly: { content, generatedAt },
│     monthly: { content, generatedAt }
│
├── chats/{chatId}/        ← Conversations with AI
│     title, createdAt, updatedAt, archived
│     └── messages/{msgId}/
│
├── notifications: {       ← Push notification preferences
│     enabled, fcmToken,
│     dailyInsight: boolean,
│     transitAlerts: boolean,
│     cosmicEvents: boolean
│   }
│
└── activity/              ← Analytics & engagement tracking
    ├── lastLogin: Timestamp
    ├── chatCount: number
    └── purchaseHistory: [...]

---
# SHARED COLLECTIONS (Not per-user)
---

panchang/{date}/           ← Daily astronomical data (shared)
├── tithi, nakshatra, yoga, karana
├── rahuKaal, choghadiya
├── sunriseAt, sunsetAt
└── moonSign, sunSign

transits/{date}/           ← Current planetary positions (shared)
├── positions: [{ planet, sign, degree, retrograde }]
├── significantEvents: [...]
└── calculatedAt

celebrities/{slug}/        ← Public celebrity charts (SEO)
├── name, dob, pob
├── kundali: {...}
└── slug, imageUrl

astrologers/{uid}/         ← Human astrologer profiles (Phase 7.5)
├── profile, credentials, availability
├── ratings, reviewCount
└── earnings, payoutHistory

products/{id}/             ← E-commerce catalog (Phase 7.3)
├── name, description, price
├── category, images
└── inventory, shipping

orders/{orderId}/          ← Order management (Phase 7.3)
├── userId, items, total
├── status, trackingInfo
└── createdAt, deliveredAt
```

### 2. NETLIFY FUNCTIONS (Organized)

```
netlify/functions/
│
├── shared/                     ← SHARED UTILITIES (NO DUPLICATION)
│   ├── astro-api.ts           → Astrology API wrapper
│   ├── gemini.ts              → AI response generation
│   ├── firebase-admin.ts      → Firebase Admin SDK init
│   ├── cache.ts               → Firestore caching helpers
│   └── validators.ts          → Input validation schemas
│
├── auth/
│   ├── send-otp.ts
│   └── verify-otp.ts
│
├── payments/
│   ├── razorpay-order.ts
│   ├── razorpay-verify.ts
│   ├── subscription-create.ts ← Phase 6
│   └── subscription-webhook.ts
│
├── astrology/
│   ├── kundali.ts             → Full natal chart
│   ├── transit.ts             → Current positions (uses shared/astro-api)
│   ├── horoscope.ts           → Daily/weekly/monthly (uses shared/gemini)
│   ├── dasha.ts               → Dasha period calculation
│   ├── matching.ts            → Kundli matching (Phase 5)
│   └── panchang.ts            → Daily Panchang (shared collection)
│
├── ai/
│   ├── synthesis.ts           → Existing chat
│   └── chart-parser.ts        → Vision-based parsing (Phase 3)
│
└── content/
    ├── celebrity-chart.ts     → SEO celebrity pages
    └── horoscope-page.ts      → SEO horoscope pages
```

### 3. SHARED SERVICES LAYER

**Create `netlify/functions/shared/astro-api.ts`:**

```typescript
// Single wrapper for all Astrology API calls
export class AstroAPI {
  private apiKey = process.env.ASTROLOGY_API_KEY;

  async getNatalChart(birthData: BirthData): Promise<KundaliData> {...}
  async getCurrentTransits(): Promise<TransitData> {...}
  async getDashaPeriods(birthData: BirthData): Promise<DashaData> {...}
  async getNavamsa(birthData: BirthData): Promise<NavamsaData> {...}
  async getYogas(kundali: KundaliData): Promise<YogaData[]> {...}
  async getPanchang(date: Date): Promise<PanchangData> {...}
}
```

**Create `netlify/functions/shared/gemini.ts`:**

```typescript
// Single wrapper for all Gemini AI calls
export class GeminiService {
  async synthesize(prompt: string, context: UserContext): Promise<string> {...}
  async generateHoroscope(moonSign: string, transits: TransitData): Promise<string> {...}
  async interpretChart(kundali: KundaliData, question: string): Promise<string> {...}
  async parseChartImage(imageUrl: string): Promise<ParsedChart> {...}
}
```

### 4. TYPESCRIPT INTERFACES (Centralized)

**Create `src/types/index.ts`:**

```typescript
// Re-export all types from single entry point
export * from "./user";
export * from "./kundali";
export * from "./horoscope";
export * from "./transit";
export * from "./subscription";
export * from "./notification";
```

**Create `src/types/kundali.ts`:**

```typescript
export interface PlanetaryPosition {...}
export interface HouseCusp {...}
export interface KundaliData {...}
export interface DashaPeriod {...}
export interface Yoga {...}
export interface NavamsaData {...}
```

### 5. FRONTEND COMPONENT STRUCTURE

```
src/components/
├── astrology/
│   ├── charts/
│   │   ├── NatalChart.tsx      → D1 birth chart
│   │   ├── NavamsaChart.tsx    → D9 chart
│   │   ├── TransitChart.tsx    → Current transit overlay
│   │   └── MatchingChart.tsx   → Two-chart comparison
│   ├── widgets/
│   │   ├── DashaDisplay.tsx    → Current Mahadasha/Antardasha
│   │   ├── TransitAlert.tsx    → Key transit notification
│   │   ├── PanchangCard.tsx    → Daily Tithi/Nakshatra
│   │   └── HoroscopeCard.tsx   → Daily/weekly prediction
│   └── CelestialChart.tsx      → Existing 3D visualization
│
├── chat/
│   ├── ChatSidebar.tsx         → Conversation list
│   ├── MessageBubble.tsx       → Individual message
│   └── ChatInput.tsx           → Input with voice support
│
├── dashboard/
│   ├── DashboardGrid.tsx       → Layout container
│   ├── SummaryCard.tsx         → Reusable card component
│   └── NotificationBanner.tsx  → Push permission request
│
├── shared/
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Modal.tsx
│   ├── Skeleton.tsx
│   └── Toast.tsx
│
└── seo/
    ├── HoroscopePage.tsx       → SEO-optimized horoscope pages
    └── CelebrityPage.tsx       → SEO celebrity chart pages
```

### 6. HOOKS ARCHITECTURE

```
src/hooks/
├── useAuth.ts              → Existing auth hook
├── useKundali.ts           → Fetch/cache user's kundali
├── useTransits.ts          → Current transits (shared data)
├── useHoroscope.ts         → Daily/weekly horoscope
├── useDasha.ts             → Current Dasha period
├── usePanchang.ts          → Today's Panchang
├── useNotifications.ts     → Push notification management
├── useSubscription.ts      → Tier checking & feature gating
└── useChat.ts              → Chat state management
```

---

## ⚠️ Anti-Patterns to Avoid

| ❌ DON'T                                                                                  | ✅ DO INSTEAD                                            |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Create separate `/api/daily-horoscope`, `/api/weekly-horoscope`, `/api/monthly-horoscope` | Create single `/api/horoscope?type=daily` with parameter |
| Store transits per-user                                                                   | Store shared `transits/{date}` collection                |
| Duplicate Astrology API calls across functions                                            | Use `shared/astro-api.ts` wrapper                        |
| Create new types in each component                                                        | Import from `src/types/index.ts`                         |
| Fetch Panchang for each user                                                              | Fetch once, cache in `panchang/{date}`                   |
| Create separate collections for each prediction type                                      | Nest under `users/{uid}/horoscopes/{date}`               |
| Inline AI prompts in each function                                                        | Use `shared/gemini.ts` with prompt templates             |

---

## 📋 Implementation Order (Architectural Dependencies)

### Phase 4 Prerequisites (Do First)

1. **Create `shared/astro-api.ts`** — All astrology functions depend on this
2. **Create `shared/gemini.ts`** — All AI functions depend on this
3. **Create `src/types/index.ts`** — Centralize all TypeScript interfaces
4. **Create `panchang/{date}` collection** — Shared daily data

### Then Implement Features

1. Transit endpoint → Uses `shared/astro-api.ts`
2. Horoscope endpoint → Uses both shared modules
3. Dasha display → Uses existing kundali + extend
4. Push notifications → Uses Firebase Admin from shared

---

## 🔒 Security Considerations

| Feature               | Security Requirement                          |
| --------------------- | --------------------------------------------- |
| User data             | Firestore rules: `request.auth.uid == userId` |
| Shared transits       | Read-only for authenticated users             |
| Panchang              | Public read (SEO), admin-only write           |
| Astrologer payouts    | Admin-only access                             |
| Subscription webhooks | Razorpay signature validation                 |

---

## 📦 Package Dependencies to Add

```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0", // For server-side Firestore
    "zod": "^3.22.0", // Input validation
    "date-fns": "^3.0.0", // Date manipulation
    "date-fns-tz": "^2.0.0" // Timezone handling
  }
}
```

This architecture ensures:

- ✅ No code duplication
- ✅ Single source of truth for data
- ✅ Shared collections for global data
- ✅ Centralized API wrappers
- ✅ Type safety across the codebase
- ✅ Easy to maintain and extend
