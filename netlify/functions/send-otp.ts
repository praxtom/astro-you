import { Config, Context } from "@netlify/functions";
import { db } from "./shared/firebase-admin.js";
import { resolveResendApiKey } from "./shared/env.js";
import {
  hashOtp,
  otpDailyCapReached,
  otpFailureDocId,
} from "./shared/otp.js";
import { checkRateLimit, getRequestIdentifier } from "./shared/rate-limit.js";
import { reportOpsEvent } from "./shared/ops-alerts.js";
import { randomInt } from "crypto";

/** Resend normally answers in well under a second. */
const RESEND_TIMEOUT_MS = 5_000;

// Rate limit: max OTP requests per email per hour
const MAX_REQUESTS_PER_HOUR = 5;
// Rate limit: max OTP requests per IP per hour, across all email addresses
const MAX_REQUESTS_PER_IP_PER_HOUR = 10;
const COOLDOWN_MS = 60_000; // 60 seconds between requests

// Practical email shape check. Also guards the Firestore doc id the address
// becomes: no whitespace or path-breaking characters, bounded length.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** True when `email` is a plausible, bounded email address. */
export function isValidEmail(email: unknown): email is string {
  return (
    typeof email === "string" && email.length <= 254 && EMAIL_RE.test(email)
  );
}

// Generate a cryptographically secure 6-digit code
function generateOTP(): string {
  return randomInt(100000, 1000000).toString();
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // Per-IP cap on top of the per-email transaction limits below — stops one
    // client from email-bombing many different addresses and draining the
    // Resend quota. The send_otp scope fails CLOSED in shared/rate-limit.ts.
    const rateLimit = await checkRateLimit({
      scope: "send_otp",
      key: getRequestIdentifier(req),
      limit: MAX_REQUESTS_PER_IP_PER_HOUR,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return json({ error: "Too many requests. Please try again later." }, 429);
    }

    const { email } = await req.json();

    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!isValidEmail(normalizedEmail)) {
      return json({ error: "Invalid email" }, 400);
    }

    const otp = generateOTP();
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes
    const otpRef = db.collection("otps").doc(normalizedEmail);
    const failRef = db
      .collection("rateLimits")
      .doc(otpFailureDocId(normalizedEmail, now));

    // Atomically check rate limits + write the new (hashed) OTP in one
    // transaction so concurrent requests can't bypass the cooldown/hourly
    // cap (TOCTOU). Returns an error string if blocked, otherwise null.
    const blockReason = await db.runTransaction(async (tx) => {
      const snap = await tx.get(otpRef);
      const data = snap.exists ? snap.data() : null;
      // A fresh code can't be used once today's failed-guess cap is hit, so
      // don't send one (and don't reset the per-code attempt counter).
      const failSnap = await tx.get(failRef);
      if (otpDailyCapReached(failSnap.data()?.count)) {
        return "Too many failed attempts today. Please try again tomorrow.";
      }

      // Lockout carried over from too many failed verify attempts.
      if (data?.blockedUntil && now < data.blockedUntil) {
        return "Too many attempts. Please try again later.";
      }
      // Cooldown between requests.
      if (data?.createdAt && now - data.createdAt < COOLDOWN_MS) {
        return "Please wait before requesting a new code";
      }
      // Hourly request cap.
      const isWithinHour =
        data?.firstRequestAt && now - data.firstRequestAt < 3600_000;
      if (isWithinHour && (data?.requestCount || 0) >= MAX_REQUESTS_PER_HOUR) {
        return "Too many requests. Please try again later.";
      }

      const requestCount = isWithinHour ? (data?.requestCount || 0) + 1 : 1;
      const firstRequestAt = isWithinHour ? data!.firstRequestAt : now;

      tx.set(otpRef, {
        codeHash: hashOtp(otp, normalizedEmail),
        expiresAt,
        createdAt: now,
        attempts: 0,
        requestCount,
        firstRequestAt,
        blockedUntil: null,
      });
      return null;
    });

    if (blockReason) {
      return json({ error: blockReason }, 429);
    }

    // Send email via Resend. A missing key is a configuration error — we
    // must NOT report success when no email was actually dispatched.
    const resendApiKey = resolveResendApiKey();
    if (!resendApiKey) {
      console.error("[Send OTP] RESEND_API_KEY is not configured");
      await reportOpsEvent(
        "email_provider_error",
        { source: "send-otp", reason: "not_configured" },
        { severity: "critical", dedupeKey: "send-otp-not-configured" },
      );
      return json(
        { error: "Email delivery is not configured. Please contact support." },
        503,
      );
    }

    let resendRes: Response;
    try {
      resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        // Never hang the login flow on a slow provider.
        signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from:
            process.env.DIGEST_FROM_EMAIL || "AstroYou <noreply@astroyou.app>",
          to: normalizedEmail,
          subject: "Your Celestial Access Code",
          html: `
              <div style="font-family: 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 40px; background: linear-gradient(180deg, #0a0a14 0%, #1a1a2e 100%); border-radius: 16px; text-align: center;">
                <h1 style="color: #FFD700; font-size: 24px; margin-bottom: 8px;">AstroYou</h1>
                <p style="color: #a0a0c0; font-size: 14px; margin-bottom: 32px;">Your gateway to celestial wisdom</p>
                <div style="background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.3); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                  <p style="color: #a0a0c0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Your Access Code</p>
                  <h2 style="color: #FFD700; font-size: 40px; letter-spacing: 8px; margin: 0; font-weight: bold;">${otp}</h2>
                </div>
                <p style="color: #606080; font-size: 12px;">This code expires in 5 minutes.</p>
              </div>
            `,
        }),
      });
    } catch (sendError) {
      const reason =
        sendError instanceof Error && sendError.name === "TimeoutError"
          ? "timeout"
          : "network";
      console.error(`[Send OTP] Resend request failed (${reason})`);
      await otpRef.delete().catch(() => undefined);
      await reportOpsEvent(
        "email_provider_error",
        { source: "send-otp", reason },
        { severity: "warning", dedupeKey: `send-otp-${reason}` },
      );
      return json({ error: "Could not send code. Please try again." }, 502);
    }

    if (!resendRes.ok) {
      // Log only the status — the Resend error body can echo the recipient
      // email address, which must not land in server logs.
      console.error(`[Send OTP] Resend failed (${resendRes.status})`);
      // Roll back the OTP doc so the user can retry cleanly.
      await otpRef.delete().catch(() => undefined);
      await reportOpsEvent(
        "email_provider_error",
        { source: "send-otp", status: resendRes.status },
        {
          severity: resendRes.status === 401 || resendRes.status === 403
            ? "critical"
            : "warning",
          dedupeKey: `send-otp-${resendRes.status}`,
        },
      );
      return json({ error: "Could not send code. Please try again." }, 502);
    }

    return json({ success: true, message: "Code sent to your email" }, 200);
  } catch (error: any) {
    console.error("Send OTP Error:", error);
    return json({ error: "Failed to send code. Please try again." }, 500);
  }
};

export const config: Config = {
  path: "/api/auth/send-otp",
};
