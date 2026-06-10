import test from "node:test";
import assert from "node:assert/strict";
import {
  DISCLAIMER_SECTIONS,
  PRIVACY_SECTIONS,
  REFUND_SECTIONS,
  SUPPORT_EMAIL,
  TERMS_SECTIONS,
} from "../../../src/lib/legal-policies.js";

test("legal policy copy covers production-critical surfaces", () => {
  const allCopy = [
    ...TERMS_SECTIONS,
    ...PRIVACY_SECTIONS,
    ...REFUND_SECTIONS,
    ...DISCLAIMER_SECTIONS,
  ]
    .flatMap((section) => [section.title, ...section.content])
    .join(" ");

  for (const required of [
    "AI",
    "credits",
    "subscriptions",
    "Refund",
    "Razorpay",
    "delete",
    "export",
    "medical",
    "legal",
    "financial",
    SUPPORT_EMAIL,
  ]) {
    assert.match(allCopy, new RegExp(required, "i"));
  }
});

test("refund policy clearly excludes consumed credits", () => {
  const refundCopy = REFUND_SECTIONS.flatMap((section) => section.content).join(" ");

  assert.match(refundCopy, /Consumed credits/i);
  assert.match(refundCopy, /duplicate charges/i);
  assert.match(refundCopy, /5-10 business days/i);
  assert.match(refundCopy, /original payment method/i);
});
