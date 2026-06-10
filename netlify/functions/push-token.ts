import { Config, Context } from "@netlify/functions";
import { db, auth, FieldValue } from "./shared/firebase-admin";
import {
  buildPushTokenRecord,
  createPushTokenDocId,
} from "./shared/push-tokens";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const idToken = typeof body.idToken === "string" ? body.idToken : "";
    if (!idToken) return json({ error: "Missing auth token" }, 401);

    const decoded = await auth.verifyIdToken(idToken);
    const userRef = db.collection("users").doc(decoded.uid);

    if (req.method === "DELETE") {
      const token = typeof body.token === "string" ? body.token.trim() : "";
      if (token) {
        await userRef
          .collection("pushTokens")
          .doc(createPushTokenDocId(token))
          .set({ active: false, updatedAt: new Date() }, { merge: true });
      } else {
        const activeTokens = await userRef
          .collection("pushTokens")
          .where("active", "==", true)
          .limit(20)
          .get();
        const batch = db.batch();
        activeTokens.docs.forEach((doc) => {
          batch.set(
            doc.ref,
            { active: false, updatedAt: new Date() },
            { merge: true },
          );
        });
        await batch.commit();
      }

      await userRef.set(
        {
          profile: { notificationPrefs: { pushBrainNudges: false } },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return json({ ok: true, active: false });
    }

    const record = buildPushTokenRecord({
      token: body.token,
      platform: body.platform,
      userAgent: body.userAgent,
    });
    const docId = createPushTokenDocId(record.token);
    await userRef
      .collection("pushTokens")
      .doc(docId)
      .set(record, { merge: true });
    await userRef.set(
      {
        fcmToken: record.token,
        profile: { notificationPrefs: { pushBrainNudges: true } },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return json({ ok: true, active: true });
  } catch (err: any) {
    console.error("[PushToken] Error:", err);
    return json({ error: "Push token update failed" }, 400);
  }
};

export const config: Config = { path: "/api/push-token" };

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
