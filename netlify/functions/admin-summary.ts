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
    const limit = Math.min(Math.max(Number(body.limit) || 1000, 1), 5000);
    // Field mask: fetch only what buildAdminSummary needs. Avoids loading heavy
    // PII (atman emotional state, kundaliData, parsedChart, chats) into memory.
    const usersSnapshot = await db
      .collection("users")
      .select(
        "email",
        "credits",
        "creditsUsed",
        "subscription",
        "tier",
        "usage",
        "updatedAt",
        "profile",
      )
      .limit(limit)
      .get();
    const users = usersSnapshot.docs.map((doc: FirestoreUserDoc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return json(buildAdminSummary(users));
  } catch (error: any) {
    console.error("[AdminSummary] Error:", error);
    const status = error instanceof AdminAuthError ? error.status : 500;
    return json(
      { error: error.message || "Could not load admin summary" },
      status,
    );
  }
};

export const config: Config = { path: "/api/admin/summary" };

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
