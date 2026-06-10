import { getUsageLimit } from "./entitlements.js";

export type CreditChangeType =
  | "purchase"
  | "consultation"
  | "synthesis"
  | "report"
  | "refund"
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
  return `${type}_${referenceId}`.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 500);
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

export async function initializeUserCredits(
  deps: CreditDeps,
  input: InitializeUserCreditsInput,
): Promise<CreditChangeResult> {
  const initialCredits = input.initialCredits ?? getUsageLimit("free", "monthlyCredits");
  const userRef = deps.db.collection("users").doc(input.uid);
  const ledgerRef = userRef.collection("creditLedger").doc("signup_bonus");

  return deps.db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const ledgerSnap = await tx.get(ledgerRef);
    const userData = userSnap.data();
    const balanceBefore = userData?.credits ?? 0;
    const existingLedger = ledgerSnap.data();

    if (userData?.credits !== undefined || existingLedger) {
      return {
        balanceBefore,
        balanceAfter: balanceBefore,
        duplicate: true,
      };
    }

    tx.set(
      userRef,
      {
        email: input.email || userData?.email || null,
        credits: deps.FieldValue.increment(initialCredits),
        createdAt: userData?.createdAt || deps.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(ledgerRef, {
      type: "signup_bonus",
      amount: initialCredits,
      source: "account_initialization",
      referenceId: input.uid,
      balanceBefore,
      balanceAfter: balanceBefore + initialCredits,
      metadata: {},
      createdAt: deps.FieldValue.serverTimestamp(),
    });

    return {
      balanceBefore,
      balanceAfter: balanceBefore + initialCredits,
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
    (input.referenceId ? createLedgerId(input.type, input.referenceId) : undefined);
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
  if (balanceAfter < 0) {
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
