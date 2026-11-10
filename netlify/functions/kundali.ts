/**
 * Unified astrology data endpoint — all chart, vedic, and analysis features.
 *
 * POST /api/kundali { birthData, chartType }
 *
 * chartType values:
 *   D1         → Natal chart (default)
 *   D9/D10/... → Divisional charts
 *   DASHAS     → Vimshottari dasha periods
 *   YOGAS      → Yoga analysis (Raj, Gajakesari, etc.)
 *   REMEDIES   → Vedic remedies (gemstones, mantras) — optional remedyType
 *   MANGLIK    → Manglik dosha detection
 *   SVG_NATAL  → Natal chart as SVG string
 *   RENDER_NATAL → Rendered natal chart image (PNG URL)
 *   PANCHANG   → Daily panchang (uses date/city/lat/lng instead of birthData)
 *   SADE_SATI  → Sade Sati (Saturn transit) detection
 *   KAAL_SARPA → Kaal Sarpa dosha detection
 *   NAKSHATRA  → Nakshatra-based predictions
 *   ASHTAKVARGA→ Ashtakvarga strength analysis
 *   ECLIPSES   → Upcoming eclipses (no birthData needed)
 *   ECLIPSE_IMPACT → Eclipse impact on natal chart
 *   LUNAR_PHASES   → Precise lunar phases
 *   VOID_OF_COURSE → Void of Course moon status
 *   NUMEROLOGY → Full numerology reading (needs birthData)
 *   CORE_NUMBERS → Life path, destiny, soul numbers (needs birthData)
 *   DAILY_TAROT → Daily tarot card (no birthData needed)
 *   TAROT_THREE → Three card tarot reading (no birthData needed) — optional question
 *   ASTRO_LINES → Astrocartography planetary lines
 *   POWER_ZONES → Astrocartography power zones
 *   LOCATION_ANALYSIS → Location-specific astrocartography analysis (needs targetLat/targetLng)
 *   BIORHYTHMS     → Biorhythm cycles (physical/emotional/intellectual)
 *   WELLNESS_SCORE → Overall wellness score
 *   ENERGY_PATTERNS→ Daily energy patterns
 */
import { Config, Context } from "@netlify/functions";
import {
  getNatalChart,
  getNavamsaChart,
  getDashaPeriods,
  getYogaAnalysis,
  getRemedies,
  getManglikDosha,
  getFestivalCalendar,
  getNatalChartSVG,
  getRenderedNatalChart,
  getSadeSati,
  getKaalSarpaDosha,
  getNakshatraPredictions,
  getAshtakvarga,
  getUpcomingEclipses,
  getEclipseNatalImpact,
  getLunarPhases,
  getVoidOfCourse,
  getNumerologyReading,
  getCoreNumbers,
  getDailyTarotCard,
  getThreeCardReading,
  getAstrocartographyLines,
  getPowerZones,
  getLocationAnalysis,
  getBiorhythms,
  getWellnessScore,
  getEnergyPatterns,
  getHumanDesignType,
  getBodygraph,
  getBodygraphSVG,
  getShadbala,
  getVarshaphal,
  BirthData,
} from "./shared/astro-api";
import { getCachedOrFetch } from "./shared/cache";
import {
  CHART_CACHE_COLLECTION,
  chartCacheKey,
  chartCacheTtlHours,
  clampedTodayKey,
  isCalendarDateKey,
  isGuestChartType,
  NAME_DEPENDENT_CHART_TYPES,
  normalizeSubjectName,
  refreshDashaCurrentFlags,
  serverDateKey,
  stripEchoedBirthInputs,
} from "./shared/chart-cache";
import { checkRateLimit, getRequestIdentifier } from "./shared/rate-limit";
import { verifyToken, AuthError } from "./shared/require-auth";
import { requestedDateKey } from "./shared/request-date.js";
import { classifyUpstreamErrorMessage } from "./shared/astro-error-classify";
import {
  chartErrorResponse,
  TIME_UNKNOWN_MESSAGE,
} from "./shared/kundali-errors";
import { normalizeZodiacMode } from "../../src/lib/zodiac-mode.js";
import { normalizeFestivalRegion } from "../../src/lib/festival-regions.js";
import { getCachedNatalChart, getCachedPanchang } from "./shared/astro-cached.js";
import {
  localDashaPeriods,
  tryLocalEngine,
} from "./shared/astro-engine.js";
import { parseBudget } from "./shared/astro-budget.js";

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Chart types that need no birth data and are safe for the public/landing page.
// Everything else requires a verified Firebase ID token.
const PUBLIC_CHART_TYPES = new Set([
  "PANCHANG",
  "FESTIVALS",
  "ECLIPSES",
  "DAILY_TAROT",
  "TAROT_THREE",
]);

