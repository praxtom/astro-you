import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  OTP_DAILY_FAILURE_CAP,
  otpDailyCapReached,
  otpFailureDocId,
  otpFailureExpiresAt,
} from "../shared/otp.js";
import { isRecentLogin } from "../shared/recent-login.js";

// ── Firestore rules ─────────────────────────────────────────────────────────
// Reading a field that doesn't exist is a rules ERROR, which denies the write.
// Free users have no `subscription`, new docs may lack `credits`, etc., so any
// optional field must be compared via .get('<field>', default), never through
// direct `resource.data.<field>` access.
const OPTIONAL_USER_FIELDS = [
  "credits",
  "subscription",
  "referral",
  "referredBy",
  "referralClaimedAt",
  "activeConsultSessionId",
  "memoryPaused",
  "phoneE164",
  "whatsappNumber",
  "verifiedContacts",
];

test("firestore.rules never reads optional user fields via direct access", () => {
  const rules = readFileSync("firestore.rules", "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  for (const field of OPTIONAL_USER_FIELDS) {
    const direct = new RegExp(`resource\\.data\\.${field}\\b`);
    assert.doesNotMatch(
      rules,
      direct,
      `firestore.rules reads resource.data.${field} directly; use .get('${field}', null)`,
    );
  }
});

test("firestore.rules guards the one direct email read with a null check", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const directEmail = [...rules.matchAll(/resource\.data\.email\b/g)];
  for (const match of directEmail) {
    const before = rules.slice(Math.max(0, match.index! - 140), match.index);
    assert.match(
      before,
      /get\('email', null\) == null\s*\|\|\s*(request\.)?$/,
      "direct resource.data.email must be short-circuited by a get() null check",
    );
  }
});

test("firestore.rules: user update compares credits/subscription with get()", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  assert.match(
    rules,
    /request\.resource\.data\.get\('credits', null\) == resource\.data\.get\('credits', null\)/,
  );
  assert.match(
    rules,
    /request\.resource\.data\.get\('subscription', null\) == resource\.data\.get\('subscription', null\)/,
  );
});

// ── Indexes / TTL for deletion + retention ──────────────────────────────────
test("firestore indexes support deletion queries and audit-log retention", () => {
  const config = JSON.parse(readFileSync("firestore.indexes.json", "utf8"));
  const overrides: any[] = config.fieldOverrides;
  const reviews = overrides.find(
    (o) => o.collectionGroup === "reviews" && o.fieldPath === "uid",
  );
  assert.ok(
    reviews?.indexes.some((i: any) => i.queryScope === "COLLECTION_GROUP"),
    "collectionGroup('reviews').where('uid') needs a collection-group index",
  );
  for (const group of ["auditLogs", "deletionJobs", "rateLimits"]) {
    assert.ok(
      overrides.some(
        (o) =>
          o.collectionGroup === group && o.fieldPath === "expiresAt" && o.ttl,
      ),
      `${group}.expiresAt must have a TTL policy`,
    );
  }
});

// ── OTP daily failure cap ───────────────────────────────────────────────────
test("OTP failure counter is per email (case-insensitive) and per UTC day", () => {
  const day = Date.UTC(2026, 10, 10, 12);
  assert.equal(
    otpFailureDocId("User@Example.com", day),
    otpFailureDocId(" user@example.com ", day + 60_000),
  );
  assert.notEqual(
    otpFailureDocId("user@example.com", day),
    otpFailureDocId("other@example.com", day),
  );
  assert.notEqual(
    otpFailureDocId("user@example.com", day),
    otpFailureDocId("user@example.com", day + 24 * 60 * 60 * 1000),
  );
  assert.ok(!otpFailureDocId("user@example.com", day).includes("example"));
  assert.ok(otpFailureExpiresAt(day).getTime() > day + 12 * 60 * 60 * 1000);
});

test("OTP daily cap blocks at the cap and not before", () => {
  assert.equal(OTP_DAILY_FAILURE_CAP, 15);
  assert.equal(otpDailyCapReached(undefined), false);
  assert.equal(otpDailyCapReached(14), false);
  assert.equal(otpDailyCapReached(15), true);
  assert.equal(otpDailyCapReached(40), true);
});

