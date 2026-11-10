/**
 * Astrology API Service — Centralized wrapper for all Astrology-API.io v3 calls.
 * https://api.astrology-api.io/api/v3  (266 endpoints available, OpenAPI spec verified)
 *
 * ── Currently wired endpoints ──────────────────────────────────────────────
 *
 * Charts
 *   POST /charts/natal                         → getNatalChart() (Western)
 *   POST /vedic/divisional-chart (D1)          → getNatalChart() (Vedic, Lahiri)
 *   POST /charts/transit                       → getTransitChart()
 *   POST /charts/synastry                      → (used inside getCompatibilityDetails)
 *
 * Data
 *   GET  /data/now                             → getCurrentTransits()
 *
 * Vedic
 *   POST /vedic/divisional-chart               → getNavamsaChart()
 *   POST /vedic/vimshottari-dasha              → getDashaPeriods()
 *   POST /vedic/panchang                       → getPanchang()
 *   POST /vedic/yoga-analysis                  → getYogaAnalysis()
 *   POST /vedic/kundli-matching                → getKundliMatching()
 *   POST /vedic/manglik-dosha                  → getManglikDosha()
 *   POST /vedic/remedies                       → getRemedies()
 *   POST /vedic/sade-sati                      → getSadeSati()
 *   POST /vedic/kaal-sarpa-dosha               → getKaalSarpaDosha()
 *   POST /vedic/nakshatra-predictions           → getNakshatraPredictions()
 *   POST /vedic/ashtakvarga                     → getAshtakvarga()
 *
 * Eclipses & Lunar
 *   GET  /eclipses/upcoming                     → getUpcomingEclipses()
 *   POST /eclipses/natal-check                  → getEclipseNatalImpact()
 *   POST /lunar/phases                          → getLunarPhases()
 *   POST /lunar/void-of-course                  → getVoidOfCourse()
 *
 * Horoscope
 *   POST /horoscope/personal/daily             → getDailyHoroscope()
 *   POST /horoscope/personal/weekly            → getWeeklyHoroscope()
 *   POST /horoscope/personal/monthly            → getMonthlyHoroscope()
 *   POST /horoscope/personal/yearly             → getYearlyHoroscope()
 *   POST /horoscope/sign/daily/text            → getDailyHoroscopeText()
 *   POST /horoscope/sign/weekly/text           → getWeeklySignHoroscope()
 *   POST /horoscope/sign/monthly/text          → getMonthlySignHoroscope()
 *   POST /horoscope/sign/yearly/text           → getYearlySignHoroscope()
 *
 * Analysis
 *   POST /analysis/natal-transit-report        → getTransitReport()
 *
 * SVG (via /render/*, format "svg" — /svg/* is deprecated)
 *   POST /render/natal                          → getNatalChartSVG()
 *   POST /render/transit                        → getTransitChartSVG()
 *
 * Render
 *   POST /render/transit                        → getRenderedTransitChart() (existing)
 *   POST /render/natal                          → getRenderedNatalChart()
 *   POST /render/synastry                       → getRenderedSynastryChart()
 *
 * Insights
 *   POST /insights/relationship/compatibility  → (used inside getCompatibilityDetails)
 *   POST /insights/wellness/biorhythms          → getBiorhythms()
 *   POST /insights/wellness/wellness-score      → getWellnessScore()
 *   POST /insights/wellness/energy-patterns     → getEnergyPatterns()
 *
 * PDF
 *   POST /pdf/natal-report                      → getNatalReportPDF()
 *   POST /pdf/horoscope/daily                   → getDailyHoroscopePDF()
 *   POST /pdf/horoscope/weekly                  → getWeeklyHoroscopePDF()
 */

/**
 * Date convention: any function taking a date expects the *caller's local*
 * calendar day (YYYY-MM-DD), which the endpoints derive via
 * shared/request-date.ts from a `localDate` the client sends. The
 * `new Date().toISOString()` fallbacks below are UTC last-resorts for
 * server-initiated calls with no user context — never the normal path, because
 * the UTC day rolls over mid-evening for every timezone west of Greenwich.
 */
import { resolveAstrologyApiKey } from "./env.js";
import {
  zodiacApiOptions,
  DEFAULT_ZODIAC_MODE,
  type ZodiacMode,
} from "../../../src/lib/zodiac-mode.js";
import {
  classifyUpstreamChartError,
  type UpstreamChartErrorKind,
} from "./astro-error-classify.js";
import {
  markCurrentDashaPeriods,
  type DashaCurrentPeriod,
} from "./chart-cache.js";
import { noteAstroResponse, reserveAstroCall } from "./astro-budget.js";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface BirthData {
  name?: string;
  dob: string; // YYYY-MM-DD
  tob: string; // HH:MM
  pob: string; // Place of birth (city name)
  lat?: number;
  lng?: number;
  /** Birth time is a placeholder (noon) — see kundali.ts time-unknown shaping. */
  birthTimeUnknown?: boolean;
  /** Sidereal Moon sign (profile.moonSign) — the Vedic rashi for sign horoscopes. */
  moonSign?: string;
  /** Sidereal Sun sign (profile.sunSign) — fallback when moonSign is missing. */
  sunSign?: string;
}

export interface PlanetaryPosition {
  name: string;
  sign: string;
  signCode: string;
  degree: number;
  house: number;
  is_retrograde: boolean;
  speed?: number;
  nakshatra?: string;
}

export interface HouseCusp {
  house: number;
  sign: string;
  degree: number;
}

export interface KundaliData {
  planetary_positions: PlanetaryPosition[];
  house_cusps: HouseCusp[];
  ascendant?: { sign: string; degree: number };
  /** Birth time unknown: no Lagna/house cusps; houses counted from the Moon. */
  timeUnknown?: boolean;
  /** What house 1 is: the Lagna (default) or the Moon sign (Chandra Lagna). */
  houseReference?: "lagna" | "moon";
}

export interface DashaPeriod {
  planet: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  subPeriods?: DashaPeriod[];
}

export interface TransitData {
  date: string;
  positions: PlanetaryPosition[];
  significantEvents?: string[];
}

// ─── Internals ───────────────────────────────────────────────────────────────

const API_BASE = "https://api.astrology-api.io/api/v3";

function getApiKey(): string | undefined {
  return resolveAstrologyApiKey();
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const apiKey = getApiKey();
  if (apiKey) headers["X-API-Key"] = apiKey;
  return headers;
}

/** Hard timeout for a single upstream astrology-API call. */
const ASTRO_API_TIMEOUT_MS = 8000;

/**
 * fetch() against the astrology API with a hard timeout. A hung (not errored)
 * upstream socket would otherwise hold the function open until the platform
 * kills it — an opaque 502 instead of the clean JSON error the callers produce.
 * AbortSignal.timeout aborts the request so `!res.ok`/catch paths run normally.
 */
async function apiFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  // Global spend cap + quota breaker (shared/astro-budget.ts). A refused call
  // throws the same quota error an upstream 429 would, so every endpoint's
  // existing 503 `upstream_quota` handling applies unchanged.
  const decision = await reserveAstroCall();
  if (!decision.allowed) {
    throw new AstroChartError(
      `Astrology budget error: 429 - ${canonicalErrorBody("quota_exhausted")}`,
      "quota_exhausted",
      429,
    );
  }
  const counted = decision.commit();
  try {
    const res = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(ASTRO_API_TIMEOUT_MS),
    });
    // A quota 429 opens the breaker (reads a clone; the body stays unread).
    await noteAstroResponse(res);
    return res;
  } finally {
    await counted;
  }
}

/**
 * A chart failure carrying *why* it failed, so callers can say something
 * actionable instead of "please try again" for a birth time that can never
 * succeed. See astro-error-classify.ts.
 */
export class AstroChartError extends Error {
  constructor(
    message: string,
    readonly kind: UpstreamChartErrorKind,
    readonly status: number,
  ) {
    super(message);
    this.name = "AstroChartError";
    Object.setPrototypeOf(this, AstroChartError.prototype);
  }
}

