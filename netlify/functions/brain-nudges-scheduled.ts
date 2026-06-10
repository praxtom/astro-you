import { schedule } from "@netlify/functions";
import { db, messaging } from "./shared/firebase-admin";
import {
  runProactiveBrainForUser,
  type BrainNudgeEmail,
  type BrainPushNotification,
  type BrainWhatsAppMessage,
} from "./shared/brain-nudges";
import { resolveResendApiKey } from "./shared/env.js";
import { processUsersPaged } from "./shared/scheduled-users";

export const handler = schedule("0 * * * *", async () => {
  const maxUsers = Number(process.env.BRAIN_NUDGE_BATCH_SIZE || 500);
  const sendEmail = createEmailSender();
  const loadPushTokens = createPushTokenLoader();
  const sendPush = createPushSender();
  const sendWhatsApp = createWhatsAppSender();
  const results: Array<{
    sent?: boolean;
    emailSent?: boolean;
    pushSent?: boolean;
    whatsappSent?: boolean;
    skippedReason?: string;
  }> = [];

  const { processed, reachedEnd } = await processUsersPaged(
    { job: "brain-nudges", maxUsers },
    async (userDoc) => {
      try {
        results.push(
          await runProactiveBrainForUser(
            { db, sendEmail, loadPushTokens, sendPush, sendWhatsApp },
            { uid: userDoc.id, sendEmail: true },
          ),
        );
      } catch (err: any) {
        console.error("[BrainNudgesScheduled] User failed:", userDoc.id, err);
        results.push({ sent: false, skippedReason: err.message || "failed" });
      }
    },
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      processed,
      reachedEnd,
      sent: results.filter((item) => item.sent).length,
      emailSent: results.filter((item) => item.emailSent).length,
      pushSent: results.filter((item) => item.pushSent).length,
      whatsappSent: results.filter((item) => item.whatsappSent).length,
      skipped: results.filter((item) => item.skippedReason).length,
    }),
  };
});

function createEmailSender() {
  const resendApiKey = resolveResendApiKey();
  if (!resendApiKey) return undefined;

  return async (email: BrainNudgeEmail) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from:
          process.env.DIGEST_FROM_EMAIL || "AstroYou <noreply@astroyou.app>",
        to: email.to,
        subject: email.subject,
        html: email.html,
      }),
    });

    if (!response.ok) {
      throw new Error(`email_provider_${response.status}`);
    }
  };
}

function createPushTokenLoader() {
  return async (uid: string) => {
    const snapshot = await db
      .collection("users")
      .doc(uid)
      .collection("pushTokens")
      .where("active", "==", true)
      .limit(5)
      .get();
    return snapshot.docs
      .map((doc) => doc.data().token)
      .filter(
        (token): token is string =>
          typeof token === "string" && token.length > 0,
      );
  };
}

function createPushSender() {
  return async (push: BrainPushNotification) => {
    await messaging.send({
      token: push.token,
      data: {
        type: "brain_nudge",
        uid: push.uid,
        triggerType: push.triggerType,
        url: push.url,
      },
      webpush: {
        notification: {
          title: push.title,
          body: push.body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `brain_${push.triggerType}`,
          requireInteraction: push.priority === "high",
        },
        fcmOptions: {
          link: `${getAppBaseUrl()}${push.url}`,
        },
      },
    });
  };
}

function createWhatsAppSender() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return undefined;

  return async (message: BrainWhatsAppMessage) => {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: message.to,
          type: "text",
          text: { body: message.body },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`whatsapp_provider_${response.status}`);
    }
  };
}

function getAppBaseUrl() {
  return (
    process.env.APP_BASE_URL ||
    process.env.URL ||
    "https://astroyou.app"
  ).replace(/\/$/, "");
}
