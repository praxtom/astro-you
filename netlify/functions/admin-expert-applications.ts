import { Config, Context } from "@netlify/functions";
import { AdminAuthError, requireAdmin } from "./shared/admin-auth.js";
import {
  ExpertApplicationError,
  buildExpertApplicationReviewDecision,
} from "./shared/expert-applications.js";
import { db, FieldValue } from "./shared/firebase-admin.js";

type AdminExpertAction = "list" | "update";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const admin = await requireAdmin(body.idToken);
    const action = body.action as AdminExpertAction;

    if (action === "list") {
      const limit = clampLimit(body.limit);
      const snapshot = await db
        .collection("expertApplications")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
      const items = snapshot.docs.map((doc) => serializeApplication(doc.id, doc.data()));
      return json({ items });
    }

    if (action !== "update") {
      throw new ExpertApplicationError("Valid expert application action is required");
    }

    const decision = buildExpertApplicationReviewDecision(
      {
        applicationId: body.applicationId,
        status: body.status,
        note: body.note,
      },
      admin,
      FieldValue.serverTimestamp(),
    );

    const applicationRef = db.collection("expertApplications").doc(decision.applicationId);
    const applicationSnap = await applicationRef.get();
    if (!applicationSnap.exists) return json({ error: "Application not found" }, 404);

    const batch = db.batch();
    batch.set(applicationRef, decision.patch, { merge: true });
    batch.set(db.collection("auditLogs").doc(), {
      uid: null,
      action: `expert_application_${decision.patch.status}`,
      entityType: "expertApplications",
      entityId: decision.applicationId,
      metadata: {
        adminUid: admin.uid,
        adminEmail: admin.email,
        note: decision.patch.reviewNote,
      },
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return json({
      success: true,
      applicationId: decision.applicationId,
      status: decision.patch.status,
      reviewStage: decision.patch.reviewStage,
    });
  } catch (error: any) {
    console.error("[AdminExpertApplications] Error:", error);
    const status =
      error instanceof AdminAuthError || error instanceof ExpertApplicationError
        ? error.status
        : 500;
    return json({ error: error.message || "Expert application review failed" }, status);
  }
};

export const config: Config = { path: "/api/admin/expert-applications" };

function serializeApplication(id: string, data: Record<string, any>) {
  return {
    id,
    ...data,
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt),
    approvedAt: serializeDate(data.approvedAt),
    rejectedAt: serializeDate(data.rejectedAt),
  };
}

function serializeDate(value: any): string | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function clampLimit(value: unknown) {
  const limit = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 50;
  return Math.min(Math.max(limit, 1), 100);
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
