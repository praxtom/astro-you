import { schedule } from "@netlify/functions";
import { db } from "./shared/firebase-admin";
import { writeAuditLog } from "./shared/audit-log";
import {
  hasSubscriptionLapsed,
  SUBSCRIPTION_GRACE_DAYS,
} from "./shared/subscription-plans";

/**
 * Daily sweeper that downgrades paid subscriptions whose paid-through date
 * (plus the standard grace window) has passed without a webhook resolving
 * them — halted/pending subscriptions that never recovered, completed
 * subscriptions past their final period, and lost cancellation webhooks.
 * Without this, nothing server-side ever expires a paid tier: the only
 * expiry check lives in the client and is trivially bypassed.
 */

const BATCH_SIZE = Number(process.env.SUBSCRIPTION_LAPSE_BATCH_SIZE || 200);

export const handler = schedule("45 2 * * *", async () => {
  const now = Date.now();
  const cutoff = new Date(now - SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000);

  // Single-field range query, drained across runs: lapsing a user nulls
  // subscription.expiresAt, which removes the doc from future sweeps, so a
  // plain limit() works as pagination without a cursor.
  const snap = await db
    .collection("users")
    .where("subscription.expiresAt", "<", cutoff)
    .limit(BATCH_SIZE)
    .get();

  let lapsed = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const subscription = doc.data()?.subscription || {};
    try {
      if (hasSubscriptionLapsed(subscription, now)) {
        await doc.ref.set(
          {
            subscription: {
              tier: "free",
              status: "expired",
              expiredAt: new Date(),
              // Clear so this doc drops out of the sweep query once handled.
              expiresAt: null,
            },
          },
          { merge: true },
        );
        lapsed += 1;
        await writeAuditLog({
          uid: doc.id,
          action: "subscription_lapsed",
          entityType: "subscription",
          entityId: subscription.razorpaySubscriptionId || undefined,
          metadata: {
            previousTier: subscription.tier || null,
            previousStatus: subscription.status || null,
            graceDays: SUBSCRIPTION_GRACE_DAYS,
          },
        }).catch((auditError) => {
          console.error("[SubscriptionLapse] Audit log failed:", auditError);
        });
      } else {
        // Matched the range query but isn't a lapsable paid tier (e.g. a
        // free-tier doc with a stale expiresAt). Null the stale timestamp so
        // it stops occupying the sweep batch.
        await doc.ref.set(
          { subscription: { expiresAt: null } },
          { merge: true },
        );
        skipped += 1;
      }
    } catch (err) {
      failed += 1;
      console.error("[SubscriptionLapse] Failed for user", doc.id, err);
    }
  }

  console.log(
    `[SubscriptionLapse] scanned=${snap.size} lapsed=${lapsed} skipped=${skipped} failed=${failed}`,
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ scanned: snap.size, lapsed, skipped, failed }),
  };
});
