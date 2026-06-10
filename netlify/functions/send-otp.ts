import { Config, Context } from "@netlify/functions";
import { db } from "./shared/firebase-admin";
import { resolveResendApiKey } from "./shared/env.js";
import { hashOtp } from "./shared/otp.js";
import { randomInt } from "crypto";

// Rate limit: max OTP requests per email per hour
const MAX_REQUESTS_PER_HOUR = 5;
const COOLDOWN_MS = 60_000; // 60 seconds between requests

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
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return json({ error: "Invalid email" }, 400);
    }
    const normalizedEmail = email.toLowerCase().trim();

    const otp = generateOTP();
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes
    const otpRef = db.collection("otps").doc(normalizedEmail);

    // Atomically check rate limits + write the new (hashed) OTP in one
    // transaction so concurrent requests can't bypass the cooldown/hourly
    // cap (TOCTOU). Returns an error string if blocked, otherwise null.
    const blockReason = await db.runTransaction(async (tx) => {
      const snap = await tx.get(otpRef);
      const data = snap.exists ? snap.data() : null;

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
      return json(
        { error: "Email delivery is not configured. Please contact support." },
        503,
      );
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "AstroYou <noreply@astroyou.app>",
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

    if (!resendRes.ok) {
      const detail = await resendRes.text().catch(() => "");
      console.error(
        `[Send OTP] Resend failed (${resendRes.status}): ${detail}`,
      );
      // Roll back the OTP doc so the user can retry cleanly.
      await otpRef.delete().catch(() => undefined);
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
