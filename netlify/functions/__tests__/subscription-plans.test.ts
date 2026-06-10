import test from "node:test";
import assert from "node:assert/strict";
import {
  getRazorpayPlanId,
  getSubscriptionGracePeriodEnd,
  resolveTierFromPlanId,
} from "../shared/subscription-plans.js";

test("getRazorpayPlanId reads required plan ids from environment", () => {
  const env = {
    RAZORPAY_PREMIUM_PLAN_ID: "plan_premium_live",
    RAZORPAY_PRO_PLAN_ID: "plan_pro_live",
  };

  assert.equal(getRazorpayPlanId("premium", env), "plan_premium_live");
  assert.equal(getRazorpayPlanId("pro", env), "plan_pro_live");
  assert.throws(() => getRazorpayPlanId("free", env), /not available/);
  assert.throws(() => getRazorpayPlanId("premium", {}), /Missing/);
});

test("resolveTierFromPlanId maps webhook plan ids back to tiers", () => {
  const env = {
    RAZORPAY_PREMIUM_PLAN_ID: "plan_premium_live",
    RAZORPAY_PRO_PLAN_ID: "plan_pro_live",
  };

  assert.equal(resolveTierFromPlanId("plan_premium_live", env), "premium");
  assert.equal(resolveTierFromPlanId("plan_pro_live", env), "pro");
  assert.equal(resolveTierFromPlanId("plan_contains_pro", env), "pro");
  assert.equal(resolveTierFromPlanId("plan_unknown", env), "premium");
});

test("getSubscriptionGracePeriodEnd adds exact days", () => {
  const now = new Date("2026-05-29T00:00:00.000Z");
  assert.equal(
    getSubscriptionGracePeriodEnd(now, 3).toISOString(),
    "2026-06-01T00:00:00.000Z",
  );
});
