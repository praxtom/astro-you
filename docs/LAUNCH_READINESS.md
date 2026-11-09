# AstroYou Launch Readiness

AstroYou is code-ready only when this command exits with `Launch readiness: READY`:

```bash
npm run check:launch
```

The checker reads `.env` and the current process environment. Local `.env` is for development only; Netlify production values must be configured in Netlify environment variables.
Values copied from `.env.example` are intentionally treated as placeholders and must not pass the launch gate.

Run it with `CONTEXT=production` to apply the production-only rules (for example, `rzp_test` keys block):

```bash
CONTEXT=production npm run check:launch
# also fail while the legal pages still contain template placeholders:
CONTEXT=production LEGAL_PLACEHOLDER_CHECK=1 npm run check:launch
```

After static readiness passes, live Firebase access must also pass:

```bash
npm run check:services
```

This verifies Firebase Admin access to Firestore, Auth, and Storage without printing secrets.

The repository uses **npm** (`package-lock.json` is the lockfile and Netlify builds with npm). Do not use pnpm.

## Required Before Public Launch

### Firebase

- `FIREBASE_SERVICE_ACCOUNT`: full Firebase Admin service account JSON with `project_id`, `client_email`, and `private_key`.
- `FIREBASE_STORAGE_BUCKET`: storage bucket for generated reports and user files.
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

After configuring Firebase, run `npm run check:services` and verify that server Firestore calls no longer show `16 UNAUTHENTICATED`.

### AI And Astrology

- `GEMINI_API_KEY`: Gemini key for synthesis, consults, reports, brain nudges, and digests.
- `ASTROLOGY_API_KEY`: dedicated astrology provider key.

Do not rely on `ASTROYOU_API_KEY` as a shared fallback for launch.

The build prerenders up to 180 Panchang date pages. Live astrology calls for them are made **only in the Netlify `production` build context** (or when `PRERENDER_LIVE_PANCHANG=1`). Deploy previews, branch deploys and local builds reuse the cross-build cache in `node_modules/.cache` or fall back to descriptive copy, so they spend no quota. A cold production build (empty cache) can still use up to 180 calls; keep that much quota headroom before a production deploy.

The build writes `sitemap.xml`, `robots.txt`, `llms.txt` and `pricing.md` into `dist/` only. The copies in `public/` are dev-time defaults and are no longer rewritten by builds.

### Payments

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_PREMIUM_PLAN_ID`
- `RAZORPAY_PRO_PLAN_ID`
- `VITE_RAZORPAY_KEY_ID`

The server and browser Razorpay key IDs must match. Subscription plan IDs must map to the Premium and Pro plans used by the webhook.

The checker uses Netlify's `CONTEXT` variable:

- `CONTEXT=production` with an `rzp_test_…` key → **blocked**.
- Any other context (`deploy-preview`, `branch-deploy`, `dev`) with an `rzp_live_…` key → **warning**: previews must not take real money.

### Email (Resend)

- `RESEND_API_KEY` — **required**. Email OTP sign-in returns 503 without it, and the digest and support-ticket alerts are not sent.
- `DIGEST_FROM_EMAIL` — **required**. Sender for OTP, digest and admin emails, e.g. `AstroYou <noreply@astroyou.app>`.

Resend only delivers from a verified domain. Before launch:

1. Resend dashboard → Domains → Add domain → `astroyou.app` (or a sending subdomain such as `mail.astroyou.app`).
2. Add the SPF (TXT), DKIM (CNAME/TXT) and MX records Resend shows at the DNS provider, and wait for "Verified".
3. Add a DMARC record, at minimum `_dmarc.astroyou.app TXT "v=DMARC1; p=none; rua=mailto:<owner inbox>"`, and tighten to `quarantine` once reports are clean.
4. Set `DIGEST_FROM_EMAIL` to an address on that verified domain.
5. Send yourself an OTP from production and check the headers show `dkim=pass` and `spf=pass`.

### Operations

- `ASTROYOU_ADMIN_EMAILS`: comma-separated admin emails for dashboard, moderation, operational queues, and new support-ticket emails.
- `APP_BASE_URL`: production URL, for example `https://astroyou.app`.
- `OTP_HASH_SECRET`: secret used to HMAC one-time login codes at rest (>= 32 characters).
- `EMAIL_UNSUB_SECRET`: secret used to HMAC one-click email unsubscribe (List-Unsubscribe) tokens. Must be a different long random value from `OTP_HASH_SECRET` (>= 32 characters). Digest emails are not sent until this is configured (compliance fail-closed).

