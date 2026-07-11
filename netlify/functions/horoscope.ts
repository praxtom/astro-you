import { Config, Context } from "@netlify/functions";
import {
  getDailyHoroscope,
  getDailyHoroscopeText,
  getWeeklyHoroscope,
  getMonthlyHoroscope,
  getYearlyHoroscope,
  getDashaPeriods,
  getPanchang,
} from "./shared/astro-api";
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
  type MeteredFeature,
} from "./shared/feature-credits";

// Extended forecasts are premium: charged in credits (daily stays free).
const PERIOD_FEATURE: Record<string, MeteredFeature> = {
  weekly: "horoscope_weekly",
  monthly: "horoscope_monthly",
  yearly: "horoscope_yearly",
};

/** ISO week key (e.g. "2026-W28") — the natural billing window for weekly. */
function isoWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let charge: FeatureCharge | null = null;
  try {
    const { birthData, date, period = "daily", idToken } = await req.json();

    // Auth + rate limit: each request fans out to up to 4 paid API calls.
    let decoded;
    try {
      decoded = await verifyToken(idToken);
      await enforceIpRateLimit(req, "horoscope", 40, 60 * 60 * 1000);
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

    // Reserve credits for premium (non-daily) forecasts before the paid API
    // calls. Refunded by the outer catch if delivery fails. The charge key is
    // deterministic per chart + period window, so re-opening the same forecast
    // (tab switches, refreshes) dedupes against the ledger instead of billing
    // again — one charge per week/month/year per chart.
    const feature = PERIOD_FEATURE[period];
    if (feature) {
      const resolvedDate =
        typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
          ? date
          : new Date().toISOString().split("T")[0];
      const periodKey =
        period === "yearly"
          ? resolvedDate.slice(0, 4)
          : period === "monthly"
            ? resolvedDate.slice(0, 7)
            : isoWeekKey(resolvedDate);
      try {
        charge = await reserveFeatureCredits(
          decoded.uid,
          feature,
          stableChargeKey(
            birthData.dob,
            birthData.tob,
            birthData.pob,
            periodKey,
          ),
        );
      } catch (err) {
        if (err instanceof CreditError) return insufficientCreditsResponse();
        throw err;
      }
    }

    console.log(
      `[Horoscope] Fetching ${period} forecast for ${date || "today"}...`,
    );

    if (period === "weekly") {
      // Weekly: fetch weekly horoscope + dashas (no narrative needed)
      const [horoscopeData, dashaData] = await Promise.all([
        getWeeklyHoroscope(birthData, date),
        getDashaPeriods(birthData),
      ]);

      const currentDasha = dashaData?.find((d: any) => d.isCurrent);
      const currentBhukti = currentDasha?.subPeriods?.find(
        (s: any) => s.isCurrent,
      );

      return new Response(
        JSON.stringify({
          horoscope: horoscopeData,
          dasha: {
            mahadasha: currentDasha?.planet,
            bhukti: currentBhukti?.planet,
            ends: currentBhukti?.endDate || currentDasha?.endDate,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (period === "monthly") {
      const [monthlyData, dashaData] = await Promise.all([
        getMonthlyHoroscope(birthData, date),
        getDashaPeriods(birthData),
      ]);

      const currentDasha = dashaData?.find((d: any) => d.isCurrent);
      const currentBhukti = currentDasha?.subPeriods?.find(
        (s: any) => s.isCurrent,
      );

      return new Response(
        JSON.stringify({
          horoscope: monthlyData,
          dasha: {
            mahadasha: currentDasha?.planet,
            bhukti: currentBhukti?.planet,
            ends: currentBhukti?.endDate || currentDasha?.endDate,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (period === "yearly") {
      const [yearlyData, dashaData] = await Promise.all([
        getYearlyHoroscope(birthData, date),
        getDashaPeriods(birthData),
      ]);

      const currentDasha = dashaData?.find((d: any) => d.isCurrent);
      const currentBhukti = currentDasha?.subPeriods?.find(
        (s: any) => s.isCurrent,
      );

      return new Response(
        JSON.stringify({
          horoscope: yearlyData,
          dasha: {
            mahadasha: currentDasha?.planet,
            bhukti: currentBhukti?.planet,
            ends: currentBhukti?.endDate || currentDasha?.endDate,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Default: daily horoscope (structured), narrative, dashas, and panchang in parallel
    const [horoscopeData, narrativeData, dashaData, panchangData] =
      await Promise.all([
        getDailyHoroscope(birthData, date),
        getDailyHoroscopeText(birthData, date),
        getDashaPeriods(birthData),
        getPanchang(date, birthData.pob, birthData.lat, birthData.lng).catch(
          () => null,
        ),
      ]);

    // Find current dasha
    const currentDasha = dashaData?.find((d: any) => d.isCurrent);
    const currentBhukti = currentDasha?.subPeriods?.find(
      (s: any) => s.isCurrent,
    );

    return new Response(
      JSON.stringify({
        horoscope: horoscopeData,
        narrative: narrativeData?.text || narrativeData,
        dasha: {
          mahadasha: currentDasha?.planet,
          bhukti: currentBhukti?.planet,
          ends: currentBhukti?.endDate || currentDasha?.endDate,
        },
        panchang: panchangData || null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[Horoscope] Function error:", error);
    if (charge) await charge.refund();
    return new Response(
      JSON.stringify({ error: "Horoscope request failed. Please try again." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = { path: "/api/horoscope" };
