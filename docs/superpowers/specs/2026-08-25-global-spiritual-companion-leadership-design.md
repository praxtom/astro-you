# AstroYou Global Spiritual Companion Leadership

**Date:** 2026-08-25

**Artifact type:** Competitive shortcomings report and master technical design

**Status:** Single-source build specification proposed for product-owner review

**Primary benchmark:** Moonly

**Direct benchmarks:** CHANI, The Pattern, Co-Star, Hint, Nebula, Sanctuary

**Adjacent benchmarks:** Rosebud, Finch, Stoic, Wysa

## Executive decision

AstroYou should not become another astrology toolbox with more menu items than Moonly. It should become the first mobile spiritual companion that closes this loop:

1. Explain what is relevant today and why.
2. Recommend one small action.
3. Let the user complete or reject it.
4. Ask what happened.
5. Learn which guidance helps this person.
6. Show the user exactly what was learned.
7. Make tomorrow's guidance visibly better.

The product promise is:

> **AstroYou turns today's Jyotish context into one useful action, checks what happened, and learns what genuinely helps you.**

Vedic astrology supplies the context. Atman supplies continuity. Prana and Dharma supply action. The daily outcome loop supplies proof that the relationship is improving.

AstroYou is not therapy, must not claim to provide therapy, and must not infer diagnoses. It is a spiritual reflection and wellbeing product with explicit safety boundaries.

## Single-source execution rule

This file is the one product and technical source for the competitive-leadership program. Do not create separate feature wish lists or competitor backlogs that can drift away from it.

- The **competitive gap map** states what users receive elsewhere that AstroYou does not yet deliver.
- The **critical shortcomings** identify the current implementation or product problem.
- The **target product experience** defines the user behaviour AstroYou must create.
- **Programs 1-12** specify the files, interfaces, schemas, APIs, migrations, security controls and tests required to close the gaps.
- The **build order** prevents teams from starting attractive but dependent work too early.
- The **definition of beating the category** determines completion. A feature is not complete merely because code exists.
- The **required follow-on implementation plans** are execution plans derived from this file; they may not change its product promise or acceptance gates without product-owner approval.

`docs/ROADMAP.md` should link to this specification after approval. Its competing global-product claims and priorities must then be replaced by the decisions in this file.

## Evidence boundary

This report is based on:

- Current AstroYou source at `796e3afad619be6db1df1789c72580ffad1ef726` on `main`.
- The repository knowledge graph, which was current at that commit.
- Source-level UX review of Landing, Onboarding, Dashboard, Synthesis, Daily Altar, Karmic Journal, Settings, entitlements, analytics, notifications, Atman and shared AI context.
- Current official competitor pages and app-store listings reviewed on 2026-08-25.
- Recent public reviews used only as directional voice-of-customer evidence.

Authenticated live AstroYou flows and competitor paid experiences were not exercised. Competitor scale claims are self-reported unless they come directly from an app store.

## Competitive bar

| Product | Bar it sets | AstroYou must match | AstroYou must exceed |
|---|---|---|---|
| Moonly | Coherent Vedic spiritual suite, lunar calendar, meditation, rituals, Tarot, dreams, numerology, broad localization | A polished daily spiritual experience, actual content library, native app, lunar/Panchang rhythm, reliable notifications | Longitudinal memory, action outcomes, transparent reasoning, user-governed learning |
| CHANI | Human-authored trust, editorial voice, weekly ritual, journal prompts, meditation | Named editorial method, human-reviewed flagship content, dependable weekly cadence | Per-user chart context, memory and action feedback without losing human credibility |
| The Pattern | Psychological-feeling self-discovery and relationship narratives | Relationship timelines, understandable emotional language, deep bonds | Evidence-backed relationship memory, consent controls, advice-outcome learning |
| Co-Star | Brand distinctiveness, social compatibility, concise daily habit, push | Memorable daily object, useful notifications, shareable relationship moments | Calm specificity instead of cryptic negativity; visible astrological provenance |
| Hint | High-conversion onboarding, personalized reports, professional guidance | Fast time-to-value and clear premium packaging | Transparent pricing, no trial traps, stronger continuity and product trust |
| Nebula | Mainstream breadth, 25-language reach, advisor availability | Mobile polish, localization, relationship and daily guidance breadth | No hidden billing, no dependency pressure, clear AI/human distinction |
| Sanctuary | Interactive charts and access to real experts | Optional human escalation and readable chart education | Persistent context and post-session continuity rather than disposable readings |
| Rosebud | Long-term memory, voice journal, goals, patterns, weekly growth | Voice/text journal, guided reflection, pattern continuity, weekly review | Jyotish-grounded action loop, inspectable evidence, lower hallucinated-memory risk |
| Finch | Tiny actions, companion attachment, habit retention | Rewarding completion, gentle streaks, visible progress | Adult spiritual depth without coercive gamification |
| Stoic | Morning/evening reflection, guided journals, mood tracking | Fast structured reflection and content discovery | Personalized practices tied to actual chart and outcome history |
| Wysa | Structured emotional tools, clinical-team boundaries, crisis handling | Explicit intended use, safe escalation, red-team evaluation | Spiritual usefulness without pretending to diagnose or treat |

### Current public evidence

- Moonly: <https://moonly.app/> and <https://apps.apple.com/us/app/moonly-moon-phases-calendar/id1489889871>
- CHANI: <https://www.chani.com/app> and <https://apps.apple.com/us/app/chani-your-astrology-guide/id1532791252>
- The Pattern: <https://www.thepattern.com/> and <https://apps.apple.com/us/app/the-pattern-astrology/id1071085727>
- Co-Star: <https://www.costarastrology.com/faq/> and <https://apps.apple.com/us/app/co-star-personalized-astrology/id1264782561>
- Hint: <https://hint.app/>
- Nebula: <https://www.asknebula.com/nebula-app-mobile> and <https://apps.apple.com/us/app/nebula-spiritual-guidance/id1459969523>
- Sanctuary: <https://www.sanctuaryworld.co/faq/> and <https://apps.apple.com/us/app/sanctuary-psychic-reading/id1417411962>
- Rosebud: <https://www.rosebud.app/> and <https://apps.apple.com/us/app/rosebud-ai-journal-diary/id6451135127>
- Finch: <https://help.finchcare.com/hc/en-us/articles/37935669335309-Our-Approach-to-Self-Care>
- Stoic: <https://www.getstoic.com/features>
- Wysa: <https://www.wysa.com/faq>

## Plain-language competitive gap map

The central problem is not that AstroYou lacks astrology calculations. The problem is that competitors turn fewer capabilities into clearer habits, stronger trust and more polished mobile experiences. AstroYou has powerful ingredients, but users still have to assemble the value themselves.