/**
 * An input-free stand-in for an upstream error body that classifies the same
 * way (classifyUpstreamChartError). Upstream bodies can echo the request — the
 * caller's birth date, time and place — so they never go into an error
 * message, where they would reach logs. The `<Label> error: <status> - <body>`
 * format is kept so classifyUpstreamErrorMessage still works across bundles.
 */
export function canonicalErrorBody(kind: UpstreamChartErrorKind): string {
  switch (kind) {
    case "quota_exhausted":
      return '{"error":{"error_code":"RATE_LIMIT_EXCEEDED"}}';
    case "dst_ambiguous":
      return '{"detail":{"error":{"error_code":"CHART_CALCULATION_ERROR","message":"local time is nonexistent or ambiguous (DST)"}}}';
    case "chart_calculation_failed":
      return '{"detail":{"error":{"error_code":"CHART_CALCULATION_ERROR","message":"calculation failed"}}}';
    case "location_unresolved":
      return '{"detail":[{"msg":"location is required"}]}';
    default:
      return "upstream error";
  }
}

/** Throw a classified error for a failed chart response. */
async function throwChartError(res: Response, label: string): Promise<never> {
  const body = await res.text().catch(() => "");
  const kind = classifyUpstreamChartError(res.status, body);
  throw new AstroChartError(
    `${label} error: ${res.status} - ${canonicalErrorBody(kind)}`,
    kind,
    res.status,
  );
}

/**
 * Escalate an upstream *quota exhaustion* on a path that otherwise degrades
 * quietly.
 *
 * Several wrappers deliberately warn-and-return a fallback (null PDF, empty
 * dasha list, no horoscope) so one flaky upstream call can't take a whole page
 * down. That is right for a transient failure — including a plain
 * "slow down" 429 — but wrong for quota exhaustion: every subsequent call
 * fails the same way, the user sees a silently empty dashboard (or gets
 * charged for a report that returns `null`), and nothing pages an operator.
 *
 * So only a 429 that classifies as `quota_exhausted` throws, letting
 * kundali.ts surface the 503 `upstream_quota`. A throttling 429 with no quota
 * marker returns normally and keeps the caller's existing fallback (e.g.
 * getDailyHoroscope still reaches getDailyHoroscopeText, getDashaPeriods still
 * returns `[]`), exactly like every other non-2xx status.
 *
 * INVARIANT: on a 429 the response body is consumed here — including on the
 * non-throwing path — so a caller must NEVER read `res` (`.json()`, `.text()`,
 * `.arrayBuffer()`) after this returns without throwing. Every call site only
 * reads the body on the `res.ok` branch; keep it that way.
 */
async function throwIfRateLimited(res: Response, label: string): Promise<void> {
  if (res.status !== 429) return;
  // Reads the body exactly once: throwChartError cannot be reused here because
  // it would re-read an already-consumed stream.
  const body = await res.text();
  if (classifyUpstreamChartError(429, body) !== "quota_exhausted") return;
  throw new AstroChartError(
    `${label} error: 429 - ${canonicalErrorBody("quota_exhausted")}`,
    "quota_exhausted",
    429,
  );
}

/** Standard DateTimeLocation object used by most endpoints. */
function buildDateTimeLocation(
  dateStr: string,
  timeStr: string,
  city?: string,
  lat?: number,
  lng?: number,
): Record<string, any> {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const dtl: Record<string, any> = {
    year,
    month,
    day,
    hour,
    minute,
    second: 0,
  };
  if (city) dtl.city = city;
  if (lat !== undefined && lng !== undefined) {
    dtl.latitude = lat;
    dtl.longitude = lng;
  }
  return dtl;
}

/** Standard Subject wrapper: { name, birth_data: DateTimeLocation }. */
function buildSubject(birthData: BirthData): Record<string, any> {
  return {
    // Never send the user's real name to the third-party astrology API — it is
    // not a calculation field (charts derive only from birth_data), and our
    // privacy policy states only calculation fields are shared. Personalized
    // narratives are generated by our own AI layer, which has the real name.
    name: "AstroYou User",
    birth_data: buildDateTimeLocation(
      birthData.dob,
      birthData.tob,
      birthData.pob || undefined,
      birthData.lat,
      birthData.lng,
    ),
  };
}

/** Chart-request payload with subject + Vedic options. */
function parseBirthData(
  birthData: BirthData,
  mode: ZodiacMode = DEFAULT_ZODIAC_MODE,
) {
  return {
    subject: buildSubject(birthData),
    options: {
      ...zodiacApiOptions(mode),
      active_points: [
        "Sun",
        "Moon",
        "Mercury",
        "Venus",
        "Mars",
        "Jupiter",
        "Saturn",
        "Mean_Node",
        "Mean_South_Node",
        "Ascendant",
      ],
      precision: 2,
    },
  };
}

/** Every option the Vedic (VedicOptions) endpoints take that the app pins. */
export const VEDIC_OPTIONS = {
  ayanamsa: "lahiri",
  bhava_system: "whole_sign",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The instant a "for date X" reading is cast for. A date within ~a day of now
 * is the caller's local "today" → cast for the current instant; any other date
 * → noon UTC of that day.
 */
export function readingInstant(date?: string, nowMs: number = Date.now()): Date {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const noon = Date.parse(`${date}T12:00:00Z`);
    if (Number.isFinite(noon) && Math.abs(noon - nowMs) > 1.5 * DAY_MS) {
      return new Date(noon);
    }
  }
  return new Date(nowMs);
}

/**
 * DateTimeLocation for an absolute instant. The clock fields are UTC and say
 * so via `timezone: "UTC"` (spec: DateTimeLocation.timezone) — sending UTC
 * hour/minute without a timezone made the API read them as local time at the
 * location, skewing transits by the location's UTC offset. Coordinates are
 * preferred over the city (a city triggers a timezone lookup of its own).
 */
export function buildInstantDateTimeLocation(
  instant: Date,
  place: { city?: string; lat?: number; lng?: number } = {},
): Record<string, any> {
  const hasCoords =
    typeof place.lat === "number" &&
    Number.isFinite(place.lat) &&
    typeof place.lng === "number" &&
    Number.isFinite(place.lng);
  return {
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
    hour: instant.getUTCHours(),
    minute: instant.getUTCMinutes(),
    second: 0,
    timezone: "UTC",
    ...(hasCoords
      ? { latitude: place.lat, longitude: place.lng }
      : place.city
        ? { city: place.city }
        : {}),
  };
}

/** Transit-time payload: { datetime: DateTimeLocation }. */
export function buildTransitTime(
  birthData: BirthData,
  transitDate?: string,
  nowMs: number = Date.now(),
): Record<string, any> {
  return {
    datetime: buildInstantDateTimeLocation(
      readingInstant(transitDate, nowMs),
      { city: birthData.pob || undefined, lat: birthData.lat, lng: birthData.lng },
    ),
  };
}

// ─── Response Transformers ───────────────────────────────────────────────────

