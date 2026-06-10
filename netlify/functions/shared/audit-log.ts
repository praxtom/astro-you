import { db, FieldValue } from "./firebase-admin.js";

export interface AuditLogInput {
  uid?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditLogInput) {
  await db.collection("auditLogs").add({
    uid: input.uid || null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId || null,
    metadata: input.metadata || {},
    createdAt: FieldValue.serverTimestamp(),
  });
}
