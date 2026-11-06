/**
 * Server-side cache policy for per-birth-data chart types on /api/kundali.
 *
 * A natal chart never changes for the same birth moment and place, yet the
 * dashboard used to spend several paid upstream calls on every load against a
 * small monthly quota. Responses are cached in the admin-only Firestore
 * collection CHART_CACHE_COLLECTION (no client rule matches it, so Firestore
 * denies all client access) keyed by a keyed hash (HMAC) of the calculation
 * inputs — the key cannot be brute-forced back to a birth moment without the
 * server secret. Docs carry an `expiresAt` Timestamp that a Firestore TTL
 * policy uses to delete them, and payloads are stripped of any echoed birth
 * inputs before they are written (stripEchoedBirthInputs).
 *
 * The subject name is NOT part of the key for chart types computed from the
 * birth moment alone: buildSubject sends a fixed placeholder name upstream, so
 * those responses cannot depend on — or leak — it. Numerology is the exception
 * (buildNumerologyBody sends the real name and the result is derived from it):
 * NAME_DEPENDENT_CHART_TYPES add the normalized name to the hashed key so two
 * people sharing a birth moment never receive each other's reading.
 *
 * Pure module (no Firebase import) so it can be unit-tested.
 */
import { createHmac } from "node:crypto";

export const CHART_CACHE_COLLECTION = "chart_cache";

const HOURS_PER_DAY = 24;
/** Natal data is fixed for a birth moment; refresh twice a year to pick up upstream fixes. */
export const NATAL_TTL_HOURS = 180 * HOURS_PER_DAY;
/** Transit-dependent readings (Saturn over the natal Moon) drift slowly but do drift. */
export const TRANSIT_TTL_HOURS = 24;
/** Readings computed for "today" — also keyed by the requested date. */
export const DAILY_TTL_HOURS = 20;

/** Chart types whose response depends only on the birth data (+ variant params). */
const NATAL_CHART_TYPES = new Set([
  "D1",
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
  // Dasha periods are fixed by birth; the "current" flags are recomputed on
  // every read (see refreshDashaCurrentFlags) so a long TTL is safe.
  "DASHAS",
  "YOGAS",
  "REMEDIES",
  "MANGLIK",
  "KAAL_SARPA",
  "NAKSHATRA",
  "ASHTAKVARGA",
  "SHADBALA",
  "NUMEROLOGY",
  "CORE_NUMBERS",
  "HUMAN_DESIGN",
  "BODYGRAPH",
  "ASTRO_LINES",
  "POWER_ZONES",
  "LOCATION_ANALYSIS",
  "VARSHAPHAL",
]);

/** Chart types whose upstream request includes (and whose result depends on) the person's name. */
export const NAME_DEPENDENT_CHART_TYPES = new Set([
  "NUMEROLOGY",
  "CORE_NUMBERS",
]);

/** Normalized name for cache keys: case/space-insensitive, matching the upstream "Anonymous" default. */
export function normalizeSubjectName(name: unknown): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  return (trimmed || "Anonymous").toLowerCase().replace(/\s+/g, " ");
}

const TRANSIT_CHART_TYPES = new Set(["SADE_SATI", "ECLIPSE_IMPACT"]);

const DAILY_CHART_TYPES = new Set([
  "LUNAR_PHASES",
  "BIORHYTHMS",
  "WELLNESS_SCORE",
  "ENERGY_PATTERNS",
]);

/**
 * TTL in hours for a cacheable chart type, or null when the type must not be
 * cached (binary/SVG/PDF payloads, real-time readings, unknown types).
 */
export function chartCacheTtlHours(chartType: string): number | null {
  if (NATAL_CHART_TYPES.has(chartType)) return NATAL_TTL_HOURS;
  if (TRANSIT_CHART_TYPES.has(chartType)) return TRANSIT_TTL_HOURS;
  if (DAILY_CHART_TYPES.has(chartType)) return DAILY_TTL_HOURS;
  return null;
}

/** When a cache doc written at `cachedAt` expires (Firestore TTL `expiresAt`). */
export function cacheExpiresAt(cachedAt: Date, ttlHours: number): Date {
  return new Date(cachedAt.getTime() + ttlHours * 60 * 60 * 1000);
}

export function isDailyChartType(chartType: string): boolean {
  return DAILY_CHART_TYPES.has(chartType);
}

