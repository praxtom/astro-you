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
    const { uid } = await req.json();
    if (!uid)
      return new Response(JSON.stringify({ error: "Missing uid" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    const userDoc = await db.collection("users").doc(uid).get();
    const subId = userDoc.data()?.subscription?.razorpaySubscriptionId;

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
          subscription: { status: "cancelling", cancelRequestedAt: new Date() },
        },
        { merge: true },
      );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Subscription Cancel] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = { path: "/api/subscription/cancel" };
