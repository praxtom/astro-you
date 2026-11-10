/**
 * Plain-language meanings for astrocartography lines and power zones returned
 * by /astrocartography/lines and /astrocartography/power-zones.
 *
 * Line meanings are generated from a planet-theme map × an angle map rather
 * than hand-writing every planet/angle pair. Keys are normalised (case,
 * spaces, underscores, hyphens, long names like "Midheaven" or "Rahu") and
 * unknown values return null so the page shows nothing extra.
 *
 * Copy rules: neutral, everyday language, never fear-based.
 */

function norm(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .toLowerCase()
    .replace(/[_\-/,.:;()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type PlanetKey =
  | "sun"
  | "moon"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto"
  | "rahu"
  | "ketu"
  | "chiron";

const PLANET_ALIASES: Record<string, PlanetKey> = {
  sun: "sun",
  surya: "sun",
  moon: "moon",
  chandra: "moon",
  mercury: "mercury",
  budha: "mercury",
  budh: "mercury",
  venus: "venus",
  shukra: "venus",
  mars: "mars",
  mangal: "mars",
  jupiter: "jupiter",
  guru: "jupiter",
  brihaspati: "jupiter",
  saturn: "saturn",
  shani: "saturn",
  uranus: "uranus",
  neptune: "neptune",
  pluto: "pluto",
  rahu: "rahu",
  "north node": "rahu",
  "true node": "rahu",
  "mean node": "rahu",
  "true north node": "rahu",
  "mean north node": "rahu",
  ketu: "ketu",
  "south node": "ketu",
  "true south node": "ketu",
  "mean south node": "ketu",
  chiron: "chiron",
};

const PLANET_NAMES: Record<PlanetKey, string> = {
  sun: "Sun",
  moon: "Moon",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
  pluto: "Pluto",
  rahu: "Rahu",
  ketu: "Ketu",
  chiron: "Chiron",
};

/** Three-part theme, always a plural list so "… show up in …" reads right. */
const PLANET_THEMES: Record<PlanetKey, string> = {
  sun: "confidence, visibility and a sense of purpose",
  moon: "comfort, feeling and belonging",
  mercury: "ideas, learning and good conversation",
  venus: "charm, beauty and ease",
  mars: "drive, courage and directness",
  jupiter: "growth, opportunity and generosity",
  saturn: "patience, focus and steady effort",
  uranus: "change, freedom and fresh ideas",
  neptune: "imagination, intuition and compassion",
  pluto: "depth, renewal and inner strength",
  rahu: "curiosity, ambition and new experiences",
  ketu: "reflection, letting go and spiritual insight",
  chiron: "healing, empathy and wisdom from experience",
};

/** One-word-ish theme used when several planets meet in a power zone. */
const PLANET_SHORT_THEMES: Record<PlanetKey, string> = {
  sun: "confidence",
  moon: "belonging",
  mercury: "learning",
  venus: "love",
  mars: "drive",
  jupiter: "growth",
  saturn: "steady progress",
  uranus: "fresh starts",
  neptune: "imagination",
  pluto: "renewal",
  rahu: "ambition",
  ketu: "reflection",
  chiron: "healing",
};

type AngleKey = "AC" | "MC" | "DS" | "IC";

const ANGLE_ALIASES: Record<string, AngleKey> = {
  ac: "AC",
  asc: "AC",
  as: "AC",
  ascendant: "AC",
  rising: "AC",
  mc: "MC",
  midheaven: "MC",
  "medium coeli": "MC",
  "mid heaven": "MC",
  ds: "DS",
  dc: "DS",
  dsc: "DS",
  desc: "DS",
  descendant: "DS",
  setting: "DS",
  ic: "IC",
  "imum coeli": "IC",
  nadir: "IC",
};

/** Life area each angle points to, phrased to follow "show up in". */
const ANGLE_AREAS: Record<AngleKey, string> = {
  AC: "how you carry yourself and feel in your own skin",
  MC: "your work and reputation",
  DS: "your relationships and partnerships",
  IC: "your home and family life",
};

function planetKey(value: unknown): PlanetKey | null {
  const key = norm(value);
  return PLANET_ALIASES[key] ?? null;
}

function angleKey(value: unknown): AngleKey | null {
  const key = norm(value).replace(/\s+line$/, "");
  return ANGLE_ALIASES[key] ?? null;
}

/**
 * One everyday line for a planet line at an angle, e.g.
 * ("Venus", "MC") → "Near this line, charm, beauty and ease show up in your
 * work and reputation." Returns null if either value is unknown.
 */
export function astroLineMeaning(
  planet: unknown,
  angle: unknown,
): string | null {
  const p = planetKey(planet);
  const a = angleKey(angle);
  if (!p || !a) return null;
  return `Near this line, ${PLANET_THEMES[p]} show up in ${ANGLE_AREAS[a]}.`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * One everyday line for a power zone, built from its dominant planets (or the
 * planets named in its line intersections, e.g. "Jupiter MC"). Returns null if
 * no known planet is found.
 */
export function astroZoneMeaning(zone: {
  dominant_planets?: unknown;
  line_intersections?: unknown;
  planets?: unknown;
}): string | null {
  const raw: unknown[] = [];
  for (const source of [
    zone?.dominant_planets,
    zone?.planets,
    zone?.line_intersections,
  ]) {
    if (Array.isArray(source)) raw.push(...source);
  }

  const keys: PlanetKey[] = [];
  for (const item of raw) {
    let key = planetKey(item);
    if (!key) {
      // "Jupiter MC" / "north_node_DS": drop a trailing angle code.
      const words = norm(item).split(" ");
      if (words.length > 1 && angleKey(words[words.length - 1])) {
        key = planetKey(words.slice(0, -1).join(" "));
      }
    }
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (keys.length === 0) return null;

  const shown = keys.slice(0, 3);
  const names = joinList(shown.map((k) => PLANET_NAMES[k]));
  const themes = joinList(shown.map((k) => PLANET_SHORT_THEMES[k]));
  return shown.length === 1
    ? `Your ${names} line runs through here, a good fit for ${themes}.`
    : `Your ${names} lines meet here, a good fit for ${themes}.`;
}

/**
 * Power-zone scores arrive on different scales (0–1, 0–10 or 0–100). Returns
 * a whole-number percentage string like "91%", or null if not a number.
 */
export function formatZoneScore(score: unknown): string | null {
  const n =
    typeof score === "number"
      ? score
      : typeof score === "string" && score.trim() !== ""
        ? Number(score.replace(/%$/, ""))
        : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  const pct = n <= 1 ? n * 100 : n <= 10 ? n * 10 : n;
  return `${Math.round(Math.min(pct, 100))}%`;
}
