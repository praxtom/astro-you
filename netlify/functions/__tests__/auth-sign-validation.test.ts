import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

// sign-horoscope.ts transitively imports shared/firebase-admin.js, which
// initializes the Admin SDK at import time — point it at a syntactically valid
// throwaway service account first (cert() parses the private key), then
// import lazily.
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
    project_id: "astroyou-test",
    client_email: "test@astroyou-test.iam.gserviceaccount.com",
    private_key: privateKey,
  });
}

const { SIGN_ANCHOR_DOB, normalizeSign, normalizePeriod } =
  await import("../sign-horoscope.js");

test("normalizeSign accepts all 12 signs case-insensitively", () => {
  const signs = Object.keys(SIGN_ANCHOR_DOB);
  assert.equal(signs.length, 12);
  for (const sign of signs) {
    assert.equal(normalizeSign(sign), sign);
    assert.equal(normalizeSign(sign.toUpperCase()), sign);
    assert.equal(normalizeSign(` ${sign.toLowerCase()} `), sign);
  }
});

test("normalizeSign rejects unknown and non-string input", () => {
  assert.equal(normalizeSign("Ophiuchus"), null);
  assert.equal(normalizeSign("aries; anything-else"), null);
  assert.equal(normalizeSign(""), null);
  assert.equal(normalizeSign(undefined), null);
  assert.equal(normalizeSign({ sign: "Aries" }), null);
});

test("normalizePeriod defaults to daily and rejects unknown periods", () => {
  assert.equal(normalizePeriod(undefined), "daily");
  assert.equal(normalizePeriod(null), "daily");
  assert.equal(normalizePeriod("daily"), "daily");
  assert.equal(normalizePeriod("weekly"), "weekly");
  assert.equal(normalizePeriod("MONTHLY"), "monthly");
  assert.equal(normalizePeriod("yearly"), "yearly");
  assert.equal(normalizePeriod("decade"), null);
  assert.equal(normalizePeriod(7), null);
});

test("each sign's anchor dob maps back to that sign upstream", () => {
  // Mirrors shared/astro-api's dob→sign derivation so a wrong anchor date
  // (which would bill and cache the wrong sign's text) fails loudly here.
  const capricornFirst = [
    "Capricorn",
    "Aquarius",
    "Pisces",
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
  ];
  const bounds = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
  for (const [sign, dob] of Object.entries(SIGN_ANCHOR_DOB)) {
    const [, month, day] = dob.split("-").map(Number);
    const derived =
      day < bounds[month - 1]
        ? capricornFirst[month - 1]
        : capricornFirst[month % 12];
    assert.equal(derived, sign);
  }
});