function transformKundaliResponse(apiResponse: any): KundaliData {
  const planetary_positions: PlanetaryPosition[] = [];
  const house_cusps: HouseCusp[] = [];
  const data = apiResponse.subject_data || apiResponse.data || apiResponse;

  const planetKeys = [
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
    "pluto",
    "mean_node",
    "true_node",
    "mean_south_node",
    "ketu",
    "rahu",
  ];
  const src = data.planets || data.subject_data || data;

  for (const key of planetKeys) {
    const pd = src[key] || data[key];
    if (pd && (pd.sign || pd.zodiac_sign)) {
      planetary_positions.push({
        name:
          pd.name ||
          key.charAt(0).toUpperCase() + key.slice(1).replace("_", " "),
        sign: pd.sign || pd.zodiac_sign || "",
        signCode: pd.sign || pd.zodiac_sign || "",
        degree: pd.position || pd.degree || 0,
        house: parseHouseNumber(pd.house) || 1,
        is_retrograde: pd.retrograde || pd.is_retrograde || false,
        speed: pd.speed,
        nakshatra: pd.nakshatra,
      });
    }
  }

  if (data.houses) {
    for (const [num, hd] of Object.entries(data.houses) as any) {
      house_cusps.push({
        house: parseInt(num),
        sign: hd.sign || "",
        degree: hd.degree || 0,
      });
    }
  }

  let ascendant: KundaliData["ascendant"] | null = null;
  // The ascendant may sit at the top level, inside the planets map, or only
  // as the first house cusp, depending on the upstream response version.
  const asc = data.ascendant || src.ascendant || src.asc;
  const firstCusp = house_cusps.find((h) => h.house === 1 && h.sign);
  if (asc) {
    ascendant = {
      sign: asc.sign || asc.zodiac_sign || asc,
      degree: asc.position || asc.degree || 0,
    };
  } else if (data.first_house) {
    ascendant = {
      sign: data.first_house.sign || "",
      degree: data.first_house.position || 0,
    };
  } else if (firstCusp) {
    ascendant = { sign: firstCusp.sign, degree: firstCusp.degree || 0 };
  }

  return {
    planetary_positions,
    house_cusps,
    ascendant: ascendant || undefined,
  };
}

const DIVISIONAL_SIGN_CODES: Record<string, string> = {
  aries: "Ari",
  taurus: "Tau",
  gemini: "Gem",
  cancer: "Can",
  leo: "Leo",
  virgo: "Vir",
  libra: "Lib",
  scorpio: "Sco",
  sagittarius: "Sag",
  capricorn: "Cap",
  aquarius: "Aqu",
  pisces: "Pis",
};

const DIVISIONAL_SIGN_ORDER = [
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

function normalizeDivisionalSign(sign: unknown): string {
  if (typeof sign !== "string") return "";
  const trimmed = sign.trim();
  return DIVISIONAL_SIGN_CODES[trimmed.toLowerCase()] || trimmed.slice(0, 3);
}

function normalizeDivisionalPlanetName(name: unknown): string {
  if (name === "Rahu") return "Mean_Node";
  if (name === "Ketu") return "Mean_South_Node";
  return typeof name === "string" ? name : "Unknown";
}

/** Normalize both documented divisional-chart response variants. */
export function normalizeDivisionalChartResponse(
  apiResponse: any,
  chartType: string,
): KundaliData {
  const envelope = apiResponse?.data || apiResponse;
  const charts = Array.isArray(envelope?.charts)
    ? envelope.charts
    : Array.isArray(apiResponse?.charts)
      ? apiResponse.charts
      : [];
  const chart = charts.find(
    (candidate: any) =>
      String(candidate?.chart || candidate?.chart_type).toUpperCase() ===
      chartType.toUpperCase(),
  );

  // Preserve compatibility with the older keyed response shape.
  if (!chart) {
    const keyedChart =
      envelope?.[chartType] ||
      apiResponse?.[chartType] ||
      apiResponse?.data?.[chartType];
    const legacy = transformKundaliResponse(keyedChart || {});
    if (legacy.planetary_positions.length > 0) return legacy;
    throw new Error(
      `Divisional chart ${chartType} was missing from the response`,
    );
  }

  const rawPositions: any[] = Array.isArray(chart.positions)
    ? chart.positions
    : Array.isArray(chart.planets)
      ? chart.planets
      : [];
  const ascendantRaw = rawPositions.find(
    (position: any) =>
      String(position?.planet || position?.name).toLowerCase() === "ascendant",
  );
  const ascendantSign = normalizeDivisionalSign(ascendantRaw?.sign);
  const ascendantIndex = DIVISIONAL_SIGN_ORDER.indexOf(ascendantSign);

  const planetary_positions: PlanetaryPosition[] = rawPositions
    .map((position: any): PlanetaryPosition | null => {
      const sign = normalizeDivisionalSign(position?.sign);
      const signIndex = DIVISIONAL_SIGN_ORDER.indexOf(sign);
      if (!sign || signIndex < 0) return null;
      const longitude = Number(position?.longitude);
      const degreeValue = Number(position?.degree);
      const degree = Number.isFinite(degreeValue)
        ? degreeValue
        : Number.isFinite(longitude)
          ? ((longitude % 30) + 30) % 30
          : 0;
      const derivedHouse =
        ascendantIndex >= 0 ? ((signIndex - ascendantIndex + 12) % 12) + 1 : 1;

      return {
        name: normalizeDivisionalPlanetName(position?.planet || position?.name),
        sign,
        signCode: sign,
        degree,
        house:
          position?.house === undefined
            ? derivedHouse
            : parseHouseNumber(position.house),
        is_retrograde: position?.retrograde || position?.is_retrograde || false,
      };
    })
    .filter(
      (position: PlanetaryPosition | null): position is PlanetaryPosition =>
        Boolean(position),
    );

  if (planetary_positions.length === 0) {
    throw new Error(
      `Divisional chart ${chartType} contained no planet positions`,
    );
  }

  const ascendantPosition = planetary_positions.find(
    (position: PlanetaryPosition) => position.name === "Ascendant",
  );

  return {
    planetary_positions,
    house_cusps: [],
    ascendant: ascendantPosition
      ? { sign: ascendantPosition.sign, degree: ascendantPosition.degree }
      : undefined,
  };
}

const NAKSHATRAS = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
];

/** Nakshatra of a sidereal position given its sign code and in-sign degree. */
export function nakshatraFromSidereal(
  signCode: string,
  degree: number,
): string | undefined {
  const signIndex = DIVISIONAL_SIGN_ORDER.indexOf(normalizeDivisionalSign(signCode));
  if (signIndex < 0 || !Number.isFinite(degree)) return undefined;
  const longitude = signIndex * 30 + Math.min(Math.max(degree, 0), 29.9999);
  return NAKSHATRAS[Math.floor(longitude / (360 / 27)) % 27];
}

/**
 * Shape a /vedic/divisional-chart D1 response like the /charts/natal D1 the
 * app has always consumed: the Ascendant lives in `ascendant` (not among the
 * planets), whole-sign house cusps are listed, and each planet carries its
 * nakshatra (derived from the sidereal longitude when the API omits it).
 */
export function normalizeVedicD1Response(apiResponse: any): KundaliData {
  const chart = normalizeDivisionalChartResponse(apiResponse, "D1");
  const ascIndex = chart.ascendant
    ? DIVISIONAL_SIGN_ORDER.indexOf(normalizeDivisionalSign(chart.ascendant.sign))
    : -1;
  const planetary_positions = chart.planetary_positions
    .filter((p) => p.name !== "Ascendant")
    .map((p) => ({
      ...p,
      nakshatra: p.nakshatra || nakshatraFromSidereal(p.sign, p.degree),
    }));
  const house_cusps: HouseCusp[] =
    ascIndex >= 0
      ? DIVISIONAL_SIGN_ORDER.map((_, i) => ({
          house: i + 1,
          sign: DIVISIONAL_SIGN_ORDER[(ascIndex + i) % 12],
          degree: 0,
        }))
      : [];
  return { planetary_positions, house_cusps, ascendant: chart.ascendant };
}

/**
 * Birth time unknown: a noon chart's Lagna and house cusps are guesses (the
 * Lagna moves a sign every ~2 hours), so drop them. Planets keep their signs
 * (and the Moon its nakshatra); houses are counted from the Moon's sign
 * (Chandra Lagna), the Jyotish convention without a birth time.
 */
export function shapeTimeUnknownChart(chart: KundaliData): KundaliData {
  const planets = (chart.planetary_positions || []).filter(
    (p) => !/^(ascendant|lagna|asc)$/i.test(p.name || ""),
  );
  const moon = planets.find((p) => /^moon$/i.test(p.name || ""));
  const moonIndex = moon
    ? DIVISIONAL_SIGN_ORDER.indexOf(normalizeDivisionalSign(moon.signCode || moon.sign))
    : -1;
  return {
    planetary_positions: planets.map((p) => {
      const idx = DIVISIONAL_SIGN_ORDER.indexOf(
        normalizeDivisionalSign(p.signCode || p.sign),
      );
      return {
        ...p,
        house: moonIndex >= 0 && idx >= 0 ? ((idx - moonIndex + 12) % 12) + 1 : 0,
      };
    }),
    house_cusps: [],
    timeUnknown: true,
    houseReference: "moon",
  };
}

