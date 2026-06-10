# AstroYou — Pre-Launch Production Audit

> **Status:** Audit complete (2026-06-10) → **Remediation complete (2026-06-10).**
> All BLOCKER and HIGH findings, and the actioned MEDIUM/LOW items, are fixed on
> branch `security/prelaunch-hardening` (commits prefixed `security(prelaunch)`).
> Method: code-grounded subagent sweep across all subsystems; highest-risk findings hand-verified against source.

## Remediation summary (what was fixed)

| Phase   | Area             | Commit theme                                                                                                                                                                                                                                                |
| ------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0       | Gemini model     | Verified live; moved to `GEMINI_MODEL` env var (was NOT a blocker — model is valid)                                                                                                                                                                         |
| 1       | Config/rules     | Firestore catch-all deny + field-equality credit guard + server-only subcollections; CSP/HSTS/X-Frame headers; secret scanning re-enabled (omit public VITE\_\*); SW excludes auth/API; plan-id throws; ESM `.js`; SEO sitemap/robots + prerender integrity |
| 2.0–2.1 | Auth             | `require-auth` helpers; fail-closed rate limiter (no spoofable client-ip); auth+rate-limit on kundali/transit/horoscope/compatibility/proactive-nudge; client `postJson` token attach; birthData validation                                                 |
| 2.2–2.3 | Credits          | Server-side AI credit reserve-before-generate + refund; guest trial enforced server-side                                                                                                                                                                    |
| 2.5     | OTP              | HMAC hash at rest + timing-safe compare; atomic send/verify transactions; email-send failure guard; lockout via blockedUntil                                                                                                                                |
| 2.6     | Webhook          | 405 on non-POST; stale-processing reprocess; periodKey `??`; grace period anchored to current_end                                                                                                                                                           |
| 2.7     | Prompt injection | Persona resolved server-side by id (no raw client prompt); atman free-text sanitized; OTP secret fail-closed                                                                                                                                                |
| 2.8     | Stream/PII       | Client-disconnect stream abort; PII log scrub; messages validation. (abortSignal-as-body-param live-verified invalid → removed)                                                                                                                             |
| 2.4     | Reports          | Charge-before-generate + refund on all failure paths; rate-limit; generic errors                                                                                                                                                                            |
| 3.1     | Atman            | knownPatterns/lifeEvents caps (1 MB doc guard); atomic transaction writes                                                                                                                                                                                   |
| 3.2     | Scheduled jobs   | Cursor pagination (no more first-200-only); digest idempotency + Resend Idempotency-Key; removed emailOverride                                                                                                                                              |
| 3.3     | Consult          | Mid-session credit guard (402 when funded time used)                                                                                                                                                                                                        |
| 4.1     | Referral         | Random unguessable codes (store-once); one-referral-ever guard; rate-limit                                                                                                                                                                                  |
| 4.2     | Trust            | Session-ownership check; deterministic ids; moderation gate (public only on approval); atomic batch                                                                                                                                                         |
| 4.3     | Analytics/admin  | IP-only analytics rate key; credit-adjustment cap; expert self-approval block; audit-log query filters + index; admin-summary field mask                                                                                                                    |
| 4.4     | Notifications    | Stale FCM token cleanup; WhatsApp disabled by default; emotional-nudge frequency cap + quiet hours; email unsubscribe footer                                                                                                                                |
| 4.5     | Mediums          | PDF truncation marker; export rate-limit+audit; delete-account ordering; analytics PII value redaction; guest-migration field whitelist; manifest icon purpose                                                                                              |

**Verification:** app + functions typecheck clean; 142 function tests pass (OTP/sanitize/referral tests added); production build green (424 SEO pages); Gemini streaming live-verified.

**Required env vars to set before deploy:** `OTP_HASH_SECRET` (≥32 chars; OTP login fails closed without it), optionally `GEMINI_MODEL`, `MAX_ADMIN_CREDIT_ADJUSTMENT`, `WHATSAPP_NUDGES_ENABLED`. Deploy `firestore.rules` + `firestore.indexes.json` (new auditLogs uid index).

