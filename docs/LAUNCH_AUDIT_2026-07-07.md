# AstroYou — Pre-Launch Audit & Hardening

> **Date**: 2026-07-07
> **Scope**: Authentication, payments/subscriptions, and the full user lifecycle (onboarding, profile edits, notifications, account deletion, data export, credits/referrals).
> **Method**: Three parallel code-tracing audits against the actual implementation (not docs), each finding backed by `file:line` evidence. Full test suite (`pnpm test`) was green at 168/168 before any changes.
> **Branch**: `launch-hardening`

This document is the source of truth for what was found and what was done about it. Each finding has a **Verdict**, the **Evidence**, the **Decision**, and a **Status** that is updated as fixes land.

---

## Executive Summary

The core engineering is genuinely strong: OTP is transactional and hashed, credit mutations are atomic with an immutable ledger, Razorpay signatures are verified with timing-safe compares, and money-based server enforcement (credit reservation before paid AI calls) is well done. The test suite passes.

**But "auth, subscriptions, and the whole lifecycle working perfectly" was not accurate.** The audit found **6 real bugs** and a cluster of gaps that would cause user-visible failures, revenue leakage, or compliance problems in production. The most serious:

| #   | Severity    | Area      | One-line                                                                                                                   |
| --- | ----------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| B1  | 🔴 Critical | Billing   | Cancelling a subscription cancels it **immediately**, not at period end — users lose the month they paid for.              |
| B2  | 🔴 Critical | Lifecycle | Deleting an account does **not** cancel the Razorpay subscription — deleted users keep getting charged forever.            |
| B3  | 🔴 Critical | Lifecycle | Editing birth data never invalidates the cached kundali — charts and AI readings stay **stale forever**.                   |
| B4  | 🟠 High     | Auth      | Logout keeps `PROFILE` in localStorage; the next account on a shared device **inherits the previous person's birth data**. |
| B5  | 🟠 High     | Auth      | Guest kundali requests always 401 — the `/free-kundali` acquisition flow and guest chart preview are **dead**.             |
| B6  | 🟠 High     | Billing   | A consultation can end up **completely free** if the balance is drained mid-session.                                       |

Plus revenue/compliance gaps: no webhook fallback for one-time top-ups (paid-but-uncredited on tab close), client/server entitlements disagree on what Premium/Pro grant, no one-click email unsubscribe (Gmail/Yahoo bulk-sender violation), incomplete GDPR export (chat content missing), and several unauthenticated endpoints that trigger paid third-party API calls.

---

## What Actually Works (verified)

So the fixes below are read in context — these were confirmed solid and were **not** changed except where noted:

- **Email OTP**: crypto-secure generation, all rate-limit checks inside one Firestore transaction (TOCTOU-safe), HMAC-hashed storage (never plaintext), 5-min expiry, 5-attempt lockout, constant-time compare, fail-closed email delivery, idempotent signup bonus, custom-token issuance. `OTP_HASH_SECRET` validated ≥32 chars with no fallback.
- **Google sign-in**: popup with redirect fallback, `getRedirectResult` handled before the auth listener, distinct error handling.
- **Credit ledger**: every mutation in a transaction with immutable `balanceBefore/After` rows; negative balance impossible; ledger-id idempotency; client cannot write `credits`/`subscription`/`creditLedger`.
- **Razorpay one-time purchase**: server-authoritative amount from a server catalog, signature verified timing-safe, replay-safe via `razorpay_${payment_id}` ledger id, ownership enforced.
- **Subscription webhook core**: signature over raw body, `webhookEvents/{eventId}` idempotency, per-period idempotent credit grants.
- **Consultation billing (happy path + abandonment)**: server-authoritative `ceil(elapsed/60) × price`, double-end safe, reaper closes idle sessions billing to last activity.
- **Wallet**: owner-scoped, reconciles to the ledger.
- **Onboarding save**: awaits Firestore write before marking complete; localStorage backup on failure.
- **Account deletion (data tree)**: recursive subcollection delete, storage prefix removal, typed-confirmation, audit-logged.
- **Referral claim**: transactional, once-ever, self-referral blocked, deterministic ledger ids.

---

## Findings & Fixes

Severity: 🔴 Critical (revenue/data-integrity/legal) · 🟠 High (user-visible failure or abuse) · 🟡 Medium (correctness/compliance) · ⚪ Minor.

### Authentication

#### A1 — 🟠 Cross-account profile leak on shared devices `[B4]`