function parseHouseNumber(houseName: string | number | undefined): number {
  if (typeof houseName === "number") return houseName;
  if (!houseName) return 1;
  const map: Record<string, number> = {
    First_House: 1,
    Second_House: 2,
    Third_House: 3,
    Fourth_House: 4,
    Fifth_House: 5,
    Sixth_House: 6,
    Seventh_House: 7,
    Eighth_House: 8,
    Ninth_House: 9,
    Tenth_House: 10,
    Eleventh_House: 11,
    Twelfth_House: 12,
  };
  return map[houseName] || parseInt(houseName) || 1;
}

/** Unwrap the common { data: ... } envelope the API uses. */
function unwrap(result: any): any {
  return result.data || result;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHARTS  (/charts/*)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Natal (D1) chart.
 *
 * Vedic: POST /vedic/divisional-chart (charts ["D1"]) with an explicit Lahiri
 * ayanamsa — /charts/natal's ChartOptions has no ayanamsa field and the spec
 * documents its Sidereal default as Fagan-Bradley, ~0.9 deg off Lahiri.
 * Western: POST /charts/natal, tropical + Placidus.
 */
export async function getNatalChart(
  birthData: BirthData,
  mode: ZodiacMode = DEFAULT_ZODIAC_MODE,
): Promise<KundaliData> {
  if (mode !== "western") {
    const res = await apiFetch(`${API_BASE}/vedic/divisional-chart`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        subject: buildSubject(birthData),
        charts: ["D1"],
        options: { ...VEDIC_OPTIONS, precision: 2 },
      }),
    });
    if (!res.ok) await throwChartError(res, "Natal chart");
    return normalizeVedicD1Response(await res.json());
  }
  const res = await apiFetch(`${API_BASE}/charts/natal`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(parseBirthData(birthData, mode)),
  });
  if (!res.ok) await throwChartError(res, "Natal chart");
  return transformKundaliResponse(await res.json());
}

/** POST /charts/transit — Transit snapshot overlaid on natal. */
export async function getTransitChart(
  birthData: BirthData,
  transitDate?: string,
  mode: ZodiacMode = DEFAULT_ZODIAC_MODE,
): Promise<any> {
  const payload = {
    subject: buildSubject(birthData),
    transit_time: buildTransitTime(birthData, transitDate),
    options: {
      ...zodiacApiOptions(mode),
      active_points: [
        "Sun",
        "Moon",
        "Mercury",
        "Venus",
        "Mars",
        "Jupiter",
        "Saturn",
        "Mean_Node",
        "Mean_South_Node",
        "Ascendant",
      ],
      precision: 2,
    },
  };
  const res = await apiFetch(`${API_BASE}/charts/transit`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) await throwChartError(res, "Transit chart");
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DATA  (/data/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /data/now — Current planetary positions (no birth data needed). */
export async function getCurrentTransits(
  localDate?: string,
): Promise<TransitData> {
  // The Moon moves ~13 degrees a day, so the caller's local day matters here.
  const today = localDate || new Date().toISOString().split("T")[0];
  try {
    const res = await apiFetch(`${API_BASE}/data/now`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      await throwIfRateLimited(res, "Current transits");
      console.warn("/data/now error:", res.status);
      return { date: today, positions: [], significantEvents: [] };
    }

    const raw = await res.json();
    const positions: PlanetaryPosition[] = [];
    const pd = raw.data || raw.positions || raw;
    if (typeof pd === "object") {
      for (const [key, value] of Object.entries(pd)) {
        const p = value as any;
        if (p && (p.sign || p.zodiac_sign)) {
          positions.push({
            name:
              p.name ||
              key.charAt(0).toUpperCase() + key.slice(1).replace("_", " "),
            sign: p.sign || p.zodiac_sign || "",
            signCode: p.sign || p.zodiac_sign || "",
            degree: p.position || p.degree || 0,
            house: parseHouseNumber(p.house) || 1,
            is_retrograde: p.retrograde || p.is_retrograde || false,
            speed: p.speed,
            nakshatra: p.nakshatra,
          });
        }
      }
    }
    return { date: today, positions, significantEvents: raw.events || [] };
  } catch (err) {
    // A quota outage must not be flattened into "no transits today" — it is
    // the one failure here the caller has to see. Everything else still
    // degrades to an empty snapshot.
    if (err instanceof AstroChartError) throw err;
    console.error("getCurrentTransits error:", err);
    return { date: today, positions: [], significantEvents: [] };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  VEDIC  (/vedic/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /vedic/divisional-chart — Divisional charts (D1-D60). */
export async function getNavamsaChart(
  birthData: BirthData,
  charts: string[] = ["D9"],
): Promise<KundaliData> {
  try {
    const res = await apiFetch(`${API_BASE}/vedic/divisional-chart`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        subject: buildSubject(birthData),
        charts,
        options: VEDIC_OPTIONS,
      }),
    });
    if (!res.ok) await throwChartError(res, "Divisional chart");
    return normalizeDivisionalChartResponse(await res.json(), charts[0]);
  } catch (err) {
    console.error("Divisional chart error:", err);
    throw err;
  }
}

/** POST /vedic/vimshottari-dasha — Dasha periods with sub-periods. */
export async function getDashaPeriods(
  birthData: BirthData,
): Promise<DashaPeriod[]> {
  const res = await apiFetch(`${API_BASE}/vedic/vimshottari-dasha`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      dasha_level: "antardasha",
      // Dasha periods span months to years, so a one-day skew is immaterial.
      target_date: new Date().toISOString().split("T")[0],
      options: VEDIC_OPTIONS,
    }),
  });
  if (!res.ok) {
    await throwIfRateLimited(res, "Dasha");
    console.warn("Dasha error:", res.status);
    return [];
  }

  return parseDashaResponse(unwrap(await res.json()));
}

/**
 * Map a /vedic/vimshottari-dasha response to DashaPeriod[], marking the
 * running periods from the response's `current_period` summary when present,
 * else from the period dates (see markCurrentDashaPeriods).
 */
export function parseDashaResponse(
  data: any,
  now: number = Date.now(),
): DashaPeriod[] {
  const raw =
    data?.mahadashas ||
    data?.periods ||
    data?.dashas ||
    (Array.isArray(data) ? data : []);
  if (!Array.isArray(raw)) return [];
  const currentPeriod: DashaCurrentPeriod | null =
    data?.current_period && typeof data.current_period === "object"
      ? data.current_period
      : null;

  const periods = raw.map(
    (m: any) =>
      ({
        planet: m.planet || m.lord || m.name || "",
        startDate: m.start_date || m.startDate || m.start || "",
        endDate: m.end_date || m.endDate || m.end || "",
        isCurrent: m.is_current ?? m.isCurrent ?? false,
        subPeriods: (m.antardashas || m.sub_periods || m.subPeriods || []).map(
          (s: any) => ({
            planet: s.planet || s.lord || s.name || "",
            startDate: s.start_date || s.startDate || s.start || "",
            endDate: s.end_date || s.endDate || s.end || "",
            isCurrent: s.is_current ?? s.isCurrent ?? false,
          }),
        ),
      }) as DashaPeriod,
  );
  return markCurrentDashaPeriods(periods, { now, currentPeriod });
}

/** POST /vedic/panchang — Daily almanac (Tithi, Nakshatra, Karana, Rahu Kaal). */
export async function getPanchang(
  date?: string,
  city?: string,
  lat?: number,
  lng?: number,
): Promise<any> {
  const dateStr = date || new Date().toISOString().split("T")[0];
  const res = await apiFetch(`${API_BASE}/vedic/panchang`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      datetime_location: buildDateTimeLocation(
        dateStr,
        "06:00",
        city || "New Delhi",
        lat ?? 28.6139,
        lng ?? 77.209,
      ),
      options: VEDIC_OPTIONS,
    }),
  });
  if (!res.ok) await throwChartError(res, "Panchang");
  return unwrap(await res.json());
}

