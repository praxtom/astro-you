import test from "node:test";
import assert from "node:assert/strict";
import { buildLaunchReadinessReport } from "../shared/launch-readiness.js";

const VALID_FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
  project_id: "astroyou",
  client_email: "firebase-adminsdk@astroyou.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----\\n",
});

test("buildLaunchReadinessReport blocks launch when critical env is missing", () => {
  const report = buildLaunchReadinessReport({
    FIREBASE_SERVICE_ACCOUNT: "{}",
    VITE_FIREBASE_API_KEY: "client-key",
  });

  assert.equal(report.overallStatus, "blocked");
  assert.ok(report.summary.missingRequired > 0);
  assert.ok(
    report.groups
      .flatMap((group) => group.items)
      .some((item) => item.key === "RAZORPAY_KEY_SECRET" && item.status === "missing"),
  );
});

test("buildLaunchReadinessReport reports ready without exposing secret values", () => {
  const report = buildLaunchReadinessReport({
    FIREBASE_SERVICE_ACCOUNT: VALID_FIREBASE_SERVICE_ACCOUNT,
    FIREBASE_STORAGE_BUCKET: "astroyou.appspot.com",
    GEMINI_API_KEY: "gemini-secret",
    ASTROLOGY_API_KEY: "astro-secret",
    RAZORPAY_KEY_ID: "rzp_live_123",
    RAZORPAY_KEY_SECRET: "razorpay-secret",
    RAZORPAY_WEBHOOK_SECRET: "webhook-secret",
    RAZORPAY_PREMIUM_PLAN_ID: "plan_premium",
    RAZORPAY_PRO_PLAN_ID: "plan_pro",
    ASTROYOU_ADMIN_EMAILS: "admin@astroyou.app",
    APP_BASE_URL: "https://astroyou.app",
    OTP_HASH_SECRET: "otp-secret-at-least-32-characters-long",
    VITE_FIREBASE_API_KEY: "firebase-client-key",
    VITE_FIREBASE_AUTH_DOMAIN: "astroyou.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "astroyou",
    VITE_FIREBASE_STORAGE_BUCKET: "astroyou.appspot.com",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
    VITE_FIREBASE_APP_ID: "1:123:web:abc",
    VITE_RAZORPAY_KEY_ID: "rzp_live_123",
  });

  assert.equal(report.overallStatus, "ready");
  assert.equal(report.summary.missingRequired, 0);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("gemini-secret"), false);
  assert.equal(serialized.includes("razorpay-secret"), false);
  assert.equal(serialized.includes("firebase-client-key"), false);
});

test("buildLaunchReadinessReport warns when ASTROYOU_API_KEY fallback is overloaded", () => {
  const report = buildLaunchReadinessReport({
    FIREBASE_SERVICE_ACCOUNT: VALID_FIREBASE_SERVICE_ACCOUNT,
    FIREBASE_STORAGE_BUCKET: "bucket",
    ASTROYOU_API_KEY: "shared-secret",
    RAZORPAY_KEY_ID: "rzp_live_123",
    RAZORPAY_KEY_SECRET: "secret",
    RAZORPAY_WEBHOOK_SECRET: "secret",
    RAZORPAY_PREMIUM_PLAN_ID: "plan_premium",
    RAZORPAY_PRO_PLAN_ID: "plan_pro",
    ASTROYOU_ADMIN_EMAILS: "admin@astroyou.app",
    APP_BASE_URL: "https://astroyou.app",
    OTP_HASH_SECRET: "otp-secret-at-least-32-characters-long",
    VITE_FIREBASE_API_KEY: "client",
    VITE_FIREBASE_AUTH_DOMAIN: "domain",
    VITE_FIREBASE_PROJECT_ID: "project",
    VITE_FIREBASE_STORAGE_BUCKET: "bucket",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "sender",
    VITE_FIREBASE_APP_ID: "app",
    VITE_RAZORPAY_KEY_ID: "rzp_live_123",
  });

  assert.equal(report.overallStatus, "warning");
  assert.ok(report.warnings.some((warning) => /shared fallback/i.test(warning)));
  assert.equal(report.summary.warnings, report.warnings.length);
});

