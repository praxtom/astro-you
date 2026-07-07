import { Config, Context } from "@netlify/functions";
import Razorpay from "razorpay";
import { db, FieldValue } from "./shared/firebase-admin";
import {
  applyCreditChange,
  applyCreditChangeInTransaction,
} from "./shared/credits";
import { getUsageLimit } from "./shared/entitlements";
import { writeAuditLog } from "./shared/audit-log";
import { verifyWebhookSignature } from "./shared/razorpay-payments";
import {
  getSubscriptionGracePeriodEnd,
  resolveTierFromPlanId,
} from "./shared/subscription-plans";

// A "processing" event older than this is treated as stale (a crashed prior
// run) and may be reprocessed, so a mid-flight crash can't wedge an event.
const PROCESSING_STALE_MS = 5 * 60 * 1000;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

/**
 * Resolve the AstroYou uid for a subscription event. Prefers `notes.uid` (set
 * at subscription creation); falls back to the user doc that references this
 * subscription id, so a payload with stripped notes still reaches the right
 * account instead of silently dropping a paid event.
 */
async function resolveSubscriptionUid(
  sub: { id?: string; notes?: Record<string, unknown> } | undefined,
): Promise<string | undefined> {
  const fromNotes = sub?.notes?.uid;
  if (typeof fromNotes === "string" && fromNotes) return fromNotes;
  if (!sub?.id) return undefined;
  const match = await db
    .collection("users")
    .where("subscription.razorpaySubscriptionId", "==", sub.id)
    .limit(1)
    .get();
  return match.empty ? undefined : match.docs[0].id;
}

/**
 * Record that a subscription event could not be matched to any user (money may
 * have moved without credits being granted) — flag for manual review instead
 * of retrying forever.
 */
async function recordUnmatchedSubscriptionEvent(
  eventDocId: string,
  eventType: string,
  sub: { id?: string } | undefined,
) {
  console.error(
    `[Webhook] ${eventType} could not be matched to any user for subscription ${sub?.id} — manual review needed`,
  );
  await db
    .collection("webhookEvents")
    .doc(eventDocId)
    .set(
      { note: "uid_unresolved", subscriptionId: sub?.id || null },
      { merge: true },
    )
    .catch((writeError) => {
      console.error("[Webhook] Failed to note unmatched event:", writeError);
    });
  await writeAuditLog({
    action: "subscription_webhook_unmatched",
    entityType: "subscription",
    entityId: sub?.id,
    metadata: { eventType },
  }).catch((auditError) => {
    console.error("[Webhook] Audit log failed:", auditError);
  });
}

/**
 * Resurrection guard: the user document no longer exists (account deleted),
 * so never re-create it from a webhook. For events that imply active billing,
 * cancel the subscription at Razorpay immediately — the account is gone, stop
 * charging the card.
 */
