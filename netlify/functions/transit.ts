import { Config, Context } from "@netlify/functions";
import { getTransitChart, getTransitReport } from "./shared/astro-api";
import { generateTransitSummary } from "./shared/gemini";
import { getCachedOrFetch } from "./shared/cache";
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
    const { birthData, transitDate, idToken } = await req.json();

    // Auth + rate limit: transit calls the paid astrology API + Gemini.
    let decoded;
    try {
      decoded = await verifyToken(idToken);
      await enforceIpRateLimit(req, "transit", 30, 60 * 60 * 1000);
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

    if (!birthData || !birthData.dob || !birthData.tob) {
      return new Response(JSON.stringify({ error: "Missing birth data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch both transit positions and the interpretive report.
    // Cache key includes tob + pob so users sharing a birthdate don't collide.
    const today = new Date().toISOString().split("T")[0];
    const reportKey = `${birthData.dob}_${birthData.tob}_${(birthData.pob || "").replace(/[/\s]/g, "_")}_${transitDate || today}`;
    console.log(
      `[Transit] Fetching chart and report for ${transitDate || "today"}...`,
    );
    const [chartData, reportData] = await Promise.all([
      getTransitChart(birthData, transitDate).then((d) => {
        console.log("[Transit] Chart data received");
        return d;
      }),
      getCachedOrFetch(
        "transit_reports",
        reportKey,
        () => getTransitReport(birthData, transitDate),
        12, // 12-hour TTL for transit reports
      ).then((d) => {
        console.log(
          `[Transit] Report data received (${(d as any)?.length || 0} events)`,
        );
        return d;
      }),
    ]);

    // Generate Gemini summary if we have report data
    let aiSummary = "";
    if (reportData && reportData.length > 0) {
      try {
        const { userContext } = await buildUserContext({
          uid: decoded.uid,
          birthData,
        });
        aiSummary = await generateTransitSummary(userContext, reportData);
        console.log("[Transit] AI summary generated");
      } catch (err) {
        console.error("[Transit] AI summary generation failed:", err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          positions: chartData,
          predictions: reportData,
          aiSummary,
          date: transitDate || new Date().toISOString().split("T")[0],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Transit function error:", error);
    return new Response(
      JSON.stringify({ error: "Transit request failed. Please try again." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = { path: "/api/transit" };