| Benchmark | What users receive today | Where AstroYou currently lacks | Build program that closes it | Proof required |
|---|---|---|---|---|
| Moonly | One coherent spiritual lifestyle product combining daily guidance, lunar rhythm, meditation, rituals, Tarot, numerology and dreams | AstroYou exposes many separate tools without one dominant daily journey; its practice/audio catalog and native-mobile presentation are weaker | Programs 2, 5, 8 and 9 | Users complete the daily loop without entering Explore; at least 70% prefer AstroYou to Moonly for “What should I know and do today?” |
| CHANI | Recognizable human editorial voice, dependable weekly ritual, professional meditation and journal content | AstroYou relies heavily on AI/API output and lacks a visible named editorial method, reviewed flagship content and weekly human cadence | Programs 5 and 7 | Every flagship weekly reading and practice has a named author/reviewer; users can distinguish human editorial content from AI personalization |
| The Pattern | Emotionally legible relationship narratives, relationship-specific conversation and timing | AstroYou stores basic relationship facts but lacks event history, recurring dynamics, advice outcomes and consent-controlled shared context | Program 6 | A relationship timeline connects events, guidance and results; blind preference beats The Pattern for a recurring relationship question |
| Co-Star | Memorable daily habit, distinctive tone, useful friend comparison, push and shareability | AstroYou lacks an iconic daily object, native widget, mature share loop and consistently recognizable notification language | Programs 2, 6, 8 and 9 | Daily widget/push opens the correct guide; share cards generate safe deep links; return and sharing cohorts improve |
| Hint | Fast personalized onboarding, report packaging and conversion | AstroYou spends its first moments on jargon and optional chart upload; value arrives too late and paid packaging is complex | Programs 1, 9 and 10 | Median first personalized value is below 90 seconds; every paywall states exact renewal and limits |
| Nebula | Mainstream mobile polish, broad localization, daily/relationship breadth and advisor availability | AstroYou is web-first, English-heavy and lacks a mature human-escalation path | Programs 8, 10 and 12 | Native release passes store-quality gates; Hindi core flow ships; human and AI identities are unmistakable |
| Sanctuary | Readable interactive astrology plus access to real experts | AstroYou has AI personas but no credentialed human expert lifecycle or consent-limited context sharing | Programs 7 and 12 | Credential, scheduling, payment, cancellation, session and review states are server-authoritative and tested |
| Rosebud | Voice journaling, long-term memory, patterns, goals and weekly growth reports | AstroYou’s journal analysis is keyword-based; Atman records advice but does not learn whether it helped | Programs 3 and 4 | Voice/text journal proposes evidence-backed memories; outcomes change later recommendations; rejected memories stay rejected |
| Finch | Tiny actions, rewarding completion, gentle companion attachment and visible progress | AstroYou has routines and streaks but no clear daily completion state or emotionally satisfying return loop | Programs 2 and 9 | The user can finish today in one flow; tomorrow visibly references completion without coercive disclosure scoring |
| Stoic | Fast morning/evening reflection, guided journals and searchable wellbeing content | AstroYou’s altar and journal are buried and lack a deep reviewed content library | Programs 4 and 5 | Morning/evening entry is reachable from Today; reviewed practices cover short and deep sessions |
| Wysa | Structured emotional tools, clear intended-use boundaries, clinical-team review and crisis handling | AstroYou largely relies on prompt instructions and mixes self-reported emotion with AI inference | Programs 3 and 7 | Self-report and inference are separate; safety classifier/output scan/red-team suite pass; no diagnosis or treatment claim appears |

### The five competitive deficiencies that matter most

1. **No indispensable daily ritual.** Moonly, CHANI, Co-Star, Finch and Stoic give users an obvious reason to open the app and a clear point at which they are finished. AstroYou presents multiple valid actions at once.
2. **Atman remembers more than it learns.** Rosebud currently communicates memory, voice journaling and growth review more clearly. AstroYou does not yet connect advice, completion and outcome strongly enough to improve the next recommendation.
3. **No professional editorial and practice library.** Generated sound and AI prose are not substitutes for reviewed meditation audio, transcripts, weekly programming and named authorship.
4. **No category-leading native mobile experience.** PWA installation and browser push do not provide the full widgets, offline journal, biometrics, background audio, native sharing and app-store discovery expected in this category.
5. **Trust is not yet a product feature.** AstroYou has good policy intentions, but it needs visible provenance, individual memory controls, transparent pricing, safe emotional vocabulary and automated safety evaluation.

### What is not a meaningful competitive deficiency

Do not respond to the market by adding more isolated divination systems or astrology endpoints. AstroYou already has sufficient breadth to compete. Additional breadth does not solve daily retention, trust, mobile polish, editorial quality, memory accuracy or action outcomes.

## What AstroYou already has

The following should be treated as existing foundations, not rebuilt from scratch:

- Central astrology provider wrapper in `netlify/functions/shared/astro-api.ts`.
- Unified `/api/kundali` chart-type endpoint.
- Synthesis streaming, persistent chat and server-built user context.
- Atman V1 emotional state, patterns, events, relationships, routines, advice and memory evidence.
- Prediction feedback and calibration.
- Proactive nudge candidates, push tokens and daily digests.
- Daily Altar, Dharma routines, Karmic Journal and Prana audio/breathwork.
- Five-space information architecture in `src/lib/spaces.ts`.
- Daily Panchang and Atman-derived guide in `src/lib/todayGuide.ts`.
- Subscriptions, entitlements, credits and Razorpay webhook infrastructure.
- Product funnel event ingestion and admin summaries.
- Data export, account deletion, legal pages and memory-bucket clearing.
- PWA installation and browser push.
- Tarot, numerology, compatibility, astrocartography, wellness, reports and advanced Vedic routes.

## Critical shortcomings

### S1. The daily guide is not genuinely personalized enough

`buildTodayGuide()` currently combines one emotional label, whether a routine exists, Nakshatra and Rahu Kaal through deterministic branches. Two users with the same broad emotional state receive almost the same action.

**Consequence:** the product claims chart-aware companionship but often behaves like a templated dashboard.

**Required correction:** create a server-owned Daily Guidance Orchestrator that receives normalized facts from natal chart, dasha, transit, Panchang, recent outcomes and confirmed memory; then returns a validated structured guide with evidence.

### S2. Atman records information but does not learn what works

The existing advice entry contains text, context, date and a `followedUp` flag. It does not have a stable ID, action, outcome, before/after state, user rating or conditions under which it helped.

**Consequence:** a generated growth report can retell history but cannot demonstrate learning.

**Required correction:** add stable advice records and explicit outcomes: `helped`, `partly_helped`, `did_not_help`, `did_not_try`.

### S3. The journal parser is a placeholder-level heuristic

`extractJournalInsights()` detects a small keyword set and normally stores the first sentence as a pattern.

**Consequence:** Rosebud can currently offer a more legible reflection loop, while AstroYou risks saving weak or incorrect memories.

**Required correction:** move analysis to a typed, authenticated, rate-limited server endpoint that proposes—not persists—structured insights. The user must accept, edit or reject every proposal.

### S4. Atman data is concentrated in one growing user document

