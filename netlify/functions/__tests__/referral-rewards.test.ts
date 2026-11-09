import test from "node:test";
import assert from "node:assert/strict";
import {
  grantReferrerRewardAfterPayment,
  isWithinReferralClaimWindow,
  REFERRER_MONTHLY_REWARD_CAP,
  REFERRER_REWARD_CREDITS,
  referralRewardMonthKey,
} from "../shared/referrals.js";
import { createFakeFirestore } from "./helpers/fake-firestore.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-10T12:00:00.000Z");

test("referral codes can only be claimed within 7 days of account creation", () => {
  const now = NOW.getTime();
  assert.equal(isWithinReferralClaimWindow(now - 1 * DAY_MS, now), true);
  assert.equal(isWithinReferralClaimWindow(now - 7 * DAY_MS, now), true);
  assert.equal(isWithinReferralClaimWindow(now - 7 * DAY_MS - 1, now), false);
  // Unknown creation time fails closed.
  assert.equal(isWithinReferralClaimWindow(null, now), false);
  assert.equal(isWithinReferralClaimWindow(Number.NaN, now), false);
});

test("referralRewardMonthKey buckets by UTC calendar month", () => {
  assert.equal(referralRewardMonthKey(NOW), "2026-11");
  assert.equal(
    referralRewardMonthKey(new Date("2026-12-31T23:59:59Z")),
    "2026-12",
  );
});

function seed(extra: Record<string, Record<string, unknown>> = {}) {
  return createFakeFirestore({
    "users/referrer": { credits: 100 },
    "users/referee": { credits: 30, referredBy: "STARABC123" },
    "users/referee/referralClaims/STARABC123": {
      code: "STARABC123",
      referrerUid: "referrer",
      refereeUid: "referee",
      status: "pending_payment",
      referrerRewardCredits: REFERRER_REWARD_CREDITS,
    },
    "users/referrer/referrals/referee": {
      code: "STARABC123",
      status: "pending_payment",
    },
    ...extra,
  });
}

test("the referrer is paid only after the referee's first payment, exactly once", async () => {
  const fake = seed();
  const deps = { db: fake.db, FieldValue: fake.FieldValue, now: () => NOW };

  const first = await grantReferrerRewardAfterPayment(deps, "referee", {
    source: "topup",
    referenceId: "pay_1",
  });
  assert.equal(first.outcome, "rewarded");
  assert.equal(fake.get("users/referrer")?.credits, 125);
  assert.equal(
    fake.get("users/referrer/creditLedger/referral_referrer_referee")?.amount,
    REFERRER_REWARD_CREDITS,
  );
  assert.equal(
    fake.get("users/referee/referralClaims/STARABC123")?.status,
    "rewarded",
  );
  assert.equal(
    fake.get("users/referrer/referrals/referee")?.status,
    "rewarded",
  );
  assert.equal(fake.get("referralRewardCounters/referrer_2026-11")?.count, 1);

  // Second payment (or a webhook replay) pays nothing more.
  const second = await grantReferrerRewardAfterPayment(deps, "referee", {
    source: "subscription",
    referenceId: "sub_1_100",
  });
  assert.equal(second.outcome, "already_settled");
  assert.equal(fake.get("users/referrer")?.credits, 125);
  assert.equal(fake.get("referralRewardCounters/referrer_2026-11")?.count, 1);
});

test("referrer rewards are capped per calendar month", async () => {
  const fake = seed({
    "referralRewardCounters/referrer_2026-11": {
      count: REFERRER_MONTHLY_REWARD_CAP,
    },
  });
  const result = await grantReferrerRewardAfterPayment(
    { db: fake.db, FieldValue: fake.FieldValue, now: () => NOW },
    "referee",
    { source: "topup", referenceId: "pay_1" },
  );
  assert.equal(result.outcome, "cap_reached");
  assert.equal(fake.get("users/referrer")?.credits, 100);
  assert.equal(
    fake.get("users/referee/referralClaims/STARABC123")?.status,
    "cap_reached",
  );

  // Next month the counter is fresh.
  const fake2 = seed({
    "referralRewardCounters/referrer_2026-10": {
      count: REFERRER_MONTHLY_REWARD_CAP,
    },
  });
  const nextMonth = await grantReferrerRewardAfterPayment(
    { db: fake2.db, FieldValue: fake2.FieldValue, now: () => NOW },
    "referee",
    { source: "topup", referenceId: "pay_1" },
  );
  assert.equal(nextMonth.outcome, "rewarded");
});

test("users without a referral, and legacy already-rewarded claims, are untouched", async () => {
  const none = createFakeFirestore({ "users/solo": { credits: 5 } });
  assert.equal(
    (
      await grantReferrerRewardAfterPayment(
        { db: none.db, FieldValue: none.FieldValue, now: () => NOW },
        "solo",
        { source: "topup", referenceId: "p" },
      )
    ).outcome,
    "no_referral",
  );

  const legacy = seed({
    "users/referee/referralClaims/STARABC123": {
      referrerUid: "referrer",
      status: "rewarded",
    },
  });
  const result = await grantReferrerRewardAfterPayment(
    { db: legacy.db, FieldValue: legacy.FieldValue, now: () => NOW },
    "referee",
    { source: "topup", referenceId: "p" },
  );
  assert.equal(result.outcome, "already_settled");
  assert.equal(legacy.get("users/referrer")?.credits, 100);
});

test("a deleted referrer is settled without recreating their account", async () => {
  const fake = seed();
  fake.store.delete("users/referrer");
  const result = await grantReferrerRewardAfterPayment(
    { db: fake.db, FieldValue: fake.FieldValue, now: () => NOW },
    "referee",
    { source: "topup", referenceId: "p" },
  );
  assert.equal(result.outcome, "referrer_missing");
  assert.equal(fake.get("users/referrer"), undefined);
});
