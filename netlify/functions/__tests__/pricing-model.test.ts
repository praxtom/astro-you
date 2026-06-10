import test from "node:test";
import assert from "node:assert/strict";
import { ENTITLEMENTS } from "../../../src/lib/entitlements.js";
import { REPORT_PRICING } from "../../../src/lib/report-pricing.js";
import { REPORT_PRODUCTS } from "../shared/reports.js";

test("subscription pricing stays aligned with the final pricing model", () => {
  assert.equal(ENTITLEMENTS.free.monthlyPriceInr, 0);
  assert.equal(ENTITLEMENTS.free.limits.monthlyCredits, 15);
  assert.equal(ENTITLEMENTS.free.limits.consultMinutesPerMonth, 3);

  assert.equal(ENTITLEMENTS.premium.monthlyPriceInr, 499);
  assert.equal(ENTITLEMENTS.premium.limits.monthlyCredits, 700);
  assert.equal(ENTITLEMENTS.premium.limits.consultMinutesPerMonth, 140);

  assert.equal(ENTITLEMENTS.pro.monthlyPriceInr, 999);
  assert.equal(ENTITLEMENTS.pro.limits.monthlyCredits, 1600);
  assert.equal(ENTITLEMENTS.pro.limits.consultMinutesPerMonth, 320);
});

test("server report products use the shared report pricing table", () => {
  for (const [type, pricing] of Object.entries(REPORT_PRICING)) {
    assert.equal(REPORT_PRODUCTS[type as keyof typeof REPORT_PRODUCTS].creditCost, pricing.creditCost);
    assert.equal(REPORT_PRODUCTS[type as keyof typeof REPORT_PRODUCTS].title, pricing.title);
  }
});
