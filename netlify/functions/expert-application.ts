import { Config, Context } from "@netlify/functions";
import { db, FieldValue } from "./shared/firebase-admin";
import {
  buildExpertApplicationRecord,
  ExpertApplicationError,
} from "./shared/expert-applications";
import { checkRateLimit, getRequestIdentifier } from "./shared/rate-limit";

/**
 * Fail-closed per-IP limiter. "expert_apply" is not enrolled in the shared
 * limiter's FAIL_CLOSED_SCOPES, whose outage fallback reports
 * `{ allowed: true, remaining: 0 }` — the same shape as the final in-budget
 * request. Denying `remaining <= 0` (and sizing the limit one above the real
 * budget) therefore also denies during limiter-store outages, keeping this
 * public write endpoint from failing open.
 */
async function allowAnonRequest(
  req: Request,
  scope: string,
  budget: number,
  windowMs: number,
): Promise<boolean> {
  const result = await checkRateLimit({
    scope,
    key: getRequestIdentifier(req),
    limit: budget + 1,
    windowMs,
  });
  return result.allowed && result.remaining > 0;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    // Public endpoint — cap unauthenticated application writes per IP.
    const allowed = await allowAnonRequest(
      req,
      "expert_apply",
      3,
      24 * 60 * 60 * 1000,
    );
    if (!allowed) {
      return json(
        { error: "Too many applications. Please try again tomorrow." },
        429,
      );
    }

    const body = await req.json().catch(() => ({}));
    const createdAt = FieldValue.serverTimestamp();
    const record = buildExpertApplicationRecord(body, createdAt);
    const ref = await db.collection("expertApplications").add(record);

    return json(
      {
        success: true,
        applicationId: ref.id,
        status: record.status,
      },
      200,
    );
  } catch (error: any) {
    console.error("[Expert Application] Error:", error);
    const status = error instanceof ExpertApplicationError ? error.status : 500;
    return json(
      {
        error:
          error instanceof ExpertApplicationError
            ? error.message
            : "Could not submit expert application",
      },
      status,
    );
  }
};

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = {
  path: "/api/experts/apply",
};
