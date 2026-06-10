# AstroYou Platform Handoff Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn AstroYou from a feature-rich astrology app into a trusted spiritual companion platform that can beat AstroTalk on paid consultations and AstroSage on discovery.

**Architecture:** Keep the current Vite, React, Netlify Functions, Firebase, Gemini, and astrology-api.io stack for fast full-product iteration. Tighten the platform boundary so money, AI context, user memory, and session records are server-owned, auditable, and reusable across every surface.

**Tech Stack:** React 19, TypeScript, Netlify Functions, Firestore, Firebase Auth, Gemini, astrology-api.io, Razorpay.

---

## Platform Judgment

AstroYou is on the right platform path, but it should not keep growing as scattered astrology features or be judged as a small MVP. The target is a full-fledged spiritual companion, marketplace, discovery engine, and monetized product.

The winning platform should be:

- **A companion:** remembers the user's birth data, emotions, routines, relationships, questions, and growth patterns.
- **A guide:** turns chart, dasha, transit, panchang, and Atman memory into specific next actions.
- **A marketplace:** gives users the familiar AstroTalk habit of "consult an expert", but with transparent AI, lower cost, and better context.
- **A discovery engine:** uses free SEO tools to compete with AstroSage before users know the brand.
- **A business:** has server-side billing, credit ledgers, subscriptions, reports, refunds, and admin visibility.

Current architecture is acceptable for the next few phases if we enforce these rules:

- Server owns credits, payments, subscriptions, and consultation billing.
- One AI context builder feeds Synthesis, Consult, reports, nudges, and daily guidance.
- All astrology data still goes through `netlify/functions/shared/astro-api.ts` and `/api/kundali`.
- Firestore schemas are explicit, versioned, and never silently guessed in components.
- SEO pages must be indexable; a pure client-rendered SPA is not enough for AstroSage-style acquisition.

---

## Phase 0: Stabilize The Foundation

**Priority:** Immediate.

**Why this matters:** We should not build monetization or marketplace growth on a base where TypeScript, linting, routing, and billing boundaries are unclear.

**Status from this pass:**

- [x] Added `pnpm test` as TypeScript verification.
- [x] Added ESLint 9 flat config so `pnpm run lint` runs.
- [x] Fixed TypeScript blockers around forecast data, user profile fields, share modal usage, and routine creation.
- [x] Split consult routing into profile and chat pages.
- [x] Moved consultation end billing into a server-side Netlify function.
- [x] Stopped client-side direct credit decrement for consult sessions.

**Remaining steps:**

- [x] Add a focused smoke test for consult end billing.
  - Files: `netlify/functions/consult-end.ts`, new `netlify/functions/__tests__/consult-end.test.ts`.
  - Check: valid user + enough credits decrements credits and writes a consultation record.
  - Check: insufficient credits returns `402` and does not write a record.

- [x] Rename unused Netlify `context` parameters to `_context`.
  - Files: `netlify/functions/*.ts`.
  - Reason: keep lint warnings meaningful.

- [x] Decide lint strictness by area.
  - Frontend app: keep hook dependency warnings visible.
  - Server functions: unused variables should become errors after cleanup.
  - Generated output: always ignored.

**Acceptance:**

- `pnpm test` passes.
- `pnpm run lint` exits successfully.
- Consult billing can only change credits from server code.

---

## Phase 1: Build The Platform Brain

**Priority:** P0 after stabilization.

**Why this matters:** This is the actual moat. AstroTalk can copy a chat UI. AstroSage can add AI summaries. The harder thing to copy is a private memory system that knows the user over time and guides them with empathy.

### Task 1.1: Create a Single User Context Builder

**Files:**

- Create: `netlify/functions/shared/user-context.ts`
- Modify: `netlify/functions/synthesis.ts`
- Modify: future consult message function from Phase 2
- Modify: `netlify/functions/shared/gemini.ts`

**Steps:**

- [x] Move all server-side context assembly into `buildUserContext(uid, birthDataOverride?)`.
- [x] Include profile, credits, subscription tier, kundali summary, current dasha, transits, panchang, Atman state, active routines, key relationships, recent chat summaries, and recent guidance.
- [x] Return a typed `UserContext` object, not a loose object.
- [x] Make Synthesis use this builder before calling Gemini.
- [x] Make Consult use the same builder with persona-specific additions.

**Acceptance:**

- Synthesis and Consult produce responses from the same user memory and chart context.
- No page component manually assembles AI context.
- Missing optional data is explicit, not silently replaced with fake values.

### Task 1.2: Version The Atman Schema

**Files:**

- Modify: `src/types/user.ts`
- Modify: `src/lib/atman.ts`
- Modify: `src/hooks/useConsciousness.ts`
- Create: `docs/ATMAN_SCHEMA.md`