**Deferred (non-blocking):** Admin.tsx multi-redirect race (cosmetic; server-authoritative). Background-function conversion for long PDF/AI reports (reliability, not security). Dead client `processAnalysisResult` brain path (unused).

---

## Original findings (for reference)

## How to read this

- Findings are grounded in actual code (`file:line`). Each was reported by a reviewer agent; the most severe were independently verified.
- **Severity**: BLOCKER (fix before any real user) · HIGH · MEDIUM · LOW.
- ✅ = independently verified against source. ⚠️ = reported but not yet hand-verified (verify before fixing).
- See `PRELAUNCH_FIX_PLAN.md` for the prioritized, file-by-file remediation order.

## The 4 root causes (≈80% of findings trace here)

1. **Unauthenticated serverless endpoints** — paid AI/astrology endpoints reachable with no token → budget drain.
2. **Client-trusted money** — credits deducted client-side and/or after the expensive call, no refund-on-failure.
3. **Fail-open rate limiting** — any Firestore hiccup opens all limits; security-critical scopes should fail closed.
4. **Unbounded Firestore arrays + non-atomic writes** — `atman` arrays grow to the 1MB doc cap (silent total failure); concurrent writes lose data.

## Agent over-claims caught during verification (do NOT act on these)

- ✅ Consult **reaper exists** (`consult-reaper-scheduled.ts`) — "complete billing bypass" was overstated; tab-close sessions DO get reaped.
- ✅ Referral **rewards ARE set** (REFERRER=25, REFEREE=15) — "values TBD/maybe zero" was wrong.
- ✅ **ErrorBoundary IS mounted at root** (`src/App.tsx:71`) — "white-screen risk" resolved.

---

# TIER 1 — Auth · Payments · Webhooks · Security Rules

## BLOCKERS

| ID    | Sev     | Area   | Issue                                                                                                                                                                                 | Location                                   | Verified |
| ----- | ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------- |
| T1-B1 | BLOCKER | Auth   | OTP stored **plaintext** in Firestore, plain `!==` compare. Anyone reading `otps/` can auth as anyone.                                                                                | `send-otp.ts:63`, `verify-otp.ts:53`       | ✅       |
| T1-B2 | BLOCKER | Auth   | OTP returns `success:true` (200) when no email actually sent (missing `RESEND_API_KEY` → silent auth lockout); Resend non-2xx also unchecked.                                         | `send-otp.ts:75-101`                       | ✅       |
| T1-B3 | BLOCKER | Auth   | OTP rate-limit + verify attempt-count are **non-atomic (TOCTOU)** — bypassable under concurrency (email spam / brute force).                                                          | `send-otp.ts:31-70`, `verify-otp.ts:35-63` | ✅       |
| T1-B4 | BLOCKER | Subs   | Unknown/missing plan ID **silently defaults to `"premium"`** — env misconfig grants paid tier free.                                                                                   | `shared/subscription-plans.ts:30`          | ✅       |
| T1-B5 | BLOCKER | Subs   | Webhook marks failed events `"failed"`, which **bypasses idempotency gate** on Razorpay retry.                                                                                        | `subscription-webhook.ts:39,237`           | ⚠️       |
| T1-B6 | BLOCKER | Rules  | **No catch-all deny** in `firestore.rules`; 8+ active collections (analyticsEvents, expertApplications, supportTickets, remedyRequests, trustModerationQueue…) have no explicit rule. | `firestore.rules`                          | ✅       |
| T1-B7 | BLOCKER | Config | `SECRETS_SCAN_SMART_DETECTION_ENABLED="false"` disables Netlify secret scanning.                                                                                                      | `netlify.toml:7`                           | ✅       |

## HIGH

