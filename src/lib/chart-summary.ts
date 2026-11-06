/**
 * Chart summary helpers shared by the dashboard ("Your chart in three lines")
 * and the chart views (Lagna resolution).
 *
 * The D1 response carries the ascendant in `ascendant` (and sometimes as a
 * house-1 cusp), NOT as an "Ascendant" entry in planetary_positions — reading
 * only the latter is why the Observatory showed "Lagna: Unknown".
 */
import { ZODIAC_SIGNS } from "./astrology.js";

interface SignedPoint {
  name?: string;
  sign?: string;
  signCode?: string;
  degree?: number;
  house?: number;
  nakshatra?: unknown;
}

export interface ChartLike {
  planetary_positions?: SignedPoint[];
  house_cusps?: Array<{
    house: number;
    sign?: string;
    signCode?: string;
    degree?: number;
  }>;
  ascendant?:
    { sign?: string; signCode?: string; degree?: number } | string | null;
  /** Set by /api/kundali when the birth time is unknown (no Lagna/houses). */
  timeUnknown?: boolean;
}

/** "Ari", "Aries", "aries", "Mesha" → "Ari"; unknown → null. */
export function normalizeSignCode(sign: unknown): string | null {
  if (typeof sign !== "string") return null;
  const s = sign.trim().toLowerCase();
  if (!s) return null;
  const match = ZODIAC_SIGNS.find(
    (z) =>
      z.code.toLowerCase() === s ||
      z.western.toLowerCase() === s ||
      z.name.toLowerCase() === s ||
      z.western.toLowerCase().slice(0, 3) === s.slice(0, 3),
  );
  return match ? match.code : null;
}

export interface ResolvedAscendant {
  code: string;
  /** Degree within the sign (0–30). */
  degree: number;
  /** Sidereal Vedic name, e.g. "Mesha". */
  name: string;
  /** Western name, e.g. "Aries". */
  western: string;
}

export function resolveAscendant(
  data: ChartLike | null | undefined,
): ResolvedAscendant | null {
  if (!data) return null;
  const candidates: Array<{ sign?: unknown; degree?: unknown }> = [];

  const asPoint = data.planetary_positions?.find(
    (p) =>
      typeof p?.name === "string" && /^(ascendant|lagna|asc)$/i.test(p.name),
  );
  if (asPoint)
    candidates.push({
      sign: asPoint.signCode || asPoint.sign,
      degree: asPoint.degree,
    });

  if (typeof data.ascendant === "string") {
    candidates.push({ sign: data.ascendant, degree: 0 });
  } else if (data.ascendant) {
    candidates.push({
      sign: data.ascendant.signCode || data.ascendant.sign,
      degree: data.ascendant.degree,
    });
  }

  const firstHouse = data.house_cusps?.find((h) => Number(h?.house) === 1);
  if (firstHouse)
    candidates.push({
      sign: firstHouse.signCode || firstHouse.sign,
      degree: firstHouse.degree,
    });

  for (const c of candidates) {
    const code = normalizeSignCode(c.sign);
    if (!code) continue;
    const sign = ZODIAC_SIGNS.find((z) => z.code === code)!;
    const raw =
      typeof c.degree === "number" && Number.isFinite(c.degree) ? c.degree : 0;
    // Some payloads give absolute longitude (0–360) rather than in-sign degrees.
    const degree = raw >= 30 ? raw % 30 : Math.max(raw, 0);
    return { code, degree, name: sign.name, western: sign.western };
  }
  return null;
}

/** Moon sign (code) from a D1 chart. */
export function resolveMoon(
  data: ChartLike | null | undefined,
): { code: string; nakshatra: string | null } | null {
  const moon = data?.planetary_positions?.find(
    (p) => typeof p?.name === "string" && /^(moon|chandra)$/i.test(p.name),
  );
  const code = normalizeSignCode(moon?.signCode || moon?.sign);
  if (!code) return null;
  return { code, nakshatra: nakshatraName(moon?.nakshatra) };
}

