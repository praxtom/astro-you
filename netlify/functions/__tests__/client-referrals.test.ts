import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReferralLink,
  createClientReferralCode,
  extractReferralCodeFromSearch,
  normalizeClientReferralCode,
} from "../../../src/lib/referrals.js";

test("createClientReferralCode matches public STAR code format", () => {
  assert.equal(createClientReferralCode("abc123def456"), "STARABC123");
  assert.equal(createClientReferralCode("uid-with-symbols"), "STARUIDWIT");
});

test("normalizeClientReferralCode accepts only public AstroYou referral codes", () => {
  assert.equal(normalizeClientReferralCode(" starabc123 "), "STARABC123");
  assert.equal(normalizeClientReferralCode("BAD123"), null);
});

test("buildReferralLink creates shareable origin links", () => {
  assert.equal(
    buildReferralLink("https://astroyou.com/app", "starabc123"),
    "https://astroyou.com/?ref=STARABC123",
  );
  assert.equal(buildReferralLink("https://astroyou.com", "bad"), "");
});

test("extractReferralCodeFromSearch reads referral query params safely", () => {
  assert.equal(extractReferralCodeFromSearch("?ref=starabc123&source=wa"), "STARABC123");
  assert.equal(extractReferralCodeFromSearch("?ref=bad"), null);
  assert.equal(extractReferralCodeFromSearch(""), null);
});