/** POST /vedic/festival-calendar — Upcoming festivals for a year/region. */
export async function getFestivalCalendar(
  year?: number,
  region?: string,
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/vedic/festival-calendar`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      year: year || new Date().getFullYear(),
      region: region || "north",
    }),
  });
  if (!res.ok) {
    // An empty festival list is a fine degradation for a transient blip, but
    // it hides a quota outage behind a permanently empty calendar; escalate so
    // kundali's FESTIVALS path can answer 503 upstream_quota.
    await throwIfRateLimited(res, "Festival calendar");
    return [];
  }
  return unwrap(await res.json());
}

/** POST /vedic/yoga-analysis — Detect yogas (Raj, Gajakesari, etc). */
export async function getYogaAnalysis(birthData: BirthData): Promise<any> {
  const res = await apiFetch(`${API_BASE}/vedic/yoga-analysis`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      options: VEDIC_OPTIONS,
    }),
  });
  if (!res.ok) await throwChartError(res, "Yoga analysis");
  return unwrap(await res.json());
}

/** POST /vedic/kundli-matching — 36-point Guna Milan. */
export async function getKundliMatching(
  person1: BirthData,
  person2: BirthData,
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/vedic/kundli-matching`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      groom: buildSubject(person1),
      bride: buildSubject(person2),
      include_manglik: true,
      options: VEDIC_OPTIONS,
    }),
  });
  if (!res.ok) await throwChartError(res, "Kundli matching");
  return unwrap(await res.json());
}

/** POST /vedic/manglik-dosha — Manglik dosha detection. */
export async function getManglikDosha(birthData: BirthData): Promise<any> {
  const res = await apiFetch(`${API_BASE}/vedic/manglik-dosha`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      options: VEDIC_OPTIONS,
    }),
  });
  if (!res.ok) await throwChartError(res, "Manglik dosha");
  return unwrap(await res.json());
}

/** remedy_type values the spec's VedicRemediesRequest enum accepts. */
const REMEDY_TYPES = new Set(["all", "gemstones", "mantras", "pujas", "rudrakshas"]);

/** /vedic/remedies body. remedy_type is a non-nullable enum — omit when unset. */
export function buildRemediesBody(
  birthData: BirthData,
  remedyType?: string,
): Record<string, any> {
  const type =
    typeof remedyType === "string" ? remedyType.trim().toLowerCase() : "";
  return {
    subject: buildSubject(birthData),
    ...(REMEDY_TYPES.has(type) ? { remedy_type: type } : {}),
    options: VEDIC_OPTIONS,
  };
}

/** POST /vedic/remedies — Gemstones, mantras, fasting, rituals. */
export async function getRemedies(
  birthData: BirthData,
  remedyType?: string,
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/vedic/remedies`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(buildRemediesBody(birthData, remedyType)),
  });
  if (!res.ok) await throwChartError(res, "Remedies");
  return unwrap(await res.json());
}

/** POST /vedic/sade-sati — Sade Sati (Saturn transit) detection. */
export async function getSadeSati(birthData: BirthData): Promise<any> {
  const res = await apiFetch(`${API_BASE}/vedic/sade-sati`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      include_remedies: true,
      options: VEDIC_OPTIONS,
    }),
  });
  if (!res.ok) await throwChartError(res, "Sade Sati");
  return unwrap(await res.json());
}

/** POST /vedic/kaal-sarpa-dosha — Kaal Sarpa dosha detection. */
export async function getKaalSarpaDosha(birthData: BirthData): Promise<any> {
  const res = await apiFetch(`${API_BASE}/vedic/kaal-sarpa-dosha`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      include_remedies: true,
      options: VEDIC_OPTIONS,
    }),
  });
  if (!res.ok) await throwChartError(res, "Kaal Sarpa");
  return unwrap(await res.json());
}

/** POST /vedic/nakshatra-predictions — Nakshatra-based predictions. */
export async function getNakshatraPredictions(
  birthData: BirthData,
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/vedic/nakshatra-predictions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      options: VEDIC_OPTIONS,
    }),
  });
  if (!res.ok) await throwChartError(res, "Nakshatra predictions");
  return unwrap(await res.json());
}

/** POST /vedic/ashtakvarga — Ashtakvarga strength analysis. */
export async function getAshtakvarga(birthData: BirthData): Promise<any> {
  const res = await apiFetch(`${API_BASE}/vedic/ashtakvarga`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      include_sarva: true,
      options: VEDIC_OPTIONS,
    }),
  });
  if (!res.ok) await throwChartError(res, "Ashtakvarga");
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ECLIPSES & LUNAR  (/eclipses/*, /lunar/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /eclipses/upcoming — Next upcoming eclipses. */
export async function getUpcomingEclipses(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/eclipses/upcoming`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) await throwChartError(res, "Eclipses");
  return unwrap(await res.json());
}

/** POST /eclipses/natal-check — Eclipse impact on natal chart. */
export async function getEclipseNatalImpact(
  birthData: BirthData,
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/eclipses/natal-check`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) await throwChartError(res, "Eclipse natal check");
  return unwrap(await res.json());
}

/** Where/when a "sky right now" reading (lunar phase, void of course) is cast. */
export interface SkyMomentInput {
  /** The caller's local day (YYYY-MM-DD); today → the current instant. */
  date?: string;
  city?: string;
  lat?: number;
  lng?: number;
}

/**
 * POST /lunar/phases — the Moon's phase for *today* at the user's location.
 * (It used to be cast for the birth date/time, so the dashboard showed the
 * birth-night Moon.) Takes a top-level `datetime_location`, NOT `subject`.
 */
export async function getLunarPhases(
  moment: SkyMomentInput,
  nowMs: number = Date.now(),
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/lunar/phases`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      datetime_location: buildInstantDateTimeLocation(
        readingInstant(moment.date, nowMs),
        moment,
      ),
    }),
  });
  if (!res.ok) await throwChartError(res, "Lunar phases");
  return unwrap(await res.json());
}

