/**
 * ASTRO_ENGINE=api|local (default "api").
 *
 * "local" serves D1, DASHAS and PANCHANG on /api/kundali from the in-house
 * Jyotish engine (src/lib/jyotish) instead of astrology-api.io — zero
 * upstream calls — shaped exactly like the API path's responses so the
 * frontend needs no change:
 *
 * - D1 → KundaliData as normalizeVedicD1Response produces it (3-letter sign
 *   codes, Mean_Node/Mean_South_Node, whole-sign cusps, nakshatras).
 * - DASHAS → DashaPeriod[] as parseDashaResponse produces it.
 * - PANCHANG → the astrology-api.io /vedic/panchang shape that
 *   src/lib/panchang-normalize.ts reads.
 *
 * Each builder returns null when it cannot compute faithfully (no birth
 * coordinates, western zodiac mode), and the caller falls back to the API.
 * The engine maths is not changed here; this is only an adapter.
 */
import {
  astronomyEngineProvider,
  buildChart,
  computePanchang,
  tzFromLatLng,
  utcOffsetAt,
  NAKSHATRAS,
  type CanonicalChart,
  type DashaPeriod as EngineDashaPeriod,
  type Graha,
  type PanchangResult,
} from "../../../src/lib/jyotish/index.js";
import type {
  BirthData,
  DashaPeriod,
  KundaliData,
  PlanetaryPosition,
} from "./astro-api.js";
import { AstroChartError, canonicalErrorBody } from "./astro-api.js";
import { markCurrentDashaPeriods } from "./chart-cache.js";

export type AstroEngineMode = "api" | "local";

export function astroEngineMode(
  env: Record<string, string | undefined> = process.env,
): AstroEngineMode {
  return env.ASTRO_ENGINE?.trim().toLowerCase() === "local" ? "local" : "api";
}

const SIGN_CODES = [
  "Ari",
  "Tau",
  "Gem",
  "Can",
  "Leo",
  "Vir",
  "Lib",
  "Sco",
  "Sag",
  "Cap",
  "Aqu",
  "Pis",
];

/** Planet names/order as the API path emits them. */
const PLANET_NAMES: Array<[Graha, string]> = [
  ["Sun", "Sun"],
  ["Moon", "Moon"],
  ["Mercury", "Mercury"],
  ["Venus", "Venus"],
  ["Mars", "Mars"],
  ["Jupiter", "Jupiter"],
  ["Saturn", "Saturn"],
  ["Rahu", "Mean_Node"],
  ["Ketu", "Mean_South_Node"],
];

const round2 = (n: number) => Math.round(n * 100) / 100;

function hasCoords(bd: Pick<BirthData, "lat" | "lng">): boolean {
  return (
    typeof bd.lat === "number" &&
    Number.isFinite(bd.lat) &&
    Math.abs(bd.lat) <= 90 &&
    typeof bd.lng === "number" &&
    Number.isFinite(bd.lng) &&
    Math.abs(bd.lng) <= 180
  );
}

/** The engine chart for a birth, or null without coordinates. */
export function localCanonicalChart(bd: BirthData): CanonicalChart | null {
  if (!hasCoords(bd)) return null;
  const lat = bd.lat as number;
  const lng = bd.lng as number;
  const time = bd.birthTimeUnknown ? "12:00" : String(bd.tob).slice(0, 5);
  const resolved = utcOffsetAt(tzFromLatLng(lat, lng), bd.dob, time);
  if (resolved.status !== "ok" && !bd.birthTimeUnknown) {
    // Same classified error the API path throws → 422 dst_ambiguous.
    throw new AstroChartError(
      `Natal chart error: 422 - ${canonicalErrorBody("dst_ambiguous")}`,
      "dst_ambiguous",
      422,
    );
  }
  return buildChart(
    {
      date: bd.dob,
      time,
      utcOffsetHours: resolved.offsetHours,
      lat,
      lng,
      timeUnknown: bd.birthTimeUnknown === true,
    },
    astronomyEngineProvider,
    // D1 only; dashas to antardasha depth (the API's dasha_level).
    { vargas: ["D1"], dasha: { depth: 2 } },
  );
}

/** D1 in the KundaliData shape normalizeVedicD1Response produces. */
export function kundaliFromChart(chart: CanonicalChart): KundaliData {
  const planetary_positions: PlanetaryPosition[] = PLANET_NAMES.map(
    ([graha, name]) => {
      const p = chart.grahas[graha];
      const code = SIGN_CODES[p.sign];
      return {
        name,
        sign: code,
        signCode: code,
        degree: round2(p.degreeInSign),
        house: p.house,
        is_retrograde: p.retrograde,
        speed: round2(p.speed),
        nakshatra: NAKSHATRAS[p.nakshatra]?.english,
      };
    },
  );
  const lagna = chart.lagna;
  if (!lagna) {
    // Time unknown: shapeTimeUnknownChart is applied by the caller as for
    // the API path; houses are already counted from the Moon here.
    return { planetary_positions, house_cusps: [] };
  }
  return {
    planetary_positions,
    house_cusps: SIGN_CODES.map((_, i) => ({
      house: i + 1,
      sign: SIGN_CODES[(lagna.sign + i) % 12],
      degree: 0,
    })),
    ascendant: {
      sign: SIGN_CODES[lagna.sign],
      degree: round2(lagna.degreeInSign),
    },
  };
}