test("buildLaunchReadinessReport accepts client storage bucket as server fallback", () => {
  const report = buildLaunchReadinessReport({
    FIREBASE_SERVICE_ACCOUNT: "{}",
    VITE_FIREBASE_STORAGE_BUCKET: "bucket",
  });

  const storageItem = report.groups
    .flatMap((group) => group.items)
    .find((item) => item.key === "FIREBASE_STORAGE_BUCKET");

  assert.equal(storageItem?.status, "configured");
});

test("buildLaunchReadinessReport blocks invalid Firebase service account JSON", () => {
  const report = buildLaunchReadinessReport({
    FIREBASE_SERVICE_ACCOUNT: "{}",
    FIREBASE_STORAGE_BUCKET: "bucket",
    GEMINI_API_KEY: "gemini-secret",
    ASTROLOGY_API_KEY: "astro-secret",
    RAZORPAY_KEY_ID: "rzp_live_123",
    RAZORPAY_KEY_SECRET: "razorpay-secret",
    RAZORPAY_WEBHOOK_SECRET: "webhook-secret",
    RAZORPAY_PREMIUM_PLAN_ID: "plan_premium",
    RAZORPAY_PRO_PLAN_ID: "plan_pro",
    ASTROYOU_ADMIN_EMAILS: "admin@astroyou.app",
    APP_BASE_URL: "https://astroyou.app",
    OTP_HASH_SECRET: "otp-secret-at-least-32-characters-long",
    VITE_FIREBASE_API_KEY: "firebase-client-key",
    VITE_FIREBASE_AUTH_DOMAIN: "astroyou.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "astroyou",
    VITE_FIREBASE_STORAGE_BUCKET: "astroyou.appspot.com",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
    VITE_FIREBASE_APP_ID: "1:123:web:abc",
    VITE_RAZORPAY_KEY_ID: "rzp_live_123",
  });

  assert.equal(report.overallStatus, "blocked");
  assert.ok(report.warnings.some((warning) => /service account/i.test(warning)));
});

test("buildLaunchReadinessReport warns when client and server projects do not match", () => {
  const report = buildLaunchReadinessReport({
    FIREBASE_SERVICE_ACCOUNT: VALID_FIREBASE_SERVICE_ACCOUNT,
    FIREBASE_STORAGE_BUCKET: "bucket",
    GEMINI_API_KEY: "gemini-secret",
    ASTROLOGY_API_KEY: "astro-secret",
    RAZORPAY_KEY_ID: "rzp_live_123",
    RAZORPAY_KEY_SECRET: "razorpay-secret",
    RAZORPAY_WEBHOOK_SECRET: "webhook-secret",
    RAZORPAY_PREMIUM_PLAN_ID: "plan_premium",
    RAZORPAY_PRO_PLAN_ID: "plan_pro",
    ASTROYOU_ADMIN_EMAILS: "admin@astroyou.app",
    APP_BASE_URL: "https://astroyou.app",
    OTP_HASH_SECRET: "otp-secret-at-least-32-characters-long",
    VITE_FIREBASE_API_KEY: "firebase-client-key",
    VITE_FIREBASE_AUTH_DOMAIN: "other.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "other",
    VITE_FIREBASE_STORAGE_BUCKET: "bucket",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
    VITE_FIREBASE_APP_ID: "1:123:web:abc",
    VITE_RAZORPAY_KEY_ID: "rzp_live_123",
  });

  assert.equal(report.overallStatus, "warning");
  assert.ok(report.warnings.some((warning) => /project_id/i.test(warning)));
});