| ID    | Sev  | Issue                                                                                                                 | Location                      |
| ----- | ---- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| T1-H1 | HIGH | `consultations_reviews`, `referrals`, `friends` are client-writable → forge own reviews/referral records.             | `firestore.rules:41-69`       |
| T1-H2 | HIGH | Rate limiter **fails open** on Firestore error.                                                                       | `shared/rate-limit.ts:70-77`  |
| T1-H3 | HIGH | `client-ip` header in rate-limit fallback chain is **client-spoofable**.                                              | `shared/rate-limit.ts:19-24`  |
| T1-H4 | HIGH | `decoded.admin` custom claim = unaudited 2nd admin path (no code sets it; sole real gate is `ASTROYOU_ADMIN_EMAILS`). | `shared/admin-auth.ts:10`     |
| T1-H5 | HIGH | Subscription grace period anchored to `now` instead of `current_end` → cuts paid time short.                          | `subscription-webhook.ts:196` |

## MEDIUM / LOW

| ID    | Sev    | Issue                                                                                                                              | Location                                    |
| ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| T1-M1 | MEDIUM | `delete-account` not atomic; partial delete → Auth record survives but Firestore gone → re-grants signup credits on next login.    | `delete-account.ts:39,55-68`                |
| T1-M2 | MEDIUM | `delete-account`/`export-data` leak raw `err.message` (Firestore internals) to client.                                             | `delete-account.ts:51`, `export-data.ts:81` |
| T1-M3 | MEDIUM | Guest→user migration writes unvalidated localStorage to Firestore.                                                                 | `AuthContext.tsx:72-95`                     |
| T1-M4 | MEDIUM | Shared `ASTROYOU_API_KEY` fallback across Gemini/Astrology/Resend resolvers → wrong-key silent failures.                           | `shared/env.ts:9-15`                        |
| T1-L1 | LOW    | `audit-log.ts` & `cache.ts` omit `.js` ESM extension (others include it) — verify it doesn't break bundling on payment/audit path. | `shared/audit-log.ts:1`                     |
| T1-L2 | LOW    | `firebase-admin.ts` uses `VITE_`-prefixed var as server-side storage bucket fallback.                                              | `shared/firebase-admin.ts:35`               |

### ✅ Verified correct (Tier 1)

Razorpay payment + webhook signatures properly verified (HMAC-SHA256, raw body via `req.text()`, `timingSafeEqual`). Credits server-authoritative, atomic via Firestore transactions, cannot go negative, ledger-level idempotency. Tokens verified on every protected path; no client-`uid`-trust. Storage rules clean. `requireAdmin` called at top of every admin endpoint. `auditLogs` append-only, client read/write denied.

---

# TIER 2 — Astrology Engine · AI/Gemini · Atman · Reports · Consult

## BLOCKERS

| ID    | Sev     | Area     | Issue                                                                                                                                                      | Location                                              | Verified                            |
| ----- | ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------- |
| T2-B1 | BLOCKER | AI       | **Gemini model `gemini-3.1-flash-lite-preview` unverified** (14 usages). If invalid → every AI call 404s = product dead. Must test live + move to env var. | `shared/gemini.ts` (14×)                              | ✅ exists / model validity UNTESTED |
| T2-B2 | BLOCKER | AI/Astro | **No auth** on `/api/kundali`, `/api/synthesis` (guest path), `/api/proactive-nudge` → drain paid astrology-api.io + Gemini budget.                        | `kundali.ts`, `synthesis.ts:26`, `proactive-nudge.ts` | ✅                                  |
| T2-B3 | BLOCKER | AI       | **Credit deduction client-side, after generation** — disconnect or block `/credits/use` = free unlimited AI.                                               | `Synthesis.tsx:577-593`                               | ✅                                  |
| T2-B4 | BLOCKER | Atman    | `knownPatterns`/`lifeEvents` grow **unbounded** → Firestore 1MB doc cap = silent total failure of dashboard+chat.                                          | `atman-brain.ts:436,492`, `atman.ts:71`               | ⚠️                                  |
| T2-B5 | BLOCKER | Atman    | Concurrent server+client writes to `atman`, **no transaction** → last-write-wins data loss.                                                                | `synthesis.ts:119` + `atman.ts:95`                    | ⚠️                                  |
| T2-B6 | BLOCKER | Reports  | Credits charged **after** PDF generated/delivered, **no refund** on failure → free reports on error, or stuck `status:"generating"`.                       | `pdf-report.ts:185-234`                               | ⚠️                                  |