Atman arrays are normalized and bounded, but the durable model still lives within `users/{uid}`. The knowledge graph reports that changing Atman core files affects 42 additional files and 94 nodes within three hops.

**Consequence:** schema evolution is risky, Firestore document size remains a structural constraint, and unrelated user-profile writes can collide with brain updates.

**Required correction:** migrate durable memories, advice, daily cycles and relationship history into server-owned subcollections. Retain only a compact `atmanSummary` document for prompt assembly and dashboard display.

### S5. Emotional labels mix self-report and inference

The current enum contains `chaotic` and `depressive`, but the model does not distinguish a user's self-description from an AI inference.

**Consequence:** the UI can make a pseudo-clinical statement without diagnostic authority.

**Required correction:** separate `SelfReportedCheckIn` from `InferredWellbeingSignal`. Never show inferred clinical-sounding labels to the user. Rename the visible vocabulary to neutral, user-selectable states such as `steady`, `tender`, `restless`, `low_energy`, `energized`, `reflective` and `overwhelmed`.

### S6. Sensitive memory is governed only at bucket level

Settings can clear patterns, events, relationships, routines or advice, but cannot explain or correct individual memory evidence inline.

**Consequence:** the user cannot audit how a specific inference affected guidance.

**Required correction:** build an item-level Memory Ledger with evidence, confidence, status, last confirmation, influence disclosure and `confirm`, `edit`, `forget`, `archive`, `pause learning` actions.

### S7. The dashboard is an index, not a completed ritual

The dashboard exposes several competing primary actions and a long tail of cards and utilities. Source review scored the representative experience 21/40 and found high cognitive load.

**Consequence:** feature breadth obscures the habit AstroYou needs users to repeat.

**Required correction:** the first viewport must show exactly three beats: today's signal, one action and contextual Ask Jyotish. Exploration moves behind progressive disclosure. The page needs a completed state.

### S8. The strongest retention features are premium-gated too early

`daily_path` and `journal_intelligence` are false for the free tier.

**Consequence:** users cannot experience the supposed moat before being asked to pay.

**Required correction:** make the basic daily loop, one journal analysis per day, memory inspection and outcome recording free. Premium sells depth, history, expanded library, offline access, advanced reports and higher AI usage—not the first proof of value.

### S9. Analytics measure acquisition and purchases, not companionship

Current events cover onboarding, first chat, consult and payment, but not daily-guide use, action acceptance, completion, outcome, journal analysis, memory correction or weekly review.

**Consequence:** the team cannot tell whether Atman improves retention.

**Required correction:** instrument the complete daily cycle without logging journal text, chat text, birth data or relationship names.

### S10. Audio is a technical sound generator, not a content product

Prana can produce sound and breathing experiences, but AstroYou lacks a catalog of professionally authored, versioned, localized practices comparable to Moonly, CHANI, Stoic or Calm.

**Consequence:** the Path space cannot become a reason to return.

**Required correction:** build an editorial Practice Catalog with real audio assets, transcripts, durations, contraindications, languages, tags, review status and completion tracking.

### S11. Relationship memory lacks history and consent boundaries

`KeyRelationship` stores a name, relationship type, broad dynamic and notes. It does not model events, guidance, outcomes, privacy classification or consent for shared analysis.

**Consequence:** AstroYou cannot yet beat The Pattern on legibility or beat it on trust.

**Required correction:** introduce relationship timelines, private/shared scopes and explicit invitation consent.

### S12. Web-first delivery cannot win a mobile habit category

PWA and browser push exist, but AstroYou has no native project.

**Consequence:** widgets, offline journal, biometric protection, native audio, app-store discovery and reliable background behaviour remain weaker than every major benchmark.

**Required correction:** add a real Expo application, not a WebView wrapper.

### S13. Trust language overclaims

Internal or product copy uses phrases such as `therapy-grade`, `scientific accuracy`, `synthetic consciousness` and absolute superiority claims.

**Consequence:** these phrases create clinical, scientific or sentience expectations the product cannot substantiate.

**Required correction:** state the method and boundary plainly: astronomical calculation, traditional Jyotish interpretation, AI synthesis and optional user memory.

### S14. The roadmap rewards endpoints, not outcomes

The existing competitive section is materially outdated and labels breadth as market leadership.

**Consequence:** engineering can finish milestones without improving activation, retention, trust or preference.

**Required correction:** replace feature-completion scoring with user-task and cohort metrics defined later in this document.

## Target product experience

### Daily loop

```text
Open AstroYou
  -> see one relevant signal for local today
  -> inspect "why this" evidence
  -> accept, replace or dismiss one suggested action
  -> complete the practice or reflection
  -> record a 10-second outcome
  -> Atman proposes a learning
  -> user confirms or rejects the learning
  -> next guidance uses only confirmed or high-confidence evidence
```

### Weekly loop

```text
Sunday/local week boundary
  -> human-authored collective outlook
  -> personalized overlay from chart and current periods
  -> evidence-based review of actions tried and outcomes
  -> one pattern to confirm or reject
  -> one intention for the next week
```

### Relationship loop

```text
Add a person privately
  -> choose relationship and privacy scope
  -> optionally invite them to share chart data
  -> inspect compatibility with source factors
  -> record a real event or question
  -> receive one communication action
  -> record outcome
  -> timeline learns without exposing private notes to the other person
```

## Target technical architecture

```text
Web app (existing Vite/React)        Native app (Expo SDK 57 / RN 0.86)
              \                         /
               shared domain + API client
                         |
                Netlify API functions
                         |
       -------------------------------------------
       | Astrology facts | Guidance | Atman V2   |
       | Practice catalog| Safety   | Analytics  |
       -------------------------------------------
                         |
              Firebase Auth / Firestore / Storage
                         |
                 Gemini structured synthesis
```

### New repository boundaries

```text
apps/
  mobile/                         # Expo Router native application
packages/
  domain/                         # Cross-platform types and pure normalizers
  api-client/                     # Authenticated API calls and response schemas
src/                              # Existing web application
netlify/functions/
  shared/daily-guidance/          # Fact selection, ranking, validation, fallback
  shared/atman-v2/                # Pure memory and outcome domain logic
  shared/practices/               # Catalog and recommendation logic
```

The web app remains operational during extraction. Cross-platform packages may not import React DOM, Netlify, Firebase Admin or browser globals.

## Program 1: Product truth and measurement

### Build

Modify:

- `docs/ROADMAP.md`
- `docs/PRODUCT_OVERVIEW.md`
- `src/lib/analytics-events.ts`
- `netlify/functions/shared/funnel-analytics.ts`
- `netlify/functions/admin-funnel-summary.ts`
- `src/pages/Admin.tsx`

Add these events:

