# AstroYou — Pre-Launch Fix Plan

> Companion to `PRELAUNCH_AUDIT.md`. Sequenced by dependency, risk, and ROI.
> Each item: what to change, where, acceptance check. IDs map back to the audit.
> Decisions locked with the user: **OTP = hash + atomic, keep Firestore.** Plan written before code changes.

## Sequencing principle

1. **Phase 0 first** — the one existential, 10-minute check. Nothing else matters if it fails.
2. **Phase 1 = cheap config/rules wins** — high protection, low blast radius, no logic risk.
3. **Phase 2 = the money + auth core** — the real engineering, where most blockers live.
4. **Phase 3 = data integrity & scale** — atman bounds, scheduled-job pagination, idempotency.
5. **Phase 4 = growth integrity & polish** — referral/trust/analytics abuse, notifications, SEO.

Recommend a shared helper `requireAuth(req)` and `requireAuthBody(body)` extracted during Phase 2 and reused everywhere, plus making the rate limiter fail-closed for sensitive scopes once — both collapse many findings into single fixes.

---

## PHASE 0 — Existential (do first, blocks everything)

### 0.1 — Verify the Gemini model id · `T2-B1`

- **Do:** Make one live call with `gemini-3.1-flash-lite-preview` against the production `GEMINI_API_KEY` (a `scripts/` one-off or `curl`). If it 404s / errors, pick a valid current model.
- **Then:** Replace all 14 hard-coded usages in `shared/gemini.ts` with `const GEMINI_MODEL = process.env.GEMINI_MODEL_ID ?? "<verified-id>"`. Set `GEMINI_MODEL_ID` in Netlify env.
- **Accept:** A real synthesis call streams tokens end-to-end in a deployed/preview context.
- ⛔ **If this fails, stop — there is no product until it's resolved.**

---

## PHASE 1 — Cheap config + rules wins (low risk, high protection)

### 1.1 — Firestore catch-all deny + lock server-only collections · `T1-B6, T1-H1`

- `firestore.rules`: add `match /{document=**} { allow read, write: if false; }` at the end of the documents block.
- Change `consultations_reviews`, `referrals`, `friends` to `allow read: if isOwner(userId); allow write: if false;` (writes move server-side).
- Replace the `diff().affectedKeys()` credits/subscription guard with explicit equality (`request.resource.data.credits == resource.data.credits` etc.) for robustness.
- **Accept:** Rules Playground — a client write to `users/{me}/referrals/x`, to an unlisted collection, and to own `credits`/`subscription` all DENY; normal profile update ALLOWS.

### 1.2 — Re-enable Netlify secret scanning · `T1-B7`

- Remove `SECRETS_SCAN_SMART_DETECTION_ENABLED="false"` from `netlify.toml`. If it was added for `.env.example` false positives, fix those instead.
- **Accept:** Build passes with scanning on.

### 1.3 — Security headers · `T3-B1`