There are no hardcoded fallback admin emails. If `ASTROYOU_ADMIN_EMAILS` is missing, email-based admin access is disabled.

Recommended (reported, not blocking):

- `OPS_ALERT_WEBHOOK_URL`: Slack or Discord incoming webhook (https). Paged once per incident window for payment, job, email and background-auth failures.
- `INTERNAL_FUNCTION_SECRET`: dedicated secret for background-function dispatch (>= 32 characters). Falls back to a value derived from `OTP_HASH_SECRET`.
- `VITE_SENTRY_DSN`: client crash reporting.
- `VITE_FIREBASE_VAPID_KEY`: browser push.
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`: only once WhatsApp nudges are enabled.

## Monitoring And Alerting

- **Health probe**: `GET /api/health` is public and secret-free. It returns 503 when a required credential is missing (`firebaseAdmin`, `gemini`, `astrologyApi`, `razorpay`, `otpSecret`, `email`) or when `jobsFresh` is false (a scheduled job has not succeeded within 2× its schedule; `staleJobs` names it). Point an uptime monitor (UptimeRobot, Better Stack) at it with a 5-minute interval.
- **Ops events**: failures are written to Firestore `opsEvents/{id}` (30-day TTL on `expiresAt`) and, when `OPS_ALERT_WEBHOOK_URL` is set, posted to the webhook. They carry no PII beyond a uid. The admin operations queue (`/api/admin/operations`, action `list`) returns recent `opsEvents`, all `jobs` with freshness, and `staleJobs`.
- **Job runs**: scheduled jobs record `jobRuns/{job}` (`ok`, counts, `lastRunAt`, `lastOkAt`, `expectedIntervalMs`).
- **Netlify**: Site configuration → Notifications → add "Deploy failed" email/Slack notifications. Scheduled functions run only on the published production deploy; check Logs → Functions for `daily-digest-scheduled` after launch day.

### Daily digest

The digest is **opt-in**: only users with `notificationPrefs.emailDigest === true` are emailed. At 01:30 UTC `daily-digest-scheduled` dispatches `daily-digest-background`, which walks every user with a per-day cursor for ~13 minutes per slice and re-dispatches itself until all users are covered (`DAILY_DIGEST_MAX_HOPS`, default 24). One digest per user per UTC day (Firestore marker plus Resend `Idempotency-Key`). If dispatch fails, the trigger runs a short inline slice and raises a `job_dispatch_failed` alert.

## Staging Environment

Previews must never touch production data or take real payments.

1. **Second Firebase project** (for example `astro-you-staging`): create it in the Firebase console, enable Auth (Google + Email) and Firestore in the same region, add the Netlify preview domain (`*--<site>.netlify.app`) to Auth → Authorized domains, then deploy rules and indexes to it:
   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes,storage --project astro-you-staging
   ```
2. **Razorpay test mode**: generate `rzp_test_…` keys, create test Premium/Pro plans, and a test webhook pointing at the staging URL with its own secret.
3. **Netlify env per deploy context**: set production values for the `production` context only, and staging values for `deploy-preview` and `branch-deploy`:
   ```bash
   netlify env:set RAZORPAY_KEY_ID rzp_live_xxx --context production
   netlify env:set RAZORPAY_KEY_ID rzp_test_xxx --context deploy-preview branch-deploy
   netlify env:set FIREBASE_SERVICE_ACCOUNT "$(cat staging-sa.json)" --context deploy-preview branch-deploy --secret
   netlify env:set VITE_FIREBASE_PROJECT_ID astro-you-staging --context deploy-preview branch-deploy
   ```
   Repeat for every `FIREBASE_*`, `VITE_FIREBASE_*`, `RAZORPAY_*`, `VITE_RAZORPAY_KEY_ID`, and `APP_BASE_URL`. Leave `OPS_ALERT_WEBHOOK_URL` unset (or point it at a separate channel) outside production.
