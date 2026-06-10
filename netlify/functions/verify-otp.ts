import { Config, Context } from "@netlify/functions";
import { db, auth, FieldValue } from "./shared/firebase-admin";
import { initializeUserCredits } from "./shared/credits";
import { hashOtp, safeEqualHex } from "./shared/otp.js";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 min lockout after too many failures

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type VerifyOutcome =
  | { ok: true }
  | { ok: false; status: number; error: string };

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { email, code } = await req.json();

    if (
      !email ||
      !code ||
      typeof email !== "string" ||
      typeof code !== "string"
    ) {
      return json({ error: "Email and code are required" }, 400);
    }
    const normalizedEmail = email.toLowerCase().trim();
    const otpRef = db.collection("otps").doc(normalizedEmail);
    const now = Date.now();
    const submittedHash = hashOtp(code, normalizedEmail);

    // Atomically read, validate, and either consume the OTP (success) or
    // increment the failed-attempt counter / set a lockout. Doing the whole
    // check+mutate in one transaction closes the concurrent-guess race.
    const outcome = await db.runTransaction<VerifyOutcome>(async (tx) => {
      const snap = await tx.get(otpRef);
      if (!snap.exists) {
        return {
          ok: false,
          status: 400,
          error: "No code found. Please request a new one.",
        };
      }
      const data = snap.data() || {};

      if (data.blockedUntil && now < data.blockedUntil) {
        return {
          ok: false,
          status: 429,
          error: "Too many failed attempts. Please request a new code later.",
        };
      }
      if ((data.attempts || 0) >= MAX_ATTEMPTS) {
        tx.update(otpRef, { blockedUntil: now + LOCKOUT_MS });
        return {
          ok: false,
          status: 429,
          error: "Too many failed attempts. Please request a new code.",
        };
      }
      if (now > (data.expiresAt || 0)) {
        tx.delete(otpRef);
        return {
          ok: false,
          status: 400,
          error: "Code expired. Please request a new one.",
        };
      }

      const storedHash = typeof data.codeHash === "string" ? data.codeHash : "";
      if (!storedHash || !safeEqualHex(submittedHash, storedHash)) {
        const attemptsAfter = (data.attempts || 0) + 1;
        if (attemptsAfter >= MAX_ATTEMPTS) {
          tx.update(otpRef, {
            attempts: FieldValue.increment(1),
            blockedUntil: now + LOCKOUT_MS,
          });
        } else {
          tx.update(otpRef, { attempts: FieldValue.increment(1) });
        }
        const remaining = Math.max(0, MAX_ATTEMPTS - attemptsAfter);
        return {
          ok: false,
          status: 400,
          error: `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
        };
      }

      // Valid — consume the OTP so it can't be reused.
      tx.delete(otpRef);
      return { ok: true };
    });

    if (!outcome.ok) {
      return json({ error: outcome.error }, outcome.status);
    }

    // Get or create the user
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(normalizedEmail);
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        userRecord = await auth.createUser({
          email: normalizedEmail,
          emailVerified: true,
        });
      } else {
        throw error;
      }
    }

    await initializeUserCredits(
      { db, FieldValue },
      { uid: userRecord.uid, email: normalizedEmail },
    );

    const customToken = await auth.createCustomToken(userRecord.uid);
    return json({ success: true, token: customToken }, 200);
  } catch (error: any) {
    console.error("Verify OTP Error:", error);
    return json({ error: "Verification failed. Please try again." }, 500);
  }
};

export const config: Config = {
  path: "/api/auth/verify-otp",
};
