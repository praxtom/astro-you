import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  buildTopupOrderOptions,
  getTopupProduct,
  isPaymentValidationError,
  listTopupProducts,
  PaymentValidationError,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "../shared/razorpay-payments.js";
import { CREDIT_PACKS } from "../../../src/lib/credit-packs.js";

test("getTopupProduct only accepts configured credit packs", () => {
  assert.deepEqual(getTopupProduct(120), {
    minutes: 120,
    amountInRupees: 99,
    currency: "INR",
  });
  assert.throws(() => getTopupProduct(60), /Unsupported credit pack/);
});

test("server topup products stay aligned with client credit packs", () => {
  assert.deepEqual(
    listTopupProducts().map(({ minutes, amountInRupees }) => ({
      minutes,
      amountInRupees,
    })),
    CREDIT_PACKS.map(({ minutes, amountInRupees }) => ({
      minutes,
      amountInRupees,
    })),
  );
});

test("buildTopupOrderOptions binds order notes to authenticated user", () => {
  const order = buildTopupOrderOptions({
    uid: "user_123",
    minutes: 120,
    expectedAmountInRupees: 99,
    now: 1_800_000,
  });

  assert.equal(order.amount, 9900);
  assert.equal(order.currency, "INR");
  assert.equal(order.receipt, "topup_user_123_1800000");
  assert.deepEqual(order.notes, {
    uid: "user_123",
    minutes: "120",
    type: "credit_topup",
  });
});

test("buildTopupOrderOptions rejects tampered amount", () => {
  assert.throws(
    () =>
      buildTopupOrderOptions({
        uid: "user_123",
        minutes: 120,
        expectedAmountInRupees: 1,
        now: 1_800_000,
      }),
    /does not match/,
  );
});

test("invalid topup requests raise payment validation errors", () => {
  assert.throws(() => getTopupProduct(60), PaymentValidationError);

  try {
    buildTopupOrderOptions({
      uid: "user_123",
      minutes: 120,
      expectedAmountInRupees: 1,
    });
    assert.fail("Expected tampered amount to throw");
  } catch (error) {
    assert.equal(isPaymentValidationError(error), true);
  }
});

test("verifyCheckoutSignature validates Razorpay checkout signatures", () => {
  const secret = "test_secret";
  const orderId = "order_123";
  const paymentId = "pay_123";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  assert.equal(
    verifyCheckoutSignature({ orderId, paymentId, signature, secret }),
    true,
  );
  assert.equal(
    verifyCheckoutSignature({
      orderId,
      paymentId,
      signature: "bad_signature",
      secret,
    }),
    false,
  );
});

test("verifyWebhookSignature validates Razorpay webhook signatures", () => {
  const secret = "webhook_secret";
  const body = JSON.stringify({ event: "subscription.charged" });
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");

  assert.equal(verifyWebhookSignature({ body, signature, secret }), true);
  assert.equal(
    verifyWebhookSignature({ body, signature: "bad_signature", secret }),
    false,
  );
});

// ── Multi-currency orders ───────────────────────────────────────────────────

import { isCurrencyEnabled } from "../shared/razorpay-payments.js";

test("a USD order is denominated in cents with currency USD", () => {
  const order = buildTopupOrderOptions({
    uid: "user_123",
    minutes: 120,
    currency: "USD",
    now: 1_800_000,
  });
  assert.equal(order.currency, "USD");
  assert.equal(order.amount, 599); // $5.99 -> cents
});

test("an order with no currency stays INR in paise, exactly as before", () => {
  const order = buildTopupOrderOptions({
    uid: "user_123",
    minutes: 120,
    now: 1_800_000,
  });
  assert.equal(order.currency, "INR");
  assert.equal(order.amount, 9900);
});

test("an amount confirmation is validated in the order's own currency", () => {
  // Passing the rupee figure for a USD order must not be accepted, or a user
  // could be charged $99 for a ₹99 pack.
  assert.throws(
    () =>
      buildTopupOrderOptions({
        uid: "u1",
        minutes: 120,
        currency: "USD",
        expectedAmount: 99,
      }),
    /does not match/,
  );
  // The correct USD figure passes.
  assert.equal(
    buildTopupOrderOptions({
      uid: "u1",
      minutes: 120,
      currency: "USD",
      expectedAmount: 5.99,
      now: 1,
    }).amount,
    599,
  );
});

test("USD is refused until Razorpay international is activated", () => {
  // Razorpay needs international payments enabled on the account; failing here
  // with a clear error beats an opaque gateway rejection at checkout.
  assert.equal(isCurrencyEnabled("INR", {}), true);
  assert.equal(isCurrencyEnabled("USD", {}), false);
  assert.equal(
    isCurrencyEnabled("USD", { RAZORPAY_INTERNATIONAL_ENABLED: "true" }),
    true,
  );
  assert.equal(
    isCurrencyEnabled("USD", { RAZORPAY_INTERNATIONAL_ENABLED: "yes" }),
    false,
  );
});
