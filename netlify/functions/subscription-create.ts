import { Config, Context } from "@netlify/functions";
import Razorpay from "razorpay";
import { db, auth } from "./shared/firebase-admin";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405 });

  try {
    const { planId, uid } = await req.json();
    if (!planId || !uid) {
      return new Response(JSON.stringify({ error: "Missing planId or uid" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify user exists
    await auth.getUser(uid);

    // Create Razorpay subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 12, // 12 months max
      customer_notify: 1,
      notes: { uid, platform: "astroyou" },
    });

    // Store subscription reference in Firestore
    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          subscription: {
            razorpaySubscriptionId: subscription.id,
            status: "created",
            planId,
            createdAt: new Date(),
          },
        },
        { merge: true },
      );

    return new Response(
      JSON.stringify({
        subscriptionId: subscription.id,
        shortUrl: subscription.short_url,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[Subscription Create] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = { path: "/api/subscription/create" };
