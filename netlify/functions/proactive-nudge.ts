import { Config, Context } from "@netlify/functions";
import { generateProactiveNudge } from "./shared/gemini";
import { buildUserContext } from "./shared/user-context";
import { selectNudgePartner } from "./shared/nudge-partner";
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
 *
 * Typed as the generator's own parameter union so a name that drifts out of
 * shared/gemini.ts fails to compile here, and a matched value flows straight
 * into the call without a cast.
 */
type NudgeTriggerType = Parameters<typeof generateProactiveNudge>[1];

const ALLOWED_TRIGGER_TYPES: readonly NudgeTriggerType[] = [
  "morning_routine",
  "anniversary_reflection",
  "transit_alert",
  "emotional_stabilization",
  "relational_management",
  "synastry_alert",
];

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { triggerType, idToken, partnerData } = await req.json();

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

    const trigger = ALLOWED_TRIGGER_TYPES.find((t) => t === triggerType);
    if (!trigger) {
      return new Response(JSON.stringify({ error: "Unknown trigger type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Full context: the weekly-cached transits and dasha ground the prompt.
    const { userContext } = await buildUserContext({ uid: decoded.uid });
    const partner =
      trigger === "synastry_alert"
        ? selectNudgePartner(userContext.atman?.keyRelationships, partnerData)
        : null;
    const nudge = await generateProactiveNudge(userContext, trigger, {
      partner,
    });

    // No grounding data or generation failed: no nudge (never a canned line
    // presented as personal guidance).
    return new Response(JSON.stringify(nudge ?? { skipped: true }), {
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
