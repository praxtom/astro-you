import { randomInt } from "crypto";
import { applyCreditChangeInTransaction } from "./credits.js";

export const REFERRER_REWARD_CREDITS = 25;
export const REFEREE_REWARD_CREDITS = 15;
/** A code can only be claimed this soon after the referee's account exists. */
export const REFERRAL_CLAIM_WINDOW_DAYS = 7;
/** Referrer rewards granted per calendar month (UTC), across all referees. */
export const REFERRER_MONTHLY_REWARD_CAP = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True when an account created at `accountCreatedMs` may still claim a
 * referral code. Unknown creation time fails closed.
 */
export function isWithinReferralClaimWindow(
  accountCreatedMs: number | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (
    typeof accountCreatedMs !== "number" ||
    !Number.isFinite(accountCreatedMs)
  ) {
    return false;
  }
  return nowMs - accountCreatedMs <= REFERRAL_CLAIM_WINDOW_DAYS * DAY_MS;
}

/** Calendar-month bucket (UTC) for the referrer reward cap, e.g. "2026-11". */
export function referralRewardMonthKey(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export class ReferralError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "ReferralError";
  }
}

export interface ReferralClaimInput {
  code: string;
  referrerUid: string;
  refereeUid: string;
  refereeEmail?: string | null;
}

// Unambiguous base32 alphabet (no 0/O/1/I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generate a random, unguessable referral code. Codes used to be derived from
 * the first 6 chars of the UID, which is predictable/enumerable — anyone who
 * knew (or guessed) a UID could claim that user's code. Random codes are stored
 * once in the user doc and reused thereafter.
 */
export function generateReferralCode(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return `STAR${suffix}`;
}

/** @deprecated UID-derived (guessable). Use generateReferralCode() + store-once. */
export function createReferralCode(uid: string): string {
  const safeUid = uid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `STAR${safeUid.slice(0, 6).padEnd(6, "X")}`;
}

/**
 * Mask an email for storage in ANOTHER user's tree. The referrer only needs to
 * recognize whom they invited, not hold the referee's raw address — which would
 * also survive the referee's account deletion. "john.doe@gmail.com" → "j***@gmail.com".
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***@${email.slice(at + 1)}`;
}

export function normalizeReferralCode(code: unknown): string {
  const normalized =
    typeof code === "string"
      ? code
          .trim()
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
      : "";

  if (!/^STAR[A-Z0-9]{6}$/.test(normalized)) {
    throw new ReferralError("A valid referral code is required");
  }

  return normalized;
}

export function buildReferralClaimRecord(
  input: ReferralClaimInput,
  createdAt: unknown,
) {
  const code = normalizeReferralCode(input.code);
  if (!input.referrerUid || !input.refereeUid) {
    throw new ReferralError("Referral users are required");
  }

  if (input.referrerUid === input.refereeUid) {
    throw new ReferralError("You cannot use your own referral code");
  }

  const refereeEmail =
    typeof input.refereeEmail === "string" && input.refereeEmail.includes("@")
      ? maskEmail(input.refereeEmail.trim().toLowerCase().slice(0, 160))
      : null;

  return {
    code,
    referrerUid: input.referrerUid,
    refereeUid: input.refereeUid,
    refereeEmail,
    // The referee's own bonus is immediate; the referrer's reward waits for
    // the referee's first successful payment (grantReferrerRewardAfterPayment).
    status: "pending_payment" as ReferralClaimStatus,
    referrerRewardCredits: REFERRER_REWARD_CREDITS,
    refereeRewardCredits: REFEREE_REWARD_CREDITS,
    createdAt,
  };
}

export type ReferralClaimStatus =
  "pending_payment" | "rewarded" | "cap_reached" | "referrer_missing";

interface RefDocLike {
  collection(name: string): { doc(id?: string): RefDocLike };
  id?: string;
  path?: string;
}

interface RefSnapLike {
  exists?: boolean;
  data(): Record<string, any> | undefined;
}

interface RefTxLike {
  get(ref: RefDocLike): Promise<RefSnapLike>;
  update(ref: RefDocLike, data: Record<string, unknown>): void;
  set(
    ref: RefDocLike,
    data: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): void;
}

export interface ReferralRewardDeps {
  db: {
    collection(name: string): { doc(id?: string): RefDocLike };
    runTransaction<T>(callback: (tx: RefTxLike) => Promise<T>): Promise<T>;
  };
  FieldValue: {
    increment(value: number): unknown;
    serverTimestamp(): unknown;
  };
  now?: () => Date;
}

export interface ReferralRewardResult {
  outcome:
    | "no_referral"
    | "already_settled"
    | "rewarded"
    | "cap_reached"
    | "referrer_missing";
  referrerUid?: string;
}

/**
 * Pay the referrer's +25 once the referee has made their first successful
 * payment (a top-up or a subscription charge). Idempotent: the claim record
 * (server-only, under the referee) moves out of "pending_payment" exactly once,
 * and the referrer ledger id is per referee. At most
 * REFERRER_MONTHLY_REWARD_CAP rewards per referrer per calendar month.
 *
 * Call it AFTER the payment's own credit transaction commits; it is best-effort
 * and safe to retry.
 */
