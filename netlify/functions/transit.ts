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
import { keyedCacheId } from "./shared/chart-cache.js";
import {
  isUpstreamQuotaError,
  upstreamQuotaResponse,
} from "./shared/kundali-errors.js";

/** Transit reports are cached per chart + day for 12 hours. */
const TRANSIT_REPORT_TTL_HOURS = 12;

function errorSummary(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

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
    // Profile-shaped clients send { coordinates: { lat, lng } }; the subject
    // and transit-time builders read flat lat/lng, so lift them (the exact
    // geocoded point beats re-geocoding the place string).
    if (
      (birthData.lat === undefined || birthData.lat === null) &&
      typeof birthData.coordinates?.lat === "number" &&
      typeof birthData.coordinates?.lng === "number"
    ) {
      birthData.lat = birthData.coordinates.lat;
      birthData.lng = birthData.coordinates.lng;
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
      if (err instanceof CreditError) return insufficientCreditsResponse(err);
      throw err;
    }

    // Fetch both transit positions and the interpretive report.
    // Cache key covers the chart (dob, tob, place, coordinates) and the day,
    // as an HMAC under the server secret: a plain hash of birth data can be
    // brute-forced back to the birth moment from a doc id.
    const today = requestedDateKey(localDate);
    const reportKey = keyedCacheId("transit_report", [
      birthData.dob,
      String(birthData.tob ?? "").slice(0, 5),
      birthData.pob || "",
      typeof birthData.lat === "number" ? birthData.lat.toFixed(4) : "",
      typeof birthData.lng === "number" ? birthData.lng.toFixed(4) : "",
      transitDate || today,
    ]);
    console.log(
      `[Transit] Fetching chart and report for ${transitDate || "today"}...`,
    );
    const [chartResult, reportResult] = await Promise.allSettled([
      getTransitChart(birthData, transitDate),
      // getCachedOrFetch propagates the fetcher throw, so nothing is cached
      // on failure.
      getCachedOrFetch(
        "transit_reports",
        reportKey,
        () => getTransitReport(birthData, transitDate),
        TRANSIT_REPORT_TTL_HOURS,
      ),
    ]);
    // No chart, nothing to show: the outer catch refunds (and maps a spent
    // allowance to 503 `upstream_quota`).
    if (chartResult.status === "rejected") throw chartResult.reason;
    const chartData = chartResult.value;
    console.log("[Transit] Chart data received");

    // A report failure must not fail the whole request — the chart is still
    // useful — but the user paid for chart + report: refund the reservation
    // and say so, instead of keeping the charge for half the product.
    let reportData: any[] = [];
    let reportUnavailable = false;
    if (reportResult.status === "fulfilled") {
      reportData = Array.isArray(reportResult.value) ? reportResult.value : [];
      console.log(`[Transit] Report data received (${reportData.length} events)`);
    } else {
      reportUnavailable = true;
      console.error(
        "[Transit] Report fetch failed; refunding and degrading:",
        isUpstreamQuotaError(reportResult.reason)
          ? "upstream_quota"
          : errorSummary(reportResult.reason),
      );
      if (charge) {
        await charge.refund();
        charge = null;
      }
    }

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
          // Predictions could not be fetched; no credits were used.
          ...(reportUnavailable
            ? { reportUnavailable: true, refunded: true }
            : {}),
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Transit function error:", errorSummary(error));
    if (charge) await charge.refund();
    // Spent astrology allowance (upstream 429 or our own budget/breaker):
    // a retryable 503, not a generic 500.
    if (isUpstreamQuotaError(error)) return upstreamQuotaResponse();
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
