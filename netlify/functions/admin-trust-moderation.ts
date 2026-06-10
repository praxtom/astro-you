import { Config, Context } from "@netlify/functions";
import { db, FieldValue } from "./shared/firebase-admin.js";
import { AdminAuthError, requireAdmin } from "./shared/admin-auth.js";
import { buildTrustModerationDecision, TrustRecordError } from "./shared/trust.js";

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
    const moderationRef = db.collection("trustModerationQueue").doc(decision.moderationId);
    const moderationSnap = await moderationRef.get();
    if (!moderationSnap.exists) return json({ error: "Moderation record not found" }, 404);

    const record = moderationSnap.data() || {};
    const patch = {
      ...decision.patch,
      updatedAt: FieldValue.serverTimestamp(),
    };
    const writes: Promise<unknown>[] = [moderationRef.set(patch, { merge: true })];

    if (record.kind === "testimonial" && isString(record.uid) && isString(record.testimonialId)) {
      writes.push(
        db
          .collection("users")
          .doc(record.uid)
          .collection("testimonialSubmissions")
          .doc(record.testimonialId)
          .set(patch, { merge: true }),
      );
    }

    if (record.kind === "consult_review" && isString(record.uid) && isString(record.reviewId)) {
      writes.push(
        db
          .collection("users")
          .doc(record.uid)
          .collection("consultationReviews")
          .doc(record.reviewId)
          .set(patch, { merge: true }),
      );

      if (isString(record.personaId)) {
        writes.push(
          db
            .collection("astrologers")
            .doc(record.personaId)
            .collection("reviews")
            .doc(record.reviewId)
            .set(patch, { merge: true }),
        );
      }
    }

    writes.push(
      db.collection("auditLogs").add({
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
      }),
    );

    await Promise.all(writes);
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
