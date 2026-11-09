/**
 * Taking back credits when Razorpay refunds a payment.
 *
 * Credits granted by a payment (a top-up pack, or a subscription's monthly
 * credits) are debited through the ledger when that payment is refunded. The
 * user may already have spent them, so this is the ONE debit allowed to push
 * the balance below zero; the debt is repaid by the next top-up. Each refund
 * id is applied at most once, and the total taken back never exceeds what the
 * payment granted.
 */
import {
  applyCreditChangeInTransaction,
  type CreditTransactionDeps,
} from "./credits.js";

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

export interface RefundDeps extends CreditTransactionDeps {
  db: {
    collection(name: string): CollectionRefLike;
    runTransaction<T>(
      callback: (tx: TransactionLike) => Promise<T>,
    ): Promise<T>;
  };
}

/**
 * Credits to take back for one refund. Proportional to the refunded share of
 * the payment (rounded up, so repeated partial refunds can't each round down
 * to nothing), and never more than what is still un-clawed from the grant.
 */
export function computeRefundClawback(input: {
  grantedCredits: number;
  alreadyClawedBack?: number;
  paymentAmount?: number | null;
  refundAmount?: number | null;
}): number {
  const granted = Math.max(0, Math.floor(input.grantedCredits || 0));
  const already = Math.max(0, Math.floor(input.alreadyClawedBack || 0));
  const remaining = Math.max(0, granted - already);
  const payment = Number(input.paymentAmount);
  const refund = Number(input.refundAmount);
  if (
    !Number.isFinite(payment) ||
    payment <= 0 ||
    !Number.isFinite(refund) ||
    refund <= 0 ||
    refund >= payment
  ) {
    return remaining;
  }
  return Math.min(remaining, Math.ceil((granted * refund) / payment));
}

export interface RefundClawbackInput {
  uid: string;
  paymentId: string;
  refundId: string;
  /** Ledger entry that granted the credits for this payment. */
  grantLedgerId: string;
  /** Fallback when the grant ledger entry has no usable amount. */
  grantedCredits: number;
  paymentAmount?: number | null;
  refundAmount?: number | null;
  /** Top-up order to mark refunded so a late verify can't grant it. */
  orderId?: string | null;
  kind: "topup" | "subscription";
}

export interface RefundClawbackResult {
  outcome: "clawed_back" | "nothing_granted" | "duplicate" | "user_missing";
  clawback: number;
  balanceAfter?: number;
}

export async function applyRefundClawback(
  deps: RefundDeps,
  input: RefundClawbackInput,
): Promise<RefundClawbackResult> {
  const userRef = deps.db.collection("users").doc(input.uid);
  const grantLedgerRef = userRef
    .collection("creditLedger")
    .doc(input.grantLedgerId);
  const refundsRef = deps.db.collection("paymentRefunds").doc(input.paymentId);
  const orderRef = input.orderId
    ? deps.db.collection("paymentOrders").doc(input.orderId)
    : null;

  return deps.db.runTransaction(async (tx) => {
    // All reads first (Firestore transactions reject reads after writes).
    const userSnap = await tx.get(userRef);
    const grantSnap = await tx.get(grantLedgerRef);
    const refundsSnap = await tx.get(refundsRef);

    if (userSnap.exists === false || !userSnap.data()) {
      return { outcome: "user_missing" as const, clawback: 0 };
    }

    const refunds = refundsSnap.data() || {};
    const refundIds: string[] = Array.isArray(refunds.refundIds)
      ? refunds.refundIds.filter((id: unknown) => typeof id === "string")
      : [];
    if (refundIds.includes(input.refundId)) {
      return { outcome: "duplicate" as const, clawback: 0 };
    }

    const grant = grantSnap.exists === false ? undefined : grantSnap.data();
    const grantedCredits = grant
      ? typeof grant.amount === "number" && grant.amount > 0
        ? grant.amount
        : input.grantedCredits
      : 0;
    const alreadyClawedBack =
      typeof refunds.clawedBackCredits === "number"
        ? refunds.clawedBackCredits
        : 0;
    const clawback = computeRefundClawback({
      grantedCredits,
      alreadyClawedBack,
      paymentAmount: input.paymentAmount,
      refundAmount: input.refundAmount,
    });
    const balanceBefore = userSnap.data()?.credits ?? 0;

    let balanceAfter = balanceBefore;
    if (clawback > 0) {
      const result = await applyCreditChangeInTransaction(
        tx,
        { FieldValue: deps.FieldValue },
        userRef,
        {
          uid: input.uid,
          amount: -clawback,
          type: "refund_clawback",
          source: "razorpay_refund",
          referenceId: input.refundId,
          ledgerId: `refund_clawback_${input.refundId}`,
          allowNegative: true,
          metadata: {
            razorpay_payment_id: input.paymentId,
            razorpay_refund_id: input.refundId,
            grantLedgerId: input.grantLedgerId,
            kind: input.kind,
            refundAmount: input.refundAmount ?? null,
            paymentAmount: input.paymentAmount ?? null,
          },
        },
        balanceBefore,
      );
      balanceAfter = result.balanceAfter;
    }

    const fullyRefunded =
      !input.paymentAmount ||
      !input.refundAmount ||
      Number(input.refundAmount) >= Number(input.paymentAmount);
    tx.set(
      refundsRef,
      {
        uid: input.uid,
        paymentId: input.paymentId,
        kind: input.kind,
        refundIds: [...refundIds, input.refundId],
        clawedBackCredits: alreadyClawedBack + clawback,
        updatedAt: deps.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    if (orderRef) {
      // Blocks a verify/webhook grant that hasn't happened yet.
      tx.set(
        orderRef,
        {
          status: fullyRefunded ? "refunded" : "partially_refunded",
          refundedAt: deps.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return {
      outcome: grant ? ("clawed_back" as const) : ("nothing_granted" as const),
      clawback,
      balanceAfter,
    };
  });
}
