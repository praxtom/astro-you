import { Config, Context } from "@netlify/functions";
import { db } from "./shared/firebase-admin";
import { requireAdmin } from "./shared/admin-auth";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const { idToken, uid, action, limit = 100 } = await req.json();
    await requireAdmin(idToken);

    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const snap = await db
      .collection("auditLogs")
      .orderBy("createdAt", "desc")
      .limit(safeLimit)
      .get();

    const logs = snap.docs
      .map((doc) => serializeAuditLog(doc.id, doc.data()))
      .filter((log: any) => (!uid || log.uid === uid) && (!action || log.action === action));

    return json({ logs });
  } catch (err: any) {
    console.error("[AdminAuditLogs] Error:", err);
    return json({ error: err.message || "Could not load audit logs" }, err.status || 500);
  }
};

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = { path: "/api/admin/audit-logs" };

function serializeAuditLog(id: string, data: Record<string, any>) {
  return {
    id,
    ...data,
    createdAt: serializeDate(data.createdAt),
  };
}

function serializeDate(value: any): string | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}