const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
  "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
  "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada",
  "Revati",
];

/** Nakshatra of a sidereal position from its sign code and in-sign degree. */
export function nakshatraFromPosition(
  code: string,
  degree: unknown,
): string | null {
  const idx = ZODIAC_SIGNS.findIndex((z) => z.code === code);
  if (idx < 0 || typeof degree !== "number" || !Number.isFinite(degree))
    return null;
  const inSign = degree >= 30 ? degree % 30 : Math.max(degree, 0);
  return NAKSHATRAS[Math.floor((idx * 30 + inSign) / (360 / 27)) % 27];
}

export interface ProfileSigns {
  /** Western name of the sidereal Moon sign (the rashi), e.g. "Taurus". */
  moonSign: string;
  sunSign?: string;
  moonNakshatra?: string;
}

/**
 * Sidereal Moon/Sun signs and the Moon's nakshatra from a *Vedic* D1 chart,
 * for profile.moonSign / profile.sunSign / profile.moonNakshatra. Null when the
 * chart has no Moon. Never call it with a Western (tropical) chart.
 */
export function deriveProfileSigns(
  data: ChartLike | null | undefined,
): ProfileSigns | null {
  const planets = data?.planetary_positions ?? [];
  const find = (re: RegExp) =>
    planets.find((p) => typeof p?.name === "string" && re.test(p.name));
  const moon = find(/^(moon|chandra)$/i);
  const moonCode = normalizeSignCode(moon?.signCode || moon?.sign);
  if (!moon || !moonCode) return null;
  const sun = find(/^(sun|surya)$/i);
  const sunCode = normalizeSignCode(sun?.signCode || sun?.sign);
  const western = (code: string) =>
    ZODIAC_SIGNS.find((z) => z.code === code)!.western;
  const nakshatra =
    nakshatraName(moon.nakshatra) ??
    nakshatraFromPosition(moonCode, moon.degree);
  return {
    moonSign: western(moonCode),
    ...(sunCode ? { sunSign: western(sunCode) } : {}),
    ...(nakshatra ? { moonNakshatra: nakshatra } : {}),
  };
}

function nakshatraName(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    const name = v.name ?? v.nakshatra ?? v.nakshatra_name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return null;
}

const MOON_MEANING: Record<string, string> = {
  Ari: "you feel fast and honestly, and recover by moving",
  Tau: "you need steadiness, comfort and time to feel safe",
  Gem: "you process feelings by talking and thinking them through",
  Can: "you feel deeply and care for people as your way of loving",
  Leo: "you need warmth, recognition and a heart that is seen",
  Vir: "you settle your mind by putting things in order",
  Lib: "you seek balance and feel best in fair, calm relationships",
  Sco: "you feel intensely and trust slowly, but completely",
  Sag: "you need meaning, freedom and something to believe in",
  Cap: "you hold emotions with discipline and quiet responsibility",
  Aqu: "you need space and feel through ideas and ideals",
  Pis: "you are sensitive, intuitive and absorb the mood around you",
};

const LAGNA_MEANING: Record<string, string> = {
  Ari: "you meet life head-on, as an initiator",
  Tau: "you meet life patiently, building what lasts",
  Gem: "you meet life curious, through words and connections",
  Can: "you meet life protectively, leading with care",
  Leo: "you meet life with presence, as a natural centre",
  Vir: "you meet life carefully, through skill and service",
  Lib: "you meet life diplomatically, seeking harmony",
  Sco: "you meet life with depth, reading what lies beneath",
  Sag: "you meet life optimistically, as a seeker",
  Cap: "you meet life with resolve, climbing step by step",
  Aqu: "you meet life independently, thinking for the many",
  Pis: "you meet life gently, guided by intuition",
};

