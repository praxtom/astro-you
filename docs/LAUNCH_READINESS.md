# AstroYou Launch Readiness

AstroYou is code-ready only when this command exits with `Launch readiness: READY`:

```bash
pnpm run check:launch
```

The checker reads `.env` and the current process environment. Local `.env` is for development only; Netlify production values must be configured in Netlify environment variables.
Values copied from `.env.example` are intentionally treated as placeholders and must not pass the launch gate.

After static readiness passes, live Firebase access must also pass:

```bash
pnpm run check:services
```

This verifies Firebase Admin access to Firestore, Auth, and Storage without printing secrets.

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

After configuring Firebase, run `pnpm run check:services` and verify that server Firestore calls no longer show `16 UNAUTHENTICATED`.

### AI And Astrology

- `GEMINI_API_KEY`: Gemini key for synthesis, consults, reports, brain nudges, and digests.
- `ASTROLOGY_API_KEY`: dedicated astrology provider key.

Do not rely on `ASTROYOU_API_KEY` as a shared fallback for launch.

### Payments

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_PREMIUM_PLAN_ID`
- `RAZORPAY_PRO_PLAN_ID`
- `VITE_RAZORPAY_KEY_ID`

The server and browser Razorpay key IDs must match. Subscription plan IDs must map to the Premium and Pro plans used by the webhook.

### Operations

- `ASTROYOU_ADMIN_EMAILS`: comma-separated admin emails for dashboard, moderation, and operational queues.
- `APP_BASE_URL`: production URL, for example `https://astroyou.app`.

There are no hardcoded fallback admin emails. If `ASTROYOU_ADMIN_EMAILS` is missing, email-based admin access is disabled.

Optional but recommended:

- `RESEND_API_KEY`
- `VITE_FIREBASE_VAPID_KEY`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`

## Current Known Blockers

The latest local readiness check is blocked until these are configured:

- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_PREMIUM_PLAN_ID`
- `RAZORPAY_PRO_PLAN_ID`
- `ASTROYOU_ADMIN_EMAILS`
- `APP_BASE_URL`

It also warns that `ASTROLOGY_API_KEY` should be configured separately instead of relying on `ASTROYOU_API_KEY`.

The checker now blocks `replace_me`, `plan_replace_me`, `rzp_live_replace_me`, `admin@example.com`, and sample Firebase service account values.

## Verification Sequence

1. Configure environment variables locally and in Netlify.
2. Run `pnpm run check:launch`.
3. Run `pnpm run check:services`.
4. Run `pnpm test`.
5. Run `pnpm run lint`.
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