**Steps:**

- [x] Add `schemaVersion` to `users/{uid}.atman`.
- [x] Separate durable memory from transient mood.
- [x] Store these buckets:
  - `emotionalState`
  - `emotionalHistory`
  - `knownPatterns`
  - `lifeEvents`
  - `keyRelationships`
  - `routines`
  - `savedAdvice`
  - `dailyIntention`
  - `dailyGratitude`
- [x] Add validation before writing Atman updates.
- [x] Add a small migration path for old users with missing fields.

**Acceptance:**

- Atman writes are typed.
- Old users do not break.
- Gemini cannot overwrite the whole Atman object accidentally.

### Task 1.3: Add Empathy Rules To AI

**Files:**

- Modify: `netlify/functions/shared/gemini.ts`
- Create: `docs/AI_GUIDANCE_POLICY.md`

**Steps:**

- [x] Define hard rules: no fear-based predictions, no fatalism, no medical diagnosis, no guaranteed financial claims.
- [x] Define guidance style: acknowledge emotion, connect to chart context, give one practical next step.
- [x] Add crisis and high-risk escalation language for self-harm, abuse, severe anxiety, and medical emergencies.
- [x] Make persona prompts inherit these rules.

**Acceptance:**

- Synthesis and Consult both follow the same safety and empathy policy.
- The app can still be spiritual without sounding generic or scary.

---

## Phase 2: Finish The AI Astrologer Marketplace

**Priority:** P0 revenue and acquisition.

**Why this matters:** This is the AstroTalk attack. Users understand "talk to an astrologer" already. We can win by making it cheaper, instant, transparent, and much more personal.

### Task 2.1: Create A Server-Owned Consultation Session

**Files:**

- Create: `netlify/functions/consult-start.ts`
- Create: `netlify/functions/consult-message.ts`
- Modify: `netlify/functions/consult-end.ts`
- Modify: `src/pages/ConsultChat.tsx`
- Modify: `src/pages/ConsultProfile.tsx`
- Modify: `src/lib/personas.ts`

**Steps:**

- [x] `consult-start` verifies auth, persona, profile, and available balance.
- [x] Create `users/{uid}/consultations/{sessionId}` with `status: "active"`.
- [x] Store `startedAt`, `personaId`, `pricePerMin`, `reservedCredits`, and `messageCount`.
- [x] `consult-message` verifies the active server session before streaming Gemini. Full shared context builder comes in Phase 1.1.
- [x] `consult-end` closes the active session, computes billable minutes, deducts credits, and writes final receipt.
- [x] Client stores only `sessionId`, not billing authority.

**Acceptance:**

- Refreshing the page does not create duplicate billing.
- A user cannot lower the price from the browser.
- A session has one clear lifecycle: active, ended, failed, refunded.

### Task 2.2: Add Credit Ledger

**Files:**

- Create: `netlify/functions/shared/credits.ts`
- Modify: `netlify/functions/consult-end.ts`
- Modify: `netlify/functions/razorpay-verify.ts`
- Modify: `src/hooks/useSubscription.ts`

**Steps:**

- [x] Add `users/{uid}/creditLedger/{entryId}`.
- [x] Every credit change writes a ledger entry with `type`, `amount`, `source`, `balanceAfter`, and `createdAt`.
- [x] Supported types: `purchase`, `consultation`, `synthesis`, `refund`, `admin_adjustment`, `subscription_grant`, and `signup_bonus`.
- [x] Replace direct credit updates with `applyCreditChange()`.

**Acceptance:**

- Admin can explain any user's balance.
- Failed payments and failed consults do not create silent credit drift.

### Task 2.3: Improve Marketplace UX

**Files:**

- Modify: `src/pages/Consult.tsx`
- Modify: `src/pages/ConsultProfile.tsx`
- Modify: `src/pages/ConsultChat.tsx`
- Modify: `src/lib/personas.ts`

**Steps:**

- [x] Replace emoji avatars with real generated or designed persona portraits.
- [x] Add clear "AI astrologer" label.
- [x] Show balance, estimated minutes, and price before session start.
- [x] Add "buy more minutes" inside chat when low balance.
- [x] Add session summary after rating.
- [x] Add review text, not only star rating.

**Acceptance:**

- User knows this is AI, knows the price, and sees what they paid for.
- The marketplace feels familiar like AstroTalk but more honest.

---

## Phase 3: Monetization System

**Priority:** P0 before paid launch.

**Why this matters:** Current monetization is partly implemented, but not yet a proper business system. Payments must be reliable, reversible, inspectable, and tied to product benefits.

### Task 3.1: Define Product Entitlements

**Files:**

