import { schedule } from "@netlify/functions";
import { generateDailyDigestForUser } from "./shared/daily-digest-runner";
import { processUsersPaged } from "./shared/scheduled-users";

export const handler = schedule("30 1 * * *", async () => {
  const maxUsers = Number(process.env.DAILY_DIGEST_BATCH_SIZE || 1000);
  let emailSent = 0;
  let skipped = 0;

  const { processed, reachedEnd } = await processUsersPaged(
    { job: "daily-digest", maxUsers },
    async (userDoc) => {
      const data = userDoc.data();
      const profile = data.profile || data;
      const prefs = profile.notificationPrefs || data.notificationPrefs || {};
      if (prefs.emailDigest === false) {
        skipped += 1;
        return;
      }
      try {
        const result = await generateDailyDigestForUser({
          uid: userDoc.id,
          sendEmail: true,
          channel: "scheduled_email",
        });
        if (result.emailSent) emailSent += 1;
        else skipped += 1;
      } catch (err: any) {
        skipped += 1;
        console.error("[DailyDigestScheduled] User failed:", userDoc.id, err);
      }
    },
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ processed, reachedEnd, emailSent, skipped }),
  };
});
