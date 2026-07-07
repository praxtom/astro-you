import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

// send-otp.ts transitively imports shared/firebase-admin.js, which initializes
// the Admin SDK at import time — point it at a syntactically valid throwaway
// service account first (cert() parses the private key), then import lazily.
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

const { isValidEmail } = await import("../send-otp.js");

test("isValidEmail accepts common real-world addresses", () => {
  assert.equal(isValidEmail("user@example.com"), true);
  assert.equal(isValidEmail("first.last+tag@sub.example.co.in"), true);
  assert.equal(isValidEmail("user_99%x-y@example.io"), true);
});

test("isValidEmail rejects the junk the old includes('@') check allowed", () => {
  assert.equal(isValidEmail("@"), false);
  assert.equal(isValidEmail("a@b"), false); // no TLD
  assert.equal(isValidEmail("user@@example.com"), false);
  assert.equal(isValidEmail("user @example.com"), false); // whitespace
  assert.equal(isValidEmail("a/b@example.com"), false); // Firestore path char
  assert.equal(isValidEmail("user@example.com "), false); // untrimmed input
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail(null), false);
  assert.equal(isValidEmail(12345), false);
  assert.equal(isValidEmail({ email: "user@example.com" }), false);
});

test("isValidEmail caps length at 254 characters", () => {
  const max = `${"a".repeat(242)}@example.com`;
  assert.equal(max.length, 254);
  assert.equal(isValidEmail(max), true);
  assert.equal(isValidEmail(`a${max}`), false);
});
