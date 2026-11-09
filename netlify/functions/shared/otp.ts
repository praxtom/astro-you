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

/**
 * Per-email daily cap on FAILED code guesses. The per-code limit (5 attempts,
 * 15-minute lockout, reset when a new code is sent) still allows hundreds of
 * guesses a day against one address; this counter survives resends, expiry
 * and successful sign-ins, so an address gets at most this many wrong guesses
 * per UTC day. Stored in `rateLimits` (server-only, TTL on `expiresAt`).
 */
export const OTP_DAILY_FAILURE_CAP = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

export function otpFailureDayBucket(nowMs: number): number {
  return Math.floor(nowMs / DAY_MS);
}

/** rateLimits doc id for this email's failed-guess counter today. */
export function otpFailureDocId(email: string, nowMs: number): string {
  const emailHash = crypto
    .createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
  return `otp_fail_${emailHash}_${otpFailureDayBucket(nowMs)}`;
}

/** When the counter doc may be TTL-deleted (end of the following day). */
export function otpFailureExpiresAt(nowMs: number): Date {
  return new Date((otpFailureDayBucket(nowMs) + 2) * DAY_MS);
}

export function otpDailyCapReached(failedToday: unknown): boolean {
  return (
    typeof failedToday === "number" && failedToday >= OTP_DAILY_FAILURE_CAP
  );
}
