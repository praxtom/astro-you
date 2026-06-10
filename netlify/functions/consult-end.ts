import { Config, Context } from "@netlify/functions";
import { db, auth, FieldValue } from "./shared/firebase-admin";
import { endConsultSession } from "./shared/consult-session";
import { writeAuditLog } from "./shared/audit-log";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const result = await endConsultSession({
      auth,
      db,
      FieldValue,
    }, payload);

    try {
      const decoded = await auth.verifyIdToken(payload.idToken);
      await writeAuditLog({
        uid: decoded.uid,
        action: "consultation_billed",
        entityType: "consultation",
        entityId: payload.sessionId,
        metadata: {
          durationSeconds: result.durationSeconds,
          minutes: result.minutes,
          cost: result.cost,
        },
      });
    } catch (auditError) {
      console.error("[Consult End] Audit log failed:", auditError);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Consult End] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Could not end consultation" }),
      {
        status: error.status || 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = {
  path: "/api/consult/end",
};
