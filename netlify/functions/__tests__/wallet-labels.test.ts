import test from "node:test";
import assert from "node:assert/strict";
import {
  activityLabel,
  humanizeValue,
  ledgerTypeLabel,
  statusLabel,
} from "../../../src/lib/wallet-labels.js";

const SNAKE = /_/;

test("every ledger source the server writes gets plain words", () => {
  const written = [
    "account_initialization",
    "razorpay",
    "razorpay_subscription",
    "razorpay_refund",
    "referral",
    "synthesis_chat",
    "synthesis_refund",
    "consult_end",
    "pdf_report",
    "pdf_report_refund",
    "admin",
    "feature_horoscope_weekly",
    "feature_horoscope_monthly",
    "feature_horoscope_yearly",
    "feature_transit",
    "feature_compatibility",
    "feature_transit_refund",
    "feature_compatibility_refund",
  ];
  for (const source of written) {
    const label = activityLabel(source);
    assert.ok(label, `${source} has a label`);
    assert.doesNotMatch(label, SNAKE, `${source} → ${label}`);
    assert.notEqual(label.toLowerCase(), source, `${source} is translated`);
  }
});

test("known sources map to the agreed words", () => {
  assert.equal(activityLabel("razorpay"), "Card/UPI purchase");
  assert.equal(activityLabel("account_initialization"), "Welcome credits");
  assert.equal(activityLabel("signup_bonus"), "Welcome credits");
  assert.equal(activityLabel("referral"), "Referral reward");
  assert.equal(activityLabel("consult_end"), "Guide session");
  assert.equal(activityLabel("consult_session"), "Guide session");
  assert.equal(activityLabel("pdf_report"), "PDF report");
  assert.equal(activityLabel("feature_horoscope_weekly"), "Weekly forecast");
  assert.equal(
    activityLabel("feature_compatibility_refund"),
    "Compatibility reading refunded",
  );
});

test("unknown sources are title-cased, never snake_case", () => {
  assert.equal(activityLabel("gift_card_bonus"), "Gift Card Bonus");
  assert.equal(activityLabel("feature_new_thing"), "New Thing");
  assert.equal(activityLabel(""), "");
  assert.equal(activityLabel(undefined), "");
});

test("every ledger type has a headline", () => {
  const types = [
    "purchase",
    "consultation",
    "synthesis",
    "feature",
    "report",
    "refund",
    "refund_clawback",
    "admin_adjustment",
    "subscription_grant",
    "signup_bonus",
    "referral_bonus",
  ];
  for (const type of types) {
    const label = ledgerTypeLabel(type);
    assert.doesNotMatch(label, SNAKE, `${type} → ${label}`);
    assert.notEqual(label, type);
  }
  assert.equal(ledgerTypeLabel(undefined), "Credit activity");
  assert.equal(ledgerTypeLabel("mystery_kind"), "Mystery Kind");
});

test("session and report statuses read as plain words", () => {
  assert.equal(statusLabel("completed"), "Done");
  assert.equal(statusLabel("ended"), "Done");
  assert.equal(statusLabel("active"), "In progress");
  assert.equal(statusLabel("generating"), "Preparing");
  assert.equal(statusLabel("pending"), "Processing");
  assert.equal(statusLabel("refunded"), "Refunded");
  assert.equal(statusLabel("failed"), "Didn't go through");
  assert.equal(statusLabel("ON_HOLD"), "On Hold");
  assert.equal(statusLabel(null), "");
});

test("humanizeValue tidies separators and case", () => {
  assert.equal(humanizeValue("  horoscope__weekly "), "Horoscope Weekly");
  assert.equal(humanizeValue("pdf-report"), "Pdf Report");
});
