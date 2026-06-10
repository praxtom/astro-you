import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import {
  REFEREE_REWARD_CREDITS,
  REFERRER_REWARD_CREDITS,
  generateReferralCode,
} from "./shared/referrals";

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
    const userRef = db.collection("users").doc(decoded.uid);

    // Generate a random code once and reuse it. Avoids both the guessable
    // UID-derived code and a redundant Firestore write on every page load.
    const code = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const existing = snap.data()?.referral?.code;
      if (typeof existing === "string" && /^STAR[A-Z0-9]{6}$/.test(existing)) {
        return existing;
      }
      const newCode = generateReferralCode();
      tx.set(
        userRef,
        {
          referral: {
            code: newCode,
            referrerRewardCredits: REFERRER_REWARD_CREDITS,
            refereeRewardCredits: REFEREE_REWARD_CREDITS,
            updatedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );
      return newCode;
    });

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
