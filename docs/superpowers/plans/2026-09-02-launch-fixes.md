# Launch Fixes — 2026-09-02

> Remediation plan for the 2026-09-02 full-platform launch audit. Spec = the audit findings
> summarised in "Global Constraints" below. Each task owns a disjoint set of files so tasks can be
> implemented in parallel. Implementers do NOT commit; the controller commits after each task review.

## Global Constraints

- Read-only outside the files a task owns. Never touch another task's files.
- Do not run `pnpm install`/`npm install` unless the task says so. Never delete `node_modules` or `.vite`.
- Keep the existing patterns: Netlify functions use `export default async (req, ctx) => Response` + `Config`; shared Firebase Admin from `netlify/functions/shared/firebase-admin`; astrology calls only via `shared/astro-api.ts` `apiFetch`; error responses never echo upstream/SDK `error.message` to clients (use generic strings, log `err.name`/status only).
- Function tests live in `netlify/functions/__tests__/*.test.ts` (node:test), compiled by `tsconfig.functions-test.json` whose `include` list must be extended when a test imports a new module. Run with `pnpm run test:functions`. Frontend typecheck: `pnpm run test:types`. Lint: `pnpm run lint`.
- Never print secret values. `.env` is local-only.
- No new "coming soon"/placeholder UI. Remove dead features instead of stubbing them.
- Do not change product pricing, credit costs, or AI prompts' substance.

## Task 1 — Config, rules, indexes, scripts, docs

Files owned: `netlify.toml`, `firestore.rules`, `firestore.indexes.json`, `package.json` (scripts only), `.nvmrc` (new), `.gitignore`, `.env.example`, `tsconfig.functions.json` (new), `netlify/functions/shared/launch-readiness.ts`, `netlify/functions/__tests__/launch-readiness.test.ts`, `scripts/prerender-seo-pages.mjs`, `docs/LAUNCH_READINESS.md`.

1. `netlify.toml`
   - CSP `connect-src`: add `https://nominatim.openstreetmap.org` and `https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io` (client geocoding + Sentry).
   - `Permissions-Policy`: change to `camera=(), microphone=(self), geolocation=(self)` (onboarding "use my location" and Synthesis voice dictation need them).
   - `[build.environment]`: add `NODE_VERSION = "22"`.
   - Add `[functions]` block with `node_bundler = "esbuild"` only if not already implied; otherwise skip. Do not add a timeout key (not supported on this plan).
2. `.nvmrc` containing `22`.
3. `firestore.rules`: in the `users/{userId}` `allow update` rule add
   `&& request.resource.data.get('activeConsultSessionId', null) == resource.data.get('activeConsultSessionId', null)`
   (the consult single-session lock must be server-only). Keep everything else unchanged.
4. `firestore.indexes.json`:
   - Add composite COLLECTION index on `auditLogs`: `uid ASC, action ASC, createdAt DESC`.
   - Add `fieldOverrides` entries: `referrals.refereeUid` with `indexes: [{ "queryScope": "COLLECTION_GROUP", "order": "ASCENDING" }]`; `consultations.status` with `indexes: [{ "queryScope": "COLLECTION_GROUP", "order": "ASCENDING" }]`; `analyticsEvents.expiresAt` with `ttl: true, indexes: []` (that field is written as a Date at `analytics-event.ts:53`). Do NOT add a TTL for `otps.expiresAt` (it is a number, not a Timestamp).
5. `package.json` scripts:
   - Add `"test:functions:types": "tsc -p tsconfig.functions.json --noEmit"` and make `"test"` = `pnpm run test:types && pnpm run test:functions:types && pnpm run test:functions`.
   - Add `"deploy:firebase": "firebase deploy --only firestore:rules,firestore:indexes,storage --project astro-you"`.
