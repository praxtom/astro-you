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
  getPanchang,
  getFestivalCalendar,
  getNatalReportPDF,
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
import { checkRateLimit, getRequestIdentifier } from "./shared/rate-limit";
import { verifyToken, AuthError } from "./shared/require-auth";

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

  try {
    const body = await req.json();
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

    const rateLimit = await checkRateLimit({
      scope: `astro_${String(chartType).toLowerCase()}`,
      key: getRequestIdentifier(req),
      limit: chartType === "PANCHANG" ? 120 : 40,
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

    // Authentication: all chart types except the public/landing ones require a
    // verified Firebase ID token. This prevents anonymous abuse of the paid
    // astrology API. Public types (panchang/festivals/eclipses/tarot) stay open
    // for the marketing pages but remain rate-limited above.
    if (!PUBLIC_CHART_TYPES.has(String(chartType))) {
      try {
        await verifyToken(body.idToken);
      } catch (err) {
        const status = err instanceof AuthError ? err.status : 401;
        return json({ error: "Authentication required" }, status);
      }
    }

    // Panchang doesn't need birthData
    if (chartType === "PANCHANG") {
      const cacheKey = date || new Date().toISOString().split("T")[0];
      const locationKey = city || `${lat ?? 28.6139}_${lng ?? 77.209}`;
      const docId = `${cacheKey}_${locationKey}`.replace(/[/\s]/g, "_");

      const data = await getCachedOrFetch("panchang", docId, () =>
        getPanchang(date, city, lat, lng),
      );
      return json({ data });
    }

    // Festival calendar doesn't need birthData
    if (chartType === "FESTIVALS") {
      const data = await getFestivalCalendar(year, region);
      return json({ data });
    }

    // Upcoming eclipses doesn't need birthData
    if (chartType === "ECLIPSES") {
      const data = await getUpcomingEclipses();
      return json({ data });
    }

    // Daily tarot is the same card for everyone on a given day — cache it so
    // 1,000 dashboard loads don't trigger 1,000 paid API calls.
    if (chartType === "DAILY_TAROT") {
      const today = new Date().toISOString().split("T")[0];
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

    // Everything else needs valid birthData.
    const validationError = validateBirthData(birthData);
    if (validationError) {
      return json({ error: validationError }, 400);
    }
    const bd = birthData as BirthData;

    switch (chartType) {
      case "DASHAS": {
        const periods = await getDashaPeriods(bd);
        return json({ periods });
      }
      case "YOGAS": {
        const data = await getYogaAnalysis(bd);
        return json({ data });
      }
      case "REMEDIES": {
        const data = await getRemedies(bd, remedyType);
        return json({ data });
      }
      case "MANGLIK": {
        const data = await getManglikDosha(bd);
        return json({ data });
      }
      case "PDF_NATAL": {
        const pdf = await getNatalReportPDF(bd);
        if (!pdf) return json({ error: "PDF generation failed" }, 500);
        return new Response(pdf, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": "attachment; filename=natal-report.pdf",
          },
        });
      }
      case "SVG_NATAL": {
        const svg = await getNatalChartSVG(bd);
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
        return json({ data: await getSadeSati(bd) });
      }
      case "KAAL_SARPA": {
        return json({ data: await getKaalSarpaDosha(bd) });
      }
      case "NAKSHATRA": {
        return json({ data: await getNakshatraPredictions(bd) });
      }
      case "ASHTAKVARGA": {
        return json({ data: await getAshtakvarga(bd) });
      }
      case "ECLIPSE_IMPACT": {
        return json({ data: await getEclipseNatalImpact(bd) });
      }
      case "LUNAR_PHASES": {
        return json({ data: await getLunarPhases(bd) });
      }
      case "VOID_OF_COURSE": {
        return json({ data: await getVoidOfCourse(bd) });
      }
      case "NUMEROLOGY": {
        return json({ data: await getNumerologyReading(bd) });
      }
      case "CORE_NUMBERS": {
        return json({ data: await getCoreNumbers(bd) });
      }
      case "ASTRO_LINES": {
        return json({ data: await getAstrocartographyLines(bd) });
      }
      case "POWER_ZONES": {
        return json({ data: await getPowerZones(bd) });
      }
      case "LOCATION_ANALYSIS": {
        if (!body.targetLat || !body.targetLng)
          return json({ error: "Missing targetLat/targetLng" }, 400);
        return json({
          data: await getLocationAnalysis(bd, body.targetLat, body.targetLng),
        });
      }
      case "BIORHYTHMS": {
        return json({ data: await getBiorhythms(bd) });
      }
      case "WELLNESS_SCORE": {
        return json({ data: await getWellnessScore(bd) });
      }
      case "ENERGY_PATTERNS": {
        return json({ data: await getEnergyPatterns(bd) });
      }
      case "HUMAN_DESIGN": {
        return json({ data: await getHumanDesignType(bd) });
      }
      case "BODYGRAPH": {
        return json({ data: await getBodygraph(bd) });
      }
      case "BODYGRAPH_SVG": {
        const svg = await getBodygraphSVG(bd);
        return new Response(svg, {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        });
      }
      case "SHADBALA": {
        return json({ data: await getShadbala(bd) });
      }
      case "VARSHAPHAL": {
        return json({ data: await getVarshaphal(bd, body.year) });
      }
      case "D1": {
        const data = await getNatalChart(bd);
        return json(data);
      }
      default: {
        // Divisional charts (D9, D10, …). Reject unknown chartTypes instead of
        // forwarding an arbitrary string to the paid upstream API.
        if (!DIVISIONAL_CHARTS.has(String(chartType))) {
          return json({ error: `Unknown chartType: ${chartType}` }, 400);
        }
        const data = await getNavamsaChart(bd, [chartType]);
        return json(data);
      }
    }
  } catch (error: any) {
    console.error("[Kundali] Error:", error);
    // Generic message — never leak upstream/Firestore internals to the client.
    return json({ error: "Astrology request failed. Please try again." }, 500);
  }
};

export const config: Config = {
  path: "/api/kundali",
};
