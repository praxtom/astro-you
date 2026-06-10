import test from "node:test";
import assert from "node:assert/strict";
import { hashOtp, safeEqualHex } from "../shared/otp.js";

test("hashOtp is deterministic for the same code+email and never the raw code", () => {
  process.env.OTP_HASH_SECRET = "test-secret";
  const h1 = hashOtp("123456", "user@example.com");
  const h2 = hashOtp("123456", "USER@example.com"); // email is lowercased
  assert.equal(h1, h2);
  assert.notEqual(h1, "123456");
  assert.match(h1, /^[a-f0-9]{64}$/); // sha256 hex
});

test("hashOtp differs for different codes and different emails", () => {
  process.env.OTP_HASH_SECRET = "test-secret";
  assert.notEqual(
    hashOtp("123456", "a@example.com"),
    hashOtp("654321", "a@example.com"),
  );
  assert.notEqual(
    hashOtp("123456", "a@example.com"),
    hashOtp("123456", "b@example.com"),
  );
});

test("safeEqualHex matches equal digests and rejects mismatches/lengths", () => {
  process.env.OTP_HASH_SECRET = "test-secret";
  const h = hashOtp("111111", "x@example.com");
  assert.equal(safeEqualHex(h, h), true);
  assert.equal(safeEqualHex(h, hashOtp("222222", "x@example.com")), false);
  assert.equal(safeEqualHex(h, "abc"), false);
  assert.equal(safeEqualHex(h, ""), false);
});
