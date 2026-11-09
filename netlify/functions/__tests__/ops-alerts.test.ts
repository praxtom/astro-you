import test from "node:test";
import assert from "node:assert/strict";
import {
  assessJobFreshness,
  buildOpsEventId,
  buildOpsWebhookPayload,
  buildOpsEventRecord,
  recordJobRun,
  reportOpsEvent,
  sanitizeOpsDetails,
  type JobRunRecord,
  type OpsEventRecord,
  type OpsStore,
} from "../shared/ops-alerts.js";
import { hasDigestOptIn } from "../shared/digest.js";
import { notifyAdminsOfSupportTicket } from "../shared/support-tickets.js";
import { buildAdminSummaryFromAggregates } from "../shared/admin-summary.js";
import { buildOpsHealthView } from "../shared/admin-operations.js";
import { buildLaunchReadinessReport } from "../shared/launch-readiness.js";

function memoryStore() {
  const events = new Map<string, OpsEventRecord & { count: number }>();
  const runs = new Map<string, JobRunRecord>();
  let auto = 0;
  const store: OpsStore = {
    async writeEvent(id, record) {
      const key = id ?? `auto_${auto++}`;
      const existing = events.get(key);
      if (existing) {
        existing.count += 1;
        return "duplicate";
      }
      events.set(key, { ...record });
      return "created";
    },
    async writeJobRun(job, record) {
      runs.set(job, { ...runs.get(job), ...record });
    },
  };
  return { store, events, runs };
}

function fakeFetch() {
  const calls: Array<{ url: string; body: any; headers: any }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      body: JSON.parse(String(init.body)),
      headers: init.headers,
    });
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("sanitizeOpsDetails drops PII keys and redacts emails in values", () => {
  const out = sanitizeOpsDetails({
    uid: "user_1",
    email: "a@b.com",
    userName: "Asha",
    dob: "1990-01-01",
    apiKey: "secret",
    note: "failed for asha@example.com today",
    count: 3,
    huge: "x".repeat(500),
  });
  assert.equal(out.uid, "user_1");
  assert.equal("email" in out, false);
  assert.equal("userName" in out, false);
  assert.equal("dob" in out, false);
  assert.equal("apiKey" in out, false);
  assert.equal(out.note, "failed for [redacted] today");
  assert.equal(out.count, 3);
  assert.equal(String(out.huge).length, 160);
});

test("reportOpsEvent stores with TTL and pages the webhook once per dedupe window", async () => {
  const { store, events } = memoryStore();
  const { impl, calls } = fakeFetch();
  const now = new Date("2026-11-10T01:30:00.000Z");
  const env = {
    OPS_ALERT_WEBHOOK_URL: "https://hooks.slack.com/services/x",
    CONTEXT: "production",
  };
  const first = await reportOpsEvent(
    "payment_credits_not_granted",
    { uid: "u1", orderId: "order_1" },
    { store, fetchImpl: impl, env, now: () => now, dedupeKey: "order_1" },
  );
  const second = await reportOpsEvent(
    "payment_credits_not_granted",
    { uid: "u1", orderId: "order_1" },
    { store, fetchImpl: impl, env, now: () => now, dedupeKey: "order_1" },
  );
  assert.deepEqual(first, { stored: true, paged: true, duplicate: false });
  assert.deepEqual(second, { stored: true, paged: false, duplicate: true });
  assert.equal(calls.length, 1);
  assert.match(calls[0].body.text, /CRITICAL|WARNING/);
  assert.match(calls[0].body.text, /payment_credits_not_granted/);
  assert.equal(calls[0].body.content, calls[0].body.text);
  const [record] = [...events.values()];
  assert.equal(record.count, 2);
  assert.equal(record.context, "production");
  assert.equal(
    record.expiresAt.getTime() - now.getTime(),
    30 * 24 * 60 * 60 * 1000,
  );
});