export interface ChartCacheKeyInput {
  chartType: string;
  dob: string;
  tob: string;
  lat?: number | null;
  lng?: number | null;
  /**
   * Always part of the key: the upstream receives `city: pob` alongside the
   * coordinates and uses it for the timezone lookup, so a mismatched place
   * label can change the chart and must only ever serve itself.
   */
  pob?: string | null;
  zodiacMode?: string;
  /**
   * The birth time is a placeholder (noon), so the response is shaped
   * differently (no Lagna/houses, approximate dashas). Only keyed when true,
   * so every existing known-time entry keeps its id.
   */
  birthTimeUnknown?: boolean;
  /** Extra request parameters that change the response (remedyType, year, target, date). */
  variant?: Record<string, string | number | null | undefined>;
}

function roundCoordinate(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  // 4 decimals ≈ 11 m — far below anything that moves a chart.
  return value.toFixed(4);
}

type Env = Record<string, string | undefined>;

const MIN_SECRET_CHARS = 32;
/** Fixed label: rotating it (v2) invalidates every cache key at once. */
const CACHE_KEY_LABEL = "astroyou:chart-cache-key:v1";
/** Unkeyed fallback for tests/local dev without OTP_HASH_SECRET. */
const DEV_FALLBACK_KEY = "astroyou-dev-only-chart-cache-key";

let memoBase: string | undefined;
let memoKey: string | undefined;

/**
 * HMAC key for cache doc ids, derived from OTP_HASH_SECRET (already required
 * for launch) with a fixed label — same pattern as shared/internal-dispatch.
 */
export function resolveChartCacheKeySecret(env: Env = process.env): string {
  const base = env.OTP_HASH_SECRET?.trim();
  if (!base || base.length < MIN_SECRET_CHARS) return DEV_FALLBACK_KEY;
  if (memoBase !== base) {
    memoBase = base;
    memoKey = createHmac("sha256", base).update(CACHE_KEY_LABEL).digest("hex");
  }
  return memoKey!;
}

function keyedDigest(material: string, env: Env): string {
  return createHmac("sha256", resolveChartCacheKeySecret(env))
    .update(material)
    .digest("hex");
}

function normalizePlace(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/\s+/g, " ")
    : "";
}

/**
 * Deterministic Firestore doc id for a chart request: the chart type in clear
 * (for ops visibility) plus an HMAC of the calculation inputs — so birth data
 * never appears in a document id and cannot be recovered from one.
 */
export function chartCacheKey(
  input: ChartCacheKeyInput,
  env: Env = process.env,
): string {
  const lat = roundCoordinate(input.lat);
  const lng = roundCoordinate(input.lng);
  const hasCoords = lat !== null && lng !== null;
  const variantEntries = Object.entries(input.variant ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`);

  const parts = [
    `type=${input.chartType}`,
    `dob=${input.dob.trim()}`,
    // "06:30" and "06:30:00" are the same birth moment.
    `tob=${input.tob.trim().slice(0, 5)}`,
    ...(hasCoords ? [`loc=${lat},${lng}`] : []),
    `pob=${normalizePlace(input.pob)}`,
    `mode=${input.zodiacMode ?? "vedic"}`,
    ...(input.birthTimeUnknown ? ["time=unknown"] : []),
    ...variantEntries,
  ];
  const digest = keyedDigest(parts.join("|"), env);
  return `${input.chartType}_${digest.slice(0, 40)}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** True for a real calendar date (YYYY-MM-DD) between 1900 and 2100. */
export function isCalendarDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(ms) || utcDateKey(ms) !== value) return false;
  const year = Number(value.slice(0, 4));
  return year >= 1900 && year <= 2100;
}

/**
 * The client's "today", trusted only within one day of the server's UTC day
 * (covers every real timezone). Anything else — a missing, malformed or
 * far-off date that would plant a cache entry under a day it was not computed
 * for — falls back to the server's UTC date.
 */
export function clampedTodayKey(
  value: unknown,
  nowMs: number = Date.now(),
): string {
  const today = utcDateKey(nowMs);
  if (!isCalendarDateKey(value)) return today;
  const allowed = [nowMs - DAY_MS, nowMs, nowMs + DAY_MS].map(utcDateKey);
  return allowed.includes(value) ? value : today;
}

