import { Config, Context } from "@netlify/functions";
import { AdminAuthError, requireAdmin } from "./shared/admin-auth.js";
import {
  AdminOperationsError,
  buildAdminOperationUpdate,
  buildOperationsQueueItem,
  buildOpsHealthView,
} from "./shared/admin-operations.js";
import { describeError } from "./shared/error-summary.js";
import { db, FieldValue } from "./shared/firebase-admin.js";
import { auditLogExpiresAt } from "./shared/audit-log.js";

type AdminOperationsAction = "list" | "update";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const admin = await requireAdmin(body.idToken);
    const action = body.action as AdminOperationsAction;

    if (action === "list") {
      const limit = clampLimit(body.limit);
      const [supportSnap, remedySnap] = await Promise.all([
        db
          .collection("supportTickets")
          .orderBy("createdAt", "desc")
          .limit(limit)
          .get(),
        db
          .collection("remedyRequests")
          .orderBy("createdAt", "desc")
          .limit(limit)
          .get(),
      ]);

      const items = [
        ...supportSnap.docs.map((doc) =>
          serializeQueueItem(
            buildOperationsQueueItem("support", doc.id, doc.data()),
          ),
        ),
        ...remedySnap.docs.map((doc) =>
          serializeQueueItem(
            buildOperationsQueueItem("remedy", doc.id, doc.data()),
          ),
        ),
      ]
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, limit);

      // Ops health is additive: a missing collection or index must never
      // break the support/remedy queue.
      const health = await Promise.all([
        db.collection("opsEvents").orderBy("createdAt", "desc").limit(50).get(),
        db.collection("jobRuns").limit(50).get(),
      ])
        .then(([eventsSnap, runsSnap]) =>
          buildOpsHealthView(
            eventsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
            runsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
          ),
        )
        .catch((error) => {
          console.error(
            "[AdminOperations] Ops health failed:",
            describeError(error),
          );
          return null;
        });

      return json({
        items,
        ...(health ?? { opsEvents: [], jobs: [], staleJobs: [] }),
      });
    }

    if (action !== "update") {
      throw new AdminOperationsError(
        "Valid admin operation action is required",
      );
    }

    const update = buildAdminOperationUpdate(
      {
        kind: body.kind,
        itemId: body.itemId,
        status: body.status,
        note: body.note,
      },
      admin,
      FieldValue.serverTimestamp(),
    );

    const itemRef = db.collection(update.collectionName).doc(update.itemId);
    const itemSnap = await itemRef.get();
    if (!itemSnap.exists)
      return json({ error: "Operation item not found" }, 404);

    const item = itemSnap.data() || {};
    if (!isString(item.uid)) {
      throw new AdminOperationsError(
        "Operation item is missing user ownership",
        409,
      );
    }

    const batch = db.batch();
    batch.set(itemRef, update.patch, { merge: true });
    batch.set(
      db
        .collection("users")
        .doc(item.uid)
        .collection(update.userCollectionName)
        .doc(update.itemId),
      update.patch,
      { merge: true },
    );
    batch.set(db.collection("auditLogs").doc(), {
      uid: item.uid,
      action: `${update.kind}_${update.patch.status}`,
      entityType: update.collectionName,
      entityId: update.itemId,
      metadata: {
        adminUid: admin.uid,
        adminEmail: admin.email,
        note: update.patch.adminNote,
      },
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: auditLogExpiresAt(),
    });
    await batch.commit();

    return json({
      success: true,
      itemId: update.itemId,
      kind: update.kind,
      status: update.patch.status,
    });
  } catch (error: any) {
    console.error("[AdminOperations] Error:", describeError(error));
    const status =
      error instanceof AdminAuthError || error instanceof AdminOperationsError
        ? error.status
        : 500;
    return json({ error: error.message || "Admin operation failed" }, status);
  }
};

export const config: Config = { path: "/api/admin/operations" };

function clampLimit(value: unknown) {
  const limit =
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : 50;
  return Math.min(Math.max(limit, 1), 100);
}

function serializeQueueItem<T extends Record<string, any>>(item: T) {
  return {
    ...item,
    createdAt: serializeDate(item.createdAt),
    updatedAt: serializeDate(item.updatedAt),
  };
}

function serializeDate(value: any): string | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
