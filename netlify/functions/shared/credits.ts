import { createHash, createHmac } from "node:crypto";
import { getUsageLimit } from "./entitlements.js";

export type CreditChangeType =
  | "purchase"
  | "consultation"
  | "synthesis"
  | "feature"
  | "report"
  | "refund"
  | "refund_clawback"
  | "admin_adjustment"
  | "subscription_grant"
  | "signup_bonus"
  | "referral_bonus";

export interface CreditChangeInput {
  uid: string;
  amount: number;
  type: CreditChangeType;
  source: string;
  referenceId?: string;
  ledgerId?: string;
  metadata?: Record<string, unknown>;
  /**
   * Allow the balance to go below zero. ONLY for taking back credits that a
   * refunded payment granted (`refund_clawback`): the user may already have
   * spent them, and the debt must survive so the next top-up repays it. Every
   * other debit stays non-negative.
   */
  allowNegative?: boolean;
}

export interface CreditChangeResult {
  balanceBefore: number;
  balanceAfter: number;
  duplicate: boolean;
}

interface DocumentRefLike {
  collection(name: string): CollectionRefLike;
  id?: string;
  path?: string;
}

interface CollectionRefLike {
  doc(id?: string): DocumentRefLike;
}

interface DocumentSnapshotLike {
  exists?: boolean;
  data(): Record<string, any> | undefined;
}

interface TransactionLike {
  get(ref: DocumentRefLike): Promise<DocumentSnapshotLike>;
  update(ref: DocumentRefLike, data: Record<string, unknown>): void;
  set(
    ref: DocumentRefLike,
    data: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): void;
}

interface DbLike {
  collection(name: string): CollectionRefLike;
  runTransaction<T>(callback: (tx: TransactionLike) => Promise<T>): Promise<T>;
}

interface FieldValueLike {
  increment(value: number): unknown;
  serverTimestamp(): unknown;
}

export interface CreditDeps {
  db: DbLike;
  FieldValue: FieldValueLike;
}

export interface InitializeUserCreditsInput {
  uid: string;
  email?: string | null;
  initialCredits?: number;
  /** Env used to derive the signup-grant key (tests inject this). */
  env?: Record<string, string | undefined>;
}

export interface CreditTransactionDeps {
  FieldValue: FieldValueLike;
}

export class CreditError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CreditError";
    this.status = status;
  }
}

export function createLedgerId(type: CreditChangeType, referenceId: string) {
  return `${type}_${referenceId}`
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .slice(0, 500);
}

export async function applyCreditChange(
  deps: CreditDeps,
  input: CreditChangeInput,
): Promise<CreditChangeResult> {
  const userRef = deps.db.collection("users").doc(input.uid);

  return deps.db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const balanceBefore = userSnap.data()?.credits ?? 0;
    return applyCreditChangeInTransaction(
      tx,
      { FieldValue: deps.FieldValue },
      userRef,
      input,
      balanceBefore,
    );
  });
}

/**
 * Canonical form of an email for "one signup bonus per mailbox": lowercase,
 * `+tag` stripped, and dots stripped for Gmail (which ignores them), so
 * `John.Doe+x@GoogleMail.com` and `johndoe@gmail.com` are the same mailbox.
 * Returns null for anything that isn't a plausible address.
 */
export function canonicalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  if (!local) return null;
  return `${local}@${domain}`;
}

const SIGNUP_GRANT_LABEL = "astroyou:signup-grants:v1";
const MIN_SECRET_CHARS = 32;
let warnedUnkeyedSignupGrant = false;

/**
 * Document id for the top-level `signupGrants/{key}` record: an HMAC of the
 * canonical email under a key derived from OTP_HASH_SECRET with its own label
 * (same derivation pattern as internal-dispatch.ts resolveInternalSecret), so
 * the collection never stores a raw or dictionary-reversible address. Falls
 * back to a labelled SHA-256 when the secret is absent so the guard still works.
 */
export function signupGrantKey(
  email: unknown,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const canonical = canonicalizeEmail(email);
  if (!canonical) return null;
  const base = env.OTP_HASH_SECRET?.trim();
  if (base && base.length >= MIN_SECRET_CHARS) {
    const key = createHmac("sha256", base).update(SIGNUP_GRANT_LABEL).digest();
    return createHmac("sha256", key).update(canonical).digest("hex");
  }
  if (!warnedUnkeyedSignupGrant) {
    warnedUnkeyedSignupGrant = true;
    console.warn(
      "[Credits] OTP_HASH_SECRET missing or short; signupGrants keys use an unkeyed hash",
    );
  }
  return createHash("sha256")
    .update(`${SIGNUP_GRANT_LABEL}:${canonical}`)
    .digest("hex");
}