async function handleOrphanedSubscriptionEvent(
  uid: string,
  eventType: string,
  sub: { id?: string },
  cancelAtRazorpay: boolean,
) {
  console.error(
    `[Webhook] ${eventType} for deleted user ${uid} (subscription ${sub.id}) — user doc NOT recreated`,
  );
  let cancelled = false;
  if (cancelAtRazorpay && sub.id) {
    try {
      await razorpay.subscriptions.cancel(sub.id, false);
      cancelled = true;
    } catch (cancelError) {
      console.error(
        `[Webhook] Failed to cancel orphaned subscription ${sub.id}:`,
        cancelError,
      );
    }
  }
  await writeAuditLog({
    uid,
    action: "subscription_webhook_orphaned",
    entityType: "subscription",
    entityId: sub.id,
    metadata: { eventType, cancelledAtRazorpay: cancelled },
  }).catch((auditError) => {
    console.error("[Webhook] Audit log failed:", auditError);
  });
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let eventId: string | undefined;
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";

    // Verify webhook signature
    if (!verifyWebhookSignature({ body, signature, secret })) {
      console.error("[Webhook] Invalid signature");
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);
    const { event: eventType, payload } = event;
    eventId =
      req.headers.get("x-razorpay-event-id") ||
      event.id ||
      `${eventType}_${Buffer.from(body).toString("base64url").slice(0, 80)}`;
    const resolvedEventId: string = eventId || "unknown_razorpay_event";

    const shouldSkip = await db.runTransaction(async (tx) => {
      const eventRef = db.collection("webhookEvents").doc(resolvedEventId);
      const eventSnap = await tx.get(eventRef);
      const data = eventSnap.data();
      const status = data?.status;
      if (status === "processed") return true;
      // Skip only if another run is actively processing AND it isn't stale; a
      // crashed prior run (stale "processing") is allowed to be retried.
      if (status === "processing") {
        const startedAt = data?.receivedAt?.toMillis?.() ?? 0;
        if (Date.now() - startedAt < PROCESSING_STALE_MS) return true;
      }
      tx.set(
        eventRef,
        {
          provider: "razorpay",
          eventId,
          eventType,
          status: "processing",
          receivedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return false;
    });
    if (shouldSkip) {
      console.log(`[Webhook] Duplicate event ignored: ${eventId}`);
      return new Response("OK", { status: 200 });
    }

    console.log(`[Webhook] Event: ${eventType}`);

    switch (eventType) {
      case "subscription.activated":
      case "subscription.charged": {
        const sub = payload.subscription?.entity;
        const uid = await resolveSubscriptionUid(sub);
        if (!uid) {
          await recordUnmatchedSubscriptionEvent(
            resolvedEventId,
            eventType,
            sub,
          );
          break;
        }

        const planId = sub.plan_id;
        const tier = resolveTierFromPlanId(planId);

        const monthlyCredits = getUsageLimit(tier, "monthlyCredits");
        // Use nullish coalescing so a legitimate 0 timestamp isn't skipped.
        const periodKey =
          sub.current_start ?? sub.current_end ?? sub.charge_at ?? "current";
        const ledgerId = `subscription_${sub.id}_${periodKey}`;
        const userRef = db.collection("users").doc(uid);

        const currentEnd = sub.current_end
          ? new Date(sub.current_end * 1000)
          : null;
        const chargeAt = sub.charge_at ? new Date(sub.charge_at * 1000) : null;
        // `expiresAt` is the field the client uses to decide whether a paid
        // tier is still active. Default to the period end, falling back to the
        // next charge date so access never silently lapses while paid.
        const expiresAt = currentEnd || chargeAt || null;

        const userExists = await db.runTransaction(async (tx) => {
          const userSnap = await tx.get(userRef);
          // Deleted account — never resurrect the user doc from a webhook.
          if (!userSnap.exists) return false;
          const currentCredits = userSnap.data()?.credits ?? 0;

          tx.set(
            userRef,
            {
              subscription: {
                tier,
                status: "active",
                razorpaySubscriptionId: sub.id,
                planId,
                currentStart: sub.current_start
                  ? new Date(sub.current_start * 1000)
                  : new Date(),
                currentEnd,
                chargeAt,
                expiresAt,
              },
            },
            { merge: true },
          );

          await applyCreditChangeInTransaction(
            tx,
            { FieldValue },
            userRef,
            {
              uid,
              amount: monthlyCredits,
              type: "subscription_grant",
              source: "razorpay_subscription",
              referenceId: `${sub.id}_${periodKey}`,
              ledgerId,
              metadata: { subscriptionId: sub.id, planId, tier, eventType },
            },
            currentCredits,
          );
          return true;
        });

        if (!userExists) {
          // Account is gone but the subscription is live — stop billing.
          await handleOrphanedSubscriptionEvent(uid, eventType, sub, true);
          break;
        }

        console.log(`[Webhook] User ${uid} activated ${tier}`);
        await writeAuditLog({
          uid,
          action: "subscription_webhook",
          entityType: "subscription",
          entityId: sub.id,
          metadata: { eventType, tier, planId, monthlyCredits },
        }).catch((auditError) => {
          console.error("[Webhook] Audit log failed:", auditError);
        });
        break;
      }

      case "subscription.halted":
      case "subscription.cancelled": {
        const sub = payload.subscription?.entity;
        const uid = await resolveSubscriptionUid(sub);
        if (!uid) {
          await recordUnmatchedSubscriptionEvent(
            resolvedEventId,
            eventType,
            sub,
          );
          break;
        }

        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
          await handleOrphanedSubscriptionEvent(uid, eventType, sub, false);
          break;
        }

        await userRef.set(
          {
            subscription: {
              tier: "free",
              status:
                eventType === "subscription.cancelled" ? "cancelled" : "halted",
              cancelledAt: new Date(),
              // Drop access immediately — no longer a paying subscriber.
              expiresAt: null,
            },
          },
          { merge: true },
        );

        console.log(`[Webhook] User ${uid} subscription ${eventType}`);
        await writeAuditLog({
          uid,
          action: "subscription_webhook",
          entityType: "subscription",
          entityId: sub.id,
          metadata: { eventType },
        }).catch((auditError) => {
          console.error("[Webhook] Audit log failed:", auditError);
        });
        break;
      }

      case "subscription.pending": {
        const sub = payload.subscription?.entity;
        const uid = await resolveSubscriptionUid(sub);
        if (!uid) {
          await recordUnmatchedSubscriptionEvent(
            resolvedEventId,
            eventType,
            sub,
          );
          break;
        }

        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
          await handleOrphanedSubscriptionEvent(uid, eventType, sub, false);
          break;
        }

        // Anchor the grace period to the end of the already-paid period (when
        // available) rather than to "now", so a pending event arriving early
        // doesn't cut the user's paid time short or extend it arbitrarily.
        const paidThrough = sub.current_end
          ? new Date(sub.current_end * 1000)
          : new Date();
        const gracePeriodEnd = getSubscriptionGracePeriodEnd(paidThrough);
        await userRef.set(
          {
            subscription: {
              status: "pending",
              gracePeriodEnd,
              // Keep paid access alive through the grace period.
              expiresAt: gracePeriodEnd,
            },
          },
          { merge: true },
        );
        await writeAuditLog({
          uid,
          action: "subscription_webhook",
          entityType: "subscription",
          entityId: sub.id,
          metadata: { eventType, status: "pending" },
        }).catch((auditError) => {
          console.error("[Webhook] Audit log failed:", auditError);
        });
        break;
      }

      case "subscription.completed": {
        // Final cycle charged and the subscription ended naturally. Keep the
        // tier and paid access until the already-paid period ends; the daily
        // lapse sweeper downgrades after expiresAt (+grace) passes.
        const sub = payload.subscription?.entity;
        const uid = await resolveSubscriptionUid(sub);
        if (!uid) {
          await recordUnmatchedSubscriptionEvent(
            resolvedEventId,
            eventType,
            sub,
          );
          break;
        }

        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
          await handleOrphanedSubscriptionEvent(uid, eventType, sub, false);
          break;
        }

        const currentEnd = sub.current_end
          ? new Date(sub.current_end * 1000)
          : null;
        await userRef.set(
          {
            subscription: {
              status: "completed",
              completedAt: new Date(),
              // Access ends when the paid-through period ends.
              ...(currentEnd ? { currentEnd, expiresAt: currentEnd } : {}),
            },
          },
          { merge: true },
        );
        await writeAuditLog({
          uid,
          action: "subscription_webhook",
          entityType: "subscription",
          entityId: sub.id,
          metadata: { eventType, status: "completed" },
        }).catch((auditError) => {
          console.error("[Webhook] Audit log failed:", auditError);
        });
        break;
      }

      case "subscription.paused": {
        // Treat paused like halted: billing has stopped, so paid access stops.
        const sub = payload.subscription?.entity;
        const uid = await resolveSubscriptionUid(sub);
        if (!uid) {
          await recordUnmatchedSubscriptionEvent(
            resolvedEventId,
            eventType,
            sub,
          );
          break;
        }

        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
          await handleOrphanedSubscriptionEvent(uid, eventType, sub, false);
          break;
        }

        await userRef.set(
          {
            subscription: {
              tier: "free",
              status: "paused",
              pausedAt: new Date(),
              expiresAt: null,
            },
          },
          { merge: true },
        );
        await writeAuditLog({
          uid,
          action: "subscription_webhook",
          entityType: "subscription",
          entityId: sub.id,
          metadata: { eventType, status: "paused" },
        }).catch((auditError) => {
          console.error("[Webhook] Audit log failed:", auditError);
        });
        break;
      }

      case "subscription.resumed": {
        // Billing resumed — restore the paid tier. Credits are granted by the
        // next subscription.charged event, not here.
        const sub = payload.subscription?.entity;
        const uid = await resolveSubscriptionUid(sub);
        if (!uid) {
          await recordUnmatchedSubscriptionEvent(
            resolvedEventId,
            eventType,
            sub,
          );
          break;
        }

        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
          await handleOrphanedSubscriptionEvent(uid, eventType, sub, true);
          break;
        }

        const tier = resolveTierFromPlanId(sub.plan_id);
        const currentEnd = sub.current_end
          ? new Date(sub.current_end * 1000)
          : null;
        const chargeAt = sub.charge_at ? new Date(sub.charge_at * 1000) : null;
        await userRef.set(
          {
            subscription: {
              tier,
              status: "active",
              resumedAt: new Date(),
              currentEnd,
              chargeAt,
              expiresAt: currentEnd || chargeAt || null,
            },
          },
          { merge: true },
        );
        await writeAuditLog({
          uid,
          action: "subscription_webhook",
          entityType: "subscription",
          entityId: sub.id,
          metadata: { eventType, status: "resumed", tier },
        }).catch((auditError) => {
          console.error("[Webhook] Audit log failed:", auditError);
        });
        break;
      }

      case "payment.captured": {
        // Server-side fallback for one-time credit top-ups: if the buyer's tab
        // closed before the browser called /api/pay/verify, the money was
        // captured but credits were never granted. The shared ledger id
        // (`razorpay_${payment_id}`) makes this replay-safe against the verify
        // path — whichever runs second becomes a no-op duplicate.
        const payment = payload.payment?.entity;
        const orderId = payment?.order_id;
        const paymentId = payment?.id;
        if (!orderId || !paymentId) break;

        const orderRef = db.collection("paymentOrders").doc(orderId);
        const orderSnap = await orderRef.get();
        const orderData = orderSnap.data();
        // No top-up order doc → this capture is not a one-time top-up
        // (e.g. a subscription invoice charge). Ignore.
        if (!orderSnap.exists || !orderData) break;
        // Already settled (by /api/pay/verify or a previous webhook run).
        if (orderData.status !== "created") break;

        const uid = orderData.uid;
        const minutes = Number(orderData.minutes);
        if (!uid || !Number.isFinite(minutes) || minutes <= 0) {
          console.error(
            `[Webhook] payment.captured for order ${orderId} has invalid order data — credits NOT granted`,
          );
          await writeAuditLog({
            uid: typeof uid === "string" ? uid : undefined,
            action: "payment_webhook_invalid_order",
            entityType: "razorpay_payment",
            entityId: paymentId,
            metadata: { razorpay_order_id: orderId },
          }).catch((auditError) => {
            console.error("[Webhook] Audit log failed:", auditError);
          });
          break;
        }

        const userSnap = await db.collection("users").doc(uid).get();
        if (!userSnap.exists) {
          // Account deleted after paying — never resurrect the user doc.
          console.error(
            `[Webhook] payment.captured for deleted user ${uid} (order ${orderId})`,
          );
          await writeAuditLog({
            uid,
            action: "payment_webhook_orphaned",
            entityType: "razorpay_payment",
            entityId: paymentId,
            metadata: { razorpay_order_id: orderId },
          }).catch((auditError) => {
            console.error("[Webhook] Audit log failed:", auditError);
          });
          break;
        }

        // Mirrors the crediting in razorpay-verify.ts, including the exact
        // ledger id scheme; minutes are server-authoritative from the order
        // doc written at order creation.
        const creditResult = await applyCreditChange(
          { db, FieldValue },
          {
            uid,
            amount: minutes,
            type: "purchase",
            source: "razorpay",
            referenceId: paymentId,
            ledgerId: `razorpay_${paymentId}`,
            metadata: {
              razorpay_order_id: orderId,
              razorpay_payment_id: paymentId,
              paymentOrderId: orderRef.id,
              amountInRupees: orderData.amountInRupees,
              via: "webhook",
            },
          },
        );

        await orderRef.set(
          {
            status: "paid",
            razorpayPaymentId: paymentId,
            paidAt: FieldValue.serverTimestamp(),
            balanceAfter: creditResult.balanceAfter,
            duplicate: creditResult.duplicate,
            settledVia: "webhook",
          },
          { merge: true },
        );

        console.log(
          `[Webhook] payment.captured settled order ${orderId} for ${uid} (duplicate=${creditResult.duplicate})`,
        );
        await writeAuditLog({
          uid,
          action: "payment_captured_webhook",
          entityType: "razorpay_payment",
          entityId: paymentId,
          metadata: {
            razorpay_order_id: orderId,
            creditsAdded: creditResult.duplicate ? 0 : minutes,
            balanceAfter: creditResult.balanceAfter,
            duplicate: creditResult.duplicate,
          },
        }).catch((auditError) => {
          console.error("[Webhook] Audit log failed:", auditError);
        });
        break;
      }
    }

    await db.collection("webhookEvents").doc(resolvedEventId).set(
      {
        status: "processed",
        processedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return new Response("OK", { status: 200 });
  } catch (err: any) {
    console.error("[Webhook] Error:", err);
    if (eventId) {
      await db
        .collection("webhookEvents")
        .doc(eventId)
        .set(
          {
            status: "failed",
            failedAt: FieldValue.serverTimestamp(),
            error: err.message || "Webhook failed",
          },
          { merge: true },
        )
        .catch((writeError) => {
          console.error("[Webhook] Failed to mark event failure:", writeError);
        });
    }
    return new Response("Error", { status: 500 });
  }
};

export const config: Config = { path: "/api/subscription/webhook" };