```ts
type CompanionEventName =
  | "birth_profile_started"
  | "birth_profile_completed"
  | "first_personalized_signal_viewed"
  | "daily_guide_viewed"
  | "daily_action_accepted"
  | "daily_action_replaced"
  | "daily_action_completed"
  | "daily_outcome_recorded"
  | "journal_entry_created"
  | "journal_analysis_requested"
  | "journal_insight_confirmed"
  | "journal_insight_rejected"
  | "memory_confirmed"
  | "memory_edited"
  | "memory_forgotten"
  | "weekly_review_viewed"
  | "push_opt_in_completed"
  | "paywall_viewed";
```

Allowed analytics properties are IDs, booleans, durations, enum values, route, app version, locale and experiment assignment. Raw journal text, chat content, names, birth data and relationship notes are forbidden.

### Tests

- Extend `netlify/functions/__tests__/analytics-goals.test.ts` to require every new event.
- Extend `netlify/functions/__tests__/funnel-analytics.test.ts` with daily and weekly cohort funnels.
- Add a test that rejects prohibited property keys such as `message`, `journalText`, `dob`, `name` and `relationshipName`.

### Acceptance

- Admin can view activation, daily-cycle completion, D1/D7/D30 return and paid conversion by acquisition cohort.
- No sensitive text reaches `analyticsEvents`.
- The roadmap contains no unsupported competitor or clinical claims.

## Program 2: Daily Guidance Orchestrator

### Files

Create:

- `packages/domain/package.json`
- `packages/domain/src/index.ts`
- `packages/domain/src/daily-guidance.ts`
- `netlify/functions/shared/daily-guidance/facts.ts`
- `netlify/functions/shared/daily-guidance/rank.ts`
- `netlify/functions/shared/daily-guidance/prompt.ts`
- `netlify/functions/shared/daily-guidance/validate.ts`
- `netlify/functions/shared/daily-guidance/fallback.ts`
- `netlify/functions/daily-guide.ts`
- `netlify/functions/daily-cycle-complete.ts`
- `src/hooks/useDailyGuide.ts`
- `src/components/daily/DailySignal.tsx`
- `src/components/daily/DailyAction.tsx`
- `src/components/daily/DailyOutcome.tsx`
- `src/components/daily/DailyCompletion.tsx`
- `netlify/functions/__tests__/daily-guidance.test.ts`
- `netlify/functions/__tests__/daily-cycle.test.ts`

Modify:

- `src/pages/Dashboard.tsx`
- `src/lib/todayGuide.ts` to become fallback-only and then remove after cutover.
- `netlify/functions/shared/user-context.ts`
- `netlify/functions/shared/brain-nudges.ts`
- `netlify/functions/shared/digest.ts`
- `firestore.rules`
- `firestore.indexes.json`

### Interfaces

```ts
export type GuidanceFactKind =
  | "natal"
  | "dasha"
  | "transit"
  | "panchang"
  | "confirmed_memory"
  | "recent_outcome";

export interface GuidanceFact {
  id: string;
  kind: GuidanceFactKind;
  label: string;
  value: string;
  sourceRef: string;
  observedAt: string;
  confidence: number;
}

export interface DailyActionSuggestion {
  actionId: string;
  practiceId?: string;
  title: string;
  rationale: string;
  durationMinutes: number;
  expectedEffect: "ground" | "clarify" | "connect" | "focus" | "rest" | "reflect";
}

export interface DailyGuidance {
  dateKey: string;
  timezone: string;
  guideVersion: string;
  headline: string;
  interpretation: string;
  facts: GuidanceFact[];
  action: DailyActionSuggestion;
  caution?: string;
  generatedAt: string;
  expiresAt: string;
}
```

The web application re-exports these types through `src/types/index.ts`; the mobile application imports them directly from `@astroyou/domain`. This avoids creating a second set of response types during native development.

`POST /api/daily-guide` accepts `idToken`, optional guest `birthData`, `dateKey`, `timezone`, current latitude and longitude. For signed-in users, server profile and Atman data override client copies. Validate date boundaries using IANA timezone, not server time.

`POST /api/daily-cycle/complete` accepts a stable `actionId`, completion state and outcome. It must be idempotent by `uid + dateKey + actionId`.

### Storage

```text
users/{uid}/dailyCycles/{dateKey}
  guideVersion
  guidanceSnapshot
  acceptedActionId
  actionState: suggested | accepted | completed | dismissed | replaced
  intention
  completedAt
  outcome: helped | partly_helped | did_not_help | did_not_try
  selfReportedBefore
  selfReportedAfter
  reflectionExcerpt
  createdAt
  updatedAt
```

Owner may read. Only server may write. Raw long-form reflection does not belong in this document.

### Generation rules

1. Build normalized facts deterministically.
2. Exclude unconfirmed low-confidence memories.
3. Rank facts by urgency, personal relevance, novelty and actionability.
4. Send only the top facts to Gemini.
5. Require structured JSON matching `DailyGuidance`.
6. Validate every fact reference against the supplied fact IDs.
7. If generation or validation fails, use deterministic fallback.
8. Cache by `uid/dateKey/timezone/guideVersion/contextFingerprint`.

### Security

- Verify Firebase token for signed-in storage.
- Enforce object ownership on every daily-cycle mutation.
- Rate limit guide generation per UID and IP.
- Limit guest birth-data payload size and validate coordinates.
- Never log raw Atman or journal data.
- Return generic errors with a request ID.

### Acceptance

- First personalized signal appears within 90 seconds of starting onboarding.
- Every interpretation exposes at least two valid evidence facts.
- Completing an action changes the same-day UI and is visible in the next day's context.
- Timezone, DST and travel tests pass.
- A failed AI request still produces safe deterministic guidance.

## Program 3: Atman V2 and advice-outcome learning

### Files

Create:

- `packages/domain/src/atman-v2.ts`
- `netlify/functions/shared/atman-v2/memory.ts`
- `netlify/functions/shared/atman-v2/advice.ts`
- `netlify/functions/shared/atman-v2/outcomes.ts`
- `netlify/functions/shared/atman-v2/summary.ts`
- `netlify/functions/shared/atman-v2/migrate.ts`
- `netlify/functions/memory-list.ts`
- `netlify/functions/memory-action.ts`
- `netlify/functions/advice-feedback.ts`
- `netlify/functions/atman-v2-migrate-scheduled.ts`
- `src/hooks/useMemoryLedger.ts`
- `src/components/memory/MemoryLedger.tsx`
- `src/components/memory/MemoryItem.tsx`
- `src/components/memory/MemoryInfluence.tsx`
- `netlify/functions/__tests__/atman-v2.test.ts`
- `netlify/functions/__tests__/atman-v2-migration.test.ts`
- `netlify/functions/__tests__/memory-api.test.ts`

Modify:

- `src/types/user.ts`
- `src/lib/atman-schema.ts`
- `src/lib/atman.ts`
- `netlify/functions/shared/atman-brain.ts`
- `netlify/functions/shared/user-context.ts`
- `netlify/functions/shared/gemini.ts`
- `src/components/dashboard/MemoryPanel.tsx`
- `src/pages/Settings.tsx`
- `firestore.rules`
- `firestore.indexes.json`