- **Evidence**: `src/components/layout/Header.tsx:56-66` logout deliberately keeps localStorage `PROFILE`; `src/lib/AuthContext.tsx` `signOut` (~:164) clears nothing. On next fresh-account login with no Firestore profile, `AuthContext.tsx:79` migration reads that stale `PROFILE` and writes the previous person's birth data (name/dob/tob/pob/coords) into the new user's document.
- **Failure**: Family/shared device → silent PII cross-contamination and a wrong chart for the new user.
- **Decision**: Centralize logout cleanup in `AuthContext.signOut` (clear `PROFILE`, `GUEST_PROFILE`, `GUEST_COMPLETE`, `MODE`, `LOGIN_REDIRECT`, `FREE_SECONDS`, chat drafts); route `Header` logout through it; harden migration so a stale `PROFILE` can never seed a new uid (migrate only from a genuine guest-session artifact).
- **Status**: ✅ Fixed (auth-fix agent).

#### A2 — 🟠 Guest kundali flow always 401 `[B5]`

- **Evidence**: `netlify/functions/kundali.ts:85-91` `PUBLIC_CHART_TYPES` excludes natal charts; `:188-196` rejects tokenless requests. `src/pages/Synthesis.tsx:267-294` requests `D1` for guests → 401 → misleading "Chart Error … check your birth data". `/free-kundali` and `/free-matching` (the SEO acquisition pages) depend on guest chart generation.
- **Failure**: The #1 top-of-funnel acquisition surface is broken; guests can never see a chart.
- **Decision**: Allow guests the minimal natal set (`D1`, plus `DASHAS` if the free pages show it) under a new fail-closed per-IP rate-limit scope (~8/hr). Authenticated behavior unchanged. Replace the misleading error with a sign-in prompt.
- **Status**: ✅ Fixed.

#### A3 — 🟠 OTP endpoints have no per-IP rate limit

- **Evidence**: `netlify/functions/shared/rate-limit.ts:31-32` declares `send_otp`/`verify_otp` in `FAIL_CLOSED_SCOPES`, but nothing calls `checkRateLimit` with them. Per-email caps don't stop an attacker cycling distinct addresses.
- **Failure**: Email-bomb arbitrary strangers, drain the Resend quota/bill.
- **Decision**: Wire per-IP `checkRateLimit` into `send-otp.ts` (~10/hr/IP) and `verify-otp.ts` (~30/hr/IP); tighten email validation from `includes("@")` to a real regex + length cap.
- **Status**: ✅ Fixed.

#### A4 — 🟠 Unauthenticated endpoints trigger paid third-party calls

- **Evidence**:
  - `netlify/functions/daily-prediction.ts` — no auth, no rate limit, `CORS *`, paid astrology API per request, leaks raw `error.message`.
  - `netlify/functions/parse-kundali.ts` — no auth, no rate limit, `CORS *`, paid Gemini Vision on attacker base64 with no size cap.
  - `netlify/functions/expert-application.ts` — no auth/limit → unbounded spam writes.
  - `netlify/functions/sign-horoscope.ts` — `sign`/`period` not whitelisted before use as cache key / paid call.
- **Failure**: Anonymous cost-amplification against our metered API bills; DB spam.
- **Decision**: Add fail-closed per-IP rate limits; cache public results; whitelist `sign`/`period`; cap `parse-kundali` payload size; stop leaking error strings; pin CORS to the site origin; require auth where callers are authenticated-only.
- **Status**: ✅ Fixed.

#### A5 — 🟡 Firestore rules: client-settable credits & referral

- **Evidence**: `firestore.rules:13-19` lets the client create its own doc with `credits == 15` (bypassing the ledger); `:23-25` pins only `credits`/`subscription` on update, leaving `referral` client-writable.
- **Failure**: Ledger-completeness invariant broken; **referral-reward hijack** — an attacker sets their own `referral.code` to a victim's code, and `referral-claim.ts` `where("referral.code","==",code).limit(1)` can resolve the attacker as referrer, farming the victim's rewards.
- **Decision**: Disallow a client-supplied `credits` field on create; pin `referral`, `referredBy`, `referralClaimedAt` as server-only (Admin SDK bypasses rules).
- **Status**: ✅ Fixed.

#### A6 — 🟡 Signup bonus can be permanently skipped