- Add a `[[headers]]` block in `netlify.toml`: `Content-Security-Policy` (allow self + `checkout.razorpay.com` + Firebase hosts + fonts), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`.
- **Accept:** `curl -I` on a deploy shows the headers; app still loads, Razorpay modal opens, Firebase auth works (tune `connect-src`/`frame-src` until clean in console).

### 1.4 — Service worker excludes auth/API · `T3-B2`

- In `public/sw.js` fetch handler, early-return (network passthrough, no cache) when path starts with `/__/auth/` or `/api/` or `/.netlify/`.
- Tie cache version to build (inject git SHA / build timestamp) instead of manual `v2`.
- **Accept:** Auth redirect + an `/api` GET never appear in `caches`; offline still serves the app shell.

### 1.5 — Subscription plan-id: throw, don't default to premium · `T1-B4`

- `shared/subscription-plans.ts:resolveTierFromPlanId`: remove the `return "premium"` fallback and the `includes("pro")` heuristic; `throw` on unknown plan id.
- **Accept:** Unit test — unknown/empty plan id throws; the two real plan ids resolve correctly.

### 1.6 — ESM extension + env-key fallback hygiene · `T1-L1, T1-M4`

- Add `.js` to imports in `shared/audit-log.ts` and `shared/cache.ts` (match the rest).
- In `shared/env.ts`, drop the shared `ASTROYOU_API_KEY` fallback for Gemini/Resend (keep per-service keys); fail loudly if a required key is missing.
- **Accept:** `npm run build` + functions bundle clean; a missing key surfaces a clear startup error, not a silent 401.

### 1.7 — SEO sitemap/robots hygiene · `T3-H12`

- Remove authenticated routes from `staticRoutes` in `prerender-seo-pages.mjs`; add a template-integrity assertion (`<div id="root"></div>` present) before injecting.
- Add `Disallow:` for `/dashboard /wallet /synthesis /consult /reports /onboarding` in `robots.txt`.
- **Accept:** Regenerated sitemap contains only public marketing/SEO routes; build fails loudly if template is wrong.

---

## PHASE 2 — Money + auth core (the real engineering)

### 2.0 — Shared helpers (build once, reuse)

- `requireAuthBody(body)` → verifies `idToken`, returns `uid` or throws 401. `requireAuthReq(req)` → from `Authorization: Bearer`.
- Make `checkRateLimit` **fail-closed** for sensitive scopes (`send_otp`, `verify_otp`, `credits_use`, `synthesis`, `consult_message`); fail-open allowed only for analytics. Drop spoofable `client-ip` from the IP chain. · `T1-H2, T1-H3`

### 2.1 — Authenticate + rate-limit all paid endpoints · `T2-B2, T2-H5`

- Add `requireAuthBody` + `checkRateLimit` to: `kundali.ts`, `proactive-nudge.ts`, `horoscope.ts`, `compatibility.ts`. For `synthesis.ts`, require a token unless an explicit, server-enforced guest quota exists (see 2.3).
- Keep a small allowlist of genuinely public chartTypes (PANCHANG/ECLIPSES/tarot) if the landing page needs them — still rate-limited.
- **Accept:** Unauthenticated POST → 401; authenticated over-limit → 429.

### 2.2 — Server-side credit deduction for AI chat · `T2-B3`

- Move deduction into `synthesis.ts`: reserve/deduct 1 credit **before** the Gemini call inside the credit transaction; refund (compensating ledger write) if generation fails. Remove the client-side `/credits/use` call in `Synthesis.tsx`.
- **Accept:** Blocking the client deduction call no longer yields free generations; a forced Gemini failure refunds the credit (ledger shows debit+refund).

### 2.3 — Guest trial enforced server-side (if guests stay) · `T2-B2`

- Replace the localStorage `FREE_SECONDS` gate with a Firestore/IP-hash counter checked server-side, or drop guest AI entirely.
- **Accept:** Clearing localStorage does not reset free usage.

### 2.4 — Reports: charge before generate, refund on failure · `T2-B6, T2-H12, T2-M9`

- Reorder `pdf-report.ts`: transaction sets `status:"generating"` + deducts credit → generate → on success `status:"completed"`; on any failure refund + `status:"failed"`. Map `CreditError`→402. Move natal/compatibility generation to a background function (or add a reaper that fails stale `generating` docs).
- **Accept:** Generation failure leaves balance unchanged and no stuck `generating` doc; insufficient credits → 402.

### 2.5 — OTP: hash + atomic + email-send guard · `T1-B1, T1-B2, T1-B3`

- Store HMAC(otp, server-secret) not plaintext; compare with `timingSafeEqual`. Wrap send (rate-check+write) and verify (read+attempt-increment+delete) each in a Firestore transaction. Return 500 if `RESEND_API_KEY` missing and check Resend response `.ok`; add a `blocked_until` after max attempts.
- **Accept:** `otps/` doc shows a hash; concurrent send requests respect cooldown; missing Resend key → 500 (not a fake 200); 6th attempt blocked even under concurrency.

### 2.6 — Webhook idempotency fix · `T1-B5`

- `subscription-webhook.ts`: don't leave events `"failed"` in a way that re-enters processing on retry; move `writeAuditLog` outside the idempotency window; add staleness timeout for stuck `"processing"`. Use `??` not `||` for `periodKey`. Anchor grace period to `current_end`. · `T1-H5`
- **Accept:** Replaying the same event id doesn't re-grant; a forced failure after credit-grant doesn't double-grant on retry.

### 2.7 — Prompt-injection + persona hardening · `T2-H1, T2-H2, T2-H3, T2-M1`

- Sanitize/truncate atman free-text before prompt interpolation; reject/validate guest `atmanData`. Gate `personaPrompt`/`personaName` to server-side vetted persona configs (lookup by id), never raw client text. Add Gemini `safetySettings`.
- **Accept:** A relationship name of `"IGNORE PREVIOUS INSTRUCTIONS…"` doesn't alter behavior; a client cannot inject a system prompt via `personaPrompt`.

### 2.8 — Gemini stream abort + input validation · `T2-H4, T2-M5, T2-M4`

- Wire `ReadableStream.cancel` → `AbortController.abort()` → pass signal to the Gemini call. Validate `messages` is a non-empty array of `{role,content:string}`. Strip user-content from `console.log`.
- **Accept:** Client disconnect stops token generation; empty `messages` → 400, not a crash.

---

## PHASE 3 — Data integrity & scale

### 3.1 — Bound atman arrays + atomic writes · `T2-B4, T2-B5, T2-H10`

- Cap `knownPatterns` (e.g. top-200 by score), `lifeEvents` (recent/high-confidence), relationships/routines; prune archived/old in maintenance. Use Firestore transactions or field-level `arrayUnion`/sub-array updates instead of overwriting the whole `atman` object. Remove the duplicate client `processAnalysisResult` brain path; rely on server `persistAtmanInsights`.
- **Accept:** Simulated heavy user stays well under 1MB; concurrent chat + client edit don't lose data.

### 3.2 — Paginate scheduled jobs + idempotency · `T3-B3, T3-B4, T2-H9`

- Cursor-paginate (`orderBy + startAfter`) digest / nudges / maintenance with a stored cursor and wall-clock guard. Daily digest: deterministic doc id `${uid}_${date}` + Resend `Idempotency-Key`, skip if already sent.
- **Accept:** A run processes beyond 200 users across pages; double-fire sends no duplicate email.

### 3.3 — Consult mid-session guard + reaper hardening · `T2-H11, T3-M7`

- `consult-message.ts`: reject (402) once elapsed exceeds funded `maxBillableMinutes`. Add a shared-secret header check to `consult-reaper-scheduled.ts`; handle `activityMs===0` legacy docs.
- **Accept:** Out-of-credit session stops calling Gemini; reaper endpoint rejects unauthenticated callers.

---

## PHASE 4 — Growth integrity, notifications, polish

### 4.1 — Referral anti-fraud · `T3-B5, T3-B6, T3-H7`

- Random server-generated codes stored in Firestore (not UID-derived). In `referral-claim`, reject if referee already `referredBy` or account older than the referral-visit window. Make `prediction_feedback` idempotent (deterministic id per source/period/date). Stop the per-read write in `referral-info`.
- **Accept:** Same user can't farm via second account; codes unguessable.

### 4.2 — Trust/review integrity · `T3-B7, T3-H6`

- `trust-submit`: rate-limit; verify the `sessionId` consultation exists and belongs to `uid`; deterministic review id per session (no dupes). Write public reviews only on moderation approval, not at submit.
- **Accept:** Can't review a non-existent session; can't spam; public review appears only after approval.

### 4.3 — Analytics + admin hardening · `T3-H8, T3-H1..H5, T3-M1..M4`

- Analytics rate-limit by IP only (drop `anonymousId`); value-level PII scrub. Admin: token via `Authorization` header; push `uid`/`action` filters into Firestore queries (add indexes); field-mask `admin-summary`; batch trust-moderation writes; cap credit adjustment; self-approval guard; single-redirect admin gate.
- **Accept:** Rotating anonymousId no longer bypasses limit; admin audit query returns correct historical rows.

### 4.4 — Notifications consent + delivery · `T3-H9, T3-H10, T3-H11, T3-M5, T3-M6, T3-M8`

- Frequency/quiet-hours caps for emotional nudges; deactivate stale FCM tokens on `not-registered`; remove `emailOverride` from public interface; add unsubscribe link; switch WhatsApp to approved templates (or disable channel); enlarge `nudgeHistory` window.
- **Accept:** A chaotic user isn't emailed hourly; uninstalled tokens stop retrying; emails carry unsubscribe.

### 4.5 — Remaining mediums

- `T2-M2` cache keys include tob/pob; `T2-M3` PDF pagination/truncation marker; `T2-M6` cache DAILY_TAROT + cap TAROT_THREE question; `T2-M7/T2-M8` export rate-limit + gated migration; `T1-M1/M2/M3` atomic delete + generic 500s + validate guest migration; `T3-M9/M10/M11` SW version, manifest icons, referral-info write.

---

## Suggested grouping for PRs

1. **PR-1 "harden config"** = Phase 0 + Phase 1 (rules, headers, SW, secret scan, plan-id, SEO). Low risk, ship first.
2. **PR-2 "auth + money"** = Phase 2. The core; needs careful testing.
3. **PR-3 "data & scale"** = Phase 3.
4. **PR-4 "growth & notifications"** = Phase 4.

Each PR ends with: `npm run build` green, relevant `__tests__` updated, and the per-item acceptance checks above run.
