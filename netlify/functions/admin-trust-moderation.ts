import { Config, Context } from "@netlify/functions";
import { db, FieldValue } from "./shared/firebase-admin.js";
import { AdminAuthError, requireAdmin } from "./shared/admin-auth.js";
import {
  buildTrustModerationDecision,
  TrustRecordError,
} from "./shared/trust.js";

type TrustModerationAction = "list" | "approve" | "reject";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const admin = await requireAdmin(body.idToken);
    const action = body.action as TrustModerationAction;

    if (action === "list") {
      const safeLimit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);
      const snapshot = await db
        .collection("trustModerationQueue")
        .orderBy("createdAt", "desc")
        .limit(safeLimit)
        .get();
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return json({ items });
    }

    const decision = buildTrustModerationDecision(
      {
        action,
        moderationId: body.moderationId,
        note: body.note,
      },
      admin,
      FieldValue.serverTimestamp(),
    );
    const moderationRef = db
      .collection("trustModerationQueue")
      .doc(decision.moderationId);
    const moderationSnap = await moderationRef.get();
    if (!moderationSnap.exists)
      return json({ error: "Moderation record not found" }, 404);

    const record = moderationSnap.data() || {};
    const patch = {
      ...decision.patch,
      updatedAt: FieldValue.serverTimestamp(),
    };
    const approved = decision.publicStatus === "approved";

    // All writes in one atomic batch so a partial failure can't leave the
    // moderation queue and the public/owner copies inconsistent.
    const batch = db.batch();
    batch.set(moderationRef, patch, { merge: true });

    if (
      record.kind === "testimonial" &&
      isString(record.uid) &&
      isString(record.testimonialId)
    ) {
      batch.set(
        db
          .collection("users")
          .doc(record.uid)
          .collection("testimonialSubmissions")
          .doc(record.testimonialId),
        patch,
        { merge: true },
      );
    }

    if (
      record.kind === "consult_review" &&
      isString(record.uid) &&
      isString(record.reviewId)
    ) {
      batch.set(
        db
          .collection("users")
          .doc(record.uid)
          .collection("consultationReviews")
          .doc(record.reviewId),
        patch,
        { merge: true },
      );

      if (isString(record.personaId)) {
        const publicReviewRef = db
          .collection("astrologers")
          .doc(record.personaId)
          .collection("reviews")
          .doc(record.reviewId);
        if (approved) {
          // Publish the FULL review content only on approval — this is the only
          // place a review becomes publicly visible.
          batch.set(publicReviewRef, { ...record, ...patch }, { merge: true });
        } else {
          // Rejected — ensure nothing is left in the public collection.
          batch.delete(publicReviewRef);
        }
      }
    }

    batch.set(db.collection("auditLogs").doc(), {
      uid: isString(record.uid) ? record.uid : null,
      action: `trust_${decision.publicStatus}`,
      entityType: "trustModerationQueue",
      entityId: decision.moderationId,
      metadata: {
        adminUid: admin.uid,
        adminEmail: admin.email,
        kind: record.kind || null,
        note: decision.patch.moderationNote,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    return json({
      success: true,
      id: decision.moderationId,
      publicStatus: decision.publicStatus,
    });
  } catch (error: any) {
    console.error("[AdminTrustModeration] Error:", error);
    const status =
      error instanceof TrustRecordError || error instanceof AdminAuthError
        ? error.status
        : 500;
    return json({ error: error.message || "Trust moderation failed" }, status);
  }
};

export const config: Config = { path: "/api/admin/trust-moderation" };

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