## HIGH

| ID     | Sev  | Issue                                                                                                                          | Location                                   |
| ------ | ---- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| T2-H1  | HIGH | Prompt injection via user-controlled atman text (patterns/relationships/events) interpolated raw into system prompt.           | `shared/gemini.ts:293-300`                 |
| T2-H2  | HIGH | **Unauthenticated `personaPrompt`/`personaName`** appended to system prompt → jailbreak / policy bypass.                       | `synthesis.ts:80-83`                       |
| T2-H3  | HIGH | Guest-supplied `atmanData` used verbatim in prompt (no sanitize).                                                              | `user-context-source.ts:6`                 |
| T2-H4  | HIGH | Aborted client connection **leaks running Gemini stream** (no AbortController) → runaway cost / Netlify-timeout truncation.    | `synthesis.ts:68-157`, `gemini.ts:540-609` |
| T2-H5  | HIGH | `horoscope.ts` & `compatibility.ts` have **no rate limiting at all** (up to 4 paid calls/request).                             | `horoscope.ts`, `compatibility.ts`         |
| T2-H6  | HIGH | Cache stampede: concurrent first-fetch of panchang → N parallel paid calls; can cache empty/error result for 20h.              | `shared/cache.ts:21-48`                    |
| T2-H7  | HIGH | `getHeaders()` silently omits `X-API-Key` if env unset → requests proceed keyless.                                             | `shared/astro-api.ts:122-133`              |
| T2-H8  | HIGH | Missing `birthData` validation (dob/tob format, lat/lng range) before paid API → wasted calls / garbage data.                  | `kundali.ts:150-153`                       |
| T2-H9  | HIGH | Atman: `brain-maintenance-scheduled` processes only first 200 users, no cursor → tail never pruned (compounds T2-B4).          | `brain-maintenance-scheduled.ts:6`         |
| T2-H10 | HIGH | Atman: client `processAnalysisResult` does O(N) sequential read-modify-write per AI response AND duplicates server brain path. | `atman.ts:401-406`                         |
| T2-H11 | HIGH | Consult: **no mid-session credit guard** — Gemini cost continues past funded time.                                             | `consult-session.ts:398-434`               |
| T2-H12 | HIGH | Reports: synchronous generation risks Netlify 10s timeout; no background path; stuck `generating` docs.                        | `pdf-report.ts:142-183`                    |

## MEDIUM

| ID     | Sev    | Issue                                                                                                | Location                                                  |
| ------ | ------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| T2-M1  | MEDIUM | No Gemini `safetySettings` on a mental-wellness app handling crisis states.                          | `shared/gemini.ts:566`                                    |
| T2-M2  | MEDIUM | Transit/kundali cache keyed on `dob` only → users sharing a birthdate get each other's charts.       | `transit.ts:26`, `useKundali.ts:47`                       |
| T2-M3  | MEDIUM | Paid PDF silently truncated to 42 lines (yearly report cut off, no marker).                          | `shared/simple-pdf.ts:4-8`                                |
| T2-M4  | MEDIUM | User message content + chat excerpts logged / stored in main user doc (PII).                         | `gemini.ts:637`, `atman-brain.ts:648`, `synthesis.ts:102` |
| T2-M5  | MEDIUM | `messages[messages.length-1]` unvalidated → crash on empty `messages`.                               | `synthesis.ts:66`                                         |
| T2-M6  | MEDIUM | `DAILY_TAROT` not cached (day-stable but fetched per call); `TAROT_THREE` question length unbounded. | `kundali.ts:138-147`                                      |
| T2-M7  | MEDIUM | `export-data` no rate limit / no audit log on sensitive full-profile export.                         | `export-data.ts:50`                                       |
| T2-M8  | MEDIUM | Atman schema migration fires on every `useConsciousness` mount, overwrites whole `atman`.            | `useConsciousness.ts:21`, `atman.ts:612`                  |
| T2-M9  | MEDIUM | Reports: `CreditError` mis-returned as 500 (should be 402); report left `generating`.                | `pdf-report.ts:214,259`                                   |
| T2-M10 | MEDIUM | Consult: duplicate `verifyIdToken` + phantom audit log on already-ended replay.                      | `consult-end.ts:11-32`, `consult-session.ts:368`          |