// The minimal natal set guests may request without an account (D1, DASHAS,
// NAKSHATRA — see shared/chart-cache.ts): the SEO acquisition pages, guest
// chat and the guest dashboard render these before signup. Upstream (paid)
// calls for guests are gated by the stricter fail-closed per-IP budget below;
// server-cache hits cost nothing upstream and do not consume it.
// Env ASTRO_GUEST_UPSTREAM_PER_IP_HOUR. Sized for shared carrier (CGNAT) IPs:
// one new guest dashboard is 3 misses; the global astrology budget
// (shared/astro-budget.ts) caps the total whatever the IP mix.
const DEFAULT_GUEST_UPSTREAM_PER_IP_HOUR = 15;
function guestUpstreamPerIpHour(): number {
  return parseBudget(
    process.env.ASTRO_GUEST_UPSTREAM_PER_IP_HOUR,
    DEFAULT_GUEST_UPSTREAM_PER_IP_HOUR,
  );
}

/**
 * Request ceilings per hour, counted for every request (cache hits too).
 * Signed-in users are keyed by uid, so many users behind one carrier IP no
 * longer share a bucket; guests and public types are keyed by IP with a
 * ceiling high enough for a shared IP — paid upstream calls are bounded
 * separately (guest budget above, global budget in astro-api).
 */
const USER_REQUESTS_PER_TYPE_PER_HOUR = 60;
const IP_REQUESTS_PER_TYPE_PER_HOUR = 200;
const IP_PANCHANG_REQUESTS_PER_HOUR = 300;
// A three-card tarot reading is the one public chart type that cannot be
// cached (it depends on the question), so every request is a paid upstream
// call. Keep anonymous use to a handful per IP per hour.
const IP_UNCACHED_PUBLIC_REQUESTS_PER_HOUR = 5;

class GuestBudgetError extends Error {
  constructor() {
    super("Guest chart budget exhausted");
    this.name = "GuestBudgetError";
  }
}

/**
 * Fail-closed per-IP limiter for guest chart requests. "kundali_guest" is not
 * enrolled in the shared limiter's FAIL_CLOSED_SCOPES, whose outage fallback
 * reports `{ allowed: true, remaining: 0 }` — the same shape as the final
 * in-budget request. Denying `remaining <= 0` (and sizing the limit one above
 * the real budget) therefore also denies during limiter-store outages: an
 * unauthenticated paid-API path must never fail open.
 */
async function allowAnonRequest(
  req: Request,
  scope: string,
  budget: number,
  windowMs: number,
): Promise<boolean> {
  const result = await checkRateLimit({
    scope,
    key: getRequestIdentifier(req),
    limit: budget + 1,
    windowMs,
  });
  return result.allowed && result.remaining > 0;
}

// Divisional charts handled by the default switch branch — an explicit
// allowlist so an unknown chartType returns 400 instead of an unintended
// (billable) upstream call.
const DIVISIONAL_CHARTS = new Set([
  "D2",
  "D3",
  "D4",
  "D7",
  "D9",
  "D10",
  "D12",
  "D16",
  "D20",
  "D24",
  "D27",
  "D30",
  "D40",
  "D45",
  "D60",
]);

