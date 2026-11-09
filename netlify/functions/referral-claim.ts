import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import {
  REFERRAL_CLAIM_WINDOW_DAYS,
  ReferralError,
  buildReferralClaimRecord,
  isWithinReferralClaimWindow,
  normalizeReferralCode,
} from "./shared/referrals";
import { signupGrantKey } from "./shared/credits";
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

    // Referral codes are for new accounts only. The Auth record's creation
    // time is server-owned (the user doc's createdAt is client-writable).
    const authUser = await auth.getUser(decoded.uid);
    const createdMs = Date.parse(authUser.metadata?.creationTime || "");
    if (
      !isWithinReferralClaimWindow(Number.isNaN(createdMs) ? null : createdMs)
    ) {
      throw new ReferralError(
        `Referral codes can only be used within ${REFERRAL_CLAIM_WINDOW_DAYS} days of creating your account`,
        403,
      );
    }

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
    // The mailbox-level record also stops "delete account, sign up again,
    // claim again" from farming the referee bonus.
    const grantKey = signupGrantKey(decoded.email);

    const result = await db.runTransaction(async (tx) => {
      const refereeRef = db.collection("users").doc(decoded.uid);
      const refereeClaimRef = refereeRef.collection("referralClaims").doc(code);
      const referrerReferralRef = db
        .collection("users")
        .doc(referrerUid)
        .collection("referrals")
        .doc(decoded.uid);
      const refereeLedgerRef = refereeRef
        .collection("creditLedger")
        .doc(`referral_referee_${code}`);
      const grantRef = grantKey
        ? db.collection("signupGrants").doc(grantKey)
        : null;

      const [claimSnap, refereeUserSnap, grantSnap] = await Promise.all([
        tx.get(refereeClaimRef),
        tx.get(refereeRef),
        grantRef ? tx.get(grantRef) : Promise.resolve(null),
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
      if (grantSnap?.exists && grantSnap.data()?.referralClaimedAt) {
        throw new ReferralError("You have already used a referral code", 409);
      }

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
      // The referrer's reward is NOT paid here: it is granted after the
      // referee's first successful payment (grantReferrerRewardAfterPayment),
      // capped per referrer per month.
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
      if (grantRef) {
        tx.set(
          grantRef,
          { referralClaimedAt: createdAt, referralUid: decoded.uid },
          { merge: true },
        );
      }

      return { duplicate: false };
    });

    return json(
      {
        success: true,
        duplicate: result.duplicate,
        referrerRewardCredits: claim.referrerRewardCredits,
        refereeRewardCredits: claim.refereeRewardCredits,
        referrerRewardStatus: "pending_payment",
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