const DASHA_MEANING: Record<string, string> = {
  Sun: "a chapter about purpose, confidence and stepping forward",
  Moon: "a chapter about feelings, home and inner security",
  Mars: "a chapter about courage, effort and drawing boundaries",
  Mercury: "a chapter about learning, communication and skill",
  Jupiter: "a chapter about growth, wisdom and good counsel",
  Venus: "a chapter about relationships, beauty and enjoying life",
  Saturn: "a chapter about patience, responsibility and earned strength",
  Rahu: "a chapter of ambition, new territory and restless hunger",
  Ketu: "a chapter of letting go, inner work and detachment",
};

function planetKey(planet: string): string | null {
  const p = planet.trim().toLowerCase();
  const map: Record<string, string> = {
    sun: "Sun",
    surya: "Sun",
    moon: "Moon",
    chandra: "Moon",
    mars: "Mars",
    mangal: "Mars",
    mercury: "Mercury",
    budha: "Mercury",
    jupiter: "Jupiter",
    guru: "Jupiter",
    venus: "Venus",
    shukra: "Venus",
    saturn: "Saturn",
    shani: "Saturn",
    rahu: "Rahu",
    mean_node: "Rahu",
    true_node: "Rahu",
    "north node": "Rahu",
    ketu: "Ketu",
    mean_south_node: "Ketu",
    "south node": "Ketu",
  };
  return map[p] ?? null;
}

export interface ChartLine {
  label: string;
  value: string;
  meaning: string;
}

export interface ThreeLinesInput {
  kundali: ChartLike | null | undefined;
  /** Birth star from the NAKSHATRA reading, used when D1 has none. */
  nakshatra?: string | null;
  dashaPeriods?: Array<{
    planet: string;
    endDate?: string;
    isCurrent?: boolean;
  }> | null;
  /** The profile says the birth time is unknown (noon placeholder). */
  birthTimeUnknown?: boolean;
}

function signLabel(code: string): string {
  const s = ZODIAC_SIGNS.find((z) => z.code === code)!;
  return `${s.western} (${s.name})`;
}

/**
 * Up to three plain-language lines — Moon sign + nakshatra, Lagna, current
 * Mahadasha — built only from data the dashboard already fetched.
 */
export function buildChartThreeLines(input: ThreeLinesInput): ChartLine[] {
  const lines: ChartLine[] = [];

  const moon = resolveMoon(input.kundali);
  if (moon) {
    const star =
      moon.nakshatra ||
      (input.nakshatra && input.nakshatra !== "Unknown"
        ? input.nakshatra
        : null);
    lines.push({
      label: "Moon",
      value: `${signLabel(moon.code)}${star ? ` · ${star} nakshatra` : ""}`,
      meaning: `Emotionally, ${MOON_MEANING[moon.code]}.`,
    });
  }

  const timeUnknown =
    Boolean(input.birthTimeUnknown) || Boolean(input.kundali?.timeUnknown);
  const lagna = timeUnknown ? null : resolveAscendant(input.kundali);
  if (timeUnknown && input.kundali) {
    lines.push({
      label: "Lagna",
      value: "Rising sign needs an exact birth time",
      meaning:
        "Add your birth time to see how you meet the world — your Moon and planets are already read.",
    });
  } else if (lagna) {
    lines.push({
      label: "Lagna",
      value: `${lagna.western} (${lagna.name}) rising`,
      meaning: `Outwardly, ${LAGNA_MEANING[lagna.code]}.`,
    });
  }

  const current = input.dashaPeriods?.find((p) => p.isCurrent);
  const key = current ? planetKey(current.planet) : null;
  if (current && key) {
    const until = current.endDate ? new Date(current.endDate) : null;
    const untilText =
      until && !Number.isNaN(until.getTime())
        ? ` until ${until.getFullYear()}`
        : "";
    lines.push({
      label: "Mahadasha",
      // Without a birth time the dasha dates can be years off.
      value: timeUnknown ? `${key} (approximate)` : `${key}${untilText}`,
      meaning: `You are in ${DASHA_MEANING[key]}.`,
    });
  }

  return lines;
}
