import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCurrency,
  toMinorUnits,
  formatMoney,
  detectCurrency,
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
} from "../../../src/lib/currency.js";

test("INR stays the default currency", () => {
  assert.equal(DEFAULT_CURRENCY, "INR");
  assert.equal(normalizeCurrency(undefined), "INR");
  assert.equal(normalizeCurrency("EUR"), "INR"); // unsupported -> default
  assert.equal(normalizeCurrency(null), "INR");
  assert.equal(normalizeCurrency(42), "INR");
});

test("normalizeCurrency accepts supported codes case-insensitively", () => {
  assert.equal(normalizeCurrency("USD"), "USD");
  assert.equal(normalizeCurrency("usd"), "USD");
  assert.equal(normalizeCurrency("inr"), "INR");
});

test("both supported currencies use 100 minor units", () => {
  assert.equal(toMinorUnits(499, "INR"), 49900);
  assert.equal(toMinorUnits(9.99, "USD"), 999);
});

test("toMinorUnits rounds rather than truncating float error", () => {
  // 19.99 * 100 is 1998.9999999999998 in IEEE-754; truncating undercharges.
  assert.equal(toMinorUnits(19.99, "USD"), 1999);
  assert.equal(toMinorUnits(0.1 + 0.2, "USD"), 30);
  assert.equal(toMinorUnits(29.99, "USD"), 2999);
});

test("toMinorUnits rejects negative and non-finite amounts", () => {
  assert.throws(() => toMinorUnits(-1, "USD"));
  assert.throws(() => toMinorUnits(Number.NaN, "USD"));
  assert.throws(() => toMinorUnits(Number.POSITIVE_INFINITY, "INR"));
});

test("toMinorUnits allows a genuinely free product", () => {
  assert.equal(toMinorUnits(0, "INR"), 0);
});

test("formatMoney emits the right symbol for each currency", () => {
  assert.match(formatMoney(499, "INR", "en-IN"), /₹/);
  assert.match(formatMoney(9.99, "USD", "en-US"), /\$/);
});

test("formatMoney shows no decimals for whole amounts", () => {
  assert.equal(formatMoney(499, "INR", "en-IN").includes(".00"), false);
  assert.equal(formatMoney(10, "USD", "en-US").includes(".00"), false);
});

test("formatMoney keeps cents when they are significant", () => {
  assert.match(formatMoney(9.99, "USD", "en-US"), /9\.99/);
});

test("detectCurrency picks USD for US locales and INR for Indian ones", () => {
  assert.equal(detectCurrency("en-US"), "USD");
  assert.equal(detectCurrency("en-IN"), "INR");
  assert.equal(detectCurrency("hi-IN"), "INR");
});

test("detectCurrency falls back to the timezone when the locale is bare", () => {
  assert.equal(detectCurrency("en", "America/Denver"), "USD");
  assert.equal(detectCurrency("en", "Asia/Kolkata"), "INR");
});

test("detectCurrency defaults to INR for anything unrecognised", () => {
  // A wrong currency is worse than the default, so never guess wildly.
  assert.equal(detectCurrency(null, null), "INR");
  assert.equal(detectCurrency("fr-FR", "Europe/Paris"), "INR");
  assert.equal(detectCurrency(undefined, undefined), "INR");
});

test("every supported currency round-trips through normalizeCurrency", () => {
  for (const code of SUPPORTED_CURRENCIES) {
    assert.equal(normalizeCurrency(code), code);
  }
});
