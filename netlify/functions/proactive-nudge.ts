import { Config, Context } from "@netlify/functions";
import { generateProactiveNudge } from "./shared/gemini";
import { buildUserContext } from "./shared/user-context";
import {
  verifyToken,
  enforceIpRateLimit,
  AuthError,
} from "./shared/require-auth";

/**
 * Trigger names this endpoint will generate for. `triggerType` is interpolated
 * straight into the Gemini prompt, so an arbitrary client string is a prompt
 * injection vector (and a way to spend our model budget on off-product text).
 *
 * The list is the union of what the client actually sends
 * (src/hooks/useProactiveTriggers.ts: transit_alert, relational_management,
 * synastry_alert) and the cases the prompt in shared/gemini.ts declares
 * behaviour for.
 */
const ALLOWED_TRIGGER_TYPES = new Set([
  "morning_routine",
  "anniversary_reflection",
  "transit_alert",
  "emotional_stabilization",
  "relational_management",
  "synastry_alert",
]);

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { triggerType, idToken } = await req.json();

    // This endpoint generates AI content (paid Gemini call). It MUST be
    // authenticated and rate-limited, and the user's context is loaded
    // server-side from their verified uid — never from client-supplied
    // birth/atman data (which would be an open AI proxy + injection vector).
    let decoded;
    try {
      decoded = await verifyToken(idToken);
      await enforceIpRateLimit(req, "proactive_nudge", 20, 60 * 60 * 1000);
    } catch (err) {
      const status = err instanceof AuthError ? err.status : 401;
      return new Response(
        JSON.stringify({
          error:
            err instanceof AuthError ? err.message : "Authentication required",
        }),
        { status, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      typeof triggerType !== "string" ||
      !ALLOWED_TRIGGER_TYPES.has(triggerType)
    ) {
      return new Response(JSON.stringify({ error: "Unknown trigger type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { userContext } = await buildUserContext({ uid: decoded.uid });
    const nudge = await generateProactiveNudge(
      userContext,
      triggerType as Parameters<typeof generateProactiveNudge>[1],
    );

    return new Response(JSON.stringify(nudge), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Proactive nudge error:", error);
    return new Response(
      JSON.stringify({ error: "Could not generate nudge." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = {
  path: "/api/proactive-nudge",
};
