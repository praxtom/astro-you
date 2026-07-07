import test from "node:test";
import assert from "node:assert/strict";
import {
  hasSubscriptionLapsed,
  isPaidSubscriptionActive,
  subscriptionTimeMs,
  SUBSCRIPTION_GRACE_DAYS,
} from "../shared/subscription-plans.js";

const NOW = new Date("2026-07-01T00:00:00.000Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  return new Date(NOW + days * DAY_MS);
}

test("subscriptionTimeMs normalizes Date, Timestamp-like, string and number", () => {
  const date = new Date("2026-07-01T00:00:00.000Z");
  assert.equal(subscriptionTimeMs(date), date.getTime());
  assert.equal(subscriptionTimeMs({ toMillis: () => 123 }), 123);
  assert.equal(subscriptionTimeMs("2026-07-01T00:00:00.000Z"), date.getTime());
  assert.equal(subscriptionTimeMs(date.getTime()), date.getTime());
  assert.equal(subscriptionTimeMs(null), null);
  assert.equal(subscriptionTimeMs(undefined), null);
  assert.equal(subscriptionTimeMs("not-a-date"), null);
});

test("isPaidSubscriptionActive accepts paid tiers within the paid-through window", () => {
  assert.equal(
    isPaidSubscriptionActive(
      { tier: "premium", status: "active", expiresAt: daysFromNow(10) },
      NOW,
    ),
    true,
  );
  assert.equal(
    isPaidSubscriptionActive(
      { tier: "pro", status: "active", expiresAt: daysFromNow(10) },
      NOW,
    ),
    true,
  );
  // Missing expiresAt on an access-granting status stays active — revocation
  // paths always set status/tier.
  assert.equal(
    isPaidSubscriptionActive({ tier: "premium", status: "active" }, NOW),
    true,
  );
});

test("isPaidSubscriptionActive honors the grace window after expiry", () => {
  // Expired 1 day ago — inside the grace window.
  assert.equal(
    isPaidSubscriptionActive(
      { tier: "premium", status: "active", expiresAt: daysFromNow(-1) },
      NOW,
    ),
    true,
  );
  // Expired beyond the grace window.
  assert.equal(
    isPaidSubscriptionActive(
      {
        tier: "premium",
        status: "active",
        expiresAt: daysFromNow(-(SUBSCRIPTION_GRACE_DAYS + 1)),
      },
      NOW,
    ),
    false,
  );
});

test("isPaidSubscriptionActive covers cancel-at-period-end and pending grace", () => {
  // User cancelled at period end — still paid through expiresAt.
  assert.equal(
    isPaidSubscriptionActive(
      { tier: "premium", status: "cancelling", expiresAt: daysFromNow(10) },
      NOW,
    ),
    true,
  );
  // Renewal retrying — the pending webhook keeps expiresAt at grace end.
  assert.equal(
    isPaidSubscriptionActive(
      { tier: "pro", status: "pending", expiresAt: daysFromNow(2) },
      NOW,
    ),
    true,
  );
  // Final cycle done — paid through current_end.
  assert.equal(
    isPaidSubscriptionActive(
      { tier: "pro", status: "completed", expiresAt: daysFromNow(5) },
      NOW,
    ),
    true,
  );
});

test("isPaidSubscriptionActive rejects revoked, free and unknown states", () => {
  for (const status of [
    "cancelled",
    "halted",
    "paused",
    "expired",
    "created",
  ]) {
    assert.equal(
      isPaidSubscriptionActive(
        { tier: "premium", status, expiresAt: daysFromNow(10) },
        NOW,
      ),
      false,
      `status=${status} must not grant paid access`,
    );
  }
  assert.equal(
    isPaidSubscriptionActive(
      { tier: "free", status: "active", expiresAt: daysFromNow(10) },
      NOW,
    ),
    false,
  );
  assert.equal(isPaidSubscriptionActive(undefined, NOW), false);
  assert.equal(isPaidSubscriptionActive(null, NOW), false);
  assert.equal(
    isPaidSubscriptionActive({ tier: "premium" }, NOW),
    false,
    "missing status must not grant paid access",
  );
});

test("hasSubscriptionLapsed flags paid tiers past expiry plus grace, any status", () => {
  const pastGrace = daysFromNow(-(SUBSCRIPTION_GRACE_DAYS + 1));
  for (const status of [
    "active",
    "halted",
    "pending",
    "completed",
    "cancelling",
  ]) {
    assert.equal(
      hasSubscriptionLapsed(
        { tier: "premium", status, expiresAt: pastGrace },
        NOW,
      ),
      true,
      `status=${status} past grace must lapse`,
    );
  }
});

test("hasSubscriptionLapsed never lapses free tiers, missing dates, or in-grace subs", () => {
  assert.equal(
    hasSubscriptionLapsed(
      { tier: "free", status: "active", expiresAt: daysFromNow(-30) },
      NOW,
    ),
    false,
  );
  assert.equal(
    hasSubscriptionLapsed({ tier: "premium", status: "active" }, NOW),
    false,
  );
  assert.equal(
    hasSubscriptionLapsed(
      { tier: "premium", status: "active", expiresAt: daysFromNow(-1) },
      NOW,
    ),
    false,
    "inside the grace window must not lapse",
  );
  assert.equal(
    hasSubscriptionLapsed(
      { tier: "premium", status: "active", expiresAt: daysFromNow(10) },
      NOW,
    ),
    false,
  );
  assert.equal(hasSubscriptionLapsed(undefined, NOW), false);
});