4. Verify with `CONTEXT=deploy-preview npm run check:launch` against the staging values: it warns if a live Razorpay key leaked into a preview.

## Backups And Recovery

Run once as the project owner (needs `roles/datastore.owner`). Project: `astro-you`, database `(default)`.

```bash
# 1. Point-in-time recovery: 7 days of minute-level versions.
gcloud firestore databases update --database='(default)' --enable-pitr --project=astro-you

# 2. Scheduled backups: daily (kept 7 days) and weekly (kept 14 weeks).
gcloud firestore backups schedules create --database='(default)' \
  --recurrence=daily --retention=7d --project=astro-you
gcloud firestore backups schedules create --database='(default)' \
  --recurrence=weekly --day-of-week=SUN --retention=14w --project=astro-you

# Firebase CLI equivalent of the daily schedule:
npx firebase firestore:backups:schedules:create --database '(default)' \
  --recurrence DAILY --retention 7d --project astro-you

# Verify:
gcloud firestore databases describe --database='(default)' --project=astro-you   # pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_ENABLED
gcloud firestore backups schedules list --database='(default)' --project=astro-you
gcloud firestore backups list --project=astro-you
```

Restore (always into a new database, then switch or copy back):

```bash
# From a scheduled backup:
gcloud firestore databases restore --project=astro-you \
  --source-backup=projects/astro-you/locations/<LOCATION>/backups/<BACKUP_ID> \
  --destination-database=restore-<YYYYMMDD>

# From PITR (export a past snapshot, then import where needed):
gcloud firestore export gs://<BACKUP_BUCKET>/pitr-<YYYYMMDD> \
  --database='(default)' --snapshot-time=<RFC3339, e.g. 2026-11-10T00:00:00Z> --project=astro-you
```

Do a restore drill into a throwaway database before launch. Cloud Storage (generated reports) is not covered by Firestore backups; enable object versioning on the bucket: `gcloud storage buckets update gs://<BUCKET> --versioning`.

## Current Known Blockers

Not re-verified by this change (the checker was not run against real env). Before launch, these must be configured:

- `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` (now required), with the sending domain verified in Resend.
- `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PREMIUM_PLAN_ID`, `RAZORPAY_PRO_PLAN_ID`.
- `ASTROYOU_ADMIN_EMAILS`.
- `EMAIL_UNSUB_SECRET`.
- `ASTROLOGY_API_KEY` as a dedicated key (not the `ASTROYOU_API_KEY` fallback), with quota headroom for a cold production build.
- Firestore rules and indexes deployed (`npm run deploy:firebase`), including the new `opsEvents.expiresAt` TTL policy.
- Firestore PITR and scheduled backups enabled (commands above).
- Production-only Razorpay live keys; previews on `rzp_test` via per-context Netlify env.

The checker blocks `replace_me`, `plan_replace_me`, `rzp_live_replace_me`, `admin@example.com`, and sample Firebase service account values.

## Verification Sequence

1. Configure environment variables locally and in Netlify (per deploy context).
2. Run `CONTEXT=production npm run check:launch`.
3. Run `npm run check:services`.
4. Run `npm run test:all` (lint, typechecks, function tests, offline SEO tests). CI runs the same on every push and PR (`.github/workflows/ci.yml`, no build step).
5. Deploy Firestore rules, indexes and TTL policies: `npm run deploy:firebase`.
6. Run payment smoke checks:
   - missing auth returns `401`;
   - bad webhook signature returns `400`;
   - valid Razorpay checkout creates wallet ledger activity;
   - subscription webhook maps plan IDs to the correct tier.
7. Run product smoke checks:
   - `/dashboard`;
   - `/consult`;
   - `/reports`;
   - `/pricing`;
   - `/trust`;
   - `/panchang`;
   - `/horoscope/aries/daily`.
8. Verify generated report storage and redownload.
9. Verify trust submissions enter moderation and are not public until approved.
10. Verify admin access works only for emails in `ASTROYOU_ADMIN_EMAILS`.
11. Create a support ticket and confirm the admin email arrives.
12. Check `GET /api/health` returns 200 with `jobsFresh: true` the day after launch.
