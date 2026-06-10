import { schedule } from "@netlify/functions";
import { db } from "./shared/firebase-admin";
import { generateDailyDigestForUser } from "./shared/daily-digest-runner";

export const handler = schedule("30 1 * * *", async () => {
  const limit = Number(process.env.DAILY_DIGEST_BATCH_SIZE || 200);
  const users = await db.collection("users").limit(limit).get();
  const results = [];

  for (const userDoc of users.docs) {
    const data = userDoc.data();
    const profile = data.profile || data;
    const prefs = profile.notificationPrefs || data.notificationPrefs || {};
    if (prefs.emailDigest === false) {
      results.push({
        uid: userDoc.id,
        emailSent: false,
        skippedReason: "email_digest_disabled",
      });
      continue;
    }

    try {
      results.push(
        await generateDailyDigestForUser({
          uid: userDoc.id,
          sendEmail: true,
          channel: "scheduled_email",
        }),
      );
    } catch (err: any) {
      console.error("[DailyDigestScheduled] User failed:", userDoc.id, err);
      results.push({
        uid: userDoc.id,
        emailSent: false,
        skippedReason: err.message || "failed",
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      processed: results.length,
      emailSent: results.filter((item) => item.emailSent).length,
      skipped: results.filter((item) => item.skippedReason).length,
    }),
  };
});
