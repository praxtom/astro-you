import { Config, Context } from "@netlify/functions";
import { db, FieldValue } from "./shared/firebase-admin";
import {
  buildExpertApplicationRecord,
  ExpertApplicationError,
} from "./shared/expert-applications";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
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