/** The server's UTC date — for readings the upstream computes for "now". */
export function serverDateKey(nowMs: number = Date.now()): string {
  return utcDateKey(nowMs);
}

/** Panchang defaults when the caller gives no place (also the upstream default). */
export const DEFAULT_PANCHANG_PLACE = Object.freeze({
  city: "New Delhi",
  lat: 28.6139,
  lng: 77.209,
});

export interface PanchangPlace {
  city: string;
  lat: number;
  lng: number;
}

function finiteInRange(value: unknown, limit: number): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= limit
    ? value
    : undefined;
}

/**
 * The exact place a panchang is computed for — city label AND coordinates,
 * both sent upstream — so the cache key covers everything the result depends
 * on. Coordinates are rounded to 3 decimals (~110 m, far below anything that
 * moves sunrise) and the rounded values are what is sent upstream.
 */
export function resolvePanchangPlace(input: {
  city?: unknown;
  lat?: unknown;
  lng?: unknown;
}): PanchangPlace {
  const city =
    typeof input.city === "string" && input.city.trim()
      ? input.city.trim().replace(/\s+/g, " ").slice(0, 100)
      : DEFAULT_PANCHANG_PLACE.city;
  const lat = finiteInRange(input.lat, 90);
  const lng = finiteInRange(input.lng, 180);
  const hasCoords = lat !== undefined && lng !== undefined;
  return {
    city,
    lat: Number((hasCoords ? lat : DEFAULT_PANCHANG_PLACE.lat).toFixed(3)),
    lng: Number((hasCoords ? lng : DEFAULT_PANCHANG_PLACE.lng).toFixed(3)),
  };
}

/**
 * Doc id in the (authenticated-readable) `panchang` collection: the date in
 * clear plus an HMAC of the place, so a listing never reveals where users are.
 */
export function panchangCacheDocId(
  dateKey: string,
  place: PanchangPlace,
  env: Env = process.env,
): string {
  const material = [
    "panchang",
    dateKey,
    normalizePlace(place.city),
    place.lat.toFixed(3),
    place.lng.toFixed(3),
  ].join("|");
  return `${dateKey}_${keyedDigest(material, env).slice(0, 32)}`;
}

/**
 * Keys under which an upstream response echoes the request's birth inputs
 * (subject name, date/time, place, coordinates). Never cached, never served
 * from the cache — only computed fields are kept.
 */
const ECHOED_INPUT_KEYS = new Set([
  "subject",
  "subject_data",
  "subjectData",
  "natal_subject",
  "birth_data",
  "birthData",
  "birth_details",
  "datetime_location",
  "input",
  "input_data",
  "request",
]);
const MAX_SANITIZE_DEPTH = 12;

/** A copy of `payload` with every echoed birth-input subtree removed. */
export function stripEchoedBirthInputs<T>(payload: T, depth = 0): T {
  if (
    depth > MAX_SANITIZE_DEPTH ||
    payload === null ||
    typeof payload !== "object"
  ) {
    return payload;
  }
  if (Array.isArray(payload)) {
    return payload.map((item) => stripEchoedBirthInputs(item, depth + 1)) as T;
  }
  if (Object.getPrototypeOf(payload) !== Object.prototype) return payload;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    payload as Record<string, unknown>,
  )) {
    if (ECHOED_INPUT_KEYS.has(key)) continue;
    out[key] = stripEchoedBirthInputs(value, depth + 1);
  }
  return out as T;
}

interface DatedPeriod {
  planet?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  subPeriods?: DatedPeriod[];
}

/**
 * The `current_period` summary /vedic/vimshottari-dasha returns (spec:
 * VedicDashaResponse) — the running Mahadasha/Antardasha at `target_date`.
 */
export interface DashaCurrentPeriod {
  mahadasha?: string;
  mahadasha_end?: string;
  antardasha?: string;
  antardasha_end?: string;
}

