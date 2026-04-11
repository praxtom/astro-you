# AstroYou — AI Assistant Context

> AI-powered Vedic astrology platform. Spiritual companion, not generic horoscope app.
> **Beating**: AstroTalk (50M downloads, 5000 astrologers) and AstroSage (20yr SEO moat, #1 Google)
> **Our edge**: AI depth (Atman consciousness), modern UX, spiritual framework (Prana/Dharma/Karmic Journal)

## Tech Stack

- **Frontend**: Vite 6 + React 19 + TypeScript + Tailwind CSS
- **Backend**: Netlify Functions (serverless)
- **Database**: Firebase Firestore (client + admin SDK)
- **Auth**: Firebase Auth (Google + Email OTP)
- **AI**: Google Gemini 3.1 Flash (via `@google/genai`)
- **Astrology API**: astrology-api.io v3.2.10 (266 endpoints, OpenAPI spec at `docs/astrology-api-openapi.json`)
- **Payments**: Razorpay (credits system)
- **Hosting**: Netlify CDN

## Project Structure

```
netlify/functions/
  shared/
    astro-api.ts       → 16 astrology API wrapper functions (centralized, no duplication)
    gemini.ts          → AI synthesis, analysis, prompts (Gemini wrapper)
    firebase-admin.ts  → Firebase Admin singleton (db, auth, FieldValue)
    cache.ts           → getCachedOrFetch() for Firestore caching
  kundali.ts           → Unified astrology endpoint: /api/kundali (7 chartTypes)
  horoscope.ts         → Daily/weekly forecasts: /.netlify/functions/horoscope
  transit.ts           → Transit chart + report: /.netlify/functions/transit
  compatibility.ts     → Compatibility + Vedic matching: /.netlify/functions/compatibility
  synthesis.ts         → AI chat streaming: /api/synthesis
  daily-prediction.ts  → Sign-based daily text: /.netlify/functions/daily-prediction
  razorpay-order.ts    → Payment: /api/pay/create-order
  razorpay-verify.ts   → Payment: /api/pay/verify
  send-otp.ts          → Auth: /api/auth/send-otp
  verify-otp.ts        → Auth: /api/auth/verify-otp
  ...

src/
  hooks/               → Data access layer (all hooks use AbortController)
    useKundali.ts      → Fetches /api/kundali, caches in Firestore
    useTransit.ts      → Fetches /.netlify/functions/transit
    useUserProfile.ts  → Real-time Firestore subscription + localStorage sync
    useDashaMonitor.ts → Monitors dasha transitions, emits custom events
    usePanchang.ts     → Fetches /api/kundali?chartType=PANCHANG
    useYogas.ts        → Fetches /api/kundali?chartType=YOGAS
    useRemedies.ts     → Fetches /api/kundali?chartType=REMEDIES
    useConsciousness.ts → Atman real-time subscription
    useProactiveTriggers.ts → Proactive spiritual nudges (7+ trigger types)
    useSubscription.ts → Tier checking + credit deduction (with lock)
    useAudio.ts        → Prana/Nada sound system
    useHeaderScroll.ts → Scroll-aware header (uses ref, not state)
  pages/
    Dashboard.tsx      → Main hub: PanchangCard, YogaCard, RemediesCard, SoulInsight
    Synthesis.tsx       → AI chat with streaming + chart visualization
    DailyForecast.tsx  → Daily/Weekly/Monthly/Yearly forecast tabs
    Compatibility.tsx  → Synastry + Guna Milan + AI narrative
    TransitOracle.tsx  → Transit overlay + predictions
    Onboarding.tsx     → 5-step birth data collection
    Landing.tsx        → Marketing page
  components/
    dashboard/         → PanchangCard, YogaCard, RemediesCard, SoulInsightCard
    astrology/         → CelestialChart (3D), Kundali (SVG), TransitOverlay
    prana/             → PranaOverlay (breathing), sound selection
    sadhana/           → KarmicJournal, InnerCircleManager, DailyAltar
    dharma/            → DharmaList (routine tracking)
  lib/
    AuthContext.tsx    → Auth state + guest-to-user migration
    atman.ts           → AtmanService (consciousness CRUD)
    firebase.ts        → Client-side Firebase config
    constants.ts       → STORAGE_KEYS
  types/
    index.ts           → Barrel export (kundali, user, horoscope, chat, components)
```

## Critical Patterns

### 1. Unified /api/kundali Endpoint

ALL astrology data goes through ONE endpoint with a `chartType` switch:

```typescript
POST /api/kundali
{
  birthData: { name, dob, tob, pob, lat, lng },
  chartType: "D1" | "D9" | "D10" | "DASHAS" | "YOGAS" | "REMEDIES" | "MANGLIK" | "PANCHANG",
  // PANCHANG-specific (no birthData needed):
  date?: string,
  city?: string,
  lat?: number,
  lng?: number,
  // REMEDIES-specific:
  remedyType?: string
}
```

**To add a new chartType**: Add case to `kundali.ts` switch, add function to `astro-api.ts`.

### 2. Adding a New Astrology API Function

All API calls go through `shared/astro-api.ts`. Pattern:

```typescript
/** POST /vedic/sade-sati — Sade Sati detection. */
export async function getSadeSati(birthData: BirthData): Promise<any> {
    const res = await fetch(`${API_BASE}/vedic/sade-sati`, {
        method: "POST", headers: getHeaders(),
        body: JSON.stringify({ subject: buildSubject(birthData) }),
    });
    if (!res.ok) throw new Error(`Sade Sati error: ${res.status} - ${await res.text()}`);
    return unwrap(await res.json());
}
```

Then add `chartType: "SADE_SATI"` case to `kundali.ts`.

### 3. Frontend Hook Pattern

All hooks follow this pattern with AbortController:

```typescript
export function useXxx(birthData: BirthData | null) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!birthData?.dob || !birthData?.tob) { setLoading(false); return; }
        const controller = new AbortController();

        const fetchData = async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/kundali', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ birthData, chartType: 'XXX' }),
                    signal: controller.signal,
                });
                if (!res.ok) throw new Error('Failed');
                const result = await res.json();
                setData(result.data ?? result);
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                setError(err.message);
            } finally { setLoading(false); }
        };

        fetchData();
        return () => controller.abort();
    }, [birthData?.dob, birthData?.tob, birthData?.pob]);

    return { data, loading, error };
}
```

Register in `src/hooks/index.ts` barrel file.

### 4. Firestore Caching (Shared Collections)

For data that's the same for all users (panchang, transits), use `shared/cache.ts`:

```typescript
import { getCachedOrFetch } from "./shared/cache";

const data = await getCachedOrFetch("panchang", "2026-03-29_New Delhi", () =>
    getPanchang(date, city, lat, lng)
);
```

Caches in Firestore collection `panchang/{docId}` with 20-hour TTL.

### 5. Gemini Context Injection

AI chat gets full user context via `UserContext` in `shared/gemini.ts`:

```typescript
const userContext: UserContext = {
    name: "User",
    birthData: { dob, tob, pob },
    dashaInfo: { currentMahadasha, currentAntardasha, ... },
    atman: { emotionalState, keyRelationships, patterns, routines, ... },
    transitContext: "Mars conjunct natal Venus: ...",
    recentSummaries: [...],
};
```

### 6. Firebase Admin (Server-Side)

Always import from the shared singleton:

```typescript
import { db, auth, FieldValue } from "./shared/firebase-admin";
```

Never initialize Firebase Admin directly in a function file.

## Firestore Schema (Actual)

```
users/{uid}/
  profile: { name, dob, tob, pob, gender, currentLocation, coordinates, birthTimeUnknown, parsedChart }
  credits: number
  subscription: { tier, expiresAt }
  kundaliData: { planetary_positions[], house_cusps[], ascendant }
  kundaliData_D9: { ... }
  atman: { emotionalState, knownPatterns[], activeEvents[], keyRelationships[], routines[], dailyIntention, ... }
  updatedAt: Timestamp

users/{uid}/chats/{chatId}/
  title, createdAt, updatedAt, messages: [{ role, content, timestamp }]

panchang/{date_location}/
  tithi, nakshatra, yoga, karana, rahu_kaal, _cachedAt

otps/{email}/
  code, expiresAt, attempts, requestCount
```

## Design System

- **Theme**: Dark cosmic (bg-[#030308], white text, gold accents)
- **Gold**: `text-gold` (custom Tailwind color ~#E5B96A)
- **Cards**: `bg-white/5 border border-white/10 rounded-[2rem]` or `glass` class
- **Labels**: `text-white/40 text-xs uppercase tracking-widest font-bold`
- **Values**: `text-white/80`
- **Animations**: Framer Motion (`motion.div` with fade/slide)
- **Icons**: Lucide React
- **Fonts**: Inter (body), display font for headings

## Key Docs

- `docs/ROADMAP.md` — Single source of truth: roadmap, tasks, competitive analysis, API strategy, quality audit
- `CLAUDE.md` (this file) — Architecture patterns, anti-patterns, conventions, dev guide
- `docs/PRODUCT_OVERVIEW.md` — Product vision and positioning
- `docs/PROJECT_ATMAN_PLAN.md` — Consciousness system design
- `docs/astrology-api-openapi.json` — Full API spec (266 endpoints, formatted JSON)

## Competitive Context

**Beating AstroTalk**: They charge ₹15-100/min for "human astrologers" — many are actually bots. We build the same marketplace UX (Phase 5.6) with transparent AI at ₹5/min. Same user habit, 10x better value, actually knows your chart.

**Beating AstroSage**: They have 20 years of SEO dominance. We need SEO pages (Sprint A) for discovery, but win on AI personalization and modern UX.

**Dual strategy**: Route A (AI Astrologer Marketplace) for user acquisition → Route B (Spiritual Companion with Atman/Prana/Dharma) for retention. Users discover us through familiar "talk to expert" UX, stay for the depth no competitor offers.

**Our moat**: Emotional intelligence (Atman), spiritual framework (Prana/Dharma/Karmic Journal), AI that remembers everything and grows with you. No competitor has anything like this.

## Architecture Rules (Anti-Patterns to Avoid)

| DON'T | DO INSTEAD |
|-------|------------|
| Create separate endpoints (`/api/yogas`, `/api/remedies`) | Route through `/api/kundali` with `chartType` param |
| Call astrology-api.io directly from any function | Use `shared/astro-api.ts` wrapper |
| Initialize Firebase Admin in each function | Import from `shared/firebase-admin.ts` |
| Store transits/panchang per-user | Use shared Firestore collections with `getCachedOrFetch()` |
| Inline Firestore queries in components | Create hooks in `src/hooks/` |
| Create types in each component | Add to `src/types/` and re-export from `index.ts` |
| Use legacy `Handler` format for Netlify functions | Use modern `export default async (req, ctx) => Response` + `Config` |
| Send fetch without Content-Type header | Always include `headers: { "Content-Type": "application/json" }` |
| Skip AbortController in fetch hooks | Always add `signal`, cleanup, and AbortError check |
| Duplicate AI prompts across functions | Use `shared/gemini.ts` with prompt templates |
| Fetch panchang per-user | Fetch once with `getCachedOrFetch("panchang", dateKey, ...)` |

## Firestore Security Model

```
users/{uid}/*           → request.auth.uid == userId (read/write own data only)
panchang/{date}/*       → authenticated read, admin-only write
transits/{date}/*       → authenticated read, admin-only write
otps/{email}/*          → server-side only (Firebase Admin SDK)
```

Credits can only decrease by 1 per transaction or be incremented by server (payment verification).

## API Response Normalization Pattern

All hooks normalize API responses to handle field name variations. Example:

```typescript
// In hook, after fetch:
const raw = result.data ?? result;
const normalized = {
    name: raw.name || raw.yoga_name || raw.title || 'Unknown',
    strength: normalizeStrength(raw.strength),  // "High" → "strong"
    planets: Array.isArray(raw.planets) ? raw.planets : [],
};
```

This prevents `[object Object]` rendering and handles API version changes gracefully.

## Full Roadmap & Tasks

See `docs/ROADMAP.md` — single source of truth for all phases, tasks, competitive analysis, API strategy, and quality status.
