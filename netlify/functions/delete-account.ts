import { Config, Context } from "@netlify/functions";
import { auth } from "./shared/firebase-admin";
import { writeAuditLog } from "./shared/audit-log";
import { openDeletionJob, runDeletionJob } from "./shared/account-deletion";
import { isRecentLogin } from "./shared/recent-login";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const { idToken, confirmation } = await req.json();
    if (!idToken || confirmation !== "DELETE") {
      return json({ error: "Missing delete confirmation" }, 400);
    }

    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken, true);
    } catch {
      return json({ error: "Invalid or expired auth token" }, 401);
    }
    const uid = decoded.uid;

    // Deleting an account is irreversible: a stolen or long-lived session
    // must not be enough. Require a sign-in within the last 10 minutes; the
    // client re-authenticates and retries on this code.
    if (!isRecentLogin(decoded.auth_time)) {
      return json(
        {
          error: "Please sign in again to confirm account deletion.",
          code: "recent_login_required",
        },
        401,
      );
    }

    // Email-keyed cleanup (expert applications, the OTP doc) must only ever
    // target an address the server verified for this account — never a
    // profile field — so one user can't trigger deletion of another's data.
    const email =
      decoded.email_verified === true && typeof decoded.email === "string"
        ? decoded.email.toLowerCase().trim()
        : "";

    // Record the job BEFORE any destructive step so a timeout or a failed
    // cleanup step is retried by account-deletion-retry-scheduled.
    await openDeletionJob(uid, email);

    await writeAuditLog({
      uid,
      action: "account_delete_requested",
      entityType: "user",
      entityId: uid,
      metadata: {
        legalRetention: "payment audit logs retained outside user document",
      },
    });

    const { subscriptionCancellation, failedSteps } = await runDeletionJob(
      uid,
      { requestUrl: req.url },
    );

    // Access is revoked and the rest is queued for retry — from the user's
    // point of view the deletion has been accepted either way.
    return json({
      status: failedSteps.length === 0 ? "success" : "pending_cleanup",
      subscriptionCancellation,
    });
  } catch (err: any) {
    console.error("[Delete Account] Error:", err);
    return json({ error: "Could not delete account. Please try again." }, 500);
  }
};

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = { path: "/api/account/delete" };
