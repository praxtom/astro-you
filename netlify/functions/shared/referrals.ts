import { randomInt } from "crypto";

export const REFERRER_REWARD_CREDITS = 25;
export const REFEREE_REWARD_CREDITS = 15;

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
    typeof input.refereeEmail === "string"
      ? input.refereeEmail.trim().toLowerCase().slice(0, 160)
      : null;

  return {
    code,
    referrerUid: input.referrerUid,
    refereeUid: input.refereeUid,
    refereeEmail,
    status: "rewarded" as const,
    referrerRewardCredits: REFERRER_REWARD_CREDITS,
    refereeRewardCredits: REFEREE_REWARD_CREDITS,
    createdAt,
  };
}
