import { Config, Context } from "@netlify/functions";
import { generateGrowthReport } from "./shared/gemini";
import { buildUserContext } from "./shared/user-context";
import {
  AuthError,
  enforceUserRateLimit,
  verifyToken,
} from "./shared/require-auth";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { birthData, idToken } = await req.json();

    let decoded;
    try {
      decoded = await verifyToken(idToken);
      await enforceUserRateLimit(decoded.uid, "growth_report", 12, 60 * 60 * 1000);
    } catch (err) {
      const status = err instanceof AuthError ? err.status : 401;
      return new Response(
        JSON.stringify({
          error:
            status === 429
              ? "Too many requests. Please slow down."
              : "Authentication required",
        }),
        { status, headers: { "Content-Type": "application/json" } },
      );
    }

    const { userContext } = await buildUserContext({
      uid: decoded.uid,
      birthData,
    });

    const report = await generateGrowthReport(userContext);

    return new Response(JSON.stringify({ report }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Growth report error:", error?.name);
    return new Response(
      JSON.stringify({ error: "Could not generate growth report" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = {
  path: "/api/growth-report",
};
