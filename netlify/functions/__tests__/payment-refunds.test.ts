import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRefundClawback,
  computeRefundClawback,
} from "../shared/payment-refunds.js";
import { applyCreditChange, CreditError } from "../shared/credits.js";
import { createFakeFirestore } from "./helpers/fake-firestore.js";

test("computeRefundClawback: full, proportional, and never more than granted", () => {
  assert.equal(
    computeRefundClawback({
      grantedCredits: 120,
      paymentAmount: 9900,
      refundAmount: 9900,
    }),
    120,
  );
  // Unknown amounts → treat as a full refund.
  assert.equal(computeRefundClawback({ grantedCredits: 120 }), 120);
  // Half refunded → half the credits (rounded up).
  assert.equal(
    computeRefundClawback({
      grantedCredits: 125,
      paymentAmount: 1000,
      refundAmount: 500,
    }),
    63,
  );
  // Second partial refund can't exceed what is left.
  assert.equal(
    computeRefundClawback({
      grantedCredits: 125,
      alreadyClawedBack: 100,
      paymentAmount: 1000,
      refundAmount: 500,
    }),
    25,
  );
  assert.equal(
    computeRefundClawback({
      grantedCredits: 0,
      refundAmount: 100,
      paymentAmount: 100,
    }),
    0,
  );
});

test("only a refund clawback may take the balance below zero", async () => {
  const fake = createFakeFirestore({ "users/u1": { credits: 10 } });
  await assert.rejects(
    applyCreditChange(fake, {
      uid: "u1",
      amount: -50,
      type: "report",
      source: "pdf_report",
      ledgerId: "report_x",
      // allowNegative is ignored for anything but a clawback.
      allowNegative: true,
    }),
    (err) => err instanceof CreditError && err.status === 402,
  );
  await assert.rejects(
    applyCreditChange(fake, {
      uid: "u1",
      amount: -50,
      type: "admin_adjustment",
      source: "admin",
      ledgerId: "adj_x",
    }),
    (err) => err instanceof CreditError && err.status === 402,
  );
  const result = await applyCreditChange(fake, {
    uid: "u1",
    amount: -50,
    type: "refund_clawback",
    source: "razorpay_refund",
    ledgerId: "refund_clawback_r1",
    allowNegative: true,
  });
  assert.equal(result.balanceAfter, -40);
  assert.equal(fake.get("users/u1")?.credits, -40);
});

test("a refunded top-up takes its credits back through the ledger, once", async () => {
  const fake = createFakeFirestore({
    "users/u1": { credits: 30 },
    // The user bought 120 and has already spent 90 of them.
    "users/u1/creditLedger/razorpay_pay_1": { type: "purchase", amount: 120 },
    "paymentOrders/order_1": { uid: "u1", minutes: 120, status: "paid" },
  });
  const input = {
    uid: "u1",
    paymentId: "pay_1",
    refundId: "rfnd_1",
    grantLedgerId: "razorpay_pay_1",
    grantedCredits: 120,
    paymentAmount: 9900,
    refundAmount: 9900,
    orderId: "order_1",
    kind: "topup" as const,
  };

  const first = await applyRefundClawback(fake, input);
  assert.equal(first.outcome, "clawed_back");
  assert.equal(first.clawback, 120);
  assert.equal(fake.get("users/u1")?.credits, -90);
  const ledger = fake.get("users/u1/creditLedger/refund_clawback_rfnd_1");
  assert.equal(ledger?.type, "refund_clawback");
  assert.equal(ledger?.amount, -120);
  assert.equal(fake.get("paymentOrders/order_1")?.status, "refunded");
  assert.deepEqual(fake.get("paymentRefunds/pay_1")?.refundIds, ["rfnd_1"]);

  // Webhook retry of the same refund is a no-op.
  const replay = await applyRefundClawback(fake, input);
  assert.equal(replay.outcome, "duplicate");
  assert.equal(fake.get("users/u1")?.credits, -90);
});

test("partial refunds add up to at most the grant", async () => {
  const fake = createFakeFirestore({
    "users/u1": { credits: 700 },
    "users/u1/creditLedger/subscription_sub_1_100": {
      type: "subscription_grant",
      amount: 700,
    },
  });
  const base = {
    uid: "u1",
    paymentId: "pay_s",
    grantLedgerId: "subscription_sub_1_100",
    grantedCredits: 700,
    paymentAmount: 49900,
    kind: "subscription" as const,
  };
  const a = await applyRefundClawback(fake, {
    ...base,
    refundId: "r_a",
    refundAmount: 30000,
  });
  const b = await applyRefundClawback(fake, {
    ...base,
    refundId: "r_b",
    refundAmount: 30000,
  });
  assert.equal(a.clawback + b.clawback, 700);
  assert.equal(fake.get("users/u1")?.credits, 0);
  assert.equal(fake.get("paymentRefunds/pay_s")?.clawedBackCredits, 700);
});

test("a refund before credits were granted takes nothing and blocks the late grant", async () => {
  const fake = createFakeFirestore({
    "users/u1": { credits: 15 },
    "paymentOrders/order_2": { uid: "u1", minutes: 50, status: "created" },
  });
  const result = await applyRefundClawback(fake, {
    uid: "u1",
    paymentId: "pay_2",
    refundId: "rfnd_2",
    grantLedgerId: "razorpay_pay_2",
    grantedCredits: 50,
    orderId: "order_2",
    kind: "topup",
  });
  assert.equal(result.outcome, "nothing_granted");
  assert.equal(result.clawback, 0);
  assert.equal(fake.get("users/u1")?.credits, 15);
  // payment.captured / verify skip non-"created" orders.
  assert.equal(fake.get("paymentOrders/order_2")?.status, "refunded");
});

test("a refund for a deleted account never recreates the user", async () => {
  const fake = createFakeFirestore({});
  const result = await applyRefundClawback(fake, {
    uid: "gone",
    paymentId: "pay_3",
    refundId: "rfnd_3",
    grantLedgerId: "razorpay_pay_3",
    grantedCredits: 50,
    kind: "topup",
  });
  assert.equal(result.outcome, "user_missing");
  assert.equal(fake.get("users/gone"), undefined);
});
