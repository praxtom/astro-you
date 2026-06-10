import crypto from "crypto";
import type { Transaction } from "firebase-admin/firestore";
import { db, FieldValue } from "./firebase-admin.js";

export interface RateLimitOptions {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export function getRequestIdentifier(req: Request, fallback = "anonymous") {
  // x-nf-client-connection-ip is Netlify's authoritative client IP and cannot
  // be spoofed by the caller. We deliberately do NOT trust `client-ip` (a
  // client-settable header) which would let an attacker bypass rate limits by
  // rotating header values.
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return req.headers.get("x-nf-client-connection-ip") || forwarded || fallback;
}

// Scopes that gate money or auth must fail CLOSED if the rate-limit store is
// unavailable — otherwise a Firestore outage becomes a rate-limit bypass on the
// most sensitive endpoints. Non-sensitive scopes (analytics) may fail open.
const FAIL_CLOSED_SCOPES = new Set([
  "send_otp",
  "verify_otp",
  "credits_use",
  "synthesis",
  "synthesis_guest",
  "synthesis_guest_day",
  "proactive_nudge",
  "consult_message",
  "consult_start",
  "pdf_report",
  "trust_submit",
  "referral_claim",
]);

export async function checkRateLimit(
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();
  const bucket = Math.floor(now / options.windowMs);
  const resetAt = new Date((bucket + 1) * options.windowMs);
  const keyHash = crypto
    .createHash("sha256")
    .update(`${options.scope}:${options.key}`)
    .digest("hex")
    .slice(0, 32);
  const ref = db
    .collection("rateLimits")
    .doc(`${options.scope}_${keyHash}_${bucket}`);

  try {
    return await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? (snap.data()?.count ?? 0) : 0;
      if (current >= options.limit) {
        return { allowed: false, remaining: 0, resetAt };
      }

      tx.set(
        ref,
        {
          scope: options.scope,
          keyHash,
          bucket,
          count: FieldValue.increment(1),
          limit: options.limit,
          resetAt,
          expiresAt: new Date(resetAt.getTime() + options.windowMs),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return {
        allowed: true,
        remaining: Math.max(0, options.limit - current - 1),
        resetAt,
      };
    });
  } catch (error) {
    const failClosed = FAIL_CLOSED_SCOPES.has(options.scope);
    console.error(
      `[RateLimit] Firestore check failed for ${options.scope}; ${failClosed ? "DENYING" : "allowing"} request.`,
      error,
    );
    return {
      allowed: !failClosed,
      remaining: 0,
      resetAt,
    };
  }
}
