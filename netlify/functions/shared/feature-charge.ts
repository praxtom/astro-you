/**
 * Firebase-free core of metered feature charging (see feature-credits.ts).
 *
 * Idempotency model: the caller supplies a deterministic `txnId` (chart +
 * period window), so genuine duplicate requests — tab switches, refreshes,
 * double clicks — find the existing charge and are not billed again.
 *
 * But a charge that was REFUNDED (delivery failed) must not keep deduping:
 * otherwise every later retry for that window would be served free forever.
 * So charges are numbered attempts under the same txnId:
 *
 *   attempt 0: feature_<f>_<txn>          refund: feature_<f>_refund_<txn>
 *   attempt n: feature_<f>_<txn>_r<n>     refund: feature_<f>_refund_<txn>_r<n>
 *
 * Attempt 0 keeps the historical ledger ids, so existing ledgers stay valid.
 * Reservation walks the attempts in one transaction: the first attempt that
 * was charged and NOT refunded means "already paid" (no charge); a refunded
 * attempt moves on to the next; the first unused attempt is charged.
 */
import {
  applyCreditChange,
  applyCreditChangeInTransaction,
  type CreditDeps,
} from "./credits.js";

/** Safety bound on refund→retry cycles for one window. */
export const MAX_CHARGE_ATTEMPTS = 25;

export interface FeatureCharge {
  charged: boolean;
  refund: () => Promise<void>;
}

export function chargeLedgerId(
  feature: string,
  txnId: string,
  attempt: number,
) {
  return attempt === 0
    ? `feature_${feature}_${txnId}`
    : `feature_${feature}_${txnId}_r${attempt}`;
}

export function refundLedgerId(
  feature: string,
  txnId: string,
  attempt: number,
) {
  return attempt === 0
    ? `feature_${feature}_refund_${txnId}`
    : `feature_${feature}_refund_${txnId}_r${attempt}`;
}

const NOOP: FeatureCharge = { charged: false, refund: async () => {} };

/**
 * Reserve `cost` credits for `feature`. Throws CreditError (402) when the
 * balance is insufficient. Returns a no-op charge when this window is already
 * paid for (a live, unrefunded attempt exists).
 */
export async function reserveFeatureCharge(
  deps: CreditDeps,
  uid: string,
  feature: string,
  cost: number,
  txnId: string,
): Promise<FeatureCharge> {
  if (!cost || cost <= 0) return NOOP;

  const userRef = deps.db.collection("users").doc(uid);
  const ledger = userRef.collection("creditLedger");

  const attempt = await deps.db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const balanceBefore = userSnap.data()?.credits ?? 0;

    for (let n = 0; n < MAX_CHARGE_ATTEMPTS; n++) {
      const chargeSnap = await tx.get(
        ledger.doc(chargeLedgerId(feature, txnId, n)),
      );
      const charged = chargeSnap.exists !== false && Boolean(chargeSnap.data());
      if (!charged) {
        // First unused attempt: charge it (throws CreditError on low balance).
        await applyCreditChangeInTransaction(
          tx,
          { FieldValue: deps.FieldValue },
          userRef,
          {
            uid,
            amount: -cost,
            type: "feature",
            source: `feature_${feature}`,
            ledgerId: chargeLedgerId(feature, txnId, n),
            metadata: { feature, attempt: n },
          },
          balanceBefore,
        );
        return n;
      }
      const refundSnap = await tx.get(
        ledger.doc(refundLedgerId(feature, txnId, n)),
      );
      const refunded =
        refundSnap.exists !== false && Boolean(refundSnap.data());
      // Charged and still standing → genuine duplicate: already paid.
      if (!refunded) return null;
    }
    // Pathological refund loop: stop serving this window for free.
    return null;
  });

  if (attempt === null) return NOOP;

  let refundedLocally = false;
  return {
    charged: true,
    refund: async () => {
      if (refundedLocally) return;
      refundedLocally = true;
      try {
        await applyCreditChange(deps, {
          uid,
          amount: cost,
          type: "refund",
          source: `feature_${feature}_refund`,
          ledgerId: refundLedgerId(feature, txnId, attempt),
          metadata: { feature, attempt, reason: "delivery_failed" },
        });
      } catch (err) {
        console.error(`[Credits] Refund failed for ${feature}:`, err);
      }
    },
  };
}
