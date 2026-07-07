import { db } from "./firebase-admin.js";
import {
  buildDailyDigest,
  buildUnsubscribeUrl,
  resolveUnsubscribeSecret,
} from "./digest.js";
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

  // Email is always resolved from the user's own profile — never from caller
  // input — so this can't be used to send a digest to an arbitrary address.
  const email = profile.email || userData.email;
  const resendApiKey = resolveResendApiKey();
  const unsubscribeSecret = resolveUnsubscribeSecret();

  // Fail fast BEFORE building user context: context building makes paid
  // astrology API calls, so a user we can't email must not cost anything and
  // must not get a digests doc written.
  if (input.sendEmail) {
    if (!email) {
      return {
        uid: input.uid,
        emailSent: false,
        skippedReason: "missing_email",
      };
    }
    if (!resendApiKey) {
      return {
        uid: input.uid,
        emailSent: false,
        skippedReason: "missing_email_provider",
      };
    }
    // Compliance fail-closed: never send a marketing/bulk email without a
    // working one-click unsubscribe (Gmail/Yahoo bulk-sender requirement).
    if (!unsubscribeSecret) {
      return {
        uid: input.uid,
        emailSent: false,
        skippedReason: "missing_unsubscribe_secret",
      };
    }
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

  // Gmail/Yahoo bulk-sender compliance: every email carries a tokenized
  // one-click unsubscribe URL (header + visible footer link, no login needed).
  const unsubscribeUrl = unsubscribeSecret
    ? buildUnsubscribeUrl(input.uid, unsubscribeSecret)
    : undefined;

  const { userContext } = await buildUserContext({ uid: input.uid });
  const digest = buildDailyDigest({
    name: userContext.name || profile.name || email?.split("@")[0] || "Seeker",
    panchang: userContext.panchangData,
    dashaInfo: userContext.dashaInfo,
    transitContext: userContext.transitContext,
    atman: userContext.atman || userData.atman,
    unsubscribeUrl,
  });

  let emailSent = false;
  let skippedReason: string | undefined;
  if (input.sendEmail) {
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
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    emailSent = response.ok;
    if (!response.ok) {
      skippedReason = `email_provider_${response.status}`;
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