/** POST /lunar/void-of-course — Void of Course status from now (not birth). */
export async function getVoidOfCourse(
  moment: SkyMomentInput,
  nowMs: number = Date.now(),
): Promise<any> {
  // Like /lunar/phases, this takes `datetime_location`, not a `subject`.
  const res = await apiFetch(`${API_BASE}/lunar/void-of-course`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      datetime_location: buildInstantDateTimeLocation(
        readingInstant(moment.date, nowMs),
        moment,
      ),
    }),
  });
  if (!res.ok) await throwChartError(res, "Void of course");
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HOROSCOPE  (/horoscope/*)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Sign selection for sign-based horoscopes ────────────────────────────────

/** Western sign names, Aries-first (aligned with DIVISIONAL_SIGN_ORDER). */
const SIGN_NAMES = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

/** "Ari" / "aries" / "Aries" → "Aries"; anything else → null. */
export function signNameOf(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const idx = DIVISIONAL_SIGN_ORDER.indexOf(normalizeDivisionalSign(value));
  return idx >= 0 ? SIGN_NAMES[idx] : null;
}

function dobMonthDay(dob: string): [number, number] | null {
  const [, month, day] = String(dob || "").split("-").map(Number);
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return null;
  return [month, day];
}

/** Tropical (Western) Sun sign from the birth date's month/day. */
function tropicalSunSign(dob: string): string | null {
  const md = dobMonthDay(dob);
  if (!md) return null;
  const [month, day] = md;
  // Day each month's later sign begins (Jan 20 → Aquarius, ...).
  const bounds = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
  const startIdx = (month + 9) % 12; // sign beginning in this month
  return SIGN_NAMES[day >= bounds[month - 1] ? startIdx : (startIdx + 11) % 12];
}

/**
 * Sidereal (Lahiri) Sun sign from the birth date — the Sun's sidereal
 * ingresses fall ~24 days after the tropical ones (Mesha ~Apr 14). Only a
 * last resort for a Vedic reading when the chart-derived signs are missing;
 * it can be a sign off within a day of an ingress.
 */
function approxSiderealSunSign(dob: string): string | null {
  const md = dobMonthDay(dob);
  if (!md) return null;
  const [month, day] = md;
  const bounds = [14, 13, 14, 14, 15, 15, 16, 17, 17, 17, 16, 16];
  const startIdx = (month + 8) % 12; // sign the Sun enters this month
  return SIGN_NAMES[day >= bounds[month - 1] ? startIdx : (startIdx + 11) % 12];
}

export interface HoroscopeSignOptions {
  /** Explicit sign (sign pages) — wins over everything else. */
  sign?: string;
  mode?: ZodiacMode;
}

/**
 * The sign a sign-based horoscope is fetched for (full Western name).
 *
 * Vedic (default): the sidereal Moon sign — rashi horoscopes are read from the
 * Moon in Jyotish — then the sidereal Sun sign, then an approximate sidereal
 * Sun sign from the date. Western: the tropical Sun sign from the date range.
 */
export function resolveHoroscopeSign(
  birthData: Pick<BirthData, "dob" | "moonSign" | "sunSign">,
  options: HoroscopeSignOptions = {},
): string {
  const explicit = signNameOf(options.sign);
  if (explicit) return explicit;
  if (options.mode === "western") {
    return tropicalSunSign(birthData.dob) || "Aries";
  }
  return (
    signNameOf(birthData.moonSign) ||
    signNameOf(birthData.sunSign) ||
    approxSiderealSunSign(birthData.dob) ||
    "Aries"
  );
}

/** 3-letter sign code ("Ari") the PDF endpoints take. */
function signAbbrev(name: string): string {
  const idx = SIGN_NAMES.indexOf(name);
  return DIVISIONAL_SIGN_ORDER[idx >= 0 ? idx : 0];
}

/** POST /horoscope/personal/daily — Personalized daily horoscope. */
export async function getDailyHoroscope(
  birthData: BirthData,
  date?: string,
): Promise<any> {
  const targetDate = date || new Date().toISOString().split("T")[0];
  const res = await apiFetch(`${API_BASE}/horoscope/personal/daily`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      target_date: targetDate,
      horoscope_type: "daily",
      language: "en",
      tradition: "universal",
      include_transits: true,
      include_progressions: false,
    }),
  });
  if (!res.ok) {
    await throwIfRateLimited(res, "Daily horoscope");
    console.warn("Daily horoscope error:", res.status);
    try {
      return await getDailyHoroscopeText(birthData, date);
    } catch {
      return null;
    }
  }
  return unwrap(await res.json());
}

/** POST /horoscope/personal/weekly — Personalized weekly horoscope. */
export async function getWeeklyHoroscope(
  birthData: BirthData,
  date?: string,
): Promise<any> {
  const targetDate = date || new Date().toISOString().split("T")[0];
  const res = await apiFetch(`${API_BASE}/horoscope/personal/weekly`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      target_date: targetDate,
      horoscope_type: "weekly",
      language: "en",
      tradition: "universal",
      include_transits: true,
      include_progressions: false,
    }),
  });
  if (!res.ok) {
    await throwIfRateLimited(res, "Weekly horoscope");
    console.warn("Weekly horoscope error:", res.status);
    return null;
  }
  return unwrap(await res.json());
}

/** POST /horoscope/personal/monthly — Personalized monthly horoscope. */
export async function getMonthlyHoroscope(
  birthData: BirthData,
  date?: string,
): Promise<any> {
  const targetDate = date || new Date().toISOString().split("T")[0];
  const res = await apiFetch(`${API_BASE}/horoscope/personal/monthly`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      target_date: targetDate,
      horoscope_type: "monthly",
      language: "en",
      tradition: "universal",
      include_transits: true,
      include_progressions: false,
    }),
  });
  if (!res.ok) {
    await throwIfRateLimited(res, "Monthly horoscope");
    console.warn("Monthly horoscope error:", res.status);
    return null;
  }
  return unwrap(await res.json());
}

/** POST /horoscope/personal/yearly — Personalized yearly horoscope. */
export async function getYearlyHoroscope(
  birthData: BirthData,
  date?: string,
): Promise<any> {
  const targetDate = date || new Date().toISOString().split("T")[0];
  const res = await apiFetch(`${API_BASE}/horoscope/personal/yearly`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      target_date: targetDate,
      horoscope_type: "yearly",
      language: "en",
      tradition: "universal",
      include_transits: true,
      include_progressions: false,
      include_major_transits: true,
      include_retrograde_periods: true,
    }),
  });
  if (!res.ok) {
    await throwIfRateLimited(res, "Yearly horoscope");
    console.warn("Yearly horoscope error:", res.status);
    return null;
  }
  return unwrap(await res.json());
}

/** POST /horoscope/sign/daily/text — Sign-based narrative daily text. */
export async function getDailyHoroscopeText(
  birthData: BirthData,
  date?: string,
  options: HoroscopeSignOptions = {},
): Promise<any> {
  const sign = resolveHoroscopeSign(birthData, options);

  const res = await apiFetch(`${API_BASE}/horoscope/sign/daily/text`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      sign,
      date: date || new Date().toISOString().split("T")[0],
      format: "paragraph",
      emoji: false,
      language: "en",
      tradition: "universal",
    }),
  });
  if (!res.ok) return null;
  return unwrap(await res.json());
}

/** POST /horoscope/sign/weekly/text — Weekly text horoscope by sign. */
export async function getWeeklySignHoroscope(
  sign: string,
  date?: string,
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/horoscope/sign/weekly/text`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      sign,
      date: date || new Date().toISOString().split("T")[0],
      format: "paragraph",
      language: "en",
    }),
  });
  if (!res.ok) return null;
  return unwrap(await res.json());
}

/** POST /horoscope/sign/monthly/text — Monthly text horoscope by sign. */
export async function getMonthlySignHoroscope(
  sign: string,
  date?: string,
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/horoscope/sign/monthly/text`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      sign,
      date: date || new Date().toISOString().split("T")[0],
      format: "paragraph",
      language: "en",
    }),
  });
  if (!res.ok) return null;
  return unwrap(await res.json());
}