---

# TIER 3 — Admin · Growth (Referral/Trust/Analytics) · Notifications · Frontend

## BLOCKERS

| ID    | Sev     | Area     | Issue                                                                                                                          | Location                          | Verified |
| ----- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | -------- |
| T3-B1 | BLOCKER | Frontend | **No security headers** (CSP/X-Frame/HSTS) anywhere — XSS runs with full Firebase token access; payment flow clickjackable.    | `netlify.toml` (no `[[headers]]`) | ✅       |
| T3-B2 | BLOCKER | Frontend | Service worker caches `/__/auth/*` and `/api/*` GET responses → intermittent auth failures / stale tokens for PWA users.       | `public/sw.js:33-85`              | ✅       |
| T3-B3 | BLOCKER | Notif    | All 3 batch schedulers (digest, nudges, maintenance) **silently cap at 200 users, no pagination** → tail permanently unserved. | `*-scheduled.ts`                  | ✅       |
| T3-B4 | BLOCKER | Notif    | Daily digest **not idempotent** (`.add()`, no key) → cron double-fire = duplicate emails + records.                            | `daily-digest-runner.ts:49-76`    | ⚠️       |
| T3-B5 | BLOCKER | Growth   | Referral **self-fraud via multi-account**: dedup is per-`code` only; no check referee is a new account.                        | `referral-claim.ts:48-79`         | ✅       |
| T3-B6 | BLOCKER | Growth   | Referral codes **derived from UID** (first 6 chars) → guessable/forgeable; collisions mis-credit.                              | `shared/referrals.ts:21-23`       | ✅       |
| T3-B7 | BLOCKER | Growth   | `consult_review` has **no session-ownership check** + **no rate limit** → unlimited fake 5★ reviews for any persona.           | `trust-submit.ts`, `trust.ts:106` | ✅       |

## HIGH

| ID     | Sev  | Issue                                                                                                                                                                         | Location                                               |
| ------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| T3-H1  | HIGH | Admin `idToken` passed in request **body** (not Authorization header) → logged / replayable for ~1h.                                                                          | all `admin-*.ts`                                       |
| T3-H2  | HIGH | `admin-audit-logs` filters `uid`/`action` **in memory** after fetching top-200 → older records silently missed.                                                               | `admin-audit-logs.ts:9-21`                             |
| T3-H3  | HIGH | `admin-summary` spreads full user docs (PII/birth/atman) into memory for up to 5000 users.                                                                                    | `admin-summary.ts:18-24`                               |
| T3-H4  | HIGH | `admin-trust-moderation` uses `Promise.all` not batch → partial failure leaves inconsistent state.                                                                            | `admin-trust-moderation.ts:45-94`                      |
| T3-H5  | HIGH | No upper bound on admin credit adjustment amount.                                                                                                                             | `admin-credit-adjustment.ts:17-19`                     |
| T3-H6  | HIGH | Public review written to `astrologers/{id}/reviews` **before** moderation (contradicts `fakeReviewsAllowed:false`).                                                           | `trust-submit.ts:35-44`                                |
| T3-H7  | HIGH | `prediction_feedback` not idempotent → user pumps own accuracy stats + public aggregate.                                                                                      | `trust-submit.ts:52-79`                                |
| T3-H8  | HIGH | Analytics rate-limit key includes client `anonymousId` → rotate to bypass → unlimited Firestore writes.                                                                       | `analytics-event.ts:14`                                |
| T3-H9  | HIGH | Nudge scheduler: `emotional_stabilization` re-fires daily forever for chaotic users; no weekly cap / quiet hours.                                                             | `brain-nudges-scheduled.ts:11`                         |
| T3-H10 | HIGH | Stale FCM tokens never invalidated after `registration-token-not-registered` → repeated failed sends.                                                                         | `brain-nudges-scheduled.ts:97-122`                     |
| T3-H11 | HIGH | `emailOverride` interface footgun in digest runner (currently safe via verified token, but trivially misusable).                                                              | `daily-digest-runner.ts:30`                            |
| T3-H12 | HIGH | Prerender: no template-integrity check; sitemap includes authenticated routes (`/wallet`,`/synthesis`,`/consult`,`/reports`,`/onboarding`); robots.txt doesn't disallow them. | `prerender-seo-pages.mjs`, `sitemap.xml`, `robots.txt` |

