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

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

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

    // Panchang doesn't need birthData
    if (chartType === "PANCHANG") {
      const cacheKey = date || new Date().toISOString().split("T")[0];
      const locationKey = city || `${lat ?? 28.6139}_${lng ?? 77.209}`;
      const docId = `${cacheKey}_${locationKey}`.replace(/[\/\s]/g, "_");

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

    // Daily tarot doesn't need birthData
    if (chartType === "DAILY_TAROT") {
      const data = await getDailyTarotCard();
      return json({ data });
    }

    // Three-card tarot doesn't need birthData
    if (chartType === "TAROT_THREE") {
      const data = await getThreeCardReading(body.question);
      return json({ data });
    }

    // Everything else needs birthData
    if (!birthData?.dob || !birthData?.tob) {
      return json({ error: "Missing birth data (dob + tob required)" }, 400);
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
        // D9, D10, D12, etc.
        const data = await getNavamsaChart(bd, [chartType]);
        return json(data);
      }
    }
  } catch (error: any) {
    console.error("[Kundali] Error:", error);
    return json({ error: error.message }, 500);
  }
};

export const config: Config = {
  path: "/api/kundali",
};
