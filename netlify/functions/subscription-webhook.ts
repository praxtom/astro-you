import { Config, Context } from "@netlify/functions";
import { db, FieldValue } from "./shared/firebase-admin";
import { applyCreditChangeInTransaction } from "./shared/credits";
import { getUsageLimit } from "./shared/entitlements";
import { writeAuditLog } from "./shared/audit-log";
import { verifyWebhookSignature } from "./shared/razorpay-payments";
import {
  getSubscriptionGracePeriodEnd,
  resolveTierFromPlanId,
} from "./shared/subscription-plans";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

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
      const status = eventSnap.data()?.status;
      if (status === "processed" || status === "processing") return true;
      tx.set(eventRef, {
        provider: "razorpay",
        eventId,
        eventType,
        status: "processing",
        receivedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
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
        const uid = sub?.notes?.uid;
        if (!uid) break;

        const planId = sub.plan_id;
        const tier = resolveTierFromPlanId(planId);

        const monthlyCredits = getUsageLimit(tier, "monthlyCredits");
        const periodKey = sub.current_start || sub.current_end || sub.charge_at || "current";
        const ledgerId = `subscription_${sub.id}_${periodKey}`;
        const userRef = db.collection("users").doc(uid);

        await db.runTransaction(async (tx) => {
          const userSnap = await tx.get(userRef);
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
                currentEnd: sub.current_end
                  ? new Date(sub.current_end * 1000)
                  : null,
                chargeAt: sub.charge_at ? new Date(sub.charge_at * 1000) : null,
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
        });

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
        const uid = sub?.notes?.uid;
        if (!uid) break;

        await db
          .collection("users")
          .doc(uid)
          .set(
            {
              subscription: {
                tier: "free",
                status:
                  eventType === "subscription.cancelled"
                    ? "cancelled"
                    : "halted",
                cancelledAt: new Date(),
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
        const uid = sub?.notes?.uid;
        if (!uid) break;

        await db
          .collection("users")
          .doc(uid)
          .set(
            {
              subscription: {
                status: "pending",
                gracePeriodEnd: getSubscriptionGracePeriodEnd(),
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
    }

    await db.collection("webhookEvents").doc(resolvedEventId).set({
      status: "processed",
      processedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return new Response("OK", { status: 200 });
  } catch (err: any) {
    console.error("[Webhook] Error:", err);
    if (eventId) {
      await db.collection("webhookEvents").doc(eventId).set({
        status: "failed",
        failedAt: FieldValue.serverTimestamp(),
        error: err.message || "Webhook failed",
      }, { merge: true }).catch((writeError) => {
        console.error("[Webhook] Failed to mark event failure:", writeError);
      });
    }
    return new Response("Error", { status: 500 });
  }
};

export const config: Config = { path: "/api/subscription/webhook" };
