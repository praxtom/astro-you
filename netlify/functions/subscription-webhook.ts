import { Config, Context } from "@netlify/functions";
import Razorpay from "razorpay";
import { db, FieldValue } from "./shared/firebase-admin";
import {
  applyCreditChangeInTransaction,
  type CreditChangeResult,
} from "./shared/credits";
import { writeAuditLog } from "./shared/audit-log";
import { verifyWebhookSignature } from "./shared/razorpay-payments";
import {
  planSubscriptionEvent,
  type RazorpaySubscriptionEntityLike,
  type SubscriptionEventPlan,
} from "./shared/subscription-plans";
import { applyRefundClawback } from "./shared/payment-refunds";
import { grantReferrerRewardAfterPayment } from "./shared/referrals";
import { reportOpsEvent } from "./shared/ops-alerts";
import { reconcileHostedCheckout, settleTopupPayment } from "./shared/hosted-payments";
import { hostedProvider } from "./shared/hosted-razorpay";

// A "processing" event older than this is treated as stale (a crashed prior
// run) and may be reprocessed, so a mid-flight crash can't wedge an event.
const PROCESSING_STALE_MS = 5 * 60 * 1000;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

const SUBSCRIPTION_EVENTS = new Set([
  "subscription.activated",
  "subscription.charged",
  "subscription.halted",
  "subscription.cancelled",
  "subscription.pending",
  "subscription.completed",
  "subscription.paused",
  "subscription.resumed",
]);

/** Events that mean the subscription is (or was) billing the card. */
const BILLING_EVENTS = new Set([
  "subscription.activated",
  "subscription.charged",
  "subscription.resumed",
]);

interface RazorpayPaymentEntityLike {
  id?: string;
  order_id?: string | null;
  invoice_id?: string | null;
  amount?: number;
  currency?: string;
}

/**
 * Resolve the AstroYou uid for a subscription event. Prefers `notes.uid` (set
 * at subscription creation); falls back to the user doc that references this
 * subscription id — as the current plan or as a pending checkout — so a
 * payload with stripped notes still reaches the right account.
 */
async function resolveSubscriptionUid(
  sub: RazorpaySubscriptionEntityLike | undefined,
): Promise<string | undefined> {
  const notes = sub?.notes;
  const fromNotes =
    notes && !Array.isArray(notes)
      ? (notes as Record<string, unknown>).uid
      : undefined;
  if (typeof fromNotes === "string" && fromNotes) return fromNotes;
  if (!sub?.id) return undefined;
  for (const field of [
    "subscription.razorpaySubscriptionId",
    "subscription.pendingSubscription.razorpaySubscriptionId",
  ]) {
    const match = await db
      .collection("users")
      .where(field, "==", sub.id)
      .limit(1)
      .get();
    if (!match.empty) return match.docs[0].id;
  }
  return undefined;
}

async function noteEvent(eventDocId: string, data: Record<string, unknown>) {
  await db
    .collection("webhookEvents")
    .doc(eventDocId)
    .set(data, { merge: true })
    .catch((writeError) => {
      console.error("[Webhook] Failed to annotate event:", writeError);
    });
}

async function audit(entry: Parameters<typeof writeAuditLog>[0]) {
  await writeAuditLog(entry).catch((auditError) => {
    console.error("[Webhook] Audit log failed:", auditError);
  });
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
  await noteEvent(eventDocId, {
    note: "uid_unresolved",
    subscriptionId: sub?.id || null,
  });
  await audit({
    action: "subscription_webhook_unmatched",
    entityType: "subscription",
    entityId: sub?.id,
    metadata: { eventType },
  });
  // Money may have moved with no credits granted: page a human.
  await reportOpsEvent(
    "payment_credits_not_granted",
    { reason: "subscription_unmatched", eventType, subscriptionId: sub?.id },
    { severity: "critical", dedupeKey: sub?.id || eventDocId },
  );
}

