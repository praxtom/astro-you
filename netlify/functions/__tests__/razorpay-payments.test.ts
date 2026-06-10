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