test("reportOpsEvent never throws when storage and webhook fail", async () => {
  const brokenStore: OpsStore = {
    writeEvent: async () => {
      throw new Error("firestore down");
    },
    writeJobRun: async () => {
      throw new Error("firestore down");
    },
  };
  const failingFetch = (async () => {
    throw new Error("network");
  }) as unknown as typeof fetch;
  const result = await reportOpsEvent(
    "job_failed",
    { job: "x" },
    {
      store: brokenStore,
      fetchImpl: failingFetch,
      env: { OPS_ALERT_WEBHOOK_URL: "https://example.invalid/hook" },
    },
  );
  assert.deepEqual(result, { stored: false, paged: false, duplicate: false });
  await recordJobRun(
    "daily-digest",
    { ok: false },
    { store: brokenStore, fetchImpl: failingFetch, env: {} },
  );
});

test("webhook is skipped without an https OPS_ALERT_WEBHOOK_URL", async () => {
  const { store } = memoryStore();
  const { impl, calls } = fakeFetch();
  await reportOpsEvent("job_failed", {}, { store, fetchImpl: impl, env: {} });
  await reportOpsEvent(
    "job_failed",
    {},
    { store, fetchImpl: impl, env: { OPS_ALERT_WEBHOOK_URL: "http://x" } },
  );
  assert.equal(calls.length, 0);
});

test("buildOpsEventId buckets by window and slugs the kind", () => {
  const now = new Date("2026-11-10T01:30:00.000Z");
  assert.equal(buildOpsEventId("Job Failed!", undefined, now), undefined);
  const a = buildOpsEventId("job_failed", "daily-digest", now);
  const b = buildOpsEventId(
    "job_failed",
    "daily-digest",
    new Date(now.getTime() + 10 * 60 * 1000),
  );
  assert.equal(a, b);
  assert.match(a!, /^job_failed__daily-digest__\d+$/);
});

test("buildOpsWebhookPayload includes context and sanitized details only", () => {
  const record = buildOpsEventRecord(
    "email_provider_error",
    { job: "daily-digest", email: "x@y.com" },
    "critical",
    new Date(),
    { CONTEXT: "production", SITE_NAME: "astroyou" },
  );
  const payload = buildOpsWebhookPayload(record, { SITE_NAME: "astroyou" });
  assert.match(
    payload.text,
    /^\[astroyou\/production\] CRITICAL email_provider_error/,
  );
  assert.equal(payload.text.includes("x@y.com"), false);
});

test("recordJobRun keeps lastOkAt across failures and alerts on failure", async () => {
  const { store, runs, events } = memoryStore();
  const t1 = new Date("2026-11-09T01:45:00.000Z");
  const t2 = new Date("2026-11-10T01:45:00.000Z");
  await recordJobRun(
    "daily-digest",
    { ok: true, processed: 10 },
    { store, now: () => t1, env: {} },
  );
  await recordJobRun(
    "daily-digest",
    { ok: false, processed: 2, failed: 1 },
    { store, now: () => t2, env: {} },
  );
  const run = runs.get("daily-digest")!;
  assert.equal(run.ok, false);
  assert.equal(run.lastOkAt?.toISOString(), t1.toISOString());
  assert.equal(run.lastRunAt.toISOString(), t2.toISOString());
  assert.equal(run.expectedIntervalMs, 24 * 60 * 60 * 1000);
  assert.ok([...events.values()].some((e) => e.kind === "job_failed"));
});

test("assessJobFreshness flags jobs not succeeding within 2x their schedule", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  const hour = 60 * 60 * 1000;
  const result = assessJobFreshness(
    [
      { id: "daily-digest", lastOkAt: new Date(now.getTime() - 30 * hour) },
      { id: "brain-nudges", lastOkAt: new Date(now.getTime() - 3 * hour) },
      { id: "never-ok", lastRunAt: now, ok: false },
      {
        id: "custom",
        expectedIntervalMs: hour,
        lastOkAt: { toDate: () => new Date(now.getTime() - 90 * 60 * 1000) },
      },
    ],
    now,
  );
  const stale = Object.fromEntries(result.map((r) => [r.job, r.stale]));
  assert.deepEqual(stale, {
    "daily-digest": false,
    "brain-nudges": true,
    "never-ok": true,
    custom: false,
  });
});

