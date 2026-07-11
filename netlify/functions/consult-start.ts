import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import { startConsultSession } from "./shared/consult-session";
import { enforceIpRateLimit, AuthError } from "./shared/require-auth";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // Per-IP limit (fail-closed scope) — starting sessions touches billing
    // state, so an unbounded loop of starts must not be possible.
    try {
      await enforceIpRateLimit(req, "consult_start", 30, 60 * 60 * 1000);
    } catch (err) {
      if (err instanceof AuthError) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: err.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw err;
    }

    const result = await startConsultSession(
      {
        auth,
        db,
        FieldValue,
      },
      await req.json(),
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Consult Start] Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Could not start consultation",
      }),
      {
        status: error.status || 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = {
  path: "/api/consult/start",
};