### Data model

```ts
export type MemoryStatus = "proposed" | "confirmed" | "rejected" | "archived";
export type MemoryKind = "pattern" | "life_event" | "preference" | "relationship" | "practice_response";

export interface AtmanMemoryV2 {
  id: string;
  kind: MemoryKind;
  statement: string;
  status: MemoryStatus;
  confidence: number;
  evidence: AtmanMemoryEvidence[];
  firstObservedAt: string;
  lastObservedAt: string;
  lastConfirmedAt?: string;
  supersedes?: string;
  archivedReason?: "user_rejected" | "contradicted" | "stale" | "merged";
}

export type AdviceOutcome = "helped" | "partly_helped" | "did_not_help" | "did_not_try";

export interface AdviceRecordV2 {
  adviceId: string;
  source: "daily_guide" | "synthesis" | "consult" | "practice";
  sourceInteractionId?: string;
  actionType: string;
  actionText: string;
  contextFactIds: string[];
  offeredAt: string;
  acceptedAt?: string;
  completedAt?: string;
  outcome?: AdviceOutcome;
  outcomeRecordedAt?: string;
  selfReportedBefore?: string;
  selfReportedAfter?: string;
  userNote?: string;
}
```

### Firestore layout

```text
users/{uid}/atmanState/current            # compact prompt/dashboard summary
users/{uid}/atmanMemories/{memoryId}      # durable evidence-backed memories
users/{uid}/adviceLedger/{adviceId}       # offered actions and outcomes
users/{uid}/memoryEvents/{eventId}         # immutable server audit events
```

All four collections are owner-readable and server-writable. User mutations go through authenticated endpoints so status transitions, evidence and audit events cannot be forged by a client.

### Migration

1. Add V2 collections without changing V1 reads.
2. Backfill each user idempotently from `users/{uid}.atman`.
3. Store `migrationVersion`, source hash and counts in `atmanState/current`.
4. Dual-write V1 summary and V2 documents for one release.
5. Compare summaries and log mismatches without sensitive text.
6. Switch prompt reads to V2 summary.
7. Switch dashboard reads to V2.
8. Stop V1 writes.
9. Retain the V1 field for rollback for 30 days, then remove it with an explicit deletion migration.

### Learning rules

- `proposed` memories never drive high-stakes guidance.
- A user-confirmed memory may drive guidance immediately.
- An inferred memory requires repeated evidence or explicit confirmation.
- A rejected memory is never re-proposed from the same evidence.
- `did_not_help` reduces recommendation priority for the same action/context combination.
- The system may retry an unhelpful action only with a changed rationale and explicit explanation.
- Memory influence must be exposed in the UI.

### Acceptance

- Every active memory has evidence and a visible status.
- Users can confirm, edit, forget and archive one item without clearing a bucket.
- No V2 collection is client-writable.
- Migration can run twice without duplicating documents.
- Prompt assembly remains within a fixed token budget.
- Atman tests include invented-memory, wrong-date, duplicate-evidence and rejected-memory cases.

## Program 4: Journal and guided reflection

### Files

Create:

- `src/types/journal.ts`
- `netlify/functions/journal-entry.ts`
- `netlify/functions/journal-list.ts`
- `netlify/functions/journal-analyze.ts`
- `netlify/functions/shared/journal/analyze.ts`
- `netlify/functions/shared/journal/validate.ts`
- `src/hooks/useJournal.ts`
- `src/components/journal/JournalComposer.tsx`
- `src/components/journal/JournalInsightReview.tsx`
- `src/components/journal/VoiceJournalButton.tsx`
- `netlify/functions/__tests__/journal-analysis.test.ts`

Modify:

- `src/components/sadhana/KarmicJournal.tsx`
- `src/components/sadhana/DailyAltar.tsx`
- `src/pages/Synthesis.tsx` to share the existing web speech-recognition adapter.
- `src/lib/analytics-events.ts`

### Analysis contract

```ts
export interface JournalInsightProposal {
  id: string;
  kind: "pattern" | "life_event" | "relationship_update" | "practice_response";
  statement: string;
  evidenceExcerpt: string;
  confidence: number;
  sensitive: boolean;
}

export interface JournalAnalysisResult {
  summary: string;
  reflectionQuestion: string;
  proposals: JournalInsightProposal[];
}

export type JournalMode = "reflection" | "dream" | "relationship" | "practice_review";

export interface CloudJournalEntry {
  entryId: string;
  mode: JournalMode;
  text: string;
  localDate: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  analysisVersion?: string;
}
```

The endpoint accepts a maximum of 10,000 characters, returns at most one summary, one question and five proposals, and persists nothing. The user reviews every proposal. Accepted proposals are sent to the V2 memory API with their original evidence.

`/api/journal/entry` supports authenticated `POST`, `PATCH` and `DELETE` operations. `/api/journal/list` returns cursor-paginated metadata and entries owned by the authenticated user. Both endpoints verify object ownership, reject unknown fields and return generic errors with request IDs.

The composer does not interrupt while the user writes. Analysis begins only after `Notice patterns` is pressed.

### Privacy modes

- **Cloud journal:** owner-readable Firestore entry, available across devices, included in export/delete.
- **Private journal:** encrypted on device and never stored as plaintext in Firestore. The user may send a selected entry for one-time analysis; the server must not persist or log the raw text.

Native private entries use AES-256-GCM application-layer encryption, a random content key stored in `expo-secure-store`, and encrypted blobs stored in SQLite. Cross-device raw-journal sync is not promised until a reviewed key-recovery design exists.

Cloud entries use:

```text
users/{uid}/journalEntries/{entryId}
```

They are owner-readable and server-writable. Firestore rules deny client writes; the journal endpoint performs validation, authorization and audit logging. Server logs must contain entry ID, size, mode and request ID only.

### Acceptance

- Voice and text entries support the same review flow.
- No proposal is automatically accepted.
- Rejected proposals do not affect future guidance.
- Private-mode raw text is absent from Firestore and server logs.
- Journal analysis remains useful when zero memories are proposed.

## Program 5: Editorial Practice Catalog and recommendation engine

### Files

Create:

- `src/types/practice.ts`
- `src/types/editorial.ts`
- `netlify/functions/shared/practices/catalog.ts`
- `netlify/functions/shared/practices/recommend.ts`
- `netlify/functions/practices-list.ts`
- `netlify/functions/practice-complete.ts`
- `netlify/functions/weekly-editorial.ts`
- `src/hooks/usePractices.ts`
- `src/pages/PracticeLibrary.tsx`
- `src/components/weekly/WeeklyReading.tsx`
- `src/components/practices/PracticePlayer.tsx`
- `src/components/practices/PracticeCard.tsx`
- `src/components/practices/PracticeTranscript.tsx`
- `netlify/functions/__tests__/practice-recommendation.test.ts`

Modify:

- `src/components/prana/PranaOverlay.tsx`
- `src/hooks/useAudio.ts`
- `src/components/dharma/DharmaList.tsx`
- `src/pages/Wellness.tsx`
- `src/pages/Admin.tsx`
- `storage.rules`
- `firestore.rules`

### Catalog schema

```ts
export interface PracticeDefinition {
  id: string;
  version: number;
  title: string;
  description: string;
  modality: "breath" | "meditation" | "mantra" | "reflection" | "movement" | "sleep";
  durationMinutes: number;
  language: string;
  contextTags: string[];
  expectedEffects: DailyActionSuggestion["expectedEffect"][];
  avoidWhen: string[];
  steps: string[];
  transcript?: string;
  audioUrl?: string;
  artworkUrl?: string;
  authorName: string;
  reviewerName: string;
  reviewStatus: "draft" | "reviewed" | "published" | "retired";
  publishedAt?: string;
}

export interface WeeklyEditorial {
  id: string;
  weekKey: string;
  language: string;
  title: string;
  collectiveReading: string;
  journalPrompt: string;
  recommendedPracticeIds: string[];
  audioUrl?: string;
  transcript?: string;
  authorName: string;
  reviewerName: string;
  reviewStatus: "draft" | "reviewed" | "published" | "retired";
  publishedAt?: string;
  contentVersion: number;
}
```

Recommendations are deterministic over tags and prior outcomes. AI may explain why a selected practice fits, but may not invent a practice or contraindication.

`weeklyEditorial/{weekKey_language}` is server-managed content. The client reads it through `/api/weekly-editorial`; Gemini may add a personalized overlay using the user's chart, but the collective reading and practice references remain unchanged and visibly attributed to the human author and reviewer.

### Acceptance

- At least 30 reviewed practices cover 2, 5, 10 and 20-minute use cases before launch.
- Every audio practice has a transcript.
- Every practice has author, reviewer and version metadata.
- A reviewed weekly reading, prompt and practice set is published before each local week begins.
- Completion creates an advice outcome candidate.
- Medical or physiological claims require documented review or are removed.

## Program 6: Relationship intelligence

### Files

Create:

- `src/types/relationship.ts`
- `netlify/functions/relationship-create.ts`
- `netlify/functions/relationship-event.ts`
- `netlify/functions/relationship-insight.ts`
- `netlify/functions/relationship-invite.ts`
- `netlify/functions/relationship-consent.ts`
- `src/hooks/useRelationships.ts`
- `src/pages/RelationshipTimeline.tsx`
- `src/components/relationships/RelationshipEventComposer.tsx`
- `src/components/relationships/RelationshipInsight.tsx`
- `src/components/relationships/SharingScope.tsx`
- `src/lib/relationship-share.ts`
- `netlify/functions/relationship-share-card.ts`
- `netlify/functions/__tests__/relationship-authorization.test.ts`

Modify:

- `src/pages/Compatibility.tsx`
- `src/pages/Friends.tsx`
- `src/pages/PublicProfile.tsx`
- `netlify/functions/compatibility.ts`
- `firestore.rules`
- `firestore.indexes.json`

### Firestore

```text
users/{uid}/relationships/{relationshipId}
users/{uid}/relationships/{relationshipId}/events/{eventId}
users/{uid}/relationships/{relationshipId}/insights/{insightId}
relationshipInvites/{inviteId}              # server-only, expiring token
```

Each record declares `scope: private | shared_summary`. Private notes never enter shared compatibility output. The invitee must explicitly consent before their birth data or chart is used. Revocation removes future access immediately.

### Security tests

- A user cannot read another user's relationship path by guessing IDs.
- A shared invite exposes only the allowed summary.
- Revoked and expired invites fail.
- Relationship names and notes are absent from analytics and logs.

### Acceptance

- A relationship can accumulate events, guidance and outcomes over time.
- Users can understand which chart factors support each insight.
- Shared analysis never reveals private journal or Atman content.
- A share card contains a safe summary and deep link, never birth data, private notes or unconfirmed memories.

## Program 7: Trust, safety, provenance and memory governance

### Files

Create:

- `src/types/provenance.ts`
- `netlify/functions/shared/provenance.ts`
- `netlify/functions/shared/safety/classify.ts`
- `netlify/functions/shared/safety/respond.ts`
- `netlify/functions/shared/safety/redact.ts`
- `netlify/functions/__tests__/safety-red-team.test.ts`
- `netlify/functions/__tests__/provenance.test.ts`
- `src/components/guidance/WhyThis.tsx`
- `src/components/guidance/GuidanceBoundary.tsx`

Modify:

- `netlify/functions/shared/ai-guidance-policy.ts`
- `netlify/functions/shared/gemini.ts`
- `netlify/functions/synthesis.ts`
- `netlify/functions/consult-message.ts`
- `src/lib/legal-policies.ts`
- `src/pages/Trust.tsx`
- `src/pages/Disclaimer.tsx`

### Provenance

Every generated guidance object includes:

```ts
export interface GuidanceProvenance {
  astronomicalFactIds: string[];
  memoryIds: string[];
  interpretationTradition: "vedic_jyotish" | "western";
  ayanamsa?: "lahiri";
  zodiacMode: "sidereal" | "tropical";
  model: string;
  promptVersion: string;
  generatedAt: string;
  limitations: string[];
}
```

### Safety pipeline

1. Validate and length-limit input.
2. Classify immediate-risk signals separately from astrology interpretation.
3. For immediate risk, suspend predictive astrology and provide real-world emergency/trusted-person guidance.
4. Generate within the shared policy.
5. Scan output for prohibited medical, fatalistic, coercive, financial-guarantee and fear-upsell claims.
6. Replace unsafe output with a deterministic safe response.
7. Log only risk tier, policy version and request ID; never log raw sensitive content.

### Acceptance

- All 100+ red-team scenarios pass.
- No output claims diagnosis, cure, guaranteed future, guaranteed compatibility or required paid remedy.
- Every daily guide and substantial AI answer can display its provenance.
- Users can pause Atman learning without losing core astrology features.

## Program 8: Native mobile application

### Technical baseline

- Expo SDK 57.
- React Native 0.86.
- React 19.2.3.
- Node.js 22.13 or newer.
- Expo Router.
- EAS development, preview and production builds.
- Firebase JavaScript SDK 12.x, matching the web major version.
- Firebase Auth initialized with `getReactNativePersistence(AsyncStorage)` from `@react-native-async-storage/async-storage`.
- Firestore JavaScript SDK for owner-readable data; sensitive or server-owned mutations continue through `@astroyou/api-client` Netlify endpoints.
- `expo-notifications` with FCM v1 for Android and APNs for iOS.
- `expo-secure-store` for device secrets.
- SQLite for offline queue and private journal blobs.
- `i18next` and `react-i18next` in a shared `packages/i18n` package; no screen owns hard-coded translated copies.

Expo version mapping source: <https://docs.expo.dev/versions/latest/>. Notification design sources: <https://docs.expo.dev/versions/latest/sdk/notifications/> and <https://docs.expo.dev/push-notifications/push-notifications-setup/>.

