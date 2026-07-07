/**
 * One-click email unsubscribe — no login required (that's the point: this is
 * what the List-Unsubscribe / List-Unsubscribe-Post headers and the email
 * footer link point to, per Gmail/Yahoo bulk-sender rules).
 *
 * GET  /api/unsubscribe?uid=...&token=...  → human clicks the footer link
 * POST /api/unsubscribe?uid=...&token=...  → mailbox provider one-click
 *
 * The token is HMAC-SHA256(uid, EMAIL_UNSUB_SECRET), verified timing-safe.
 * A valid token can only flip THIS user's emailDigest preference off — it
 * grants no read access and cannot be replayed for any other uid.
 */
import { Config, Context } from "@netlify/functions";
import { db } from "./shared/firebase-admin";
import { writeAuditLog } from "./shared/audit-log";
import {
  resolveUnsubscribeSecret,
  verifyUnsubscribeToken,
} from "./shared/digest";

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const uid = url.searchParams.get("uid") || "";
    const token = url.searchParams.get("token") || "";

    // Invalid or missing token → 400 with no detail (never confirm whether a
    // uid exists or why verification failed).
    const secret = resolveUnsubscribeSecret();
    if (
      !secret ||
      !uid ||
      uid.length > 128 ||
      !verifyUnsubscribeToken(uid, token, secret)
    ) {
      return new Response("Invalid unsubscribe link", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Only touch existing users — a stale link for a deleted account must not
    // recreate a stub user document.
    const userRef = db.collection("users").doc(uid);
    const snapshot = await userRef.get();
    if (snapshot.exists) {
      await userRef.set(
        { profile: { notificationPrefs: { emailDigest: false } } },
        { merge: true },
      );
      await writeAuditLog({
        uid,
        action: "email_digest_unsubscribed",
        entityType: "user",
        entityId: uid,
        metadata: { channel: req.method === "POST" ? "one_click" : "link" },
      }).catch((err) => console.error("[Unsubscribe] Audit log failed:", err));
    }

    // One-click POSTs come from mailbox providers — a plain 200 is all they
    // need. Humans on GET see a tiny branded confirmation page.
    if (req.method === "POST") {
      return new Response("Unsubscribed", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return new Response(unsubscribedPage(), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[Unsubscribe] Error:", err);
    return new Response("Something went wrong. Please try again.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
};

function unsubscribedPage(): string {
  const settingsUrl = `${(process.env.APP_BASE_URL || "https://astroyou.app").replace(/\/$/, "")}/settings`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Unsubscribed — AstroYou</title>
</head>
<body style="margin:0;background:#030308;color:#f8f5ee;font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="max-width:420px;padding:40px 32px;text-align:center;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:2rem;margin:24px">
<h1 style="color:#E5B96A;font-size:22px;margin:0 0 12px">You're unsubscribed</h1>
<p style="color:rgba(248,245,238,0.7);font-size:14px;line-height:1.6;margin:0 0 20px">You will no longer receive the AstroYou daily digest. Your account and readings are untouched.</p>
<p style="color:rgba(248,245,238,0.4);font-size:12px;margin:0">Changed your mind? Turn it back on any time in <a href="${settingsUrl}" style="color:#8a86a0">Settings</a>.</p>
</div>
</body>
</html>`;
}

export const config: Config = { path: "/api/unsubscribe" };