const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOB_RE = /^\d{2}:\d{2}(:\d{2})?$/;

/** Validate birth data before any (paid) upstream call. Returns an error message or null. */
function validateBirthData(bd: any): string | null {
  if (!bd || typeof bd !== "object") return "Missing birth data";
  if (typeof bd.dob !== "string" || !DOB_RE.test(bd.dob))
    return "Invalid dob (expected YYYY-MM-DD)";
  if (typeof bd.tob !== "string" || !TOB_RE.test(bd.tob))
    return "Invalid tob (expected HH:MM)";
  if (
    bd.lat !== undefined &&
    bd.lat !== null &&
    (typeof bd.lat !== "number" ||
      Number.isNaN(bd.lat) ||
      bd.lat < -90 ||
      bd.lat > 90)
  )
    return "lat out of range (-90..90)";
  if (
    bd.lng !== undefined &&
    bd.lng !== null &&
    (typeof bd.lng !== "number" ||
      Number.isNaN(bd.lng) ||
      bd.lng < -180 ||
      bd.lng > 180)
  )
    return "lng out of range (-180..180)";
  if (
    bd.pob !== undefined &&
    (typeof bd.pob !== "string" || bd.pob.length > 200)
  )
    return "Invalid pob";
  return null;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405 });

  let body: any;
  try {
    body = await req.json();
    const {
      birthData,
      chartType = "D1",
      date,
      city,
      lat,
      lng,
      remedyType,
      year,
      region,
    } = body;

    // Vedic unless the client asks otherwise, so existing behaviour is
    // unchanged for everyone who never touches the setting.
    const zodiacMode = normalizeZodiacMode(body.zodiacMode);

    // Authentication: all chart types except the public/landing ones require a
    // verified Firebase ID token. This prevents anonymous abuse of the paid
    // astrology API. Public types (panchang/festivals/eclipses/tarot) stay open
    // for the marketing pages but remain rate-limited below. Guests may also
    // request the basic natal set (GUEST_CHART_TYPES) under a strict
    // fail-closed per-IP budget; authenticated behavior is unchanged.
    let isGuest = false;
    let uid: string | null = null;
    if (!PUBLIC_CHART_TYPES.has(String(chartType))) {
      try {
        const decoded: any = await verifyToken(body.idToken);
        uid = typeof decoded?.uid === "string" ? decoded.uid : null;
      } catch (err) {
        if (!isGuestChartType(chartType)) {
          const status = err instanceof AuthError ? err.status : 401;
          return json(
            { error: "Authentication required", code: "auth_required" },
            status,
          );
        }
        isGuest = true;
      }
    }

    const rateLimit = await checkRateLimit({
      scope: `astro_${String(chartType).toLowerCase()}`,
      key: uid ? `uid:${uid}` : getRequestIdentifier(req),
      limit: uid
        ? USER_REQUESTS_PER_TYPE_PER_HOUR
        : chartType === "PANCHANG"
          ? IP_PANCHANG_REQUESTS_PER_HOUR
          : chartType === "TAROT_THREE"
            ? IP_UNCACHED_PUBLIC_REQUESTS_PER_HOUR
            : IP_REQUESTS_PER_TYPE_PER_HOUR,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return json(
        {
          error: "Too many astrology requests. Please try again later.",
          resetAt: rateLimit.resetAt.toISOString(),
        },
        429,
      );
    }

    // Panchang doesn't need birthData. The cache key covers exactly what is
    // sent upstream — the validated date plus the city label AND the
    // coordinates — so a mismatched city/coords pair can only ever serve
    // itself, never poison the entry for the real place.
    if (chartType === "PANCHANG") {
      if (
        date !== undefined &&
        date !== null &&
        date !== "" &&
        !isCalendarDateKey(date)
      ) {
        return json({ error: "Invalid date (expected YYYY-MM-DD)" }, 400);
      }
      const dateKey = isCalendarDateKey(date)
        ? date
        : clampedTodayKey(body.localDate);
      // Shared entry (shared/astro-cached.ts): the daily forecast and chat
      // context read the same doc for the same day and place.
      const data = await getCachedPanchang(dateKey, { city, lat, lng });
      return json({ data });
    }

    // Festival calendar doesn't need birthData
    if (chartType === "FESTIVALS") {
      const festivalRegion = normalizeFestivalRegion(region);
      // "off" means the user has hidden the card — never spend a paid API call
      // fetching content that will not be rendered.
      if (festivalRegion === "off") return json({ data: [] });
      // Same calendar for everyone in a region and year: cache it so a
      // dashboard load never spends a paid upstream call.
      const festivalYear =
        Number.isInteger(year) && year >= 1900 && year <= 2200
          ? year
          : new Date().getUTCFullYear();
      const data = await getCachedOrFetch(
        "festival_calendar",
        `${festivalYear}_${festivalRegion}`,
        () => getFestivalCalendar(festivalYear, festivalRegion),
        24 * 7,
      );
      return json({ data });
    }

    // Upcoming eclipses doesn't need birthData
    if (chartType === "ECLIPSES") {
      // The upcoming-eclipse list is global and changes only as dates pass.
      const data = await getCachedOrFetch(
        "eclipses_upcoming",
        new Date().toISOString().slice(0, 10),
        () => getUpcomingEclipses(),
        24,
      );
      return json({ data });
    }

    // Daily tarot is the same card for everyone on a given day — cache it so
    // 1,000 dashboard loads don't trigger 1,000 paid API calls.
    if (chartType === "DAILY_TAROT") {
      const today = requestedDateKey(body.localDate);
      const data = await getCachedOrFetch("tarot_daily", today, () =>
        getDailyTarotCard(),
      );
      return json({ data });
    }

    // Three-card tarot doesn't need birthData
    if (chartType === "TAROT_THREE") {
      const question = typeof body.question === "string" ? body.question : "";
      if (question.length > 500) {
        return json({ error: "Question too long (max 500 characters)" }, 400);
      }
      const data = await getThreeCardReading(question);
      return json({ data });
    }

    // "I don't know my birth time": the chart is cast for noon and shaped
    // below (no Lagna/houses, approximate dashas, no house-based verdicts).
    const birthTimeUnknown =
      birthData && typeof birthData === "object"
        ? birthData.birthTimeUnknown === true
        : false;
    if (birthTimeUnknown && !TOB_RE.test(String(birthData.tob ?? ""))) {
      birthData.tob = "12:00";
    }

    // Everything else needs valid birthData.
    const validationError = validateBirthData(birthData);
    if (validationError) {
      return json({ error: validationError }, 400);
    }
    // Profile-shaped clients send { coordinates: { lat, lng } } instead of
    // top-level lat/lng. Lift them so the upstream call uses the exact
    // geocoded point (not a re-geocode of the place string) and the cache
    // key is the same however the client shaped the request.
    const liftedCoords =
      (birthData.lat === undefined || birthData.lat === null) &&
      birthData.coordinates &&
      typeof birthData.coordinates.lat === "number" &&
      typeof birthData.coordinates.lng === "number" &&
      Math.abs(birthData.coordinates.lat) <= 90 &&
      Math.abs(birthData.coordinates.lng) <= 180
        ? {
            lat: birthData.coordinates.lat as number,
            lng: birthData.coordinates.lng as number,
          }
        : null;
    const bd: BirthData = {
      name: birthData.name,
      dob: birthData.dob,
      tob: birthData.tob,
      pob: birthData.pob,
      lat: liftedCoords ? liftedCoords.lat : birthData.lat,
      lng: liftedCoords ? liftedCoords.lng : birthData.lng,
      ...(birthTimeUnknown ? { birthTimeUnknown: true } : {}),
    };
    const type = String(chartType);

    // Divisional charts (D9, D10, ...) subdivide signs by a few degrees and
    // hinge on the Lagna — a noon guess is wrong more often than right.
    if (birthTimeUnknown && DIVISIONAL_CHARTS.has(type)) {
      return json(
        {
          error: TIME_UNKNOWN_MESSAGE,
          code: "time_unknown",
          unavailable: "time_unknown",
        },
        422,
      );
    }

    // Paid PDFs are sold through /api/pdf-report, which charges the report's
    // credit price and stores the file for free re-download. Serving them here
    // would hand out the same report for free.
    if (type === "PDF_NATAL") {
      return json(
        {
          error:
            "Natal PDF reports are generated through the reports flow, which shows the credit price first.",
          code: "use_reports_endpoint",
          endpoint: "/api/pdf-report",
          reportType: "natal",
        },
        410,
      );
    }

    // Upstream call guard: guests spend the per-IP budget only when a paid
    // upstream call is actually about to happen.
    const guarded = async <T>(fetcher: () => Promise<T>): Promise<T> => {
      if (isGuest) {
        const allowed = await allowAnonRequest(
          req,
          "kundali_guest",
          guestUpstreamPerIpHour(),
          60 * 60 * 1000,
        );
        if (!allowed) throw new GuestBudgetError();
      }
      return fetcher();
    };

    // "Sky right now" readings: the caller's local day at their current
    // location (body.city/lat/lng), falling back to the birth place.
    const skyMoment = () => {
      const hasSkyCoords =
        typeof body.lat === "number" &&
        typeof body.lng === "number" &&
        Math.abs(body.lat) <= 90 &&
        Math.abs(body.lng) <= 180;
      const skyCity =
        typeof body.city === "string" && body.city.trim()
          ? body.city.trim().slice(0, 200)
          : undefined;
      return {
        date: requestedDateKey(body.localDate),
        ...(hasSkyCoords
          ? { lat: body.lat as number, lng: body.lng as number }
          : skyCity
            ? { city: skyCity }
            : { city: bd.pob || undefined, lat: bd.lat, lng: bd.lng }),
      } as { date: string; city?: string; lat?: number; lng?: number };
    };
    const sky = skyMoment();
    const biorhythmDate = clampedTodayKey(body.localDate);

    // Per-birth-data server cache (admin-only collection, long TTL for natal
    // data) — see shared/chart-cache.ts for the policy and key.
    const ttlHours = chartCacheTtlHours(type);
    const cacheDocId =
      ttlHours === null
        ? null
        : chartCacheKey({
            chartType: type,
            dob: bd.dob,
            tob: bd.tob,
            lat: bd.lat,
            lng: bd.lng,
            pob: bd.pob,
            zodiacMode: type === "D1" ? zodiacMode : undefined,
            birthTimeUnknown,
            variant: {
              remedyType: type === "REMEDIES" ? remedyType : undefined,
              // Numerology is derived from the name: key on it (hashed with
              // the rest of the key, never stored in clear).
              subject: NAME_DEPENDENT_CHART_TYPES.has(type)
                ? normalizeSubjectName(bd.name)
                : undefined,
              year: type === "VARSHAPHAL" ? body.year : undefined,
              targetLat:
                type === "LOCATION_ANALYSIS" ? body.targetLat : undefined,
              targetLng:
                type === "LOCATION_ANALYSIS" ? body.targetLng : undefined,
              // Keyed on the day actually computed: biorhythms get an explicit
              // (clamped) target date; wellness/energy/lunar phase are cast
              // by the upstream for "now", so they key on the server's day.
              date:
                type === "BIORHYTHMS"
                  ? biorhythmDate
                  : type === "WELLNESS_SCORE" ||
                      type === "ENERGY_PATTERNS" ||
                      type === "LUNAR_PHASES"
                    ? serverDateKey()
                    : undefined,
              // The lunar phase is cast at the viewer's location — key on the
              // place actually sent upstream.
              sky:
                type === "LUNAR_PHASES"
                  ? [sky.city, sky.lat, sky.lng]
                      .map((v) =>
                        typeof v === "number" ? v.toFixed(4) : (v ?? ""),
                      )
                      .join("|")
                  : undefined,
            },
          });
    // Only computed fields are cached (and served): any echoed birth inputs
    // are stripped before the write and again on read for older entries.
    const cached = async <T>(fetcher: () => Promise<T>): Promise<T> =>
      cacheDocId && ttlHours !== null
        ? stripEchoedBirthInputs(
            await getCachedOrFetch(
              CHART_CACHE_COLLECTION,
              cacheDocId,
              async () => stripEchoedBirthInputs(await guarded(fetcher)),
              ttlHours,
              { serialize: true },
            ),
          )
        : guarded(fetcher);

    switch (chartType) {
      case "DASHAS": {
        // ASTRO_ENGINE=local: in-house Vimshottari (no upstream call, so no
        // guest budget or cache needed); null → the API path below.
        const periods =
          tryLocalEngine("dashas", () => localDashaPeriods(bd)) ??
          (await cached(() => getDashaPeriods(bd)));
        // Dasha dates follow the Moon's exact longitude, which moves ~6 deg
        // in 12 hours — with a noon placeholder they can be years off.
        return json({
          periods: refreshDashaCurrentFlags(periods),
          ...(birthTimeUnknown ? { approximate: true } : {}),
        });
      }
      case "YOGAS": {
        const data = await cached(() => getYogaAnalysis(bd));
        return json({ data });
      }
      case "REMEDIES": {
        const data = await cached(() => getRemedies(bd, remedyType));
        return json({ data });
      }
      case "MANGLIK": {
        // Manglik is Mars's house from the Lagna — no verdict without a time.
        if (birthTimeUnknown) {
          return json({
            data: null,
            unavailable: "time_unknown",
            message: TIME_UNKNOWN_MESSAGE,
          });
        }
        const data = await cached(() => getManglikDosha(bd));
        return json({ data });
      }
      case "SVG_NATAL": {
        const svg = await getNatalChartSVG(bd, zodiacMode);
        return new Response(svg, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        });
      }
      case "RENDER_NATAL": {
        const url = await getRenderedNatalChart(bd);
        return json({ url });
      }
      case "SADE_SATI": {
        return json({ data: await cached(() => getSadeSati(bd)) });
      }
      case "KAAL_SARPA": {
        return json({ data: await cached(() => getKaalSarpaDosha(bd)) });
      }
      case "NAKSHATRA": {
        return json({ data: await cached(() => getNakshatraPredictions(bd)) });
      }
      case "ASHTAKVARGA": {
        return json({ data: await cached(() => getAshtakvarga(bd)) });
      }
      case "ECLIPSE_IMPACT": {
        return json({ data: await cached(() => getEclipseNatalImpact(bd)) });
      }
      case "LUNAR_PHASES": {
        return json({
          // Cast for "now" (the cache key's server day), never a client date.
          data: await cached(() => getLunarPhases({ ...sky, date: undefined })),
        });
      }
      case "VOID_OF_COURSE": {
        return json({ data: await getVoidOfCourse(sky) });
      }
      case "NUMEROLOGY": {
        return json({ data: await cached(() => getNumerologyReading(bd)) });
      }
      case "CORE_NUMBERS": {
        return json({ data: await cached(() => getCoreNumbers(bd)) });
      }
      case "ASTRO_LINES": {
        return json({ data: await cached(() => getAstrocartographyLines(bd)) });
      }
      case "POWER_ZONES": {
        return json({ data: await cached(() => getPowerZones(bd)) });
      }
      case "LOCATION_ANALYSIS": {
        if (!body.targetLat || !body.targetLng)
          return json({ error: "Missing targetLat/targetLng" }, 400);
        return json({
          data: await cached(() =>
            getLocationAnalysis(bd, body.targetLat, body.targetLng),
          ),
        });
      }
      case "BIORHYTHMS": {
        return json({
          data: await cached(() => getBiorhythms(bd, biorhythmDate)),
        });
      }
      case "WELLNESS_SCORE": {
        return json({ data: await cached(() => getWellnessScore(bd)) });
      }
      case "ENERGY_PATTERNS": {
        return json({ data: await cached(() => getEnergyPatterns(bd)) });
      }
      case "HUMAN_DESIGN": {
        return json({ data: await cached(() => getHumanDesignType(bd)) });
      }
      case "BODYGRAPH": {
        return json({ data: await cached(() => getBodygraph(bd)) });
      }
      case "BODYGRAPH_SVG": {
        const svg = await getBodygraphSVG(bd);
        return new Response(svg, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        });
      }
      case "SHADBALA": {
        return json({ data: await cached(() => getShadbala(bd)) });
      }
      case "VARSHAPHAL": {
        return json({ data: await cached(() => getVarshaphal(bd, body.year)) });
      }
      case "D1": {
        const chart = await getCachedNatalChart(bd, zodiacMode, () =>
          guarded(() => getNatalChart(bd, zodiacMode)),
        );
        return json(chart);
      }
      default: {
        // Divisional charts (D9, D10, …). Reject unknown chartTypes instead of
        // forwarding an arbitrary string to the paid upstream API.
        if (!DIVISIONAL_CHARTS.has(String(chartType))) {
          return json({ error: `Unknown chartType: ${chartType}` }, 400);
        }
        const data = await cached(() => getNavamsaChart(bd, [chartType]));
        return json(data);
      }
    }
  } catch (error: any) {
    if (
      error instanceof GuestBudgetError ||
      error?.name === "GuestBudgetError"
    ) {
      return json(
        {
          error:
            "Too many chart requests. Sign in for full access, or try again later.",
          code: "guest_budget",
        },
        429,
      );
    }

    // Log only the classification — never the message/body, which can echo
    // the upstream response (and with it the caller's birth inputs).
    console.error("[Kundali] Error:", {
      chartType:
        typeof body?.chartType === "string"
          ? body.chartType.slice(0, 32)
          : undefined,
      name: error?.name,
      kind: typeof error?.kind === "string" ? error.kind : undefined,
      status: typeof error?.status === "number" ? error.status : undefined,
      code: typeof error?.code === "string" ? error.code : undefined,
    });

    // A birth time that fell in a daylight-saving gap, or in a repeated
    // fall-back hour, can never succeed on retry — so it must not get the
    // generic "please try again". Matched on `name` rather than `instanceof`
    // so the guard survives differing class identities across bundles.
    // Same for any chart the upstream could not calculate (or whose place it
    // could not resolve): a 422 with actionable copy, not a 500 "try again".
    const chartFailure = chartErrorResponse(error);
    if (chartFailure) return json(chartFailure.body, chartFailure.status);

    // Our upstream allowance for the billing period is spent. That is an
    // operator problem, not a bad request: a 500 "please try again" hides it
    // and invites a retry storm against an endpoint that cannot succeed. Say
    // "temporarily unavailable" and return a retryable 503 instead.
    // Every astro-api wrapper throws the structured AstroChartError, so read
    // `kind` off it directly. The message-parsing fallback stays for
    // cross-bundle class-identity safety (a duplicated class, or an error that
    // crossed a serialization boundary, loses `instanceof`/`name`).
    const quotaKind =
      error?.name === "AstroChartError"
        ? error.kind
        : classifyUpstreamErrorMessage(error?.message);
    if (quotaKind === "quota_exhausted") {
      return json(
        {
          error:
            "Astrology service is temporarily unavailable. Please try again later.",
          code: "upstream_quota",
        },
        503,
      );
    }

    // Generic message — never leak upstream/Firestore internals to the client.
    return json({ error: "Astrology request failed. Please try again." }, 500);
  }
};

export const config: Config = {
  path: "/api/kundali",
};