test("hasDigestOptIn requires an explicit true", () => {
  assert.equal(hasDigestOptIn({}), false);
  assert.equal(hasDigestOptIn({ profile: { name: "A" } }), false);
  assert.equal(
    hasDigestOptIn({ profile: { notificationPrefs: { emailDigest: false } } }),
    false,
  );
  assert.equal(
    hasDigestOptIn({ profile: { notificationPrefs: { emailDigest: true } } }),
    true,
  );
  assert.equal(
    hasDigestOptIn({ notificationPrefs: { emailDigest: true } }),
    true,
  );
  assert.equal(hasDigestOptIn(null), false);
});

test("notifyAdminsOfSupportTicket emails admins without requester PII", async () => {
  const { impl, calls } = fakeFetch();
  const sent = await notifyAdminsOfSupportTicket(
    {
      ticketId: "t_1",
      category: "refund",
      priority: "urgent",
      subject: "Charged twice\r\nBcc: evil@x.com",
    },
    {
      fetchImpl: impl,
      env: {
        RESEND_API_KEY: "re_key",
        ASTROYOU_ADMIN_EMAILS: "ops@astroyou.app, bad-entry",
        DIGEST_FROM_EMAIL: "AstroYou <noreply@astroyou.app>",
        APP_BASE_URL: "https://astroyou.app",
      },
    },
  );
  assert.equal(sent, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.to, ["ops@astroyou.app"]);
  assert.match(
    calls[0].body.subject,
    /^\[URGENT\] New support ticket \(refund\)/,
  );
  assert.equal(/[\r\n]/.test(calls[0].body.subject), false);
  assert.equal(calls[0].headers["Idempotency-Key"], "support_ticket_t_1");
});

test("notifyAdminsOfSupportTicket is a no-op without config and never throws", async () => {
  const { impl, calls } = fakeFetch();
  assert.equal(
    await notifyAdminsOfSupportTicket(
      { ticketId: "t", category: "other", priority: "normal", subject: "s" },
      { fetchImpl: impl, env: {} },
    ),
    false,
  );
  assert.equal(calls.length, 0);
  const throwing = (async () => {
    throw new Error("timeout");
  }) as unknown as typeof fetch;
  assert.equal(
    await notifyAdminsOfSupportTicket(
      { ticketId: "t", category: "other", priority: "normal", subject: "s" },
      {
        fetchImpl: throwing,
        env: { RESEND_API_KEY: "k", ASTROYOU_ADMIN_EMAILS: "a@b.co" },
      },
    ),
    false,
  );
});

test("buildAdminSummaryFromAggregates uses exact counts and list-price MRR", () => {
  const summary = buildAdminSummaryFromAggregates({
    totalUsers: 2000,
    premiumUsers: 30,
    proUsers: 10,
    premiumPriceSum: 2 * 399,
    premiumPricedUsers: 2,
    creditsOutstanding: 12345,
    creditsUsed: 678,
    recentUsers: [
      { id: "u1", email: "a@b.co", subscription: { tier: "pro" }, credits: 3 },
    ],
  });
  assert.equal(summary.totalUsers, 2000);
  assert.equal(summary.payingUsers, 40);
  assert.equal(summary.paidConversionRate, 2);
  assert.equal(summary.estimatedMrr, 2 * 399 + 28 * 499 + 10 * 999);
  assert.equal(summary.totalCreditsOutstanding, 12345);
  assert.equal(summary.source, "aggregate");
  assert.equal(summary.recentUsers[0].tier, "pro");
});

