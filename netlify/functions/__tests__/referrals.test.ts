import test from "node:test";
import assert from "node:assert/strict";
import {
  REFEREE_REWARD_CREDITS,
  REFERRER_REWARD_CREDITS,
  ReferralError,
  buildReferralClaimRecord,
  createReferralCode,
  normalizeReferralCode,
} from "../shared/referrals.js";

test("createReferralCode creates stable public referral codes", () => {
  assert.equal(createReferralCode("abc123def456"), "STARABC123");
  assert.equal(createReferralCode("uid-with-symbols"), "STARUIDWIT");
});

test("normalizeReferralCode accepts only AstroYou referral codes", () => {
  assert.equal(normalizeReferralCode(" starabc123 "), "STARABC123");
  assert.throws(() => normalizeReferralCode("BAD123"), /valid referral code/i);
});

test("buildReferralClaimRecord creates reward metadata", () => {
  const record = buildReferralClaimRecord(
    {
      code: "starabc123",
      referrerUid: "referrer_1",
      refereeUid: "new_user_1",
      refereeEmail: " Seeker@example.com ",
    },
    "server-timestamp",
  );

  assert.equal(record.code, "STARABC123");
  assert.equal(record.referrerUid, "referrer_1");
  assert.equal(record.refereeUid, "new_user_1");
  assert.equal(record.refereeEmail, "seeker@example.com");
  assert.equal(record.status, "rewarded");
  assert.equal(record.referrerRewardCredits, REFERRER_REWARD_CREDITS);
  assert.equal(record.refereeRewardCredits, REFEREE_REWARD_CREDITS);
  assert.equal(record.createdAt, "server-timestamp");
});

test("buildReferralClaimRecord rejects self referrals", () => {
  assert.throws(
    () =>
      buildReferralClaimRecord(
        {
          code: "STARABC123",
          referrerUid: "same_user",
          refereeUid: "same_user",
        },
        "server-timestamp",
      ),
    (error: unknown) =>
      error instanceof ReferralError &&
      (error as ReferralError).status === 400 &&
      /your own referral/i.test((error as ReferralError).message),
  );
});
