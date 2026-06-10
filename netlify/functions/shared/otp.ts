import crypto from "crypto";

/**
 * OTP codes are never stored in plaintext. We store an HMAC-SHA256 of the code
 * keyed on a server secret and salted with the email, so a read of the `otps`
 * collection cannot reveal live codes (and codes can't be brute-forced offline
 * without the server secret).
 */
function otpSecret(): string {
  return (
    process.env.OTP_HASH_SECRET ||
    process.env.RAZORPAY_WEBHOOK_SECRET ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    "astroyou-otp-fallback-secret"
  );
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
