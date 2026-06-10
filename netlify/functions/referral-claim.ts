import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import {
  ReferralError,
  buildReferralClaimRecord,
  normalizeReferralCode,
} from "./shared/referrals";
import { enforceIpRateLimit, AuthError } from "./shared/require-auth";

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
    // Rate-limit to prevent brute-forcing the referral-code space.
    try {
      await enforceIpRateLimit(req, "referral_claim", 10, 60 * 60 * 1000);
    } catch (err) {
      if (err instanceof AuthError)
        return json({ error: err.message }, err.status);
      throw err;
    }
    const code = normalizeReferralCode(body.referralCode);
    const referrerSnap = await db
      .collection("users")
      .where("referral.code", "==", code)
      .limit(1)
      .get();

    if (referrerSnap.empty) {
      throw new ReferralError("Referral code was not found", 404);
    }

    const referrerDoc = referrerSnap.docs[0];
    const referrerUid = referrerDoc.id;
    const createdAt = FieldValue.serverTimestamp();
    const claim = buildReferralClaimRecord(
      {
        code,
        referrerUid,
        refereeUid: decoded.uid,
        refereeEmail: decoded.email,
      },
      createdAt,
    );

    const result = await db.runTransaction(async (tx) => {
      const referrerRef = db.collection("users").doc(referrerUid);
      const refereeRef = db.collection("users").doc(decoded.uid);
      const refereeClaimRef = refereeRef.collection("referralClaims").doc(code);
      const referrerReferralRef = referrerRef
        .collection("referrals")
        .doc(decoded.uid);
      const referrerLedgerRef = referrerRef
        .collection("creditLedger")
        .doc(`referral_referrer_${decoded.uid}`);
      const refereeLedgerRef = refereeRef
        .collection("creditLedger")
        .doc(`referral_referee_${code}`);

      const [claimSnap, referrerUserSnap, refereeUserSnap] = await Promise.all([
        tx.get(refereeClaimRef),
        tx.get(referrerRef),
        tx.get(refereeRef),
      ]);

      if (claimSnap.exists) {
        return { duplicate: true };
      }

      // A user may be referred at most once, ever. Without this a referee could
      // claim many different codes to farm the signup reward.
      const refereeData = refereeUserSnap.data() || {};
      if (refereeData.referredBy) {
        throw new ReferralError("You have already used a referral code", 409);
      }

      const referrerBalance = referrerUserSnap.data()?.credits ?? 0;
      const refereeBalance = refereeData.credits ?? 0;

      tx.set(refereeClaimRef, claim);
      tx.set(referrerReferralRef, claim);
      tx.set(
        refereeRef,
        {
          referredBy: code,
          referralClaimedAt: createdAt,
          credits: FieldValue.increment(claim.refereeRewardCredits),
        },
        { merge: true },
      );
      tx.update(referrerRef, {
        credits: FieldValue.increment(claim.referrerRewardCredits),
      });

      tx.set(referrerLedgerRef, {
        type: "referral_bonus",
        amount: claim.referrerRewardCredits,
        source: "referral",
        referenceId: decoded.uid,
        balanceBefore: referrerBalance,
        balanceAfter: referrerBalance + claim.referrerRewardCredits,
        metadata: { code, refereeUid: decoded.uid },
        createdAt,
      });
      tx.set(refereeLedgerRef, {
        type: "referral_bonus",
        amount: claim.refereeRewardCredits,
        source: "referral",
        referenceId: code,
        balanceBefore: refereeBalance,
        balanceAfter: refereeBalance + claim.refereeRewardCredits,
        metadata: { code, referrerUid },
        createdAt,
      });

      return { duplicate: false };
    });

    return json(
      {
        success: true,
        duplicate: result.duplicate,
        referrerRewardCredits: claim.referrerRewardCredits,
        refereeRewardCredits: claim.refereeRewardCredits,
      },
      200,
    );
  } catch (error: any) {
    console.error("[Referral Claim] Error:", error);
    const status = error instanceof ReferralError ? error.status : 500;
    return json(
      {
        error:
          error instanceof ReferralError
            ? error.message
            : "Could not claim referral",
      },
      status,
    );
  }
};

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = {
  path: "/api/referrals/claim",
};
