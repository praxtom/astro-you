import { createHash } from "node:crypto";
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
import {
  reserveFeatureCredits,
  insufficientCreditsResponse,
  stableChargeKey,
  CreditError,
  type FeatureCharge,
} from "./shared/feature-credits";
import { requestedDateKey } from "./shared/request-date.js";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let charge: FeatureCharge | null = null;
  try {
    const { birthData, transitDate, idToken, localDate } = await req.json();

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

    // Transit Oracle is a premium surface — reserve credits before the paid
    // API calls. Refunded by the outer catch if the chart fetch fails. Keyed
    // per chart + transit date so re-viewing the same day's transits (which
    // the 12h report cache serves anyway) doesn't bill again.
    try {
      charge = await reserveFeatureCredits(
        decoded.uid,
        "transit",
        stableChargeKey(
          birthData.dob,
          birthData.tob,
          birthData.pob,
          transitDate || requestedDateKey(localDate),
        ),
      );
    } catch (err) {
      if (err instanceof CreditError) return insufficientCreditsResponse();
      throw err;
    }

    // Fetch both transit positions and the interpretive report.
    // Cache key covers dob + tob + pob so users sharing a birthdate don't
    // collide — hashed so raw birth data never appears in a doc ID.
    const today = requestedDateKey(localDate);
    const reportKey = createHash("sha256")
      .update(
        `${birthData.dob}_${birthData.tob}_${birthData.pob || ""}_${transitDate || today}`,
      )
      .digest("hex");
    console.log(
      `[Transit] Fetching chart and report for ${transitDate || "today"}...`,
    );
    const [chartData, reportData] = await Promise.all([
      getTransitChart(birthData, transitDate).then((d) => {
        console.log("[Transit] Chart data received");
        return d;
      }),
      // A report failure must not fail the whole request — the chart is still
      // useful. getCachedOrFetch propagates the fetcher throw (so nothing is
      // cached on failure); we degrade to empty predictions in-memory only.
      getCachedOrFetch(
        "transit_reports",
        reportKey,
        () => getTransitReport(birthData, transitDate),
        12, // 12-hour TTL for transit reports
      )
        .then((d) => {
          console.log(
            `[Transit] Report data received (${Array.isArray(d) ? d.length : 0} events)`,
          );
          return d;
        })
        .catch((err) => {
          console.error("[Transit] Report fetch failed, degrading:", err);
          return [] as any[];
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
          date: transitDate || requestedDateKey(localDate),
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Transit function error:", error);
    if (charge) await charge.refund();
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
