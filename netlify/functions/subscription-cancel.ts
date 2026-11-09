import { Config, Context } from "@netlify/functions";
import Razorpay from "razorpay";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import {
  currentSubscriptionId,
  pendingSubscriptionId,
} from "./shared/subscription-plans";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405 });

  try {
    const { idToken } = await req.json();
    if (!idToken)
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });

    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const userDoc = await db.collection("users").doc(uid).get();
    const subscription = userDoc.data()?.subscription || {};
    const subId = currentSubscriptionId(subscription);
    const pendingId = pendingSubscriptionId(subscription);

    if (!subId && !pendingId) {
      return new Response(JSON.stringify({ error: "No active subscription" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // An unpaid plan-change checkout is abandoned along with the plan: cancel
    // it immediately so the old payment link can never start billing.
    if (pendingId) {
      try {
        await razorpay.subscriptions.cancel(pendingId, false);
      } catch (pendingErr: any) {
        console.warn(
          "[Subscription Cancel] Could not cancel pending checkout:",
          pendingErr?.statusCode ?? pendingErr?.name ?? "error",
        );
      }
    }

    // Cancel at end of billing period. The 2nd arg is `cancelAtCycleEnd` —
    // passing false would cancel IMMEDIATELY and forfeit the paid period.
    // Razorpay emits subscription.cancelled at cycle end, and the webhook
    // downgrades the tier then.
    if (subId) {
      await razorpay.subscriptions.cancel(subId, true);
    }

    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          subscription: {
            ...(subId
              ? {
                  status: "cancelling",
                  cancelRequestedAt: new Date(),
                  cancelAtPeriodEnd: true,
                }
              : {}),
            ...(pendingId ? { pendingSubscription: FieldValue.delete() } : {}),
          },
        },
        { merge: true },
      );

    return new Response(
      JSON.stringify({
        success: true,
        currentEnd: subscription.currentEnd || null,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    // Never echo an upstream/SDK message to the client — Razorpay and Firebase
    // errors can carry account, plan, or credential detail. Log the type only.
    console.error(
      "[Subscription Cancel] Error:",
      err?.name || "error",
      err?.statusCode ?? "",
    );
    return new Response(
      JSON.stringify({ error: "Could not cancel subscription" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = { path: "/api/subscription/cancel" };
