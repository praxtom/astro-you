import test from "node:test";
import assert from "node:assert/strict";
import {
  classifySubscriptionEvent,
  decideLapseAction,
  isStaleSubscriptionEvent,
  planSubscriptionEvent,
  RAZORPAY_MONTHLY_MAX_TOTAL_COUNT,
  SUBSCRIPTION_GRACE_DAYS,
} from "../shared/subscription-plans.js";

const env = {
  RAZORPAY_PREMIUM_PLAN_ID: "plan_premium",
  RAZORPAY_PRO_PLAN_ID: "plan_pro",
};
const NOW = new Date("2026-11-10T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const premiumActive = {
  tier: "premium",
  status: "active",
  razorpaySubscriptionId: "sub_premium",
  planId: "plan_premium",
  expiresAt: new Date(NOW.getTime() + 20 * DAY_MS),
  lastEventAt: 1_000,
};

const premiumWithPendingPro = {
  ...premiumActive,
  pendingSubscription: {
    tier: "pro",
    razorpaySubscriptionId: "sub_pro",
    status: "created",
    priceInr: 999,
    createdAt: new Date(NOW.getTime() - 60_000),
  },
};

function proSub(extra: Record<string, unknown> = {}) {
  return {
    id: "sub_pro",
    plan_id: "plan_pro",
    status: "active",
    current_start: 2_000,
    current_end: 2_000 + 30 * 86_400,
    charge_at: 2_000 + 30 * 86_400,
    ...extra,
  };
}

test("monthly subscriptions use Razorpay's longest term, not 12 cycles", () => {
  assert.equal(RAZORPAY_MONTHLY_MAX_TOTAL_COUNT, 1200);
});

test("classifySubscriptionEvent separates current, pending and superseded", () => {
  assert.equal(
    classifySubscriptionEvent(premiumWithPendingPro, "sub_premium"),
    "current",
  );
  assert.equal(
    classifySubscriptionEvent(premiumWithPendingPro, "sub_pro"),
    "pending",
  );
  assert.equal(
    classifySubscriptionEvent(premiumWithPendingPro, "sub_old"),
    "superseded",
  );
  // Legacy field name still counts as current.
  assert.equal(
    classifySubscriptionEvent({ razorpaySubId: "sub_legacy" }, "sub_legacy"),
    "current",
  );
  assert.equal(classifySubscriptionEvent(undefined, "sub_x"), "superseded");
});

test("a pending upgrade is promoted only by its own charge, and the old plan is cancelled", () => {
  const plan = planSubscriptionEvent({
    eventType: "subscription.charged",
    sub: proSub(),
    subscription: premiumWithPendingPro,
    eventCreatedAt: 2_100,
    now: NOW,
    env,
  });
  assert.equal(plan.role, "pending");
  assert.equal(plan.outcome, "promoted");
  assert.equal(plan.replaceSubscription?.tier, "pro");
  assert.equal(plan.replaceSubscription?.status, "active");
  assert.equal(plan.replaceSubscription?.razorpaySubscriptionId, "sub_pro");
  assert.equal(plan.replaceSubscription?.previousSubscriptionId, "sub_premium");
  assert.equal(plan.replaceSubscription?.lastEventAt, 2_100);
  assert.equal(
    "pendingSubscription" in (plan.replaceSubscription || {}),
    false,
  );
  assert.deepEqual(plan.cancelAtRazorpay, ["sub_premium"]);
  assert.equal(plan.grant?.tier, "pro");
  assert.equal(plan.grant?.amount, 1600);
  assert.equal(plan.grant?.ledgerId, "subscription_sub_pro_2000");
});

test("an already-cancelled old plan is not cancelled again on promotion", () => {
  const plan = planSubscriptionEvent({
    eventType: "subscription.activated",
    sub: proSub(),
    subscription: {
      ...premiumWithPendingPro,
      status: "cancelled",
      tier: "free",
    },
    now: NOW,
    env,
  });
  assert.equal(plan.outcome, "promoted");
  assert.deepEqual(plan.cancelAtRazorpay, []);
});

test("the old Premium's cancel event after an upgrade never drops the Pro payer to free", () => {
  const proCurrent = {
    tier: "pro",
    status: "active",
    razorpaySubscriptionId: "sub_pro",
    previousSubscriptionId: "sub_premium",
    lastEventAt: 2_100,
  };
  for (const eventType of [
    "subscription.cancelled",
    "subscription.halted",
    "subscription.paused",
    "subscription.pending",
    "subscription.completed",
    "subscription.resumed",
  ]) {
    const plan = planSubscriptionEvent({
      eventType,
      sub: { id: "sub_premium", plan_id: "plan_premium", status: "cancelled" },
      subscription: proCurrent,
      eventCreatedAt: 2_200,
      now: NOW,
      env,
    });
    assert.equal(plan.role, "superseded", eventType);
    assert.equal(plan.outcome, "superseded", eventType);
    assert.equal(plan.mergeSubscription, undefined, eventType);
    assert.equal(plan.replaceSubscription, undefined, eventType);
    assert.equal(plan.grant, undefined, eventType);
  }
});

