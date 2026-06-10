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
  emailOverride?: string | null;
}): Promise<DailyDigestRunResult> {
  const userSnap = await db.collection("users").doc(input.uid).get();
  const userData = userSnap.data() || {};
  const profile = userData.profile || userData;
  const prefs = profile.notificationPrefs || userData.notificationPrefs || {};

  if (input.sendEmail && prefs.emailDigest === false) {
    return { uid: input.uid, emailSent: false, skippedReason: "email_digest_disabled" };
  }

  const email = input.emailOverride || profile.email || userData.email;
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
        },
        body: JSON.stringify({
          from: process.env.DIGEST_FROM_EMAIL || "AstroYou <noreply@astroyou.app>",
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

  await db.collection("users").doc(input.uid).collection("digests").add({
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