/** Cancel Razorpay subscriptions immediately (best effort, audited). */
async function cancelAtRazorpay(
  ids: string[],
  uid: string | undefined,
  reason: string,
): Promise<void> {
  for (const id of ids) {
    let cancelled = false;
    try {
      await razorpay.subscriptions.cancel(id, false);
      cancelled = true;
    } catch (cancelError: any) {
      console.error(
        `[Webhook] Failed to cancel subscription ${id} (${reason}):`,
        cancelError?.statusCode ?? cancelError?.name ?? "error",
      );
    }
    await audit({
      uid,
      action: "subscription_cancelled_by_system",
      entityType: "subscription",
      entityId: id,
      metadata: { reason, cancelled },
    });
  }
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
  shouldCancel: boolean,
) {
  console.error(
    `[Webhook] ${eventType} for deleted user ${uid} (subscription ${sub.id}) — user doc NOT recreated`,
  );
  if (shouldCancel && sub.id) {
    await cancelAtRazorpay([sub.id], uid, "account_deleted");
  }
  await audit({
    uid,
    action: "subscription_webhook_orphaned",
    entityType: "subscription",
    entityId: sub.id,
    metadata: { eventType, cancelRequested: shouldCancel },
  });
}

/** Best-effort: the referee's first payment unlocks the referrer's reward. */
async function rewardReferrer(
  uid: string,
  source: string,
  referenceId: string,
) {
  try {
    await grantReferrerRewardAfterPayment({ db, FieldValue }, uid, {
      source,
      referenceId,
    });
  } catch (err: any) {
    console.error("[Webhook] Referral reward failed:", err?.message || err);
  }
}