### Files

Create:

```text
apps/mobile/app/_layout.tsx
apps/mobile/app/index.tsx
apps/mobile/app/onboarding/*
apps/mobile/app/today.tsx
apps/mobile/app/guidance.tsx
apps/mobile/app/journal.tsx
apps/mobile/app/relationships.tsx
apps/mobile/app/settings.tsx
apps/mobile/src/auth/*
apps/mobile/src/notifications/*
apps/mobile/src/offline/*
apps/mobile/src/audio/*
apps/mobile/src/secure/*
apps/mobile/eas.json
packages/domain/src/*
packages/api-client/src/*
packages/i18n/src/*
```

### Release scope

Native V1 includes only onboarding, Today, Synthesis, Journal, Practices, Relationships, subscription management, notifications and settings. Advanced Vedic tools remain web-deep-linked until the core native loop is stable.

English is the source locale. Hindi is the first additional locale. Translation keys cover navigation, onboarding, the daily loop, journal controls, practices, safety copy, paywalls and settings before public launch. Generated guidance receives the normalized profile language; stored enum values and analytics events remain language-independent.

### Offline behaviour

- Cache the last seven daily guides.
- Queue action completions and journal saves with idempotency keys.
- Reconcile on reconnect using server `updatedAt` and explicit conflict rules.
- Never queue payments.
- Private journal blobs remain device-encrypted.

### Notifications

Store one document per device token with platform, app version, locale, timezone, permission status and last-seen timestamp. Track both Expo and native token when available. Process push receipts and retire invalid tokens.

Notification deep links open a specific daily guide, practice, relationship or weekly review. No notification uses fear, urgency about harm or a hidden paid gate.

### Acceptance

- App launches to useful cached content offline.
- Daily action completion syncs exactly once after reconnect.
- Push open routes to the correct object.
- Journal can be protected by device biometrics.
- Release builds pass iOS and Android smoke suites on physical devices.
- Crash-free sessions exceed 99.5% before public rollout.

## Program 9: Onboarding, information architecture and accessibility

### Files

Modify:

- `src/pages/Onboarding.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/layout/Header.tsx`
- `src/components/dashboard/ExploreIndex.tsx`
- `src/components/dashboard/HeroAlmanac.tsx`
- `src/components/dashboard/UtilityDock.tsx`
- `src/components/SectionErrorBoundary.tsx`
- `src/lib/spaces.ts`

Create:

- `src/components/onboarding/BirthDetailsStep.tsx`
- `src/components/onboarding/BirthPlaceStep.tsx`
- `src/components/onboarding/FirstSignalPreview.tsx`
- `src/components/onboarding/ChartImportOption.tsx`
- `src/components/daily/GoDeeper.tsx`
- `netlify/functions/__tests__/onboarding-readiness.test.ts`

### Required flow

1. Promise: “Let's find your Moon and rising sign.”
2. Name and date.
3. Time with explicit unknown-time option.
4. Place with timezone and coordinates.
5. First useful preview.
6. Optional account creation to preserve the experience.

Existing-chart upload becomes an alternate method inside the flow, not the first screen.

### Accessibility

- Minimum 12px metadata text.
- WCAG AA contrast on core flows.
- Persistent focus-visible states.
- No focusable controls in closed overlays.
- Accessible text equivalent for day-arc SVG information.
- Visible horizontal-scroll affordance or responsive replacement.
- Every async region has retry and `aria-live` status.
- Reduced-motion alternative for all long-form animation.

### Acceptance

- Progress labels and visual steps always agree.
- Guest location drives Panchang and today boundaries.
- No guest sees an action that can only fail after clicking.
- Mobile usability passes 320, 375, 768 and 1440px checks.
- Keyboard-only and screen-reader smoke tests pass.

## Program 10: Monetization and entitlements

### Principle

Never hide the product's core habit behind a paywall before the user experiences it.

### Entitlement changes

Free:

- Daily personalized signal.
- One recommended action per day.
- One journal analysis per day.
- Memory ledger inspection and correction.
- Outcome recording.
- Basic chart, Panchang and compatibility.

Premium:

- Full practice library.
- Unlimited journal analyses within fair-use limits disclosed before purchase.
- Weekly and monthly growth reviews.
- Extended history.
- Advanced forecasts and reports.
- Offline downloads and expanded personalization.

Pro:

- Advanced Vedic and specialty reports.
- Higher generation quotas.
- Priority human expert review when that program exists.

Modify:

- `src/lib/entitlements.ts`
- `netlify/functions/shared/entitlements.ts`
- `src/lib/subscriptions.ts`
- `netlify/functions/shared/subscription-plans.ts`
- `src/pages/Pricing.tsx`
- `src/pages/Wallet.tsx`
- `src/pages/Settings.tsx`

### Acceptance

- Client/server entitlement parity test remains mandatory.
- Every paywall states exact included features, renewal amount, renewal date, limit and cancellation route.
- Emotional conversations never display a countdown tied to harm avoidance.
- Purchase receipts show plan, amount, currency, renewal and usage allowance.

## Program 11: Quality, evaluation and release gates

### Test layers

1. **Pure domain tests:** Atman merge, outcome ranking, daily fact ranking, practice selection.
2. **Function tests:** auth, ownership, validation, rate limits, idempotency, error redaction.
3. **Firestore emulator tests:** rules, migration, indexes and cross-user denial.
4. **AI evaluation:** specificity, evidence fidelity, memory hallucination, contradiction handling and safety.
5. **Web E2E:** onboarding, daily cycle, journal proposal, memory correction, subscription and export/delete.
6. **Native E2E:** Maestro flows on iOS and Android release builds.
7. **Astrology golden fixtures:** timezone, DST, ayanamsa, birth-time-unknown and travel-location cases.
8. **Accessibility:** automated scan plus keyboard and screen-reader smoke.
9. **Performance:** cold start, first signal, streaming latency and offline reopen.

### Required commands after the programs exist

```bash
pnpm run test:types
pnpm run test:functions
pnpm test
pnpm run build
pnpm run check:launch
pnpm run check:market
```

Add dedicated commands:

```text
test:rules
test:e2e:web
test:e2e:mobile
test:ai-evals
test:security
```

### Release gates

- Zero critical or high safety-eval failures.
- Zero cross-user authorization failures.
- No raw sensitive content in logs or analytics.
- 99.5% crash-free sessions in staged native rollout.
- P95 first personalized signal below 3 seconds after profile exists.
- P95 cached dashboard below 1.5 seconds.
- Every migration has idempotency, readback and rollback evidence.

## Program 12: Real human expertise without dependency pressure

This program begins only after the core companion reaches the D30 retention gate. Existing AI personas remain clearly labeled AI modes; they are not represented as human astrologers.

### Product model

