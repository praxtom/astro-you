import type { Config } from "@netlify/functions";
import { db } from "./shared/firebase-admin";
import { writeAuditLog } from "./shared/audit-log";
import { recordJobRun } from "./shared/ops-alerts";
import {
  decideLapseAction,
  SUBSCRIPTION_GRACE_DAYS,
} from "./shared/subscription-plans";

/**
 * Daily sweeper that downgrades paid subscriptions whose paid-through date
 * (plus the standard grace window) has passed without a webhook resolving
 * them — halted/pending subscriptions that never recovered, completed
 * subscriptions past their final period, and lost cancellation webhooks.
 * Without this, nothing server-side ever expires a paid tier: the only
 * expiry check lives in the client and is trivially bypassed.
 *
 * Each downgrade re-reads the user inside a transaction and re-checks the
 * lapse condition there, so a renewal webhook that lands between the sweep
 * query and the write (pushing expiresAt forward) is never overwritten.
 */

const BATCH_SIZE = Number(process.env.SUBSCRIPTION_LAPSE_BATCH_SIZE || 200);
/** Stop starting new work after this long; Netlify kills scheduled runs at 30s. */
const TIME_BUDGET_MS = 20_000;

type LapseOutcome = "lapsed" | "cleared" | "renewed";

export default async (_req: Request): Promise<Response> => {
  try {
    return await runLapseSweep();
  } catch (err) {
    console.error("[SubscriptionLapse] Run failed:", err);
    await recordJobRun("subscription-lapse", { ok: false, note: "run_threw" });
    return new Response(JSON.stringify({ error: "lapse_sweep_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

async function runLapseSweep(): Promise<Response> {
  const startedAt = Date.now();
  const now = startedAt;
  const cutoff = new Date(now - SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000);

  // Single-field range query, drained across runs: lapsing a user nulls
  // subscription.expiresAt, which removes the doc from future sweeps, so a
  // plain limit() works as pagination without a cursor. Range filters order
  // by the field ascending, so the longest-overdue users go first.
  const snap = await db
    .collection("users")
    .where("subscription.expiresAt", "<", cutoff)
    .limit(BATCH_SIZE)
    .get();

  let lapsed = 0;
  let skipped = 0;
  let renewed = 0;
  let failed = 0;
  let deferred = 0;

  for (const doc of snap.docs) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      deferred += 1;
      continue;
    }
    try {
      const result = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        const subscription = fresh.data()?.subscription || {};
        const action = decideLapseAction(subscription, Date.now());
        if (action === "lapse") {
          tx.set(
            doc.ref,
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
          return { outcome: "lapsed" as LapseOutcome, subscription };
        }
        if (action === "clear") {
          // Matched the range query but isn't a lapsable paid tier (e.g. a
          // free-tier doc with a stale expiresAt). Null the stale timestamp so
          // it stops occupying the sweep batch.
          tx.set(
            doc.ref,
            { subscription: { expiresAt: null } },
            { merge: true },
          );
          return { outcome: "cleared" as LapseOutcome, subscription };
        }
        // A paid tier that no longer lapses: a renewal arrived after the
        // query ran. Leave it alone.
        return { outcome: "renewed" as LapseOutcome, subscription };
      });

      if (result.outcome === "lapsed") {
        lapsed += 1;
        await writeAuditLog({
          uid: doc.id,
          action: "subscription_lapsed",
          entityType: "subscription",
          entityId: result.subscription.razorpaySubscriptionId || undefined,
          metadata: {
            previousTier: result.subscription.tier || null,
            previousStatus: result.subscription.status || null,
            graceDays: SUBSCRIPTION_GRACE_DAYS,
          },
        }).catch((auditError) => {
          console.error("[SubscriptionLapse] Audit log failed:", auditError);
        });
      } else if (result.outcome === "cleared") {
        skipped += 1;
      } else {
        renewed += 1;
      }
    } catch (err) {
      failed += 1;
      console.error("[SubscriptionLapse] Failed for user", doc.id, err);
    }
  }

  const summary = {
    scanned: snap.size,
    lapsed,
    skipped,
    renewed,
    failed,
    deferred,
  };
  console.log(`[SubscriptionLapse] ${JSON.stringify(summary)}`);
  await recordJobRun("subscription-lapse", {
    ok: true,
    processed: lapsed,
    failed,
    skipped: skipped + renewed + deferred,
  });
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = { schedule: "45 2 * * *" };
