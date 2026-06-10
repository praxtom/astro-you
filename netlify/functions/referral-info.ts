import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import { REFEREE_REWARD_CREDITS, REFERRER_REWARD_CREDITS, createReferralCode } from "./shared/referrals";

function serializeDate(value: any): string | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (!body.idToken || typeof body.idToken !== "string") {
      return json({ error: "Missing id token" }, 401);
    }

    const decoded = await auth.verifyIdToken(body.idToken);
    const code = createReferralCode(decoded.uid);
    const userRef = db.collection("users").doc(decoded.uid);

    await userRef.set(
      {
        referral: {
          code,
          referrerRewardCredits: REFERRER_REWARD_CREDITS,
          refereeRewardCredits: REFEREE_REWARD_CREDITS,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );

    const snap = await userRef
      .collection("referrals")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const referrals = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: serializeDate(data.createdAt),
      };
    });

    return json(
      {
        code,
        referrals,
        stats: {
          invited: referrals.length,
          creditsEarned: referrals.reduce(
            (sum, item: any) => sum + (Number(item.referrerRewardCredits) || 0),
            0,
          ),
          referrerRewardCredits: REFERRER_REWARD_CREDITS,
          refereeRewardCredits: REFEREE_REWARD_CREDITS,
        },
      },
      200,
    );
  } catch (error: any) {
    console.error("[Referral Info] Error:", error);
    return json({ error: "Could not load referral info" }, 500);
  }
};

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = {
  path: "/api/referrals/info",
};