export async function grantReferrerRewardAfterPayment(
  deps: ReferralRewardDeps,
  refereeUid: string,
  payment: { source: string; referenceId: string },
): Promise<ReferralRewardResult> {
  const now = deps.now?.() ?? new Date();
  const monthKey = referralRewardMonthKey(now);
  const refereeRef = deps.db.collection("users").doc(refereeUid);

  return deps.db.runTransaction(async (tx) => {
    const refereeSnap = await tx.get(refereeRef);
    const code = refereeSnap.data()?.referredBy;
    if (typeof code !== "string" || !code) return { outcome: "no_referral" };

    const claimRef = refereeRef.collection("referralClaims").doc(code);
    const claimSnap = await tx.get(claimRef);
    const claim = claimSnap.data();
    // Claims made before this rule were rewarded at claim time ("rewarded").
    if (!claim || claim.status !== "pending_payment") {
      return { outcome: "already_settled" };
    }
    const referrerUid =
      typeof claim.referrerUid === "string" ? claim.referrerUid : "";
    if (!referrerUid) {
      tx.set(claimRef, { status: "referrer_missing" }, { merge: true });
      return { outcome: "referrer_missing" };
    }

    const referrerRef = deps.db.collection("users").doc(referrerUid);
    const referrerReferralRef = referrerRef
      .collection("referrals")
      .doc(refereeUid);
    const counterRef = deps.db
      .collection("referralRewardCounters")
      .doc(`${referrerUid}_${monthKey}`);
    const referrerSnap = await tx.get(referrerRef);
    const counterSnap = await tx.get(counterRef);
    const referrerReferralSnap = await tx.get(referrerReferralRef);

    const settle = (status: ReferralClaimStatus) => {
      const patch = {
        status,
        settledAt: deps.FieldValue.serverTimestamp(),
        settledBy: payment.source,
        settledPaymentRef: payment.referenceId,
      };
      tx.set(claimRef, patch, { merge: true });
      if (
        referrerReferralSnap.exists !== false &&
        referrerReferralSnap.data()
      ) {
        tx.set(referrerReferralRef, patch, { merge: true });
      }
    };

    if (referrerSnap.exists === false || !referrerSnap.data()) {
      settle("referrer_missing");
      return { outcome: "referrer_missing", referrerUid };
    }

    const count = Number(counterSnap.data()?.count ?? 0) || 0;
    if (count >= REFERRER_MONTHLY_REWARD_CAP) {
      settle("cap_reached");
      return { outcome: "cap_reached", referrerUid };
    }

    const amount =
      Number(claim.referrerRewardCredits) || REFERRER_REWARD_CREDITS;
    const result = await applyCreditChangeInTransaction(
      tx,
      { FieldValue: deps.FieldValue },
      referrerRef,
      {
        uid: referrerUid,
        amount,
        type: "referral_bonus",
        source: "referral",
        referenceId: refereeUid,
        ledgerId: `referral_referrer_${refereeUid}`,
        metadata: {
          code,
          refereeUid,
          trigger: payment.source,
          paymentRef: payment.referenceId,
        },
      },
      referrerSnap.data()?.credits ?? 0,
    );
    if (!result.duplicate) {
      tx.set(
        counterRef,
        {
          referrerUid,
          month: monthKey,
          count: count + 1,
          updatedAt: deps.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    settle("rewarded");
    return { outcome: "rewarded", referrerUid };
  });
}
