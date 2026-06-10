import { Config, Context } from "@netlify/functions";
import Razorpay from "razorpay";
import { db, auth } from "./shared/firebase-admin";
import { getEntitlements, resolveTier } from "./shared/entitlements";
import { getRazorpayPlanId } from "./shared/subscription-plans";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405 });

  try {
    const { idToken, tier: requestedTier } = await req.json();
    if (!idToken) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!requestedTier) {
      return new Response(JSON.stringify({ error: "Missing tier" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const tier = resolveTier(requestedTier);
    if (tier === "free") {
      return new Response(JSON.stringify({ error: "Free tier does not need checkout" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const planId = getRazorpayPlanId(tier);
    const entitlements = getEntitlements(tier);

    // Create Razorpay subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 12, // 12 months max
      customer_notify: 1,
      notes: { uid, tier, platform: "astroyou" },
    });

    // Store subscription reference in Firestore
    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          subscription: {
            tier,
            razorpaySubscriptionId: subscription.id,
            status: "created",
            planId,
            priceInr: entitlements.monthlyPriceInr,
            createdAt: new Date(),
          },
        },
        { merge: true },
      );

    return new Response(
      JSON.stringify({
        subscriptionId: subscription.id,
        shortUrl: subscription.short_url,
        tier,
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
