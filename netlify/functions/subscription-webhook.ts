import { Config, Context } from "@netlify/functions";
import crypto from "crypto";
import { db } from "./shared/firebase-admin";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";

    // Verify webhook signature
    const expected = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");
    if (expected !== signature) {
      console.error("[Webhook] Invalid signature");
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);
    const { event: eventType, payload } = event;

    console.log(`[Webhook] Event: ${eventType}`);

    switch (eventType) {
      case "subscription.activated":
      case "subscription.charged": {
        const sub = payload.subscription?.entity;
        const uid = sub?.notes?.uid;
        if (!uid) break;

        const planId = sub.plan_id;
        const tier = planId?.includes("pro") ? "pro" : "premium";

        await db
          .collection("users")
          .doc(uid)
          .set(
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
              credits: tier === "pro" ? 999 : 100, // Reset monthly credits
            },
            { merge: true },
          );

        console.log(`[Webhook] User ${uid} activated ${tier}`);
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
                gracePeriodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
              },
            },
            { merge: true },
          );
        break;
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err: any) {
    console.error("[Webhook] Error:", err);
    return new Response("Error", { status: 500 });
  }
};

export const config: Config = { path: "/api/subscription/webhook" };
