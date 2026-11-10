import { Config, Context } from "@netlify/functions";
import {
  getDailyHoroscope,
  getDailyHoroscopeText,
  getWeeklyHoroscope,
  getMonthlyHoroscope,
  getYearlyHoroscope,
  resolveHoroscopeSign,
  type BirthData,
} from "./shared/astro-api";
import {
  chartBirthData,
  getCachedDashaPeriods,
  getCachedPanchang,
} from "./shared/astro-cached.js";
import { getCachedOrFetch } from "./shared/cache.js";
import {
  CHART_CACHE_COLLECTION,
  birthChartCacheKey,
  clampedTodayKey,
  isCalendarDateKey,
  stripEchoedBirthInputs,
} from "./shared/chart-cache.js";
import {
  isUpstreamQuotaError,
  upstreamQuotaResponse,
} from "./shared/kundali-errors.js";
import {
  verifyToken,
  enforceUserRateLimit,
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
import { requestedDateKey } from "./shared/request-date.js";
import {
  badInputResponse,
  birthInputError,
  chargeKeyCoord,
  isValidDateString,
} from "./shared/charge-input.js";
import { describeError } from "./shared/error-summary.js";
import { db } from "./shared/firebase-admin";
import { normalizeZodiacMode } from "../../src/lib/zodiac-mode.js";

/**
 * The saved sidereal Moon/Sun signs and zodiac mode for the sign-based daily
 * text. Signs are attached only when the request is for the profile's own
 * birth moment. Best-effort: a read failure falls back to the client's
 * birthData (and the date-derived sidereal Sun sign).
 */
async function loadSignContext(
  uid: string,
  birthData: Record<string, any>,
): Promise<{ birth: Record<string, any>; mode: "vedic" | "western" }> {
  try {
    const snap = await db.collection("users").doc(uid).get();
    const data = snap.data() ?? {};
    const profile = data.profile ?? data;
    const mode = normalizeZodiacMode(profile.zodiacMode ?? data.zodiacMode);
    const sameChart =
      profile.dob === birthData.dob &&
      String(profile.tob ?? "").slice(0, 5) ===
        String(birthData.tob ?? "").slice(0, 5);
    if (!sameChart) return { birth: birthData, mode };
    return {
      birth: {
        ...birthData,
        ...(typeof profile.moonSign === "string"
          ? { moonSign: profile.moonSign }
          : {}),
        ...(typeof profile.sunSign === "string"
          ? { sunSign: profile.sunSign }
          : {}),
      },
      mode,
    };
  } catch (err) {
    console.warn("[Horoscope] Profile sign lookup failed:", describeError(err));
    return { birth: birthData, mode: normalizeZodiacMode(birthData.zodiacMode) };
  }
}
import {
  forecastUnavailableResponse,
  isEmptyForecast,
} from "./shared/forecast-delivery.js";

// Extended forecasts are premium: charged in credits (daily stays free).
const PERIOD_FEATURE: Record<string, MeteredFeature> = {
  weekly: "horoscope_weekly",
  monthly: "horoscope_monthly",
  yearly: "horoscope_yearly",
};

type ForecastPeriod = "daily" | "weekly" | "monthly" | "yearly";

/** Cache lifetime per window; the window itself is part of the key. */
const PERSONAL_FORECAST_TTL_HOURS: Record<ForecastPeriod, number> = {
  daily: 20,
  weekly: 8 * 24,
  monthly: 32 * 24,
  yearly: 367 * 24,
};

/**
 * A personal forecast through chart_cache, keyed by an HMAC of the chart plus
 * the forecast window — re-opening the same day/week/month/year (tab
 * switches, refreshes, other devices) costs no upstream call. A null/empty
 * upstream result is never cached.
 */
async function cachedPersonalForecast(
  period: ForecastPeriod,
  bd: BirthData,
  windowKey: string,
  fetcher: () => Promise<any>,
): Promise<any> {
  return stripEchoedBirthInputs(
    await getCachedOrFetch(
      CHART_CACHE_COLLECTION,
      birthChartCacheKey(`HOROSCOPE_${period.toUpperCase()}`, bd, {
        window: windowKey,
      }),
      async () => stripEchoedBirthInputs(await fetcher()),
      PERSONAL_FORECAST_TTL_HOURS[period],
    ),
  );
}

/** Settled value, or the fallback (quota errors are collected by the caller). */
function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

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
    const {
      birthData,
      date,
      period = "daily",
      idToken,
      localDate,
    } = await req.json();

    // Auth + rate limit: each request fans out to up to 4 paid API calls.
    let decoded;
    try {
      decoded = await verifyToken(idToken);
      await enforceUserRateLimit(decoded.uid, "horoscope", 40, 60 * 60 * 1000);
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

    // Validate BEFORE charging: input that is certain to fail upstream must
    // be a free 400, not a charge → error → refund cycle.
    const inputError = birthInputError(birthData);
    if (inputError) return badInputResponse(inputError);
    if (date !== undefined && date !== null && date !== "" && !isValidDateString(date)) {
      return badInputResponse("date must be YYYY-MM-DD");
    }

    // Reserve credits for premium (non-daily) forecasts before the paid API
    // calls. Refunded by the outer catch if delivery fails. The charge key is
    // deterministic per chart + period window, so re-opening the same forecast
    // (tab switches, refreshes) dedupes against the ledger instead of billing
    // again — one charge per week/month/year per chart.
    const feature = PERIOD_FEATURE[period];
    if (feature) {
      const resolvedDate = isValidDateString(date)
          ? date
          : requestedDateKey(localDate);
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
            chargeKeyCoord(birthData.lat),
            chargeKeyCoord(birthData.lng),
            periodKey,
          ),
        );
      } catch (err) {
        if (err instanceof CreditError) return insufficientCreditsResponse(err);
        throw err;
      }
    }

    console.log(
      `[Horoscope] Fetching ${period} forecast for ${date || "today"}...`,
    );

    // Same normalization (and therefore cache keys) as /api/kundali.
    const bd = chartBirthData(birthData);
    // The forecast's day: an explicit date, else the caller's local today.
    const dayKey = isCalendarDateKey(date) ? date : clampedTodayKey(localDate);

    if (period === "weekly") {
      // Weekly: fetch weekly horoscope + dashas (no narrative needed)
      const [horoscopeData, dashaData] = await Promise.all([
        cachedPersonalForecast("weekly", bd, isoWeekKey(dayKey), () =>
          getWeeklyHoroscope(bd, dayKey),
        ),
        // Dashas only decorate a paid forecast — never fail it over them.
        getCachedDashaPeriods(bd).catch(() => [] as any[]),
      ]);

      // Paid window: an empty upstream result must refund, not 200 a blank
      // forecast the user was charged for.
      if (isEmptyForecast(horoscopeData)) {
        return forecastUnavailableResponse(charge, "weekly");
      }

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
        cachedPersonalForecast("monthly", bd, dayKey.slice(0, 7), () =>
          getMonthlyHoroscope(bd, dayKey),
        ),
        // Dashas only decorate a paid forecast — never fail it over them.
        getCachedDashaPeriods(bd).catch(() => [] as any[]),
      ]);

      // Paid window: an empty upstream result must refund, not 200 a blank
      // forecast the user was charged for.
      if (isEmptyForecast(monthlyData)) {
        return forecastUnavailableResponse(charge, "monthly");
      }

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
        cachedPersonalForecast("yearly", bd, dayKey.slice(0, 4), () =>
          getYearlyHoroscope(bd, dayKey),
        ),
        // Dashas only decorate a paid forecast — never fail it over them.
        getCachedDashaPeriods(bd).catch(() => [] as any[]),
      ]);

      // Paid window: an empty upstream result must refund, not 200 a blank
      // forecast the user was charged for.
      if (isEmptyForecast(yearlyData)) {
        return forecastUnavailableResponse(charge, "yearly");
      }

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
    // The narrative is sign-based: the sidereal Moon sign in Vedic mode.
    // Every part is cached: the personal forecast per chart + day, the
    // sign narrative in the shared horoscope_signs collection (same key as
    // /api/sign-horoscope and /api/daily-prediction), dashas and panchang in
    // the same entries /api/kundali uses. A repeat view costs no upstream call.
    const signContext = await loadSignContext(decoded.uid, birthData);
    const sign = resolveHoroscopeSign(signContext.birth as BirthData, {
      mode: signContext.mode,
    });
    const settled = await Promise.allSettled([
      cachedPersonalForecast("daily", bd, dayKey, () =>
        getDailyHoroscope(bd, dayKey),
      ),
      getCachedOrFetch(`horoscope_signs`, `${sign}_daily_${dayKey}`, async () => {
        const result = await getDailyHoroscopeText(
          signContext.birth as typeof birthData,
          dayKey,
          { sign },
        );
        // Never cache an upstream failure as an empty doc.
        if (!result) throw new Error("Sign narrative upstream returned no data");
        return result;
      }),
      getCachedDashaPeriods(bd),
      getCachedPanchang(dayKey, {
        city: birthData.pob,
        lat: bd.lat,
        lng: bd.lng,
      }),
    ]);
    const quotaHit = settled.some(
      (r) => r.status === "rejected" && isUpstreamQuotaError(r.reason),
    );
    const horoscopeData = settledValue(settled[0], null);
    const narrativeData = settledValue(settled[1], null);
    const dashaData = settledValue(settled[2], [] as any[]);
    const panchangData = settledValue(settled[3], null);
    // Free view: degrade part by part, but when the allowance is spent and
    // there is no forecast at all, say "temporarily unavailable" (503).
    if (quotaHit && !horoscopeData && !narrativeData) {
      return upstreamQuotaResponse();
    }

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
    console.error("[Horoscope] Function error:", describeError(error));
    if (charge) await charge.refund();
    // Spent astrology allowance (upstream 429 or our own budget/breaker):
    // a retryable 503, not a generic 500.
    if (isUpstreamQuotaError(error)) return upstreamQuotaResponse();
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
