import { Config, Context } from "@netlify/functions";
import Razorpay from "razorpay";
import { auth, db, getStorageBucket } from "./shared/firebase-admin";
import { writeAuditLog } from "./shared/audit-log";

// Statuses that Razorpay can no longer bill — everything else (active,
// pending, halted, paused, cancelling, ...) must be cancelled at Razorpay
// BEFORE we destroy the account, or the subscriber keeps getting auto-charged
// with no remaining mapping back to a user.
const NON_BILLABLE_STATUSES = new Set(["cancelled", "completed", "expired"]);

type SubscriptionCancellation = "none" | "cancelled" | "cancel_failed";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const { idToken, confirmation } = await req.json();
    if (!idToken || confirmation !== "DELETE") {
      return json({ error: "Missing delete confirmation" }, 400);
    }

    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const userRef = db.collection("users").doc(uid);

    // Snapshot everything we need BEFORE any destructive step: the user doc
    // holds the Razorpay subscription mapping and the email keys the otps doc.
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};
    const email = (
      decoded.email ||
      userData.profile?.email ||
      userData.email ||
      ""
    )
      .toLowerCase()
      .trim();

    await writeAuditLog({
      uid,
      action: "account_delete_requested",
      entityType: "user",
      entityId: uid,
      metadata: {
        legalRetention: "payment audit logs retained outside user document",
      },
    });

    // Stop billing FIRST — the account is being destroyed, so cancel
    // immediately (not at cycle end). On failure we log the subscription id
    // for manual support cancellation and continue with deletion.
    const subscriptionCancellation = await cancelActiveSubscription(
      uid,
      userData.subscription,
    );

    // Delete the Auth user next so access is revoked immediately. If a later
    // Firestore/Storage cleanup step fails, the worst case is orphaned data —
    // not a re-loginable account that would get signup credits re-granted.
    await auth.deleteUser(uid);

    // recursiveDelete walks the whole doc tree via BulkWriter — parallel and
    // resilient for heavy users, unlike a sequential doc-by-doc walk that can
    // hit the function timeout with no retry path (the auth user is gone).
    await db.recursiveDelete(userRef);

    // The OTP login doc is keyed by email, outside the user tree.
    if (email) {
      await db
        .collection("otps")
        .doc(email)
        .delete()
        .catch((otpError) => {
          console.error("[Delete Account] OTP cleanup failed:", otpError);
        });
    }

    await getStorageBucket()
      .deleteFiles({
        prefix: `users/${safeSegment(uid)}/`,
        force: true,
      })
      .catch((storageError) => {
        console.error("[Delete Account] Storage cleanup failed:", storageError);
      });

    await writeAuditLog({
      uid,
      action: "account_deleted",
      entityType: "user",
      entityId: uid,
      metadata: { subscriptionCancellation },
    });

    return json({ status: "success", subscriptionCancellation });
  } catch (err: any) {
    console.error("[Delete Account] Error:", err);
    return json({ error: "Could not delete account. Please try again." }, 500);
  }
};

async function cancelActiveSubscription(
  uid: string,
  subscription: Record<string, any> | undefined,
): Promise<SubscriptionCancellation> {
  const subscriptionId =
    subscription?.razorpaySubscriptionId || subscription?.razorpaySubId;
  const status = String(subscription?.status || "");
  if (!subscriptionId || NON_BILLABLE_STATUSES.has(status)) {
    return "none";
  }

  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "",
    });
    // false = cancel immediately, not at cycle end — the account is going away.
    await razorpay.subscriptions.cancel(subscriptionId, false);
    await writeAuditLog({
      uid,
      action: "account_delete_subscription_cancelled",
      entityType: "subscription",
      entityId: subscriptionId,
      metadata: { previousStatus: status },
    }).catch((auditError) => {
      console.error("[Delete Account] Audit log failed:", auditError);
    });
    return "cancelled";
  } catch (cancelError: any) {
    // Razorpay treats cancelling an already-cancelled/completed subscription
    // as an error — that still means billing has stopped, so proceed.
    const description = String(
      cancelError?.error?.description || cancelError?.message || cancelError,
    );
    console.error(
      `[Delete Account] Razorpay cancellation failed for ${subscriptionId}:`,
      description,
    );
    // Record the subscription id so support can cancel it manually — the user
    // doc that held the mapping is about to be deleted.
    await writeAuditLog({
      uid,
      action: "account_delete_subscription_cancel_failed",
      entityType: "subscription",
      entityId: subscriptionId,
      metadata: { previousStatus: status, error: description.slice(0, 500) },
    }).catch((auditError) => {
      console.error("[Delete Account] Audit log failed:", auditError);
    });
    return "cancel_failed";
  }
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = { path: "/api/account/delete" };

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 160);
}
