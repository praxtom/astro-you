import test from "node:test";
import assert from "node:assert/strict";
import {
  ENTITLEMENTS as SERVER_ENTITLEMENTS,
  SUBSCRIPTION_GRACE_DAYS as SERVER_GRACE_DAYS,
} from "../shared/entitlements.js";
import {
  ENTITLEMENTS as CLIENT_ENTITLEMENTS,
  SUBSCRIPTION_GRACE_DAYS as CLIENT_GRACE_DAYS,
} from "../../../src/lib/entitlements.js";

// The client file (src/lib/entitlements.ts) is what the Pricing page and all
// feature gates advertise; the server file (netlify/functions/shared/
// entitlements.ts) is what webhooks actually grant. Any drift between them
// means users are sold one thing and given another.
test("server and client entitlement matrices are deeply equal", () => {
  assert.deepEqual(SERVER_ENTITLEMENTS, CLIENT_ENTITLEMENTS);
});

test("server entitlements match the advertised Pricing-page numbers", () => {
  assert.equal(SERVER_ENTITLEMENTS.premium.limits.monthlyCredits, 700);
  assert.equal(SERVER_ENTITLEMENTS.premium.limits.consultMinutesPerMonth, 140);
  assert.equal(SERVER_ENTITLEMENTS.pro.limits.monthlyCredits, 1600);
  assert.equal(SERVER_ENTITLEMENTS.pro.limits.consultMinutesPerMonth, 320);

  // The top-level monthlyCredits mirrors limits.monthlyCredits in each tier.
  for (const tier of ["free", "premium", "pro"] as const) {
    assert.equal(
      SERVER_ENTITLEMENTS[tier].monthlyCredits,
      SERVER_ENTITLEMENTS[tier].limits.monthlyCredits,
    );
  }
});

test("subscription grace window stays aligned between client and server", () => {
  assert.equal(SERVER_GRACE_DAYS, CLIENT_GRACE_DAYS);
});