- **Evidence**: `AuthContext.tsx:57-72` fires `/api/credits/initialize` without checking `res.ok`, then `:123-152` fires the referral claim. The claim merge-sets `credits` via `increment(15)`, making `credits` defined; both the client gate and server guard (`shared/credits.ts:128`, `credits !== undefined`) then treat init as done — the 15-credit bonus is never granted.
- **Decision (two-sided)**: In `AuthContext`, await init, check `res.ok`, and only claim referral after successful init. In `shared/credits.ts`, make the idempotency guard rely on the `creditLedger/signup_bonus` sentinel only (grant incrementally if `credits` exists but the sentinel doesn't). Also clear a pending referral code on `409` (permanent), keep it on `429`/`5xx`.
- **Status**: ✅ Fixed (client side auth-fix, server side billing-fix).

### Payments & Subscriptions

#### B1 — 🔴 Cancellation is immediate, not end-of-period `[B1]`

- **Evidence**: `netlify/functions/subscription-cancel.ts:36` calls `razorpay.subscriptions.cancel(subId, false)`. In the SDK the 2nd arg is `cancelAtCycleEnd` (`node_modules/razorpay/dist/resources/subscriptions.js:244-268`); `false` cancels now. Yet the comment says "end of billing period" and Firestore records `cancelAtPeriodEnd: true`.
- **Failure**: Cancel on day 2 → access lost instantly, no refund, no paid-through period.
- **Decision**: Pass `true`. Verify the cycle-end `subscription.cancelled` webhook still downgrades correctly.
- **Status**: ✅ Fixed (billing-fix).

#### B2 — 🔴 Account deletion doesn't cancel the subscription `[B2]`

- **Evidence**: `netlify/functions/delete-account.ts` has zero Razorpay references; cancellation lives only in `subscription-cancel.ts`. Deletion removes the doc holding `razorpaySubscriptionId`, losing the mapping.
- **Failure**: A paying subscriber deletes their account and keeps being charged monthly with no way for the app to stop it.
- **Decision**: Before deleting data, read `subscription.razorpaySubscriptionId`; if active/pending/halted/paused, cancel immediately at Razorpay (account is being destroyed). On failure, audit-log the subscription id and continue; report cancellation status.
- **Status**: ✅ Fixed (lifecycle-fix).

#### B3 — 🔴 Deleted users get resurrected by later webhooks

- **Evidence**: `subscription-webhook.ts:93-125,168-185,217-231` `set(..., {merge:true})` on `users/{uid}` with no existence check; a post-deletion `charged`/`pending`/`cancelled` event recreates the doc (and re-grants credits on `charged`).
- **Decision**: Before any user write in the webhook, verify the doc exists; if it doesn't and the event implies an active subscription, cancel that subscription at Razorpay, audit-log, and mark the event processed without recreating the user. (Pairs with B2.)
- **Status**: ✅ Fixed (billing-fix).

#### B4 — 🟠 Consultations can be free `[B6]`

- **Evidence**: `shared/consult-session.ts:422-434` — if `credits < cost` at finalize, the session is marked `failed` and **zero** is deducted. `reservedCredits` at start is a snapshot, not a hold.
- **Failure**: Start a consult, drain the balance via synthesis (1 credit/msg) mid-session, finish → full AI consultation for free.
- **Decision**: Deduct `min(cost, remaining balance)` (partial billing, never negative, never free when balance > 0); mark `completed` with an `underbilled` flag and the actual amount. Keep ledger idempotency.
- **Status**: ✅ Fixed.

#### B5 — 🟠 No webhook fallback for one-time top-ups

- **Evidence**: Crediting depends entirely on the browser calling `/api/pay/verify` after checkout; no `payment.captured`/`order.paid` handler exists. Tab closes post-payment → captured money, no credits, order stuck `created`.
- **Decision**: Handle `payment.captured` in `subscription-webhook.ts` (reuse its signature + idempotency): look up `paymentOrders/{order_id}`, credit idempotently with the same `razorpay_${payment_id}` ledger id used by the verify path, mark the order paid; ignore non-top-up charges.
- **Status**: ✅ Fixed.

#### B6 — 🟠 Entitlements drift (client vs server)

- **Evidence**: `netlify/functions/shared/entitlements.ts` grants Premium 900 credits/mo + 180 min, Pro 2200 + 440; `src/lib/entitlements.ts` + `Pricing.tsx` advertise 700/1600 credits and 140/320 min. Webhook uses server numbers → users get more than advertised, and the two files keep drifting.
- **Decision**: Advertised Pricing numbers are the contract — set server to 700/140 (Premium) and 1600/320 (Pro), matching the client. Add `billing-entitlements-parity.test.ts` asserting the two matrices are deeply equal, with cross-reference comments.
- **Status**: ✅ Fixed.

#### B7 — 🟡 "Unlimited chat" promise vs per-message metering

- **Evidence**: `Pricing.tsx` promises unlimited Synthesis chat for Premium/Pro and `useSubscription.ts:136-142` returns `true` without deducting — but `synthesis.ts:113-126` charges 1 credit/message server-side for every authenticated user.
- **Decision**: Honor the promise server-side — skip the per-message charge for active premium/pro (respecting `expiresAt` + grace). Keep rate limits.
- **Status**: ✅ Fixed.

#### B8 — 🟡 Subscription lifecycle gaps (completed/paused/resumed, missing uid, lapse)

- **Evidence**: `subscription-webhook.ts` doesn't handle `subscription.completed` (sub ends silently after `total_count`), `paused`/`resumed`, or a missing `notes.uid` (paid, never credited). No scheduled job downgrades an expired subscription (client-only check `useSubscription.ts:128-133`).
- **Decision**: Handle `completed` (status `completed`, keep `expiresAt`), `paused`/`resumed`; on missing `uid`, fall back to `where("subscription.razorpaySubscriptionId","==",id)` then audit-log. Add `netlify/functions/subscription-lapse-scheduled.ts` (daily) to downgrade past-grace subscriptions to free/expired.
- **Status**: ✅ Fixed.

#### B9 — 🟡 No dedupe on subscription upgrade

- **Evidence**: `subscription-create.ts` — subscribing to Pro while Premium is active leaves the old Razorpay sub live; its next `charged` webhook flips the user back to Premium.
- **Decision**: If an active/pending sub with a different plan exists, 409 with "cancel first"; same plan → return existing.
- **Status**: ✅ Fixed.

### User Lifecycle

#### L1 — 🔴 Stale kundali after birth-data edit `[B3]`

- **Evidence**: Re-edit writes only `profile` (`Onboarding.tsx:174-184`, `OnboardingModal.tsx` `finalizeJourney` ~:295-315). `useKundali.ts:56-87` returns cached `kundaliData[_D9/_D10]` whenever populated, never comparing against current birth data; `shared/user-context.ts:72` feeds the same stale cache to the AI. Dasha/transit context _does_ refresh (hash-keyed), so the AI gets a fresh dasha over a stale natal chart — internally inconsistent.
- **Failure**: User corrects a wrong birth time; every chart (Dashboard, Synthesis, ConsultChat) and AI reading stays wrong forever.
- **Decision**: On any save that changes dob/tob/pob/coordinates, `deleteField()` `kundaliData`, `kundaliData_D9`, `kundaliData_D10` in the same update (both onboarding and the modal). Confirm `useKundali` refetches on cache-miss and `ConsultChat` tolerates the absence.
- **Status**: ✅ Fixed (lifecycle-fix).

#### L2 — 🔴 Data export missing chat/consultation content

- **Evidence**: `export-data.ts` `readSubcollection("chats")` is non-recursive → titles/metadata only; `chats/*/messages` and `consultations/*/messages` (the most personal data) absent, plus `friends` and several root fields (`kundaliData_D9/_D10`, `email`, `referral`, `chartUrl`).
- **Failure**: A GDPR "export all my data" omits the actual conversations — a compliance defect.
- **Decision**: Recurse into `chats/*/messages` and `consultations/*/messages`, add `friends` and the missing root fields; keep the 3/hr limit; page message reads.
- **Status**: ✅ Fixed.

#### L3 — 🟡 No working email unsubscribe (bulk-sender compliance)

- **Evidence**: Digest/nudge emails link to `/settings` (login required); no `List-Unsubscribe` header, no tokenized endpoint. Gmail/Yahoo require one-click unsubscribe for bulk senders.
- **Decision**: New `netlify/functions/unsubscribe.ts` — GET with HMAC token (timing-safe), sets `emailDigest=false`, returns a branded no-auth page. Add `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers and a footer link in `shared/digest.ts`. New env var `EMAIL_UNSUB_SECRET` (fail-closed validated).
- **Status**: ✅ Fixed.

#### L4 — 🟡 Default opt-out notifications + digest waste

- **Evidence**: Emails go to every user unless `emailDigest === false` (no explicit opt-in). `daily-digest-runner.ts:58,99-106` builds full paid context and writes a `digests` doc even for users with no email.
- **Decision**: Check email presence + pref _before_ building context. (Explicit opt-in consent flagged as a product decision — see Deferred.)
- **Status**: ✅ Fixed (waste); opt-in consent deferred.

#### L5 — 🟡 Deletion robustness + residue

- **Evidence**: Sequential doc-by-doc delete risks timeout on heavy users with no retry path; `otps/{email}` and other uid-keyed root docs survive.
- **Decision**: Use `db.recursiveDelete()` for the user tree; delete `otps/{email}`. (Deep purge of analytics/payment records left as retention policy — see Deferred.)
- **Status**: ✅ Fixed.

#### L6 — ⚪ Onboarding coordinates never captured; stale preview

- **Evidence**: `LocationInput.tsx:103` carries lat/lng but `onChange` passes only the string → `profile.coordinates` never set, every astrology call re-geocodes. Preview effect gated on `!preview` shows stale data when going back.
- **Decision**: Surface `{lat,lng}` on suggestion select, store `coordinates`; regenerate preview when dob/tob/pob change.
- **Status**: ✅ Fixed.

---

## Deferred (product/ops decisions, not code bugs — recommended before or shortly after launch)

These are intentionally **not** auto-fixed because they need a human/product/ops decision or external configuration:

1. **Explicit notification opt-in.** Switching from opt-out to opt-in during onboarding is a growth/consent tradeoff — recommend opt-in for EU users at minimum.
2. **Deletion of uid-keyed analytics/payment records.** `analyticsEvents`, `paymentOrders`, `webhookEvents`, published review authorship currently survive deletion. Payment records are legally retained; analytics should get a retention policy or uid-anonymization pass.
3. **Razorpay dashboard config.** The `payment.captured` fallback (B5) and subscription webhooks require the corresponding events enabled in the Razorpay dashboard and the webhook secret set in env. **Code cannot do this — verify in the dashboard before launch.**
4. **New env vars.** `EMAIL_UNSUB_SECRET` (L3) must be set in Netlify (≥32 chars). Confirm `OTP_HASH_SECRET`, `RESEND_API_KEY`, Razorpay keys, `ASTROYOU_API_KEY` are all present in production.
5. **Error monitoring.** No Sentry/equivalent. Strongly recommended before taking real traffic.
6. **Persistence choice.** Firebase default local persistence means shared-computer sessions persist until explicit logout — acceptable, but worth a product call.

---

## Verification

All 20 findings (A1–A6, B1–B9, L1–L6) fixed on branch `launch-hardening`. Fixes were implemented across three isolated agents with disjoint file ownership, then reviewed and cross-checked by hand — including the notification-preference field path (unsubscribe writes `profile.notificationPrefs.emailDigest`, exactly what the digest runner reads and Settings toggles), the guest chart-request rate limiter (sized `budget + 1` so a legitimate first request is never blocked, denies on the shared limiter's outage fallback), the account-deletion Razorpay cancel + `recursiveDelete`, and the webhook resurrection guard (`userSnap.exists` checked in every handler, orphaned subscriptions cancelled).

| Gate                                               | Baseline (pre-fix) | Post-fix                                        |
| -------------------------------------------------- | ------------------ | ----------------------------------------------- |
| `pnpm test` (types + functions)                    | 168 pass           | **209 pass, 0 fail** (+41 new regression tests) |
| `pnpm run lint`                                    | clean              | **clean**                                       |
| `pnpm run build` (`tsc -b` + vite + SEO prerender) | passing            | **passing** (430 SEO pages prerendered)         |

New regression tests added: entitlements client/server parity, consult partial-billing, signup-bonus idempotency, subscription lapse/grace decisions, birth-data-change detection, unsubscribe token generate/verify, OTP email validation, sign whitelist. Two pre-existing tests that pinned the old (buggy) behavior were updated to assert the corrected contract (`entitlements.test.ts` credit numbers; `consult-session.test.ts` insufficient-credits → partial billing).

### Extra fix during review

Beyond the 20 findings, the brain-nudge emails (`brain-nudges-scheduled.ts` / `shared/brain-nudges.ts`) were also missing `List-Unsubscribe` headers — the same bulk-sender compliance gap as L3, in a file none of the three agents owned. Fixed by reusing the tokenized unsubscribe helpers, with a fail-closed fallback to the settings link when `EMAIL_UNSUB_SECRET` is unset.

### ⚠️ Before flipping DNS (operational — not doable from code)

1. **Razorpay dashboard**: enable `payment.captured` and the subscription lifecycle events (`activated`, `charged`, `halted`, `pending`, `cancelled`, `completed`, `paused`, `resumed`) on the webhook, and confirm the webhook secret matches the env var. The B5 top-up-recovery and B8 lifecycle fixes are inert until these events are actually delivered.
2. **`EMAIL_UNSUB_SECRET`** (≥32 chars) set in Netlify — until then, digests skip sending (fail-closed) and nudge emails fall back to the settings link.
3. Confirm `OTP_HASH_SECRET`, `RESEND_API_KEY`, `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`, `ASTROYOU_API_KEY` present in production.
4. Deploy the updated `firestore.rules` (Firebase console/CLI) — the credits/referral hardening lives there, not in the app bundle.
5. Deferred product decisions above (explicit notification opt-in, analytics retention on deletion, error monitoring) remain open.
