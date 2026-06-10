import { Config, Context } from "@netlify/functions";
import { generateProactiveNudge } from "./shared/gemini";
import { buildUserContext } from "./shared/user-context";
import {
  verifyToken,
  enforceIpRateLimit,
  AuthError,
} from "./shared/require-auth";

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

    const { userContext } = await buildUserContext({ uid: decoded.uid });
    const nudge = await generateProactiveNudge(userContext, triggerType);

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
