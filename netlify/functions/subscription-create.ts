import { Config, Context } from "@netlify/functions";
import Razorpay from "razorpay";
import { isRazorpayHostedUrl } from "../../src/lib/payment-navigation";
import { db, auth } from "./shared/firebase-admin";
import { getEntitlements, resolveTier } from "./shared/entitlements";
import {
  currentSubscriptionId,
  getRazorpayPlanId,
  pendingSubscriptionId,
  RAZORPAY_MONTHLY_MAX_TOTAL_COUNT,
  subscriptionTimeMs,
} from "./shared/subscription-plans";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

/** An unpaid checkout older than this is replaced instead of reused. */
const PENDING_REUSE_MS = 24 * 60 * 60 * 1000;

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function fetchShortUrl(subscriptionId: string): Promise<{
  shortUrl: string | null;
  status: string | null;
}> {
  try {
    const existing = await razorpay.subscriptions.fetch(subscriptionId);
    return {
      shortUrl: isRazorpayHostedUrl(existing.short_url) ? existing.short_url : null,
      status: (existing as { status?: string })?.status || null,
    };
  } catch (fetchErr: any) {
    console.warn(
      "[Subscription Create] Could not fetch subscription:",
      fetchErr?.statusCode ?? fetchErr?.name ?? "error",
    );
    return { shortUrl: null, status: null };
  }
}

/**
 * Starts a Razorpay checkout for a paid plan.
 *
 * A new checkout never touches the plan the user is paying for today: it is
 * parked in `subscription.pendingSubscription` and the webhook promotes it
 * only when its own activated/charged event arrives — at which point the old
 * subscription is cancelled at Razorpay so the user is never billed twice.
 * (Overwriting `subscription` here used to drop a Premium payer to free the
 * moment they clicked "Upgrade to Pro".)
 */
export default async (req: Request, _context: Context) => {
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405 });

  try {
    const { idToken, tier: requestedTier } = await req.json();
    if (!idToken) {
      return json({ error: "Missing auth token" }, 401);
    }
    if (!requestedTier) {
      return json({ error: "Missing tier" }, 400);
    }

    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const tier = resolveTier(requestedTier);
    if (tier === "free") {
      return json({ error: "Free tier does not need checkout" }, 400);
    }
    const planId = getRazorpayPlanId(tier);
    const entitlements = getEntitlements(tier);

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return json({ error: "Account not found" }, 404);
    const existingSub = userSnap.data()?.subscription || {};
    const existingSubId = currentSubscriptionId(existingSub);
    const existingStatus = existingSub.status;

    // Already paying for exactly this plan — hand back the live subscription
    // instead of stacking a duplicate.
    if (
      existingSubId &&
      (existingStatus === "active" || existingStatus === "pending") &&
      resolveTier(existingSub.tier) === tier
    ) {
      const { shortUrl } = await fetchShortUrl(existingSubId);
      if (!shortUrl) return json({ error: "Your subscription is already registered. Check its status in Settings." }, 409);
      return json(
        { subscriptionId: existingSubId, shortUrl, tier, existing: true },
        200,
      );
    }

    // A recent unpaid checkout for the same plan: reuse its payment link.
    const pending = existingSub.pendingSubscription || {};
    const pendingId = pendingSubscriptionId(existingSub);
    if (pendingId) {
      const pendingCreatedMs = subscriptionTimeMs(pending.createdAt);
      const fresh =
        pendingCreatedMs !== null &&
        Date.now() - pendingCreatedMs < PENDING_REUSE_MS;
      if (resolveTier(pending.tier) === tier && fresh) {
        const { shortUrl, status } = await fetchShortUrl(pendingId);
        if (shortUrl && (status === "created" || status === null)) {
          return json(
            {
              subscriptionId: pendingId,
              shortUrl,
              tier,
              existing: true,
              pending: true,
            },
            200,
          );
        }
      }
      // Replacing an unpaid checkout (other plan, or stale): stop the old link
      // from ever charging. Best effort — if it somehow pays later, the
      // webhook treats it as superseded and cancels it then.
      try {
        await razorpay.subscriptions.cancel(pendingId, false);
      } catch (cancelErr: any) {
        console.warn(
          "[Subscription Create] Could not cancel replaced checkout:",
          cancelErr?.statusCode ?? cancelErr?.name ?? "error",
        );
      }
    }

    // Monthly plan, renewing until the user cancels (see
    // RAZORPAY_MONTHLY_MAX_TOTAL_COUNT for why this is not "infinite").
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: RAZORPAY_MONTHLY_MAX_TOTAL_COUNT,
      customer_notify: 1,
      notes: {
        uid,
        tier,
        platform: "astroyou",
        ...(existingSubId ? { replaces: existingSubId } : {}),
      },
    });

    await userRef.set(
      {
        subscription: {
          // Keep a free user's record well-formed; never touch a paid tier.
          ...(existingSub.tier ? {} : { tier: "free" }),
          pendingSubscription: {
            tier,
            razorpaySubscriptionId: subscription.id,
            status: "created",
            planId,
            priceInr: entitlements.monthlyPriceInr,
            createdAt: new Date(),
          },
        },
      },
      { merge: true },
    );

    if (!isRazorpayHostedUrl(subscription.short_url)) {
      return json({ error: "Hosted subscription checkout is unavailable. Please try again shortly." }, 502);
    }

    return json(
      {
        subscriptionId: subscription.id,
        shortUrl: subscription.short_url,
        tier,
        pending: true,
        replacesCurrentPlan: Boolean(
          existingSubId &&
          ["active", "pending", "cancelling"].includes(String(existingStatus)),
        ),
      },
      200,
    );
  } catch (err: any) {
    // Never echo an upstream/SDK message to the client — Razorpay and Firebase
    // errors can carry account, plan, or credential detail. Log the type only.
    console.error(
      "[Subscription Create] Error:",
      err?.name || "error",
      err?.statusCode ?? "",
    );
    return json({ error: "Could not create subscription" }, 500);
  }
};

export const config: Config = { path: "/api/subscription/create" };
