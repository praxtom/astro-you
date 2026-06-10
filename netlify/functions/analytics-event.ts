import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin.js";
import {
  FunnelAnalyticsError,
  buildFunnelEventRecord,
} from "./shared/funnel-analytics.js";
import { checkRateLimit, getRequestIdentifier } from "./shared/rate-limit.js";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const rateKey = `${getRequestIdentifier(req)}:${body.anonymousId || "anonymous"}`;
    const rate = await checkRateLimit({
      scope: "analytics_event",
      key: rateKey,
      limit: 180,
      windowMs: 15 * 60 * 1000,
    });
    if (!rate.allowed) {
      return json(
        {
          error: "Too many analytics events",
          resetAt: rate.resetAt.toISOString(),
        },
        429,
      );
    }

    const uid = await resolveOptionalUid(body.idToken);
    const record = buildFunnelEventRecord(
      {
        eventName: body.eventName,
        params: body.params,
        path: body.path,
        referrer: body.referrer,
        anonymousId: body.anonymousId,
        sessionId: body.sessionId,
        acquisition: body.acquisition,
      },
      { uid },
      FieldValue.serverTimestamp(),
    );

    const ref = await db.collection("analyticsEvents").add(record);
    return json({ success: true, eventId: ref.id });
  } catch (error: any) {
    console.error("[AnalyticsEvent] Error:", error);
    const status = error instanceof FunnelAnalyticsError ? error.status : 500;
    return json(
      {
        error:
          error instanceof FunnelAnalyticsError
            ? error.message
            : "Could not record analytics event",
      },
      status,
    );
  }
};

export const config: Config = { path: "/api/analytics/event" };

async function resolveOptionalUid(idToken: unknown) {
  if (typeof idToken !== "string" || !idToken) return null;
  const decoded = await auth.verifyIdToken(idToken);
  return decoded.uid;
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
