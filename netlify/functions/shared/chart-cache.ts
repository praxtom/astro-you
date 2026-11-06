/**
 * Server-side cache policy for per-birth-data chart types on /api/kundali.
 *
 * A natal chart never changes for the same birth moment and place, yet the
 * dashboard used to spend several paid upstream calls on every load against a
 * small monthly quota. Responses are cached in the admin-only Firestore
 * collection CHART_CACHE_COLLECTION (no client rule matches it, so Firestore
 * denies all client access) keyed by a hash of the calculation inputs.
 *
 * The subject name is deliberately NOT part of the key: astro-api.ts never
 * sends the real name upstream (buildSubject uses a fixed placeholder), so the
 * response cannot depend on — or leak — it.
 *
 * Pure module (no Firebase import) so it can be unit-tested.
 */
import { createHash } from "node:crypto";

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

export function isDailyChartType(chartType: string): boolean {
  return DAILY_CHART_TYPES.has(chartType);
}

export interface ChartCacheKeyInput {
  chartType: string;
  dob: string;
  tob: string;
  lat?: number | null;
  lng?: number | null;
  /** Only part of the key when coordinates are missing (then the place is geocoded upstream). */
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

/**
 * Deterministic Firestore doc id for a chart request: the chart type in clear
 * (for ops visibility) plus a SHA-256 of the calculation inputs — so birth data
 * never appears in a document id.
 */
export function chartCacheKey(input: ChartCacheKeyInput): string {
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
    hasCoords
      ? `loc=${lat},${lng}`
      : `pob=${(input.pob ?? "").trim().toLowerCase().replace(/\s+/g, " ")}`,
    `mode=${input.zodiacMode ?? "vedic"}`,
    ...(input.birthTimeUnknown ? ["time=unknown"] : []),
    ...variantEntries,
  ];
  const digest = createHash("sha256").update(parts.join("|")).digest("hex");
  return `${input.chartType}_${digest.slice(0, 40)}`;
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