async function handleSubscriptionEvent(
  eventType: string,
  sub: RazorpaySubscriptionEntityLike | undefined,
  payment: RazorpayPaymentEntityLike | undefined,
  eventCreatedAt: number | null,
  eventDocId: string,
) {
  const uid = await resolveSubscriptionUid(sub);
  if (!sub?.id || !uid) {
    await recordUnmatchedSubscriptionEvent(eventDocId, eventType, sub);
    return;
  }

  const userRef = db.collection("users").doc(uid);
  const result = await db.runTransaction(async (tx) => {
    // Reads first: Firestore transactions reject reads after writes.
    const userSnap = await tx.get(userRef);
    // Deleted account — never resurrect the user doc from a webhook.
    if (!userSnap.exists) return { exists: false as const };
    const userData = userSnap.data() || {};

    const plan: SubscriptionEventPlan = planSubscriptionEvent({
      eventType,
      sub,
      subscription: userData.subscription,
      eventCreatedAt,
    });

    let grantResult: CreditChangeResult | null = null;
    if (plan.grant) {
      grantResult = await applyCreditChangeInTransaction(
        tx,
        { FieldValue },
        userRef,
        {
          uid,
          amount: plan.grant.amount,
          type: "subscription_grant",
          source: "razorpay_subscription",
          referenceId: plan.grant.referenceId,
          ledgerId: plan.grant.ledgerId,
          metadata: {
            subscriptionId: sub.id,
            planId: plan.grant.planId,
            tier: plan.grant.tier,
            eventType,
            role: plan.role,
            ...(payment?.id ? { razorpay_payment_id: payment.id } : {}),
          },
        },
        userData.credits ?? 0,
      );
      // Lets a later refund of this payment find (and take back) the grant.
      if (payment?.id) {
        tx.set(
          db.collection("paymentGrants").doc(payment.id),
          {
            uid,
            kind: "subscription",
            subscriptionId: sub.id,
            ledgerId: plan.grant.ledgerId,
            credits: plan.grant.amount,
            amount: payment.amount ?? null,
            currency: payment.currency ?? null,
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    }

    if (plan.replaceSubscription) {
      // Promotion: the new subscription replaces the old map wholesale (this
      // also drops pendingSubscription and stale cancel/grace fields).
      tx.update(userRef, { subscription: plan.replaceSubscription });
    } else if (plan.mergeSubscription || plan.clearPending) {
      tx.set(
        userRef,
        {
          subscription: {
            ...(plan.mergeSubscription || {}),
            ...(plan.clearPending
              ? { pendingSubscription: FieldValue.delete() }
              : {}),
          },
        },
        { merge: true },
      );
    }

    return { exists: true as const, plan, grantResult };
  });

  if (!result.exists) {
    await handleOrphanedSubscriptionEvent(
      uid,
      eventType,
      sub,
      BILLING_EVENTS.has(eventType),
    );
    return;
  }

  const { plan, grantResult } = result;
  if (plan.cancelAtRazorpay.length > 0) {
    await cancelAtRazorpay(
      plan.cancelAtRazorpay,
      uid,
      plan.outcome === "promoted" ? "replaced_by_new_plan" : "superseded",
    );
  }
  if (plan.outcome !== "updated") {
    await noteEvent(eventDocId, {
      note: plan.outcome,
      subscriptionRole: plan.role,
      subscriptionId: sub.id,
    });
  }
  if (plan.grant) {
    await rewardReferrer(uid, "subscription", plan.grant.referenceId);
  }

  console.log(
    `[Webhook] ${eventType} for ${uid}: role=${plan.role} outcome=${plan.outcome}`,
  );
  await audit({
    uid,
    action: "subscription_webhook",
    entityType: "subscription",
    entityId: sub.id,
    metadata: {
      eventType,
      role: plan.role,
      outcome: plan.outcome,
      tier: plan.grant?.tier ?? null,
      creditsGranted:
        plan.grant && grantResult && !grantResult.duplicate
          ? plan.grant.amount
          : 0,
      cancelled: plan.cancelAtRazorpay,
    },
  });
}

async function handleRefundProcessed(
  payload: any,
  eventDocId: string,
): Promise<void> {
  const refund = payload?.refund?.entity;
  let payment: RazorpayPaymentEntityLike | undefined =
    payload?.payment?.entity;
  const refundId: string | undefined = refund?.id;
  const paymentId: string | undefined = refund?.payment_id || payment?.id;
  if (!refundId || !paymentId) return;
  await db.runTransaction(async tx => {
    const ref = db.collection("paymentRefunds").doc(paymentId);
    await tx.get(ref);
    tx.set(ref, { blocked: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  // Refund webhooks do not always include the payment entity.
  if (!payment?.order_id) {
    const fetched = await hostedProvider.payment(paymentId);
    payment = { ...fetched, amount: Number(fetched.amount) };
  }


  // Which grant did this payment fund? Subscription charges record a
  // paymentGrants doc; one-time top-ups are found through their order.
  let target: {
    uid: string;
    grantLedgerId: string;
    grantedCredits: number;
    orderId: string | null;
    kind: "topup" | "subscription";
  } | null = null;

  const grantSnap = await db.collection("paymentGrants").doc(paymentId).get();
  const grant = grantSnap.data();
  if (grantSnap.exists && grant?.uid && grant?.ledgerId) {
    target = {
      uid: grant.uid,
      grantLedgerId: grant.ledgerId,
      grantedCredits: Number(grant.credits) || 0,
      orderId: null,
      kind: "subscription",
    };
  } else if (payment?.order_id) {
    const orderSnap = await db
      .collection("paymentOrders")
      .doc(payment.order_id)
      .get();
    const order = orderSnap.data();
    if (orderSnap.exists && order?.uid) {
      target = {
        uid: order.uid,
        grantLedgerId: `razorpay_${paymentId}`,
        grantedCredits: Number(order.minutes) || 0,
        orderId: payment.order_id,
        kind: "topup",
      };
    }
  }

  if (!target) {
    console.error(
      `[Webhook] refund ${refundId} for payment ${paymentId} matched no credit grant — manual review`,
    );
    await noteEvent(eventDocId, { note: "refund_unmatched", paymentId });
    await audit({
      action: "refund_webhook_unmatched",
      entityType: "razorpay_payment",
      entityId: paymentId,
      metadata: { refundId },
    });
    return;
  }

  const result = await applyRefundClawback(
    { db, FieldValue },
    {
      uid: target.uid,
      paymentId,
      refundId,
      grantLedgerId: target.grantLedgerId,
      grantedCredits: target.grantedCredits,
      paymentAmount: payment?.amount ?? null,
      refundAmount: typeof refund?.amount === "number" ? refund.amount : null,
      orderId: target.orderId,
      kind: target.kind,
    },
  );

  console.log(
    `[Webhook] refund ${refundId} for ${target.uid}: ${result.outcome} clawback=${result.clawback}`,
  );
  await audit({
    uid: target.uid,
    action: "refund_credits_clawback",
    entityType: "razorpay_payment",
    entityId: paymentId,
    metadata: {
      refundId,
      kind: target.kind,
      outcome: result.outcome,
      clawback: result.clawback,
      balanceAfter: result.balanceAfter ?? null,
    },
  });
}

async function handlePaymentCaptured(payload: any): Promise<void> {
  const paymentId = payload?.payment?.entity?.id;
  if (!paymentId) return;
  const payment = await hostedProvider.payment(paymentId);
  if (!payment.order_id) return;
  const order = await db.collection("paymentOrders").doc(payment.order_id).get();
  if (!order.exists) return;
  const result = await settleTopupPayment({ db, FieldValue }, {
    orderId: payment.order_id, payment, checkoutId: order.data()?.hostedCheckoutId,
  });
  if (result.status === "paid") {
    await rewardReferrer(result.uid, "topup", paymentId);
  } else if (result.status === "account_missing") {
    await reportOpsEvent("payment_credits_not_granted", {
      reason: "account_deleted", uid: result.uid, paymentId,
    }, { severity: "critical", dedupeKey: paymentId });
  }
  await audit({
    uid: result.uid,
    action: "payment_captured_webhook",
    entityType: "razorpay_payment",
    entityId: paymentId,
    metadata: {
      razorpay_order_id: payment.order_id,
      creditsAdded: result.status === "paid" && !result.duplicate ? result.minutes : 0,
      balanceAfter: result.balanceAfter,
      duplicate: result.duplicate,
      status: result.status,
    },
  });
}

async function handlePaymentLinkPaid(payload: any): Promise<void> {
  const reference = payload?.payment_link?.entity?.reference_id;
  if (typeof reference !== "string" || !reference.startsWith("hc_")) return;
  const result = await reconcileHostedCheckout({ db, FieldValue }, hostedProvider, reference);
  // A paid event may arrive before the fetch API reflects capture. Keep it
  // retryable so a closed browser cannot leave the credits unfulfilled.
  if (!["paid", "refunded", "account_missing"].includes(result.status)) {
    throw new Error("Hosted payment capture is not ready for settlement");
  }
  if (result.status === "paid" && "uid" in result) {
    await rewardReferrer(result.uid, "topup", reference);
  }
  if (result.status === "account_missing") {
    await reportOpsEvent("payment_credits_not_granted", {
      reason: "account_deleted", checkoutId: reference,
    }, { severity: "critical", dedupeKey: reference });
  }
  await audit({
    action: "payment_link_webhook",
    entityType: "hosted_checkout",
    entityId: reference,
    metadata: { status: result.status },
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
    const eventCreatedAt =
      typeof event.created_at === "number" ? event.created_at : null;

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

    if (SUBSCRIPTION_EVENTS.has(eventType)) {
      await handleSubscriptionEvent(
        eventType,
        payload?.subscription?.entity,
        payload?.payment?.entity,
        eventCreatedAt,
        resolvedEventId,
      );
    } else if (eventType === "payment_link.paid") {
      await handlePaymentLinkPaid(payload);
    } else if (eventType === "payment.captured") {
      await handlePaymentCaptured(payload);
    } else if (eventType === "refund.processed") {
      await handleRefundProcessed(payload, resolvedEventId);
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
