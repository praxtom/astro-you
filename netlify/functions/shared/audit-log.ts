import { db, FieldValue } from "./firebase-admin.js";

export interface AuditLogInput {
  uid?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

// Audit entries outlive account deletion (fraud prevention, accounting,
// disputes) for this long, then the Firestore TTL policy on `expiresAt`
// (firestore.indexes.json) deletes them. Keep in sync with the Privacy Policy.
export const AUDIT_LOG_RETENTION_YEARS = 8;

/** TTL timestamp for an audit entry written now. Use on direct batch writes too. */
export function auditLogExpiresAt(now = new Date()): Date {
  const expiresAt = new Date(now.getTime());
  expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + AUDIT_LOG_RETENTION_YEARS);
  return expiresAt;
}

export async function writeAuditLog(input: AuditLogInput) {
  await db.collection("auditLogs").add({
    uid: input.uid || null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId || null,
    metadata: input.metadata || {},
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: auditLogExpiresAt(),
  });
}
