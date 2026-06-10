import { Config, Context } from "@netlify/functions";
import { AdminAuthError, requireAdmin } from "./shared/admin-auth.js";
import { auth, db, getStorageBucket } from "./shared/firebase-admin.js";
import { buildLaunchReadinessReport } from "./shared/launch-readiness.js";
import { verifyLiveServices } from "./shared/live-services.js";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    await requireAdmin(body.idToken);
    const staticReadiness = buildLaunchReadinessReport(process.env);
    const liveServices = await verifyLiveServices({
      async verifyFirestore() {
        await db.collection("__astroyou_healthcheck").limit(1).get();
      },
      async verifyAuth() {
        await auth.listUsers(1);
      },
      async verifyStorage() {
        const [exists] = await getStorageBucket().exists();
        if (!exists) throw new Error("Configured storage bucket was not found.");
      },
    });

    return json({ ...staticReadiness, liveServices });
  } catch (error: any) {
    console.error("[AdminLaunchReadiness] Error:", error);
    const status = error instanceof AdminAuthError ? error.status : 500;
    return json({ error: error.message || "Could not load launch readiness" }, status);
  }
};

export const config: Config = { path: "/api/admin/launch-readiness" };

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