function isCurrentAt(period: DatedPeriod, now: number): boolean | null {
  const start = Date.parse(period.startDate ?? "");
  const end = Date.parse(period.endDate ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return start <= now && now < end;
}

const DASHA_LORD_ALIASES: Record<string, string> = {
  mean_node: "rahu",
  true_node: "rahu",
  "north node": "rahu",
  mean_south_node: "ketu",
  true_south_node: "ketu",
  "south node": "ketu",
};

function dashaLord(name: unknown): string {
  const key = typeof name === "string" ? name.trim().toLowerCase() : "";
  return DASHA_LORD_ALIASES[key] ?? key;
}

/**
 * Index of the period ruled by `lord` (disambiguated by its end date when the
 * lord repeats), or -1 when no period matches.
 */
function findNamedPeriod(
  periods: DatedPeriod[],
  lord: string | undefined,
  end: string | undefined,
  now: number,
): number {
  const target = dashaLord(lord);
  if (!target) return -1;
  const matches = periods
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => dashaLord(p.planet) === target);
  if (matches.length === 0) return -1;
  if (matches.length === 1) return matches[0].i;
  const endDay = typeof end === "string" ? end.slice(0, 10) : "";
  const byEnd = endDay
    ? matches.find(({ p }) => (p.endDate ?? "").slice(0, 10) === endDay)
    : undefined;
  if (byEnd) return byEnd.i;
  const byDate = matches.find(({ p }) => isCurrentAt(p, now) === true);
  return (byDate ?? matches[0]).i;
}

/**
 * Mark the running Mahadasha (and its running Antardasha) — the single place
 * the dasha "current" flags are decided, used on a fresh upstream fetch and on
 * every cache read.
 *
 * Priority: the upstream `current_period` summary when given and it names a
 * period in the list; otherwise each period's start/end dates against `now`;
 * periods without parseable dates keep whatever flag they already carry.
 */
export function markCurrentDashaPeriods<T extends DatedPeriod>(
  periods: T[],
  options: { now?: number; currentPeriod?: DashaCurrentPeriod | null } = {},
): T[] {
  if (!Array.isArray(periods)) return periods;
  const now = options.now ?? Date.now();
  const hint = options.currentPeriod ?? null;

  const byDates = periods.map((period) => {
    const current = isCurrentAt(period, now);
    const subPeriods = Array.isArray(period.subPeriods)
      ? period.subPeriods.map((sub) => {
          const subCurrent = isCurrentAt(sub, now);
          return subCurrent === null ? sub : { ...sub, isCurrent: subCurrent };
        })
      : period.subPeriods;
    return {
      ...period,
      ...(current === null ? {} : { isCurrent: current }),
      ...(subPeriods ? { subPeriods } : {}),
    } as T;
  });

  const mahaIndex = hint
    ? findNamedPeriod(byDates, hint.mahadasha, hint.mahadasha_end, now)
    : -1;
  if (mahaIndex < 0) return byDates;

  return byDates.map((period, i) => {
    const isMaha = i === mahaIndex;
    let subPeriods = period.subPeriods;
    if (isMaha && Array.isArray(subPeriods) && hint?.antardasha) {
      const subIndex = findNamedPeriod(
        subPeriods,
        hint.antardasha,
        hint.antardasha_end,
        now,
      );
      if (subIndex >= 0) {
        subPeriods = subPeriods.map((sub, j) => ({
          ...sub,
          isCurrent: j === subIndex,
        }));
      }
    } else if (!isMaha && Array.isArray(subPeriods)) {
      subPeriods = subPeriods.map((sub) => ({ ...sub, isCurrent: false }));
    }
    return {
      ...period,
      isCurrent: isMaha,
      ...(subPeriods ? { subPeriods } : {}),
    };
  });
}

/**
 * Recompute the isCurrent flags of cached dasha periods against `now`, so a
 * months-old cache entry still reports the right running Mahadasha/Antardasha.
 * Periods without parseable dates keep whatever flag they were cached with.
 * (Date-only form of markCurrentDashaPeriods.)
 */
export function refreshDashaCurrentFlags<T extends DatedPeriod>(
  periods: T[],
  now: number = Date.now(),
): T[] {
  return markCurrentDashaPeriods(periods, { now });
}

/**
 * Chart types guests (no account) may request — the basic natal set used by
 * the SEO acquisition pages, guest chat, and the guest dashboard's "chart in
 * three lines", dasha and birth-star cards. Everything else needs sign-in.
 */
export const GUEST_CHART_TYPES: ReadonlySet<string> = new Set([
  "D1",
  "DASHAS",
  "NAKSHATRA",
]);

export function isGuestChartType(chartType: unknown): boolean {
  return GUEST_CHART_TYPES.has(String(chartType));
}
