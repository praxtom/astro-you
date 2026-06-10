import { Config, Context } from "@netlify/functions";
import { AdminAuthError, requireAdmin } from "./shared/admin-auth.js";
import { db } from "./shared/firebase-admin.js";
import { buildFunnelSummary } from "./shared/funnel-summary.js";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    await requireAdmin(body.idToken);
    const limit =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.min(Math.max(Math.floor(body.limit), 1), 1000)
        : 1000;

    const snapshot = await db
      .collection("analyticsEvents")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    const events = snapshot.docs.map((doc) => doc.data());

    return json(buildFunnelSummary(events));
  } catch (error: any) {
    console.error("[AdminFunnelSummary] Error:", error);
    const status = error instanceof AdminAuthError ? error.status : 500;
    return json({ error: error.message || "Could not load funnel summary" }, status);
  }
};

export const config: Config = { path: "/api/admin/funnel-summary" };

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
