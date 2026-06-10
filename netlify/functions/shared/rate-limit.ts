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
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("client-ip") ||
    forwarded ||
    fallback
  );
}

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
  const ref = db.collection("rateLimits").doc(`${options.scope}_${keyHash}_${bucket}`);

  try {
    return await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? snap.data()?.count ?? 0 : 0;
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
    console.warn(`[RateLimit] Firestore check failed for ${options.scope}; allowing request.`, error);
    return {
      allowed: true,
      remaining: Math.max(0, options.limit - 1),
      resetAt,
    };
  }
}