- Human experts provide scheduled sessions or asynchronous review of an existing AstroYou question, chart interpretation or relationship report.
- Users see credentials, methodology, languages, price, duration, cancellation policy and available times before payment.
- No expert can message a user with unsolicited fear, urgency or remedy sales.
- Session continuity is opt-in: the user chooses which Atman memories or prior guidance the expert may see and whether the resulting summary returns to Atman.
- Compensation is fixed per session/review, not optimized around extending emotionally vulnerable calls.

### Files

Create:

- `src/types/human-expert.ts`
- `netlify/functions/experts-list.ts`
- `netlify/functions/expert-availability.ts`
- `netlify/functions/expert-session-create.ts`
- `netlify/functions/expert-session-complete.ts`
- `netlify/functions/expert-session-review.ts`
- `netlify/functions/shared/experts/credentials.ts`
- `netlify/functions/shared/experts/availability.ts`
- `netlify/functions/shared/experts/sessions.ts`
- `src/pages/HumanExperts.tsx`
- `src/pages/HumanExpertProfile.tsx`
- `src/pages/HumanExpertSession.tsx`
- `src/components/experts/ContextConsent.tsx`
- `netlify/functions/__tests__/expert-authorization.test.ts`
- `netlify/functions/__tests__/expert-session-lifecycle.test.ts`

Modify:

- `src/lib/personas.ts` to separate `ai_guides` from `human_experts` in navigation and copy.
- `src/pages/Consult.tsx`
- `src/pages/ConsultProfile.tsx`
- `src/pages/ConsultChat.tsx`
- `netlify/functions/shared/consult-session.ts`
- `firestore.rules`
- `firestore.indexes.json`

### Firestore

```text
experts/{expertId}                              # public approved profile
experts/{expertId}/availability/{slotId}       # server-managed
users/{uid}/expertSessions/{sessionId}          # owner read, server write
expertSessions/{sessionId}                      # server-only operational record
expertCredentialReviews/{reviewId}              # server-only audit
```

### Session state machine

```text
quoted -> reserved -> paid -> scheduled -> active -> completed
                    \-> cancelled -> refunded_or_forfeited
```

Every transition is server-authoritative, idempotent and audit-logged. Payment success never implies session completion. A completed session may create a user-visible summary only after the expert submits it; Atman ingestion requires separate user approval.

### Acceptance

- AI and human identities are unambiguous in every surface.
- An expert sees only context explicitly selected by the user.
- Credential review and suspension are auditable.
- Refund, cancellation and no-show paths are tested.
- Session reviews are accepted only from users with completed sessions.
- No per-minute countdown or remedy commission is used.

## Build order and dependencies

```text
Program 1: truth + analytics
        |
        +--> Program 2: daily orchestrator ----+
        |                                      |
        +--> Program 3: Atman V2 --------------+--> Program 4: journal
        |                                      |
        +--> Program 7: safety/provenance -----+
                                               |
Program 5: practice catalog -------------------+--> Program 8: native
Program 9: onboarding/IA ----------------------+       |
Program 10: entitlements ----------------------+       +--> public mobile launch
Program 6: relationships ------------------------------+

Program 11 quality gates apply to every program.
Program 12 human expertise starts only after native public launch and D30 retention proof.
```

### Independently releasable sequence

1. **Truth and observability:** correct roadmap, add companion events, establish baselines.
2. **Daily ritual web release:** simplified dashboard and structured daily cycle with deterministic fallback.
3. **Atman V2 foundation:** backfill, dual-write, memory ledger and advice outcomes.
4. **Journal release:** voice/text reflection with proposed memories and explicit consent.
5. **Practice catalog:** reviewed content and recommendation outcomes.
6. **Trust release:** provenance UI, safety evals and pause-learning controls.
7. **Native private beta:** core daily loop only.
8. **Relationship timeline:** private-first, then consented sharing.
9. **Native public launch:** push, offline, subscription and app-store readiness.
10. **Scale:** localization, weekly editorial programming and controlled experiments.
11. **Human expertise:** credentialed, consent-limited sessions after the companion itself retains users.

## What must be stopped

Until D30 retention and user preference prove the core loop, do not prioritize:

- Additional divination systems.
- More pseudo-expert AI personas.
- Public community feeds.
- Per-minute AI pressure.
- E-commerce remedies.
- Decorative 3D expansion unrelated to the daily ritual.
- Invented spiritual or emotional percentage scores.
- Clinical terminology.
- Claims that a feature is unique without current competitor verification.

Existing specialty routes may remain available, but they must not occupy the primary daily journey.

## Definition of beating the category

### Blind product preference

- At least 70% of target users prefer AstroYou to Moonly for “What should I know and do today?”
- At least 70% prefer AstroYou to The Pattern for understanding a recurring relationship dynamic.
- At least 70% prefer AstroYou to Rosebud for reviewing how they changed over four weeks.
- Tests use identical user facts and remove brand identifiers.

### Activation and retention

- At least 70% of started onboarding sessions reach a personalized signal.
- Median first value is below 90 seconds.
- At least 50% of activated users accept or replace their first action.
- D7 retained users exceed 25%.
- D30 retained users exceed 12% before paid acquisition scales.
- At least 30% of accepted actions receive an outcome.

These retention thresholds are provisional product gates, not market averages. Replace them only after AstroYou has a reliable baseline and a documented reason.

### Guidance quality

- At least 80% of rated guidance is specific and helpful.
- Every active memory is traceable to evidence.
- Fewer than 5% of shown memories are corrected as materially wrong.
- No rejected memory reappears from the same evidence.
- Unhelpful advice is not repeated without an explicit change.

### Trust and quality

- No undisclosed limits or renewal terms.
- Fewer than 1% of purchasers contact support about an unexpected charge.
- No critical safety or authorization failures.
- WCAG AA on primary flows.
- 4.7+ store rating after 500 verified ratings.
- 99.5%+ crash-free sessions.

## Required follow-on implementation plans

This master specification must be decomposed into these task-by-task plans after product-owner approval:

1. Product truth and companion analytics.
2. Daily Guidance Orchestrator and dashboard ritual.
3. Atman V2 schema, migration and memory ledger.
4. Journal analysis and voice capture.
5. Practice Catalog and audio platform.
6. Safety, provenance and privacy controls.
7. Native Expo application.
8. Relationship timeline and consent sharing.
9. Onboarding and accessibility remediation.
10. Entitlement and pricing redesign.
11. Human expert sessions and credential governance.

Each plan must use TDD, list exact file changes, include migration/readback steps, end every task with focused verification and preserve the existing web experience until its replacement is proven.

## Product-owner decisions required before implementation

1. Confirm that the primary promise is the closed-loop companion, not maximum feature breadth.
2. Confirm English-first global launch with Hindi as the first additional language.
3. Confirm that the native app is a real Expo application rather than a WebView wrapper.
4. Confirm that the basic daily loop and one daily journal analysis remain free.
5. Confirm that raw private journal mode may sacrifice cross-device raw-text sync until secure key recovery is designed.
6. Confirm that human editorial review is a launch requirement for flagship weekly content and practices.