/** POST /horoscope/sign/yearly/text — Yearly text horoscope by sign. */
export async function getYearlySignHoroscope(
  sign: string,
  date?: string,
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/horoscope/sign/yearly/text`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      sign,
      date: date || new Date().toISOString().split("T")[0],
      format: "long",
      language: "en",
    }),
  });
  if (!res.ok) return null;
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ANALYSIS  (/analysis/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /analysis/natal-transit-report — Transit predictions report. */
export async function getTransitReport(
  birthData: BirthData,
  transitDate?: string,
): Promise<any[]> {
  const res = await apiFetch(`${API_BASE}/analysis/natal-transit-report`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      transit_time: buildTransitTime(birthData, transitDate),
      // The spec's ReportOptions.tradition enum has no "vedic" value
      // (universal | psychological | event_oriented | classical).
      report_options: { tradition: "universal", language: "en" },
    }),
  });
  if (!res.ok) {
    // Throw rather than return [] — an empty array would be cached for the full
    // TTL, breaking a chart's transits for hours after one upstream blip.
    await throwChartError(res, "Transit report");
  }

  const result = await res.json();
  const data = result.data || result;
  return (
    data.report?.events ||
    data.events ||
    result.report?.events ||
    result.events ||
    []
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RENDER  (/render/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /render/transit — Pre-rendered transit chart SVG/image. */
export async function getRenderedTransitChart(
  birthData: BirthData,
  transitDate?: string,
  mode: ZodiacMode = DEFAULT_ZODIAC_MODE,
): Promise<string> {
  const res = await apiFetch(`${API_BASE}/render/transit`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      transit_time: buildTransitTime(birthData, transitDate),
      options: { ...zodiacApiOptions(mode), precision: 2 },
      render_options: { format: "svg", theme: "dark" },
    }),
  });
  if (!res.ok) await throwChartError(res, "Transit render");
  const result = await res.json();
  return result.url || result.data || "";
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SVG CHARTS  (/svg/*)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SVG text from a /render/* response: served as image/svg+xml, or wrapped in
 * a JSON envelope ({ svg } / { data }) depending on the API version.
 */
async function readRenderedSvg(res: Response): Promise<string> {
  const type = res.headers.get("content-type") || "";
  if (!type.includes("json")) return res.text();
  const result = await res.json();
  const body = result?.data ?? result;
  return typeof body === "string" ? body : body?.svg || body?.content || "";
}

/**
 * Natal chart as SVG via POST /render/natal (format "svg") — the spec marks
 * /svg/natal deprecated in favour of it (removed in v4).
 */
export async function getNatalChartSVG(
  birthData: BirthData,
  mode: ZodiacMode = DEFAULT_ZODIAC_MODE,
): Promise<string> {
  const res = await apiFetch(`${API_BASE}/render/natal`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      options: { ...zodiacApiOptions(mode), precision: 2 },
      render_options: { format: "svg", theme: "dark" },
    }),
  });
  if (!res.ok) await throwChartError(res, "SVG natal");
  return readRenderedSvg(res);
}

/** Transit chart as SVG via POST /render/transit (/svg/transit is deprecated). */
export async function getTransitChartSVG(
  birthData: BirthData,
  transitDate?: string,
  mode: ZodiacMode = DEFAULT_ZODIAC_MODE,
): Promise<string> {
  const res = await apiFetch(`${API_BASE}/render/transit`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      transit_time: buildTransitTime(birthData, transitDate),
      options: { ...zodiacApiOptions(mode), precision: 2 },
      render_options: { format: "svg", theme: "dark" },
    }),
  });
  if (!res.ok) await throwChartError(res, "SVG transit");
  return readRenderedSvg(res);
}

/** POST /render/natal — Render natal chart as PNG image. Returns image URL or data. */
export async function getRenderedNatalChart(
  birthData: BirthData,
  mode: ZodiacMode = DEFAULT_ZODIAC_MODE,
): Promise<string> {
  const res = await apiFetch(`${API_BASE}/render/natal`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      options: { ...zodiacApiOptions(mode), precision: 2 },
      render_options: { format: "png", theme: "dark", width: 1080 },
    }),
  });
  if (!res.ok) await throwChartError(res, "Render natal");
  const result = await res.json();
  return result.url || result.data || "";
}

/** POST /render/synastry — Render synastry chart as PNG image. */
export async function getRenderedSynastryChart(
  person1: BirthData,
  person2: BirthData,
  mode: ZodiacMode = DEFAULT_ZODIAC_MODE,
): Promise<string> {
  const res = await apiFetch(`${API_BASE}/render/synastry`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject1: buildSubject(person1),
      subject2: buildSubject(person2),
      options: { ...zodiacApiOptions(mode), precision: 2 },
      render_options: { format: "png", theme: "dark" },
    }),
  });
  if (!res.ok) await throwChartError(res, "Synastry render");
  const result = await res.json();
  return result.url || result.data || "";
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPATIBILITY  (multi-endpoint)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Full compatibility analysis — calls two endpoints in parallel:
 *   POST /insights/relationship/compatibility  (subjects array)
 *   POST /charts/synastry                      (subject1 / subject2)
 */
export async function getCompatibilityDetails(
  person1: BirthData,
  person2: BirthData,
  mode: ZodiacMode = DEFAULT_ZODIAC_MODE,
): Promise<any> {
  const s1 = buildSubject(person1);
  const s2 = buildSubject(person2);

  // Names are labels here, not calculation inputs — the upstream compatibility
  // insight is computed entirely from birth_data. Sending placeholders keeps
  // two real people's names off a third-party service for no loss of accuracy.
  // (Numerology endpoints are the exception: there the name IS the input.)
  const insightsPayload = {
    subjects: [
      { name: "Partner 1", birth_data: s1.birth_data },
      { name: "Partner 2", birth_data: s2.birth_data },
    ],
    options: { ...zodiacApiOptions(mode), language: "en" },
  };
  const synastryPayload = {
    subject1: s1,
    subject2: s2,
    options: { ...zodiacApiOptions(mode), language: "en" },
  };

  try {
    const [rIns, rSyn] = await Promise.all([
      apiFetch(`${API_BASE}/insights/relationship/compatibility`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(insightsPayload),
      }),
      apiFetch(`${API_BASE}/charts/synastry`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(synastryPayload),
      }),
    ]);

    // Compatibility is a paid feature: returning a half-empty match because our
    // upstream allowance ran out is worse than failing loudly.
    if (!rIns.ok) await throwIfRateLimited(rIns, "Compatibility insights");
    if (!rSyn.ok) await throwIfRateLimited(rSyn, "Synastry");

    if (!rIns.ok) console.error("[Compatibility] Insights error:", rIns.status);
    if (!rSyn.ok) console.error("[Compatibility] Synastry error:", rSyn.status);
    // Both parts failed: there is nothing to show. Return null so the caller
    // refunds the charge instead of rendering an empty "0%" match.
    if (!rIns.ok && !rSyn.ok) return null;

    const ins: any = rIns.ok ? unwrap(await rIns.json()) : {};
    const syn: any = rSyn.ok ? unwrap(await rSyn.json()) : {};

    return {
      ...ins,
      ...syn,
      synastry: { ...(ins.synastry || {}), ...(syn.synastry || {}) },
      love_languages: {
        ...(ins.love_languages || {}),
        ...(syn.love_languages || {}),
      },
      dynamics: {
        ...(ins.dynamics || {}),
        ...(syn.dynamics || {}),
        ...(syn.relationship_dynamics || {}),
      },
      compatibility: {
        ...(ins.compatibility || {}),
        ...(syn.compatibility || {}),
      },
      interpretations: syn.interpretations || ins.interpretations || [],
      overall_score:
        ins.overall_score ||
        syn.overall_compatibility ||
        ins.compatibility?.overall_score ||
        0,
    };
  } catch (error) {
    if (error instanceof AstroChartError) throw error;
    console.error("[Compatibility] Error:", error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PDF REPORTS  (/pdf/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /pdf/natal-report — Generate natal chart PDF report. Returns PDF binary. */
export async function getNatalReportPDF(
  birthData: BirthData,
): Promise<ArrayBuffer | null> {
  const res = await apiFetch(`${API_BASE}/pdf/natal-report`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      tradition: "universal",
      language: "en",
    }),
  });
  if (!res.ok) {
    await throwIfRateLimited(res, "Natal report PDF");
    console.warn("Natal report PDF error:", res.status);
    return null;
  }
  return res.arrayBuffer();
}

/** POST /pdf/horoscope/daily — Generate daily horoscope PDF. Returns PDF binary. */
export async function getDailyHoroscopePDF(
  birthData: BirthData,
  date?: string,
  options: HoroscopeSignOptions = {},
): Promise<ArrayBuffer | null> {
  const sign = signAbbrev(resolveHoroscopeSign(birthData, options));

  const res = await apiFetch(`${API_BASE}/pdf/horoscope/daily`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      sign,
      target_date: date || new Date().toISOString().split("T")[0],
      language: "en",
    }),
  });
  if (!res.ok) {
    await throwIfRateLimited(res, "Daily horoscope PDF");
    console.warn("Daily horoscope PDF error:", res.status);
    return null;
  }
  return res.arrayBuffer();
}

/** POST /pdf/horoscope/weekly — Generate weekly horoscope PDF. Returns PDF binary. */
export async function getWeeklyHoroscopePDF(
  birthData: BirthData,
  date?: string,
  options: HoroscopeSignOptions = {},
): Promise<ArrayBuffer | null> {
  const sign = signAbbrev(resolveHoroscopeSign(birthData, options));

  const res = await apiFetch(`${API_BASE}/pdf/horoscope/weekly`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      sign,
      // Spec: WeeklyHoroscopePDFRequest takes `week_start` (normalized to
      // that week's Monday upstream), not `target_date`.
      week_start: date || new Date().toISOString().split("T")[0],
      language: "en",
    }),
  });
  if (!res.ok) {
    await throwIfRateLimited(res, "Weekly horoscope PDF");
    console.warn("Weekly horoscope PDF error:", res.status);
    return null;
  }
  return res.arrayBuffer();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  NUMEROLOGY  (/numerology/*)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Numerology body — spec: SingleSubjectRequest { subject: { name, birth_data } }.
 * The name IS a numerology input (destiny/soul numbers), so it is sent here,
 * unlike the chart endpoints; only the birth date is needed from birth_data.
 */
export function buildNumerologyBody(birthData: BirthData): Record<string, any> {
  const [year, month, day] = birthData.dob.split("-").map(Number);
  return {
    subject: {
      name: birthData.name?.trim() || "Anonymous",
      birth_data: { year, month, day },
    },
  };
}

/** POST /numerology/comprehensive — Full numerology reading. */
export async function getNumerologyReading(birthData: BirthData): Promise<any> {
  const res = await apiFetch(`${API_BASE}/numerology/comprehensive`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(buildNumerologyBody(birthData)),
  });
  if (!res.ok) await throwChartError(res, "Numerology");
  return unwrap(await res.json());
}

/** POST /numerology/core-numbers — Life path, destiny, soul numbers. */
export async function getCoreNumbers(birthData: BirthData): Promise<any> {
  const res = await apiFetch(`${API_BASE}/numerology/core-numbers`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(buildNumerologyBody(birthData)),
  });
  if (!res.ok) await throwChartError(res, "Core numbers");
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAROT  (/tarot/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /tarot/cards/daily — Daily tarot card. */
export async function getDailyTarotCard(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/tarot/cards/daily`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) await throwChartError(res, "Daily tarot");
  return unwrap(await res.json());
}

