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
  "synthesis",
  "synthesis_guest",
  "synthesis_guest_day",
  "proactive_nudge",
  "consult_message",
  "consult_start",
  "ai_consult",
  "pdf_report",
  "trust_submit",
  "referral_claim",
  // Public endpoints that front the paid astrology API — fail closed so a
  // rate-limit-store outage can't be exploited to rack up upstream spend.
  "sign_horoscope",
  "horoscope",
  "transit",
  "compatibility",
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
    // kundali.ts uses dynamic `astro_<chartType>` scopes — all front the paid
    // astrology API, so treat the whole prefix as fail-closed.
    const failClosed =
      FAIL_CLOSED_SCOPES.has(options.scope) ||
      options.scope.startsWith("astro_");
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

/** Stable sha256 of a JSON-serializable submission (object keys sorted). */
export function submissionFingerprint(value: unknown): string {
  const stable = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, stable((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stable(value)) ?? "")
    .digest("hex")
    .slice(0, 40);
}

/**
 * True when this exact submission (same scope + key + fingerprint) was already
 * accepted within `windowMs` — e.g. a double-clicked "Send" or a client retry.
 * Otherwise claims the window and returns false. Fails OPEN (returns false) if
 * the store is unavailable: a duplicate ticket is better than a lost one.
 */
export interface SubmissionKey {
  scope: string;
  key: string;
  fingerprint: string;
}

function duplicateRef(options: SubmissionKey) {
  const keyHash = crypto
    .createHash("sha256")
    .update(`${options.scope}:${options.key}:${options.fingerprint}`)
    .digest("hex")
    .slice(0, 32);
  return db.collection("rateLimits").doc(`dup_${options.scope}_${keyHash}`);
}

/** Undo a claim when the write it guarded failed, so a retry isn't blocked. */
export async function releaseSubmission(options: SubmissionKey) {
  await duplicateRef(options)
    .delete()
    .catch(() => undefined);
}

export async function isDuplicateSubmission(
  options: SubmissionKey & { windowMs: number },
): Promise<boolean> {
  const now = Date.now();
  const ref = duplicateRef(options);
  try {
    return await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      const until = snap.exists ? Number(snap.data()?.duplicateUntilMs) : 0;
      if (until > now) return true;
      tx.set(ref, {
        scope: options.scope,
        duplicateUntilMs: now + options.windowMs,
        expiresAt: new Date(now + options.windowMs),
      });
      return false;
    });
  } catch (error) {
    console.error(
      `[RateLimit] Duplicate check failed for ${options.scope}; allowing.`,
      error,
    );
    return false;
  }
}