function toApiPeriod(p: EngineDashaPeriod): DashaPeriod {
  return {
    planet: p.lord,
    startDate: p.start.slice(0, 10),
    endDate: p.end.slice(0, 10),
    isCurrent: false,
    ...(p.sub ? { subPeriods: p.sub.map(toApiPeriod) } : {}),
  };
}

/** Dasha periods in the parseDashaResponse shape, current flags set for `now`. */
export function dashasFromChart(
  chart: CanonicalChart,
  now: number = Date.now(),
): DashaPeriod[] {
  // Exact instants (not the day-truncated dates) decide "current".
  const withInstants = chart.dasha.mahadashas.map((md) => ({
    planet: md.lord,
    startDate: md.start,
    endDate: md.end,
    isCurrent: false,
    subPeriods: (md.sub ?? []).map((ad) => ({
      planet: ad.lord,
      startDate: ad.start,
      endDate: ad.end,
      isCurrent: false,
    })),
  }));
  const flagged = markCurrentDashaPeriods(withInstants, { now });
  const shaped = chart.dasha.mahadashas.map(toApiPeriod);
  return shaped.map((md, i) => ({
    ...md,
    isCurrent: flagged[i].isCurrent,
    subPeriods: (md.subPeriods ?? []).map((ad, j) => ({
      ...ad,
      isCurrent: flagged[i].subPeriods?.[j]?.isCurrent ?? false,
    })),
  }));
}

export function localNatalChart(bd: BirthData): KundaliData | null {
  const chart = localCanonicalChart(bd);
  return chart ? kundaliFromChart(chart) : null;
}

export function localDashaPeriods(
  bd: BirthData,
  now: number = Date.now(),
): DashaPeriod[] | null {
  const chart = localCanonicalChart(bd);
  return chart ? dashasFromChart(chart, now) : null;
}

/** HH:mm, without the engine's "+1" next-day marker. */
const hhmm = (local: string) => local.slice(0, 5);

/** A computed panchang in the astrology-api.io /vedic/panchang shape. */
export function panchangToApiShape(p: PanchangResult): Record<string, any> {
  const [year, month, day] = p.date.split("-").map(Number);
  return {
    date: { gregorian: p.date, year, month, day },
    tithi: {
      number: p.tithi.index + 1,
      name: p.tithi.name,
      paksha: p.tithi.paksha.toLowerCase(),
      end_time: p.tithi.endsLocal,
    },
    nakshatra: {
      number: p.nakshatra.index + 1,
      name: p.nakshatra.name,
      pada: p.nakshatra.pada,
      end_time: p.nakshatra.endsLocal,
    },
    yoga: {
      number: p.yoga.index + 1,
      name: p.yoga.name,
      end_time: p.yoga.endsLocal,
    },
    karana: p.karanas[0]
      ? {
          number: p.karanas[0].index + 1,
          name: p.karanas[0].name,
          end_time: p.karanas[0].endsLocal,
        }
      : undefined,
    vara: { name: p.vara.sanskrit, english: p.vara.english },
    sunrise_sunset: {
      sunrise: hhmm(p.sunriseLocal),
      sunset: hhmm(p.sunsetLocal),
    },
    inauspicious_periods: {
      rahu_kalam: {
        start: hhmm(p.rahuKaal.startLocal),
        end: hhmm(p.rahuKaal.endLocal),
      },
      yamagandam: {
        start: hhmm(p.yamaganda.startLocal),
        end: hhmm(p.yamaganda.endLocal),
      },
      gulika_kalam: {
        start: hhmm(p.gulika.startLocal),
        end: hhmm(p.gulika.endLocal),
      },
    },
    auspicious_periods: p.abhijit.observed
      ? {
          abhijit_muhurta: {
            start: hhmm(p.abhijit.startLocal),
            end: hhmm(p.abhijit.endLocal),
          },
        }
      : {},
    source: "local",
  };
}

/** Panchang for a local date at a place (offset from the place's IANA zone). */
export function localPanchang(
  dateKey: string,
  place: { lat: number; lng: number },
): Record<string, any> {
  const resolved = utcOffsetAt(
    tzFromLatLng(place.lat, place.lng),
    dateKey,
    "12:00",
  );
  return panchangToApiShape(
    computePanchang(
      {
        date: dateKey,
        lat: place.lat,
        lng: place.lng,
        utcOffsetHours: resolved.offsetHours,
      },
      astronomyEngineProvider,
    ),
  );
}

/**
 * Run a local computation when ASTRO_ENGINE=local. Returns null (→ use the
 * API) when the flag is off, the builder declines, or the engine fails
 * unexpectedly; a classified chart error (DST gap) propagates like the API's.
 */
export function tryLocalEngine<T>(
  label: string,
  compute: () => T | null,
  env: Record<string, string | undefined> = process.env,
): T | null {
  if (astroEngineMode(env) !== "local") return null;
  try {
    return compute();
  } catch (err) {
    if ((err as { name?: unknown })?.name === "AstroChartError") throw err;
    console.warn(
      `[AstroEngine] Local ${label} failed; falling back to the API:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