export async function initializeUserCredits(
  deps: CreditDeps,
  input: InitializeUserCreditsInput,
): Promise<CreditChangeResult> {
  const initialCredits =
    input.initialCredits ?? getUsageLimit("free", "monthlyCredits");
  const userRef = deps.db.collection("users").doc(input.uid);
  const ledgerRef = userRef.collection("creditLedger").doc("signup_bonus");
  const grantKey = signupGrantKey(input.email, input.env);
  const grantRef = grantKey
    ? deps.db.collection("signupGrants").doc(grantKey)
    : null;

  return deps.db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const ledgerSnap = await tx.get(ledgerRef);
    const grantSnap = grantRef ? await tx.get(grantRef) : null;
    const userData = userSnap.data();
    const balanceBefore = userData?.credits ?? 0;
    const existingLedger = ledgerSnap.data();

    // Idempotency relies ONLY on the signup_bonus ledger sentinel. A defined
    // `credits` field is NOT proof the bonus was granted — a referral claim
    // can merge-set credits before initialization runs, and treating that as
    // "already initialized" would permanently skip the signup bonus.
    if (ledgerSnap.exists !== false && existingLedger) {
      return {
        balanceBefore,
        balanceAfter: balanceBefore,
        duplicate: true,
      };
    }

    // One signup bonus per mailbox, ever. The per-uid sentinel above is
    // deleted with the account, so delete + re-signup used to re-grant the
    // bonus. This top-level record outlives the account and holds only a key.
    const grantData = grantSnap?.data();
    const alreadyGrantedElsewhere =
      grantSnap !== null &&
      grantSnap.exists !== false &&
      Boolean(grantData) &&
      grantData?.uid !== input.uid;
    const amount = alreadyGrantedElsewhere ? 0 : initialCredits;

    tx.set(
      userRef,
      {
        email: input.email || userData?.email || null,
        credits: deps.FieldValue.increment(amount),
        createdAt: userData?.createdAt || deps.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    // Written even when nothing is granted, so repeat calls stay idempotent.
    tx.set(ledgerRef, {
      type: "signup_bonus",
      amount,
      source: "account_initialization",
      referenceId: input.uid,
      balanceBefore,
      balanceAfter: balanceBefore + amount,
      metadata: alreadyGrantedElsewhere
        ? { skipped: "email_already_received_signup_bonus" }
        : {},
      createdAt: deps.FieldValue.serverTimestamp(),
    });
    if (grantRef && !alreadyGrantedElsewhere) {
      tx.set(
        grantRef,
        {
          uid: input.uid,
          amount,
          grantedAt: deps.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return {
      balanceBefore,
      balanceAfter: balanceBefore + amount,
      duplicate: false,
    };
  });
}

export async function applyCreditChangeInTransaction(
  tx: TransactionLike,
  deps: CreditTransactionDeps,
  userRef: DocumentRefLike,
  input: CreditChangeInput,
  balanceBefore: number,
): Promise<CreditChangeResult> {
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    throw new CreditError("Credit amount must be non-zero", 400);
  }

  const ledgerId =
    input.ledgerId ||
    (input.referenceId
      ? createLedgerId(input.type, input.referenceId)
      : undefined);
  const ledgerRef = userRef.collection("creditLedger").doc(ledgerId);

  if (ledgerId) {
    const ledgerSnap = await tx.get(ledgerRef);
    const existingLedger = ledgerSnap.data();
    if (ledgerSnap.exists !== false && existingLedger) {
      return {
        balanceBefore: existingLedger.balanceBefore ?? balanceBefore,
        balanceAfter: existingLedger.balanceAfter ?? balanceBefore,
        duplicate: true,
      };
    }
  }

  const balanceAfter = balanceBefore + input.amount;
  // Negative balances are permitted only for a refund clawback debit.
  const negativeAllowed =
    input.allowNegative === true &&
    input.type === "refund_clawback" &&
    input.amount < 0;
  if (balanceAfter < 0 && !negativeAllowed) {
    throw new CreditError("Insufficient credits", 402);
  }

  tx.update(userRef, { credits: deps.FieldValue.increment(input.amount) });
  tx.set(ledgerRef, {
    type: input.type,
    amount: input.amount,
    source: input.source,
    referenceId: input.referenceId || null,
    balanceBefore,
    balanceAfter,
    metadata: input.metadata || {},
    createdAt: deps.FieldValue.serverTimestamp(),
  });

  return { balanceBefore, balanceAfter, duplicate: false };
}
