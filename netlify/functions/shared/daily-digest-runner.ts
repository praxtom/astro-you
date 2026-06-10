import { db } from "./firebase-admin.js";
import { buildDailyDigest } from "./digest.js";
import { resolveResendApiKey } from "./env.js";
import { buildUserContext } from "./user-context.js";

export interface DailyDigestRunResult {
  uid: string;
  subject?: string;
  text?: string;
  html?: string;
  emailSent: boolean;
  skippedReason?: string;
}

export async function generateDailyDigestForUser(input: {
  uid: string;
  sendEmail: boolean;
  channel: "preview" | "email" | "scheduled_email";
}): Promise<DailyDigestRunResult> {
  const userSnap = await db.collection("users").doc(input.uid).get();
  const userData = userSnap.data() || {};
  const profile = userData.profile || userData;
  const prefs = profile.notificationPrefs || userData.notificationPrefs || {};

  if (input.sendEmail && prefs.emailDigest === false) {
    return {
      uid: input.uid,
      emailSent: false,
      skippedReason: "email_digest_disabled",
    };
  }

  // Idempotency for the scheduled path: one digest per user per UTC day. If the
  // cron double-fires, we skip re-sending instead of emailing twice.
  const dateStr = new Date().toISOString().split("T")[0];
  const digestsCol = db
    .collection("users")
    .doc(input.uid)
    .collection("digests");
  const idempotent = input.channel === "scheduled_email";
  const digestRef = idempotent
    ? digestsCol.doc(`${dateStr}`)
    : digestsCol.doc();
  if (idempotent) {
    const existing = await digestRef.get();
    if (existing.exists && existing.data()?.emailSent) {
      return {
        uid: input.uid,
        emailSent: false,
        skippedReason: "already_sent_today",
      };
    }
  }

  // Email is always resolved from the user's own profile — never from caller
  // input — so this can't be used to send a digest to an arbitrary address.
  const email = profile.email || userData.email;
  const { userContext } = await buildUserContext({ uid: input.uid });
  const digest = buildDailyDigest({
    name: userContext.name || profile.name || email?.split("@")[0] || "Seeker",
    panchang: userContext.panchangData,
    dashaInfo: userContext.dashaInfo,
    transitContext: userContext.transitContext,
    atman: userContext.atman || userData.atman,
  });

  let emailSent = false;
  let skippedReason: string | undefined;
  if (input.sendEmail) {
    const resendApiKey = resolveResendApiKey();
    if (!email) {
      skippedReason = "missing_email";
    } else if (!resendApiKey) {
      skippedReason = "missing_email_provider";
    } else {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
          // Resend dedupes retries carrying the same key.
          "Idempotency-Key": `digest_${input.uid}_${dateStr}`,
        },
        body: JSON.stringify({
          from:
            process.env.DIGEST_FROM_EMAIL || "AstroYou <noreply@astroyou.app>",
          to: email,
          subject: digest.subject,
          html: digest.html,
        }),
      });
      emailSent = response.ok;
      if (!response.ok) {
        skippedReason = `email_provider_${response.status}`;
      }
    }
  }

  await digestRef.set({
    channel: input.channel,
    emailSent,
    skippedReason: skippedReason || null,
    subject: digest.subject,
    text: digest.text,
    createdAt: new Date(),
  });

  return {
    uid: input.uid,
    subject: digest.subject,
    text: digest.text,
    html: digest.html,
    emailSent,
    skippedReason,
  };
}
