import crypto from "crypto";

/**
 * OTP codes are never stored in plaintext. We store an HMAC-SHA256 of the code
 * keyed on a server secret and salted with the email, so a read of the `otps`
 * collection cannot reveal live codes (and codes can't be brute-forced offline
 * without the server secret).
 */
function otpSecret(): string {
  const secret = process.env.OTP_HASH_SECRET;
  if (!secret || secret.length < 32) {
    // Fail closed: never fall back to a hardcoded literal or another service's
    // credential. A weak/absent key would let codes be brute-forced offline.
    throw new Error(
      "OTP_HASH_SECRET must be set to a random value of at least 32 characters",
    );
  }
  return secret;
}

export function hashOtp(code: string, email: string): string {
  return crypto
    .createHmac("sha256", otpSecret())
    .update(`${email.toLowerCase()}:${code}`)
    .digest("hex");
}

/** Constant-time comparison of two equal-length hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
