import { Config, Context } from "@netlify/functions";
import { db } from "./shared/firebase-admin.js";
import { AdminAuthError, requireAdmin } from "./shared/admin-auth.js";
import { buildAdminSummary } from "./shared/admin-summary.js";

interface FirestoreUserDoc {
  id: string;
  data(): Record<string, unknown>;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    await requireAdmin(body.idToken);
    const limit = Math.min(Math.max(Number(body.limit) || 5000, 1), 5000);
    const usersSnapshot = await db.collection("users").limit(limit).get();
    const users = usersSnapshot.docs.map((doc: FirestoreUserDoc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return json(buildAdminSummary(users));
  } catch (error: any) {
    console.error("[AdminSummary] Error:", error);
    const status = error instanceof AdminAuthError ? error.status : 500;
    return json({ error: error.message || "Could not load admin summary" }, status);
  }
};

export const config: Config = { path: "/api/admin/summary" };

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
