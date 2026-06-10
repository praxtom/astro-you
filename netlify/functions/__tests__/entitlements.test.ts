import test from "node:test";
import assert from "node:assert/strict";
import {
  canUseFeature,
  getEntitlements,
  getUsageLimit,
  resolveTier,
} from "../shared/entitlements.js";

test("resolveTier safely defaults to free", () => {
  assert.equal(resolveTier("premium"), "premium");
  assert.equal(resolveTier("enterprise"), "free");
  assert.equal(resolveTier(undefined), "free");
});

test("canUseFeature reads from the shared entitlement table", () => {
  assert.equal(canUseFeature("free", "free_kundali"), true);
  assert.equal(canUseFeature("free", "monthly_report"), false);
  assert.equal(canUseFeature("premium", "monthly_report"), true);
  assert.equal(canUseFeature("pro", "astrocartography"), true);
});

test("getUsageLimit returns numeric plan limits", () => {
  assert.equal(getUsageLimit("free", "monthlyCredits"), 15);
  assert.equal(getUsageLimit("premium", "monthlyCredits"), 900);
  assert.equal(getUsageLimit("pro", "monthlyCredits"), 2200);
  assert.equal(getEntitlements("pro").displayName, "Pro");
});
