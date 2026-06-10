import { Config, Context } from "@netlify/functions";
import Razorpay from "razorpay";
import { auth, db } from "./shared/firebase-admin";

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
    const subId = subscription.razorpaySubscriptionId || subscription.razorpaySubId;

    if (!subId) {
      return new Response(JSON.stringify({ error: "No active subscription" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Cancel at end of billing period
    await razorpay.subscriptions.cancel(subId, false);

    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          subscription: {
            status: "cancelling",
            cancelRequestedAt: new Date(),
            cancelAtPeriodEnd: true,
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
    console.error("[Subscription Cancel] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = { path: "/api/subscription/cancel" };
