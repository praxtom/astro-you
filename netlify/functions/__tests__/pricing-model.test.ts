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

// ── Multi-currency pricing ──────────────────────────────────────────────────

import { SUPPORTED_CURRENCIES } from "../../../src/lib/currency.js";
import { CREDIT_PACKS, getPackAmount } from "../../../src/lib/credit-packs.js";

test("every credit pack is priced in every supported currency", () => {
  for (const pack of CREDIT_PACKS) {
    for (const currency of SUPPORTED_CURRENCIES) {
      const amount = getPackAmount(pack, currency);
      assert.equal(
        typeof amount,
        "number",
        `${pack.minutes} has no ${currency} price`,
      );
      assert.ok(amount > 0, `${pack.minutes} is free in ${currency}`);
    }
  }
});

test("the INR pack amount still matches the legacy rupee field", () => {
  // razorpay-payments and the Wallet page still read amountInRupees.
  for (const pack of CREDIT_PACKS) {
    assert.equal(getPackAmount(pack, "INR"), pack.amountInRupees);
  }
});

test("a bigger credit pack never costs less, in any currency", () => {
  for (const currency of SUPPORTED_CURRENCIES) {
    const amounts = CREDIT_PACKS.map((p) => getPackAmount(p, currency));
    const minutes = CREDIT_PACKS.map((p) => p.minutes);
    for (let i = 1; i < amounts.length; i += 1) {
      if (minutes[i] > minutes[i - 1]) {
        assert.ok(
          amounts[i] > amounts[i - 1],
          `${currency}: ${minutes[i]} min costs ${amounts[i]}, but ${minutes[i - 1]} min costs ${amounts[i - 1]}`,
        );
      }
    }
  }
});

test("every tier is priced in every supported currency", () => {
  for (const tier of ["free", "premium", "pro"] as const) {
    for (const currency of SUPPORTED_CURRENCIES) {
      const price = ENTITLEMENTS[tier].monthlyPrices[currency];
      assert.equal(typeof price, "number", `${tier} has no ${currency} price`);
    }
    // The legacy field must keep agreeing with the INR entry.
    assert.equal(
      ENTITLEMENTS[tier].monthlyPrices.INR,
      ENTITLEMENTS[tier].monthlyPriceInr,
    );
  }
  assert.equal(ENTITLEMENTS.free.monthlyPrices.USD, 0);
  assert.ok(
    ENTITLEMENTS.pro.monthlyPrices.USD > ENTITLEMENTS.premium.monthlyPrices.USD,
  );
});