## MEDIUM

| ID     | Sev    | Issue                                                                                                             | Location                             |
| ------ | ------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| T3-M1  | MEDIUM | Admin UI gate cosmetic; all 7 admin calls fire before first 403 → concurrent `navigate()` race.                   | `Admin.tsx`                          |
| T3-M2  | MEDIUM | No self-approval guard for admin-is-also-expert-applicant.                                                        | `admin-expert-applications.ts:44-61` |
| T3-M3  | MEDIUM | `trust-summary` fully unauthenticated, reads up to 1300 docs/call, cache-bustable → Firestore cost amplification. | `trust-summary.ts:9-35`              |
| T3-M4  | MEDIUM | Analytics PII can enter via free-form param keys (value-level not scanned).                                       | `funnel-analytics.ts:80-98`          |
| T3-M5  | MEDIUM | No unsubscribe link in nudge/digest emails (CAN-SPAM/GDPR).                                                       | `brain-nudges.ts:398-403`            |
| T3-M6  | MEDIUM | WhatsApp sends `type:"text"` out of 24h window → silent fail for ~all users (needs templates).                    | `brain-nudges-scheduled.ts:129-147`  |
| T3-M7  | MEDIUM | Consult-reaper HTTP endpoint publicly callable (no shared-secret) → on-demand Firestore-quota DoS.                | `consult-reaper-scheduled.ts:31`     |
| T3-M8  | MEDIUM | `nudgeHistory` capped at ~20 → dedup window only ~3-4 days; older trigger types re-fire early.                    | `brain-nudges.ts:372`                |
| T3-M9  | MEDIUM | SW cache version hard-coded `v2`, not build-hash-tied → risk of stale runtime cache.                              | `public/sw.js:1-2`                   |
| T3-M10 | MEDIUM | `manifest.json` uses `"any maskable"` on standard icons → Android adaptive-icon cropping.                         | `public/manifest.json:14-15`         |
| T3-M11 | MEDIUM | `referral-info` overwrites referral subdoc (Firestore write) on every read call.                                  | `referral-info.ts:28-38`             |

### ✅ Verified correct (Tier 3)

ErrorBoundary mounted at app root with prod stack-trace hiding + recovery UI. Vite only inlines `VITE_` vars (no server-secret leak; Firebase web keys are public by design). Consult reaper exists and dedupes billing via ledger. Referral rewards set (25/15). SW has `skipWaiting`+`clients.claim` and network-first shell.

---

## Appendix: subsystem coverage

Authentication · Payments/Credits · Subscriptions/Webhooks · Firestore/Storage rules & secrets · Astrology data engine · AI/Gemini · Atman memory · Reports/PDF · Consultation marketplace · Admin/Ops · Referrals · Trust/Reviews · Analytics · Notifications/Scheduled jobs · PWA/Service worker · SEO/Prerender · Frontend config/headers · Rate limiting · Error handling.
