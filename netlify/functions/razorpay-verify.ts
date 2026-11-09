import { Config, Context } from "@netlify/functions";
import { db, auth, FieldValue } from "./shared/firebase-admin";
import { settleTopupPayment } from "./shared/hosted-payments";
import { hostedProvider } from "./shared/hosted-razorpay";
import { writeAuditLog } from "./shared/audit-log";
import { verifyCheckoutSignature } from "./shared/razorpay-payments";
import { grantReferrerRewardAfterPayment } from "./shared/referrals";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!process.env.RAZORPAY_KEY_SECRET) {
    console.error(
      "[Razorpay Verify] Missing RAZORPAY_KEY_SECRET — cannot verify payments",
    );
    return new Response(
      JSON.stringify({ error: "Payment is not configured" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      idToken,
    } = await req.json();

    // Validate required fields
    if (!idToken) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // Check the signature, then fetch the payment before granting any credits.
    const isValidSignature = verifyCheckoutSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      secret: process.env.RAZORPAY_KEY_SECRET || "",
    });

    if (!isValidSignature) {
      return new Response(JSON.stringify({ status: "failure" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const orderRef = db.collection("paymentOrders").doc(razorpay_order_id);
    const orderSnap = await orderRef.get();
    const orderData = orderSnap.data();
    if (!orderSnap.exists || !orderData) {
      return new Response(
        JSON.stringify({ error: "Payment order not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    if (orderData.uid !== uid) {
      return new Response(
        JSON.stringify({ error: "Payment order belongs to another user" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const minutes = Number(orderData.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return new Response(JSON.stringify({ error: "Invalid payment order" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payment = await hostedProvider.payment(razorpay_payment_id);
    const creditResult = await settleTopupPayment({ db, FieldValue }, {
      orderId: razorpay_order_id, payment, uid, checkoutId: orderData.hostedCheckoutId,
    });
    if (creditResult.status !== "paid") {
      return new Response(JSON.stringify({
        error: creditResult.status === "refunded" ? "This payment was refunded." : "Payment has not been captured yet.",
        status: creditResult.status,
      }), { status: 409, headers: { "Content-Type": "application/json" } });
    }

    // The referee's first successful payment unlocks their referrer's reward.
    // Best effort and idempotent — the payment itself is already settled.
    await grantReferrerRewardAfterPayment({ db, FieldValue }, uid, {
      source: "topup",
      referenceId: razorpay_payment_id,
    }).catch((referralError) => {
      console.error(
        "[Razorpay Verify] Referral reward failed:",
        referralError?.message || referralError,
      );
    });

    await writeAuditLog({
      uid,
      action: "payment_verified",
      entityType: "razorpay_payment",
      entityId: razorpay_payment_id,
      metadata: {
        razorpay_order_id,
        creditsAdded: creditResult.duplicate ? 0 : minutes,
        balanceAfter: creditResult.balanceAfter,
        duplicate: creditResult.duplicate,
      },
    }).catch((auditError) => {
      console.error("[Razorpay Verify] Audit log failed:", auditError);
    });

    return new Response(
      JSON.stringify({
        status: "success",
        creditsAdded: creditResult.duplicate ? 0 : minutes,
        balanceAfter: creditResult.balanceAfter,
        duplicate: creditResult.duplicate,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Payment verification error:", error);
    const status = typeof error?.status === "number" ? error.status : 500;
    // Don't leak internal error text on unexpected (500) failures, but do
    // surface actionable client errors like "Insufficient credits" (402).
    const message =
      status === 500
        ? "Payment verification failed"
        : error?.message || "Payment verification failed";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = {
  path: "/api/pay/verify",
};