test("buildOpsHealthView lists events and stale jobs", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  const view = buildOpsHealthView(
    [
      {
        id: "e1",
        kind: "job_failed",
        severity: "critical",
        details: { job: "daily-digest" },
        createdAt: now,
      },
    ],
    [
      {
        id: "consult-reaper",
        job: "consult-reaper",
        ok: true,
        lastOkAt: new Date(now.getTime() - 60 * 60 * 1000),
        processed: 4,
      },
    ],
    now,
  );
  assert.equal(view.opsEvents[0].kind, "job_failed");
  assert.equal(view.opsEvents[0].createdAt, now.toISOString());
  assert.deepEqual(view.staleJobs, ["consult-reaper"]);
  assert.equal(view.jobs[0].processed, 4);
});

const READY_ENV = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    project_id: "astroyou",
    client_email: "firebase-adminsdk@astroyou.iam.gserviceaccount.com",
    private_key:
      "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----\\n",
  }),
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
  EMAIL_UNSUB_SECRET: "email-unsub-secret-at-least-32-characters-long",
  RESEND_API_KEY: "re_secret",
  DIGEST_FROM_EMAIL: "AstroYou <noreply@astroyou.app>",
  VITE_FIREBASE_API_KEY: "firebase-client-key",
  VITE_FIREBASE_AUTH_DOMAIN: "astroyou.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "astroyou",
  VITE_FIREBASE_STORAGE_BUCKET: "astroyou.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
  VITE_FIREBASE_APP_ID: "1:123:web:abc",
  VITE_RAZORPAY_KEY_ID: "rzp_live_123",
};

function item(
  report: ReturnType<typeof buildLaunchReadinessReport>,
  key: string,
) {
  return report.groups.flatMap((g) => g.items).find((i) => i.key === key);
}

test("launch gate requires Resend key and sender address", () => {
  const { RESEND_API_KEY: _r, DIGEST_FROM_EMAIL: _d, ...rest } = READY_ENV;
  const report = buildLaunchReadinessReport(rest);
  assert.equal(report.overallStatus, "blocked");
  assert.equal(item(report, "RESEND_API_KEY")?.status, "missing");
  assert.equal(item(report, "DIGEST_FROM_EMAIL")?.status, "missing");

  const bad = buildLaunchReadinessReport({
    ...READY_ENV,
    DIGEST_FROM_EMAIL: "AstroYou",
  });
  assert.equal(bad.overallStatus, "blocked");
  assert.equal(
    buildLaunchReadinessReport({
      ...READY_ENV,
      DIGEST_FROM_EMAIL: "noreply@astroyou.app",
    }).overallStatus,
    "ready",
  );
  assert.equal(item(report, "VITE_SENTRY_DSN")?.required, false);
});

test("launch gate checks Razorpay key mode against the Netlify deploy context", () => {
  const previewLive = buildLaunchReadinessReport({
    ...READY_ENV,
    CONTEXT: "deploy-preview",
  });
  assert.equal(previewLive.overallStatus, "warning");
  assert.ok(
    previewLive.warnings.some((w) =>
      /rzp_test keys outside production/.test(w),
    ),
  );

  const prodTest = buildLaunchReadinessReport({
    ...READY_ENV,
    CONTEXT: "production",
    RAZORPAY_KEY_ID: "rzp_test_123",
    VITE_RAZORPAY_KEY_ID: "rzp_test_123",
  });
  assert.equal(prodTest.overallStatus, "blocked");
  assert.equal(item(prodTest, "RAZORPAY_KEY_ID")?.status, "missing");

  assert.equal(
    buildLaunchReadinessReport({ ...READY_ENV, CONTEXT: "production" })
      .overallStatus,
    "ready",
  );
  assert.equal(
    buildLaunchReadinessReport({
      ...READY_ENV,
      CONTEXT: "branch-deploy",
      RAZORPAY_KEY_ID: "rzp_test_1",
      VITE_RAZORPAY_KEY_ID: "rzp_test_1",
    }).overallStatus,
    "ready",
  );
});