- Create: `src/lib/entitlements.ts`
- Create: `netlify/functions/shared/entitlements.ts`
- Modify: `src/hooks/useSubscription.ts`
- Modify: `src/types/user.ts`

**Recommended tiers:**

- Free:
  - Basic profile
  - Free kundali
  - Limited Synthesis messages
  - Starter consult minutes
- Premium:
  - More Synthesis access
  - Daily path, dasha preparation, journal intelligence
  - Monthly report
  - Discounted consult rate
- Pro:
  - Highest consult allowance or deeper discount
  - Yearly report
  - Astrocartography and advanced features
  - Priority persona access

**Steps:**

- [x] Define a single entitlement table used by frontend and backend.
- [x] Stop checking tier strings directly in page components.
- [x] Add `canUseFeature(user, featureKey)` and `getUsageLimit(user, featureKey)`.

**Acceptance:**

- Adding a new plan benefit does not require editing many pages.
- Free, Premium, and Pro behavior is consistent server-side and client-side.

### Task 3.2: Finish Razorpay Subscriptions

**Files:**

- Create: `netlify/functions/subscription-create.ts` if not complete
- Modify: `netlify/functions/subscription-webhook.ts`
- Modify: `netlify/functions/subscription-cancel.ts`
- Modify: `src/pages/Pricing.tsx`
- Modify: `src/pages/Settings.tsx`

**Steps:**

- [x] Create Razorpay plan ids in environment variables.
- [x] Server creates subscription checkout.
- [x] Webhook verifies signature.
- [x] Webhook updates `users/{uid}.subscription`.
- [x] Add grace period for failed payment.
- [x] Add cancellation with retention prompt.

**Acceptance:**

- Subscription state is driven by Razorpay webhooks, not browser success callbacks.
- A user can see current plan, renewal date, and cancellation state.

### Task 3.3: Monetize Reports

**Files:**

- Modify: `netlify/functions/pdf-report.ts`
- Modify: `src/pages/Synthesis.tsx`
- Modify: `src/pages/Compatibility.tsx`
- Create: `src/pages/Reports.tsx`

**Steps:**

- [x] Offer paid PDF reports: birth chart, compatibility, yearly forecast.
- [x] Store report jobs under `users/{uid}/reports/{reportId}`.
- [x] Charge credits or plan allowance before generation.
- [x] Let users download old reports.

**Acceptance:**

- Reports create higher-ticket revenue beyond chat minutes.
- A failed report does not consume credits permanently.

---

## Phase 4: Daily Companion And Retention

**Priority:** P1 after billing and context builder.

**Why this matters:** Acquisition is not enough. The product wins if users feel seen every day.

### Task 4.1: Rebuild Dashboard Around "Today"

**Files:**

- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/components/dashboard/*`
- Modify: `src/hooks/usePanchang.ts`
- Modify: `src/hooks/useDashaMonitor.ts`
- Modify: `src/hooks/useProactiveTriggers.ts`

**Steps:**

- [x] Make dashboard answer three questions:
  - What is my energy today?
  - What should I do today?
  - What should I be careful with today?
- [x] Add Dasha card as a first-class dashboard module.
- [x] Add Panchang timing with end times, sunrise, sunset, Rahu Kaal, and recommendation.
- [x] Add one Atman-based nudge based on emotional state or routine gap.
- [x] Add one action button: journal, breathe, consult, or save intention.

**Acceptance:**

- Dashboard feels like a daily guide, not a collection of widgets.
- Guidance uses birth data, current sky, and user memory.

### Task 4.2: Make Journaling Useful

**Files:**

- Modify: `src/components/sadhana/KarmicJournal.tsx`
- Modify: `src/lib/atman.ts`
- Modify: `netlify/functions/shared/gemini.ts`

**Steps:**

- [x] After a journal entry, extract patterns and life events.
- [x] Show "what I noticed about you" back to the user.
- [x] Let the user accept, edit, or reject extracted memory.
- [x] Feed accepted memory into future guidance.

**Acceptance:**

- The app learns with consent.
- User can see and correct what the system thinks it knows.

### Task 4.3: Add Digest Channels

**Files:**

- Create: `netlify/functions/daily-digest.ts`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/types/user.ts`

**Steps:**

- [x] Add notification preferences.
- [x] Generate daily digest from panchang, dasha, transit, routines, and Atman.
- [x] Start with email.
- [x] Add WhatsApp later only after opt-in and provider setup.

**Acceptance:**

- Digest drives daily return visits.
- Opt-out is clear.

---

## Phase 5: Discovery And AstroSage SEO

**Priority:** P1, parallel with retention once billing is stable.

**Why this matters:** AstroSage wins because it owns Google. AstroYou needs free tools and indexable content before brand trust exists.

### Task 5.1: Choose SEO Rendering Strategy

**Files:**

- Modify: `vite.config.ts` or introduce a content rendering pipeline.
- Modify: `netlify.toml`
- Create: `docs/SEO_RENDERING_DECISION.md`

**Options:**

- Static generation for free tools and sign pages.
- Add a small Astro/Next content app alongside the React app.
- Pre-render key pages during build.

**Decision rule:**

- If the page must rank on Google, it must have meaningful HTML before client JavaScript runs.

**Acceptance:**

- Free kundali, kundali matching, daily horoscope by sign, panchang, and muhurat pages are indexable.

### Task 5.2: Build Free Tool Funnel

**Files:**

- Modify: `src/pages/FreeKundali.tsx`
- Modify: `src/pages/FreeMatching.tsx`
- Modify: `src/pages/SignHoroscope.tsx`
- Create: `src/pages/PanchangSeo.tsx`
- Create: `src/pages/MuhuratSeo.tsx`

**Steps:**

- [x] Free tools work without signup.
- [x] Results show enough value to build trust.
- [x] Save/deeper analysis requires account creation.
- [x] Use clear CTA into Synthesis or Consult.

**Acceptance:**

- SEO visitors can get value in under 60 seconds.
- Signup feels like saving progress, not a wall.

### Task 5.3: Create Content Clusters

**Clusters:**

- Kundali
- Kundali matching
- Daily horoscope
- Panchang
- Muhurat
- Sade Sati
- Manglik
- Nakshatra
- Dasha

**Steps:**

- [x] Create template pages with structured data.
- [x] Link each content page to a working product action.
- [x] Track conversion from SEO page to saved profile, first chat, consult, and payment.

**Acceptance:**

- Content is not a blog island. Every page routes into the product.

---

## Phase 6: Trust, Safety, And Privacy

**Priority:** P1 before scale.

**Why this matters:** A platform that knows the user deeply must also protect them deeply.

**Steps:**

- [x] Add "Why am I seeing this?" explanation for major nudges.
- [x] Add memory viewer and delete controls.
- [x] Add account deletion flow that deletes profile, chats, Atman, reports, ledgers where legally allowed, and auth account.
- [x] Add AI safety policy to Consult and Synthesis.
- [x] Add rate limits for expensive AI and astrology API calls.
- [x] Add audit logs for payments, subscription webhooks, admin actions, and credit changes.

**Acceptance:**

- Users can inspect and control personal memory.
- Business-critical operations are auditable.
- Guidance avoids fear-based upselling.

---

## Phase 7: Market Leadership

**Priority:** P2 after web business loop works.

**Tracks:**

- Regional languages: Hindi first, then major Indian languages.
- Native mobile: start with PWA, then wrapper, then native features.
- Human astrologers: only after AI marketplace and billing are proven.
- E-commerce: gemstones, pujas, reports, and spiritual products only with strong ethical guardrails.
- Community: shareable charts, public profiles, referral minutes, and compatibility invites.

**Acceptance:**

- Each expansion uses the same context engine, billing ledger, and trust rules.
- No new surface bypasses the platform architecture.

---

## Immediate Execution Order

1. Finish Phase 0 cleanup and keep `pnpm test` green.
2. Build Phase 2.1 consultation session manager.
3. Build Phase 2.2 credit ledger.
4. Build Phase 1.1 shared user context builder.
5. Wire Consult to the shared context builder.
6. Build Phase 3 entitlement table.
7. Finish Razorpay subscription webhooks.
8. Start SEO rendering decision before writing more SEO pages.
9. Rebuild dashboard around daily guidance.
10. Add memory viewer and user-controlled Atman edits.

---

## Architecture Rules Going Forward

- Do not add new direct client credit updates.
- Do not create separate astrology endpoint wrappers outside `shared/astro-api.ts`.
- Do not duplicate AI prompts across functions.
- Do not add new paid features without credit ledger entries.
- Do not add more "unique features" before the consult marketplace and retention loop are stable.
- Do not rely on a browser success callback as proof of payment.
- Do not ship fear-based copy or remedy upsells.

---

## Success Metrics

**Acquisition:**

- SEO page visits.
- Free tool completion rate.
- Free tool to signup conversion.

**Activation:**

- Onboarding completion.
- First Synthesis chat.
- First consult start.

**Revenue:**

- First payment conversion.
- Consult revenue per active user.
- Subscription MRR.
- Report purchase rate.

**Retention:**

- Day 1, Day 7, Day 30 return rate.
- Daily dashboard opens.
- Journal entries per user.
- Routine completion streaks.

**Trust:**

- Refund rate.
- Failed billing rate.
- Memory deletion/edit usage.
- AI safety escalation count.