test("a late charge on a superseded subscription grants credits but never the tier, and stops it", () => {
  const plan = planSubscriptionEvent({
    eventType: "subscription.charged",
    sub: {
      id: "sub_premium",
      plan_id: "plan_premium",
      status: "active",
      current_start: 1_500,
    },
    subscription: {
      tier: "pro",
      status: "active",
      razorpaySubscriptionId: "sub_pro",
    },
    now: NOW,
    env,
  });
  assert.equal(plan.outcome, "superseded");
  assert.equal(plan.mergeSubscription, undefined);
  assert.equal(plan.replaceSubscription, undefined);
  assert.equal(plan.grant?.tier, "premium");
  assert.equal(plan.grant?.amount, 700);
  assert.deepEqual(plan.cancelAtRazorpay, ["sub_premium"]);
});

test("cancel/halt of the pending checkout clears it and leaves the current plan alone", () => {
  const plan = planSubscriptionEvent({
    eventType: "subscription.cancelled",
    sub: proSub({ status: "cancelled" }),
    subscription: premiumWithPendingPro,
    now: NOW,
    env,
  });
  assert.equal(plan.outcome, "pending_cleared");
  assert.equal(plan.clearPending, true);
  assert.equal(plan.mergeSubscription, undefined);
  assert.deepEqual(plan.cancelAtRazorpay, []);
});

test("current subscription lifecycle events still apply", () => {
  const cancelled = planSubscriptionEvent({
    eventType: "subscription.cancelled",
    sub: { id: "sub_premium", plan_id: "plan_premium" },
    subscription: premiumActive,
    eventCreatedAt: 3_000,
    now: NOW,
    env,
  });
  assert.equal(cancelled.outcome, "updated");
  assert.equal(cancelled.mergeSubscription?.tier, "free");
  assert.equal(cancelled.mergeSubscription?.status, "cancelled");
  assert.equal(cancelled.mergeSubscription?.expiresAt, null);
  assert.equal(cancelled.mergeSubscription?.lastEventAt, 3_000);

  const pending = planSubscriptionEvent({
    eventType: "subscription.pending",
    sub: { id: "sub_premium", plan_id: "plan_premium", current_end: 4_000 },
    subscription: premiumActive,
    now: NOW,
    env,
  });
  assert.equal(pending.mergeSubscription?.status, "pending");
  assert.equal(
    (pending.mergeSubscription?.expiresAt as Date).getTime(),
    4_000_000 + SUBSCRIPTION_GRACE_DAYS * DAY_MS,
  );

  const renewal = planSubscriptionEvent({
    eventType: "subscription.charged",
    sub: {
      id: "sub_premium",
      plan_id: "plan_premium",
      current_start: 5_000,
      current_end: 6_000,
    },
    subscription: { ...premiumActive, status: "cancelling" },
    now: NOW,
    env,
  });
  assert.equal(renewal.outcome, "updated");
  // A cancel-at-period-end request survives a charge event.
  assert.equal(renewal.mergeSubscription?.status, "cancelling");
  assert.equal(renewal.grant?.ledgerId, "subscription_sub_premium_5000");
});

test("out-of-order delivery: an older event never undoes a newer one", () => {
  const afterCancel = {
    ...premiumActive,
    tier: "free",
    status: "cancelled",
    lastEventAt: 9_000,
  };
  assert.equal(isStaleSubscriptionEvent(afterCancel, 8_000), true);
  assert.equal(isStaleSubscriptionEvent(afterCancel, 9_000), false);
  assert.equal(isStaleSubscriptionEvent({}, 8_000), false);

  // A retried old `activated` arrives after the cancel: credits for that
  // already-paid period are still owed (idempotent ledger id), state is not.
  const lateActivated = planSubscriptionEvent({
    eventType: "subscription.activated",
    sub: { id: "sub_premium", plan_id: "plan_premium", current_start: 1_000 },
    subscription: afterCancel,
    eventCreatedAt: 8_000,
    now: NOW,
    env,
  });
  assert.equal(lateActivated.outcome, "stale");
  assert.equal(lateActivated.mergeSubscription, undefined);
  assert.equal(lateActivated.grant?.ledgerId, "subscription_sub_premium_1000");

  const latePending = planSubscriptionEvent({
    eventType: "subscription.pending",
    sub: { id: "sub_premium", plan_id: "plan_premium" },
    subscription: afterCancel,
    eventCreatedAt: 8_500,
    now: NOW,
    env,
  });
  assert.equal(latePending.outcome, "stale");
  assert.equal(latePending.mergeSubscription, undefined);
});

test("unknown plan ids still fail loudly instead of granting a tier", () => {
  assert.throws(() =>
    planSubscriptionEvent({
      eventType: "subscription.charged",
      sub: { id: "sub_premium", plan_id: "plan_unknown" },
      subscription: premiumActive,
      now: NOW,
      env,
    }),
  );
});

test("decideLapseAction re-checks inside the sweeper transaction", () => {
  const now = NOW.getTime();
  const old = new Date(now - (SUBSCRIPTION_GRACE_DAYS + 2) * DAY_MS);
  assert.equal(
    decideLapseAction(
      { tier: "premium", status: "halted", expiresAt: old },
      now,
    ),
    "lapse",
  );
  // A renewal moved expiresAt forward between query and transaction.
  assert.equal(
    decideLapseAction(
      {
        tier: "premium",
        status: "active",
        expiresAt: new Date(now + 20 * DAY_MS),
      },
      now,
    ),
    "keep",
  );
  assert.equal(
    decideLapseAction({ tier: "free", expiresAt: old }, now),
    "clear",
  );
});