test("buildLaunchReadinessReport blocks placeholder production values", () => {
  const report = buildLaunchReadinessReport({
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
      project_id: "astroyou",
      client_email: "firebase-adminsdk@example.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\nREPLACE_ME\\n-----END PRIVATE KEY-----\\n",
    }),
    FIREBASE_STORAGE_BUCKET: "astroyou.appspot.com",
    GEMINI_API_KEY: "replace_me",
    ASTROLOGY_API_KEY: "replace_me",
    RAZORPAY_KEY_ID: "rzp_live_replace_me",
    RAZORPAY_KEY_SECRET: "replace_me",
    RAZORPAY_WEBHOOK_SECRET: "replace_me",
    RAZORPAY_PREMIUM_PLAN_ID: "plan_replace_me",
    RAZORPAY_PRO_PLAN_ID: "plan_replace_me",
    ASTROYOU_ADMIN_EMAILS: "admin@example.com",
    APP_BASE_URL: "https://astroyou.app",
    OTP_HASH_SECRET: "short",
    VITE_FIREBASE_API_KEY: "replace_me",
    VITE_FIREBASE_AUTH_DOMAIN: "astroyou.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "astroyou",
    VITE_FIREBASE_STORAGE_BUCKET: "astroyou.appspot.com",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "replace_me",
    VITE_FIREBASE_APP_ID: "replace_me",
    VITE_RAZORPAY_KEY_ID: "rzp_live_replace_me",
  });

  assert.equal(report.overallStatus, "blocked");
  assert.ok(report.warnings.some((warning) => /placeholder/i.test(warning)));
  assert.ok(report.warnings.some((warning) => /Admin emails/i.test(warning)));
});

test("buildLaunchReadinessReport does not downgrade placeholder shared fallback keys", () => {
  const report = buildLaunchReadinessReport({
    FIREBASE_SERVICE_ACCOUNT: VALID_FIREBASE_SERVICE_ACCOUNT,
    FIREBASE_STORAGE_BUCKET: "astroyou.appspot.com",
    ASTROYOU_API_KEY: "replace_me",
    RAZORPAY_KEY_ID: "rzp_live_123",
    RAZORPAY_KEY_SECRET: "razorpay-secret",
    RAZORPAY_WEBHOOK_SECRET: "webhook-secret",
    RAZORPAY_PREMIUM_PLAN_ID: "plan_premium",
    RAZORPAY_PRO_PLAN_ID: "plan_pro",
    ASTROYOU_ADMIN_EMAILS: "admin@astroyou.app",
    APP_BASE_URL: "https://astroyou.app",
    OTP_HASH_SECRET: "otp-secret-at-least-32-characters-long",
    VITE_FIREBASE_API_KEY: "firebase-client-key",
    VITE_FIREBASE_AUTH_DOMAIN: "astroyou.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "astroyou",
    VITE_FIREBASE_STORAGE_BUCKET: "astroyou.appspot.com",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
    VITE_FIREBASE_APP_ID: "1:123:web:abc",
    VITE_RAZORPAY_KEY_ID: "rzp_live_123",
  });

  assert.equal(report.overallStatus, "blocked");
  assert.ok(report.warnings.some((warning) => /placeholder/i.test(warning)));
});

test("buildLaunchReadinessReport blocks missing or weak OTP hash secret", () => {
  const report = buildLaunchReadinessReport({
    FIREBASE_SERVICE_ACCOUNT: VALID_FIREBASE_SERVICE_ACCOUNT,
    FIREBASE_STORAGE_BUCKET: "astroyou.appspot.com",
    GEMINI_API_KEY: "gemini-secret",
    ASTROLOGY_API_KEY: "astro-secret",
    RAZORPAY_KEY_ID: "rzp_live_123",
    RAZORPAY_KEY_SECRET: "razorpay-secret",
    RAZORPAY_WEBHOOK_SECRET: "webhook-secret",
    RAZORPAY_PREMIUM_PLAN_ID: "plan_premium",
    RAZORPAY_PRO_PLAN_ID: "plan_pro",
    ASTROYOU_ADMIN_EMAILS: "admin@astroyou.app",
    APP_BASE_URL: "https://astroyou.app",
    OTP_HASH_SECRET: "too-short",
    VITE_FIREBASE_API_KEY: "firebase-client-key",
    VITE_FIREBASE_AUTH_DOMAIN: "astroyou.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "astroyou",
    VITE_FIREBASE_STORAGE_BUCKET: "astroyou.appspot.com",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
    VITE_FIREBASE_APP_ID: "1:123:web:abc",
    VITE_RAZORPAY_KEY_ID: "rzp_live_123",
  });

  assert.equal(report.overallStatus, "blocked");
  const otpItem = report.groups
    .flatMap((group) => group.items)
    .find((item) => item.key === "OTP_HASH_SECRET");

  assert.equal(otpItem?.status, "missing");
  assert.ok(report.warnings.some((warning) => /OTP hash secret/i.test(warning)));
});