/** POST /tarot/reports/three-card — Three card reading. */
export async function getThreeCardReading(question?: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/tarot/reports/three-card`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      question: question || "What does the universe want me to know today?",
    }),
  });
  if (!res.ok) await throwChartError(res, "Three card reading");
  return unwrap(await res.json());
}

/** POST /tarot/cards/draw — Draw N tarot cards. */
export async function drawTarotCards(count: number = 3): Promise<any> {
  const res = await apiFetch(`${API_BASE}/tarot/cards/draw`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ count }),
  });
  if (!res.ok) await throwChartError(res, "Draw tarot");
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  NUMEROLOGY COMPATIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /numerology/compatibility — Numerology compatibility between two people. */
export async function getNumerologyCompatibility(
  person1: BirthData,
  person2: BirthData,
): Promise<any> {
  const [y1, m1, d1] = person1.dob.split("-").map(Number);
  const [y2, m2, d2] = person2.dob.split("-").map(Number);
  const res = await apiFetch(`${API_BASE}/numerology/compatibility`, {
    method: "POST",
    headers: getHeaders(),
    // Spec: MultipleSubjectsRequest { subjects: Subject[] }.
    body: JSON.stringify({
      subjects: [
        {
          name: person1.name || "Person 1",
          birth_data: { year: y1, month: m1, day: d1 },
        },
        {
          name: person2.name || "Person 2",
          birth_data: { year: y2, month: m2, day: d2 },
        },
      ],
    }),
  });
  if (!res.ok) await throwChartError(res, "Numerology compatibility");
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ECLIPSE INTERPRETATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /eclipses/interpretation — Interpretation of one eclipse. Spec:
 * EclipseInterpretationRequest requires `eclipse_id` (NASA-format id, as listed
 * by /eclipses/upcoming), not a date.
 */
export async function getEclipseInterpretation(
  eclipseId: string,
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/eclipses/interpretation`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ eclipse_id: eclipseId, language: "en" }),
  });
  if (!res.ok) await throwChartError(res, "Eclipse interpretation");
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ASTROCARTOGRAPHY  (/astrocartography/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /astrocartography/lines — Get astrocartography planetary lines. */
export async function getAstrocartographyLines(
  birthData: BirthData,
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/astrocartography/lines`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) await throwChartError(res, "Astrocartography lines");
  return unwrap(await res.json());
}

/** POST /astrocartography/power-zones — Find power zones on the globe. */
export async function getPowerZones(birthData: BirthData): Promise<any> {
  const res = await apiFetch(`${API_BASE}/astrocartography/power-zones`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) await throwChartError(res, "Power zones");
  return unwrap(await res.json());
}

/** POST /astrocartography/location-analysis — Analyze a specific location. */
export async function getLocationAnalysis(
  birthData: BirthData,
  lat: number,
  lng: number,
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/astrocartography/location-analysis`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      location: { latitude: lat, longitude: lng },
    }),
  });
  if (!res.ok) await throwChartError(res, "Location analysis");
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  WELLNESS  (/insights/wellness/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /insights/wellness/biorhythms — Calculate biorhythm cycles. */
export async function getBiorhythms(
  birthData: BirthData,
  targetDate?: string,
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/insights/wellness/biorhythms`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      // Biorhythms are per-day, so the caller's local day matters. See the
      // date convention note at the top of this file.
      target_date: targetDate || new Date().toISOString().split("T")[0],
    }),
  });
  if (!res.ok) await throwChartError(res, "Biorhythms");
  return unwrap(await res.json());
}

/** POST /insights/wellness/wellness-score — Overall wellness score. */
export async function getWellnessScore(birthData: BirthData): Promise<any> {
  const res = await apiFetch(`${API_BASE}/insights/wellness/wellness-score`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) await throwChartError(res, "Wellness score");
  return unwrap(await res.json());
}

/** POST /insights/wellness/energy-patterns — Daily energy patterns. */
export async function getEnergyPatterns(birthData: BirthData): Promise<any> {
  const res = await apiFetch(`${API_BASE}/insights/wellness/energy-patterns`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) await throwChartError(res, "Energy patterns");
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HUMAN DESIGN  (/human-design/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /human-design/type — Get Human Design type. */
export async function getHumanDesignType(birthData: BirthData): Promise<any> {
  const res = await apiFetch(`${API_BASE}/human-design/type`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) await throwChartError(res, "HD type");
  return unwrap(await res.json());
}

/** POST /human-design/bodygraph — Calculate full bodygraph. */
export async function getBodygraph(birthData: BirthData): Promise<any> {
  const res = await apiFetch(`${API_BASE}/human-design/bodygraph`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) await throwChartError(res, "Bodygraph");
  return unwrap(await res.json());
}

/** POST /human-design/bodygraph-svg — Render bodygraph as SVG. */
export async function getBodygraphSVG(birthData: BirthData): Promise<string> {
  const res = await apiFetch(`${API_BASE}/human-design/bodygraph-svg`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) await throwChartError(res, "Bodygraph SVG");
  return res.text();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ADVANCED VEDIC  (/vedic/shadbala, /vedic/varshaphal)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /vedic/shadbala — Six-fold planetary strength. */
export async function getShadbala(birthData: BirthData): Promise<any> {
  const res = await apiFetch(`${API_BASE}/vedic/shadbala`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      options: VEDIC_OPTIONS,
    }),
  });
  if (!res.ok) await throwChartError(res, "Shadbala");
  return unwrap(await res.json());
}

/** POST /vedic/varshaphal — Annual solar return chart. */
export async function getVarshaphal(
  birthData: BirthData,
  year?: number,
): Promise<any> {
  const res = await apiFetch(`${API_BASE}/vedic/varshaphal`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      // Spec: VedicVarshaphalRequest requires `target_year` (not `year`).
      target_year: year || new Date().getFullYear(),
      options: VEDIC_OPTIONS,
    }),
  });
  if (!res.ok) await throwChartError(res, "Varshaphal");
  return unwrap(await res.json());
}