test("verify-otp and send-otp both enforce the daily cap", () => {
  for (const file of ["verify-otp.ts", "send-otp.ts"]) {
    const src = readFileSync(`netlify/functions/${file}`, "utf8");
    assert.match(src, /otpDailyCapReached\(/, `${file} must check the cap`);
  }
  const verify = readFileSync("netlify/functions/verify-otp.ts", "utf8");
  assert.match(verify, /count: FieldValue\.increment\(1\)/);
});

// ── Recent login for deletion ───────────────────────────────────────────────
test("isRecentLogin accepts sign-ins within 10 minutes only", () => {
  const now = Date.UTC(2026, 10, 10, 12);
  const sec = now / 1000;
  assert.equal(isRecentLogin(sec - 30, now), true);
  assert.equal(isRecentLogin(sec - 9 * 60, now), true);
  assert.equal(isRecentLogin(sec - 11 * 60, now), false);
  assert.equal(isRecentLogin(undefined, now), false);
  assert.equal(isRecentLogin("123", now), false);
  assert.equal(isRecentLogin(sec + 3600, now), false);
});

test("delete-account returns recent_login_required and journals the job", () => {
  const src = readFileSync("netlify/functions/delete-account.ts", "utf8");
  assert.match(src, /code: "recent_login_required"/);
  assert.match(src, /401/);
  assert.ok(
    src.indexOf("openDeletionJob(") < src.indexOf("runDeletionJob("),
    "the deletion job must be recorded before any destructive step",
  );
  const shared = readFileSync(
    "netlify/functions/shared/account-deletion.ts",
    "utf8",
  );
  assert.match(
    shared,
    /collectionGroup\("reviews"\)\.where\("uid", "==", uid\)/,
  );
  assert.match(shared, /"weeklyAstrologyContext"/);
  const retry = readFileSync(
    "netlify/functions/account-deletion-retry-scheduled.ts",
    "utf8",
  );
  assert.match(retry, /schedule: "@hourly"/);
  assert.match(retry, /export default async/);
});

// ── Admin allowlist requires a verified email ───────────────────────────────
test("admin email allowlist requires email_verified", () => {
  const src = readFileSync("netlify/functions/shared/admin-auth.ts", "utf8");
  assert.match(src, /decoded\.email_verified === true/);
});

// ── Consent ─────────────────────────────────────────────────────────────────
test("analytics consent is not bundled with sign-in and is withdrawn on sign-out", () => {
  const modal = readFileSync("src/components/AuthModal.tsx", "utf8");
  assert.doesNotMatch(modal, /consent to analytics cookies/i);
  assert.match(modal, /useState\(false\)[^\n]*\n?/);
  assert.match(
    modal,
    /const \[analyticsOptIn, setAnalyticsOptIn\] = useState\(false\)/,
  );

  const ctx = readFileSync("src/lib/AuthContext.tsx", "utf8");
  assert.doesNotMatch(ctx, /enableAnalytics\(/);
  assert.match(ctx, /setAnalyticsConsent\(false\)/);

  const firebase = readFileSync("src/lib/firebase.ts", "utf8");
  assert.match(
    firebase,
    /export function setAnalyticsConsent\(granted: boolean\)/,
  );
  assert.match(firebase, /setAnalyticsCollectionEnabled\(analytics, false\)/);
});

test("Google Fonts are self-hosted, not loaded from Google", () => {
  const html = readFileSync("index.html", "utf8");
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  const css = readFileSync("src/styles/fonts.css", "utf8");
  for (const match of css.matchAll(/url\("\/(fonts\/[^"]+)"\)/g)) {
    assert.ok(readFileSync(`public/${match[1]}`).length > 1000, match[1]);
  }
  const toml = readFileSync("netlify.toml", "utf8");
  const csp = toml.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)?.[1] ?? "";
  assert.doesNotMatch(csp, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});