6. `tsconfig.functions.json` (new): same compilerOptions as `tsconfig.functions-test.json` but `noEmit: true`, no `outDir`, and `include: ["netlify/functions/**/*.ts", "src/types/**/*.ts", "src/lib/**/*.ts"]`, `exclude: ["netlify/functions/__tests__/**"]`. Run it and record every error it reports in your report (other tasks fix `pdf-report.ts`, `consult-message.ts`, `synthesis.ts`; anything else you find, list it — do not fix files you don't own). If import-extension or lib settings make it unusable, adjust compilerOptions (e.g. `allowImportingTsExtensions`, `lib`) until only genuine errors remain.
7. `netlify/functions/shared/launch-readiness.ts`: add `EMAIL_UNSUB_SECRET` as a **required** Operations key with the same ≥32-char validation used for `OTP_HASH_SECRET`. Add a test in `launch-readiness.test.ts` that a missing/short `EMAIL_UNSUB_SECRET` blocks readiness.
8. `scripts/prerender-seo-pages.mjs`:
   - `baseUrl` = `process.env.APP_BASE_URL || process.env.URL || "https://astroyou.app"`, with trailing slash stripped.
   - In `fetchPanchang`, when a 429 response body contains `RATE_LIMIT_EXCEEDED` or `Quota exceeded`, set a module-level `quotaExhausted = true`, log one line, and make all subsequent panchang fetches return the cached value or `null` immediately without calling the API (so a cold build cannot burn the remaining monthly quota).
9. `.env.example`: add `PANCHANG_BUDGET_MS` (documented, default 90000) and `EMAIL_UNSUB_SECRET` if missing.
10. `.gitignore`: add `output/` and `tmp/`.
11. `docs/LAUNCH_READINESS.md`: update "Current Known Blockers" to the real list (RAZORPAY_WEBHOOK_SECRET, RAZORPAY_PREMIUM_PLAN_ID, RAZORPAY_PRO_PLAN_ID, ASTROYOU_ADMIN_EMAILS, EMAIL_UNSUB_SECRET); remove APP_BASE_URL; add a "Deploy Firestore rules and indexes" step using `pnpm run deploy:firebase`; add a note that the astrology API plan must have quota headroom (a cold build can consume up to 180 calls).

Acceptance: `pnpm run test:functions` passes including the new test; `node scripts/check-launch-readiness.mjs` still runs; `firestore.indexes.json` is valid JSON; report lists the `test:functions:types` errors seen.

## Task 2 — Backend: reports, consult, AI input hygiene, upstream errors

Files owned: `netlify/functions/pdf-report.ts`, `netlify/functions/consult-message.ts`, `netlify/functions/synthesis.ts`, `netlify/functions/kundali.ts`, `netlify/functions/proactive-nudge.ts`, `netlify/functions/credits-use.ts`, `netlify/functions/razorpay-order.ts`, `netlify/functions/subscription-create.ts`, `netlify/functions/subscription-cancel.ts`, `netlify/functions/shared/astro-api.ts`, `netlify/functions/shared/astro-error-classify.ts`, `netlify/functions/shared/user-context.ts`, `netlify/functions/shared/synthesis-limits.ts` (new), `netlify/functions/__tests__/synthesis-limits.test.ts` (new), `netlify/functions/__tests__/astro-error-classify.test.ts`, `netlify/functions/__tests__/user-context*.test.ts`, and `tsconfig.functions-test.json` (**include list additions only**).

1. `pdf-report.ts`: line 89 references undeclared `localDate`. Destructure `localDate` from the request body (same contract as `compatibility.ts:28` / `kundali.ts:254`) so `requestedDateKey(localDate)` is valid. No other behaviour change.
2. Create `shared/synthesis-limits.ts` exporting `MAX_SYNTHESIS_MESSAGE_CHARS = 8000`, `MAX_SYNTHESIS_MESSAGES = 60`, and `isWithinSynthesisInputLimits(value: unknown): boolean` (move the implementation out of `synthesis.ts`). `synthesis.ts` imports it. `consult-message.ts` must reject `body.messages` failing the limit with a 400 `{ error: "Message too long" }` before any Gemini call. Add `synthesis-limits.test.ts` covering: non-array passes, >60 messages fails, one message >8000 chars fails, boundary values pass.
3. `consult-message.ts` and `synthesis.ts`: fix the `Property 'persisted' does not exist on type '{}'` type error by typing the result of the `safe()` wrapper (e.g. generic `safe<T>` returning `T | null`). Replace every client-facing `error.message` with a generic string (`"Consultation failed"` / `"Could not send consultation message"`); log only `error?.name` and status.
4. Generic errors on 500 paths (same rule): `razorpay-order.ts` (keep the `PaymentValidationError` message since it is server-authored; generic for everything else), `subscription-create.ts:134`, `subscription-cancel.ts:68`.
5. `credits-use.ts`: add `enforceIpRateLimit`/the existing per-uid limiter with scope `credits_use`, 120 per hour per uid (the scope is already registered fail-closed in `rate-limit.ts`). Follow the pattern used in `consult-start.ts`.
6. `shared/astro-api.ts`: replace the two raw `fetch(` calls at ~1314 and ~1319 with `apiFetch`. In the compatibility-insights payload (~1301-1302) send `"Partner 1"` / `"Partner 2"` instead of real names (names are not calculation inputs). Leave numerology name inputs alone (name-derived calculation).
7. `shared/astro-error-classify.ts`: add detection of upstream quota exhaustion (HTTP 429 with body containing `RATE_LIMIT_EXCEEDED` or `Quota exceeded`) returning a new classification, e.g. `{ kind: "quota_exhausted" }`. `kundali.ts` maps it to HTTP 503 `{ error: "Astrology service is temporarily unavailable. Please try again later.", code: "upstream_quota" }` instead of the generic 500. Add a unit test in `astro-error-classify.test.ts`.
8. `shared/user-context.ts`: wrap `name` (line ~116), and recent-summary `title`/`summary` (~305-312) with `sanitizePromptText` from `shared/sanitize.ts` (name max 80 chars, title 120, summary 600). Add/extend a test.
9. `proactive-nudge.ts`: validate `triggerType` against an allow-list derived from the trigger types the client sends (grep `src/hooks/useProactiveTriggers.ts` for the literal trigger names); return 400 on anything else.

Acceptance: `pnpm run test:functions` green with new tests; `tsc -p tsconfig.functions-test.json` clean; no client-facing `error.message` remains in owned files (grep).

## Task 3 — Backend: account lifecycle and misc endpoints

Files owned: `netlify/functions/delete-account.ts`, `netlify/functions/export-data.ts`, `netlify/functions/analytics-event.ts`, `netlify/functions/growth-report.ts`, `netlify/functions/sadhana-path.ts`, `netlify/functions/daily-digest.ts`, `netlify/functions/credits-initialize.ts`.

1. `delete-account.ts`: extend the top-level purge loop to also cover `supportTickets`, `remedyRequests` (both `where("uid","==",uid)`), and `predictionFeedbackAggregateQueue` (docs keyed `${uid}_...`; query `where("uid","==",uid)` if the record has `uid`, otherwise use a document-id range query `>= uid + "_"` and `< uid + "_"`; check `trust-submit.ts:~90-107` to see which fields the record has).
2. `export-data.ts`: move `await req.json()` inside the try (malformed JSON → 400 `{ error: "Invalid JSON" }`). Add `expertApplications`, `trustModerationQueue`, `supportTickets`, `remedyRequests`, `paymentOrders` (uid-filtered) to the export payload, each capped at 500 docs. Keep response shape backward compatible (new top-level keys only).
3. `analytics-event.ts`: `resolveOptionalUid` must catch `verifyIdToken` failures and return `null` (anonymous) instead of throwing a 500.
4. `growth-report.ts:46`, `sadhana-path.ts:46`, `daily-digest.ts:43`, `credits-initialize.ts:29`: replace client-facing `error.message` with a generic string; log `error?.name` only.

Acceptance: `pnpm run test:functions` still green; `grep -n "error.message\|err.message" <owned files>` returns only log lines, not response bodies.

## Task 4 — Frontend: resilience, monitoring, dead features, onboarding

Files owned: `src/main.tsx`, `src/lib/reportError.ts`, `src/App.tsx`, `src/components/dashboard/UtilityDock.tsx`, `src/pages/Friends.tsx` (delete), `src/pages/PublicProfile.tsx` (delete), `src/pages/Onboarding.tsx`, `src/components/OnboardingModal.tsx`, `src/components/LocationInput.tsx`, `src/components/synthesis/ConversationsListView.tsx`, `src/lib/acquisition.ts`, `src/vite-env.d.ts`, `package.json`/`package-lock.json` (dependency addition only, via **`npm install @sentry/react --save`** — npm, not pnpm, because `package-lock.json` is the lockfile in use).

1. `src/main.tsx`: add `window.addEventListener("vite:preloadError", () => window.location.reload())` before render (recovers from stale lazy chunks after a deploy). Initialise Sentry: if `import.meta.env.VITE_SENTRY_DSN` is a non-empty string, `import("@sentry/react")` dynamically and call `init({ dsn, environment: import.meta.env.MODE, sendDefaultPii: false, tracesSampleRate: 0 })`, then expose it on `window.Sentry` so `reportError` forwards. No-op without DSN. Keep the bundle impact lazy (dynamic import only when DSN present).
2. `src/lib/reportError.ts`: keep the shim but update the doc comment to reflect that `main.tsx` wires it.
3. Remove the dead social feature (it queries other users' documents, which Firestore rules deny): delete `src/pages/Friends.tsx` and `src/pages/PublicProfile.tsx`; remove their lazy imports and `<Route>`s from `src/App.tsx`; in `UtilityDock.tsx` remove the "Friends" navigation button and the username/public-profile controls (keep the rest of the dock intact). Run `pnpm run test:types` to confirm nothing else imports them.
4. `src/components/OnboardingModal.tsx`: require `birthCoordinates` before finalising, matching `Onboarding.tsx:442` (show the same toast text: "Please pick your birth place from the suggestions so we can locate it accurately.").
5. `src/components/LocationInput.tsx`: when the geocode fetch fails (catch block ~133), surface a visible inline message under the input (`"Couldn't look up places right now. Check your connection and try again."`) using the existing FieldError/help-text pattern in the component; clear it on the next successful search.
6. `src/pages/Onboarding.tsx`: fix the step counter labels so they are sequential and share one total (currently `02 / 05`, `02 / 04`, `03 / 04`, `04 / 04` at lines ~717, 788, 880, 921). Count the actual rendered steps and label them `01..N / N` consistently.
7. `src/components/synthesis/ConversationsListView.tsx:97`: fix the `react-hooks/immutability` lint error without changing behaviour (e.g. use a `useImperativeHandle`/`useMergedRefs`-style helper or assign via a stable callback that the rule accepts).
8. `src/lib/acquisition.ts`: `sendServerAnalyticsEvent` must return early unless `hasAnalyticsConsent()` (from `src/lib/firebase.ts`) is true, in addition to the existing `VITE_ENABLE_SERVER_ANALYTICS` gate.
9. `src/vite-env.d.ts`: declare `VITE_SENTRY_DSN?: string` on `ImportMetaEnv` if the file declares env types.

Acceptance: `pnpm run test:types` clean; `pnpm run lint` reports 0 errors; `pnpm run build` succeeds; grep confirms no remaining imports of Friends/PublicProfile.
