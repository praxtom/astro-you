/**
 * Ashtakoot (Guna Milan) — eight kootas, total /36, from each person's Moon
 * nakshatra and Moon sign.
 *
 * Tables (North Indian convention as used by most matchmaking software):
 * - Varna, Vashya (5×5, rows = bride, cols = groom, split Sagittarius/Capricorn):
 *   https://www.onlinejyotish.com/articles/marriage-matching/english/vashya-kootam.php
 * - Yoni animals per nakshatra and the 7 Mahavaira (0-point) pairs:
 *   https://www.onlinejyotish.com/articles/marriage-matching/english/yoni-kootam.php
 *   The intermediate 3/2/1 grades follow the standard 14×14 matrix (symmetric).
 * - Tara (remainders 3, 5, 7 unfavourable, 1.5 per direction), Graha Maitri grades,
 *   Gana and Nadi nakshatra groups, Bhakoot 2/12, 5/9, 6/8 = 0:
 *   https://hindutone.com/astrology/kundli-matching-ashtakoota-guna-milan-36-gunas/
 * - Gana grades (boy × girl): Deva-Deva 6, Deva boy–Manushya girl 6, Manushya boy–
 *   Deva girl 5, Deva–Rakshasa 1, Manushya–Rakshasa 0, same 6. Sources differ on
 *   these minor grades; the table is exported so it can be swapped.
 */
import { SIGNS } from "./types.js";
import type { NakshatraIndex, SaptaGraha, SignIndex } from "./types.js";

export interface MatchPerson {
  moonNakshatra: NakshatraIndex;
  moonSign: SignIndex;
  /** Optional sidereal Moon longitude: refines Vashya for Sagittarius/Capricorn halves. */
  moonLongitude?: number;
}

export interface KootaScore {
  name:
    | "Varna"
    | "Vashya"
    | "Tara"
    | "Yoni"
    | "Graha Maitri"
    | "Gana"
    | "Bhakoot"
    | "Nadi";
  points: number;
  max: number;
  bride: string;
  groom: string;
  note?: string;
}

export interface AshtakootResult {
  kootas: KootaScore[];
  total: number;
  max: 36;
  /** Nadi or Bhakoot score of zero (reported as factors, not verdicts). */
  doshas: Array<"nadi" | "bhakoot">;
}

// ---- Varna -------------------------------------------------------------
const VARNA_NAMES = ["Shudra", "Vaishya", "Kshatriya", "Brahmin"];
/** Rank 0–3 by Moon sign element: water Brahmin, fire Kshatriya, earth Vaishya, air Shudra. */
export function varnaOf(sign: SignIndex): number {
  return { water: 3, fire: 2, earth: 1, air: 0 }[SIGNS[sign].element];
}

// ---- Vashya ------------------------------------------------------------
export const VASHYA_NAMES = [
  "Chatushpada",
  "Manava",
  "Jalachara",
  "Vanachara",
  "Keeta",
] as const;
/** Rows = bride, columns = groom. */
export const VASHYA_TABLE: number[][] = [
  [2, 1, 1, 0, 1],
  [1, 2, 0.5, 0, 1],
  [1, 0.5, 2, 1, 1],
  [0, 0, 1, 2, 0],
  [1, 0, 1, 0, 2],
];
const NAKSHATRA_SPAN = 360 / 27;

export function vashyaOf(p: MatchPerson): number {
  const s = p.moonSign;
  let firstHalf: boolean;
  if (p.moonLongitude !== undefined) firstHalf = p.moonLongitude % 30 < 15;
  else {
    // Fall back to the nakshatra's midpoint.
    const mid = ((p.moonNakshatra + 0.5) * NAKSHATRA_SPAN) % 360;
    const midInSign =
      Math.floor(mid / 30) === s ? mid % 30 : mid < s * 30 ? 0 : 29.99;
    firstHalf = midInSign < 15;
  }
  switch (s) {
    case 0:
    case 1:
      return 0;
    case 2:
    case 5:
    case 6:
    case 10:
      return 1;
    case 3:
    case 11:
      return 2;
    case 4:
      return 3;
    case 7:
      return 4;
    case 8:
      return firstHalf ? 1 : 0;
    case 9:
      return firstHalf ? 0 : 2;
    default:
      return 0;
  }
}

// ---- Tara --------------------------------------------------------------
const TARA_NAMES = [
  "Parama Mitra",
  "Janma",
  "Sampat",
  "Vipat",
  "Kshema",
  "Pratyari",
  "Sadhaka",
  "Vadha",
  "Mitra",
];
function taraFrom(from: number, to: number): number {
  return ((to - from + 27) % 27) + 1;
}
function taraGood(count: number): boolean {
  const r = count % 9;
  return r !== 3 && r !== 5 && r !== 7;
}

// ---- Yoni --------------------------------------------------------------
export const YONI_NAMES = [
  "Horse",
  "Elephant",
  "Sheep",
  "Serpent",
  "Dog",
  "Cat",
  "Rat",
  "Cow",
  "Buffalo",
  "Tiger",
  "Deer",
  "Monkey",
  "Mongoose",
  "Lion",
] as const;
/** Yoni index for each nakshatra 0–26. */
export const NAKSHATRA_YONI = [
  0, 1, 2, 3, 3, 4, 5, 2, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 12, 11, 13, 0,
  13, 7, 1,
];
export const YONI_TABLE: number[][] = [
  [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1],
  [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0],
  [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1],
  [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2],
  [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1],
  [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1],
  [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2],
  [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1],
  [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1],
  [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1],
  [3, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1],
  [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2],
  [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2],
  [1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4],
];

// ---- Graha Maitri ------------------------------------------------------
type Relation = "friend" | "neutral" | "enemy";
/** Naisargika (natural) relationships, BPHS ch. 3: how `a` regards `b`. */
const FRIENDS: Record<SaptaGraha, SaptaGraha[]> = {
  Sun: ["Moon", "Mars", "Jupiter"],
  Moon: ["Sun", "Mercury"],
  Mars: ["Sun", "Moon", "Jupiter"],
  Mercury: ["Sun", "Venus"],
  Jupiter: ["Sun", "Moon", "Mars"],
  Venus: ["Mercury", "Saturn"],
  Saturn: ["Mercury", "Venus"],
};
const ENEMIES: Record<SaptaGraha, SaptaGraha[]> = {
  Sun: ["Venus", "Saturn"],
  Moon: [],
  Mars: ["Mercury"],
  Mercury: ["Moon"],
  Jupiter: ["Mercury", "Venus"],
  Venus: ["Sun", "Moon"],
  Saturn: ["Sun", "Moon", "Mars"],
};
export function naturalRelation(a: SaptaGraha, b: SaptaGraha): Relation {
  if (FRIENDS[a].includes(b)) return "friend";
  if (ENEMIES[a].includes(b)) return "enemy";
  return "neutral";
}
export function grahaMaitriPoints(a: SaptaGraha, b: SaptaGraha): number {
  if (a === b) return 5;
  const pair = [naturalRelation(a, b), naturalRelation(b, a)].sort().join("+");
  const grades: Record<string, number> = {
    "friend+friend": 5,
    "friend+neutral": 4,
    "neutral+neutral": 3,
    "enemy+friend": 1,
    "enemy+neutral": 0.5,
    "enemy+enemy": 0,
  };
  return grades[pair];
}

// ---- Gana --------------------------------------------------------------
export const GANA_NAMES = ["Deva", "Manushya", "Rakshasa"] as const;
export const NAKSHATRA_GANA = [
  0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1,
  0,
];
/** Rows = groom gana, columns = bride gana. */
export const GANA_TABLE: number[][] = [
  [6, 6, 1],
  [5, 6, 0],
  [1, 0, 6],
];

// ---- Nadi --------------------------------------------------------------
export const NADI_NAMES = ["Aadi", "Madhya", "Antya"] as const;
/** Zig-zag pattern 0,1,2,2,1,0,0,1,2,... */
export function nadiOf(nakshatra: NakshatraIndex): number {
  const pattern = [0, 1, 2, 2, 1, 0];
  return pattern[nakshatra % 6];
}

export function ashtakoot(
  bride: MatchPerson,
  groom: MatchPerson,
): AshtakootResult {
  const kootas: KootaScore[] = [];

  const bv = varnaOf(bride.moonSign);
  const gv = varnaOf(groom.moonSign);
  kootas.push({
    name: "Varna",
    points: gv >= bv ? 1 : 0,
    max: 1,
    bride: VARNA_NAMES[bv],
    groom: VARNA_NAMES[gv],
  });

  const bva = vashyaOf(bride);
  const gva = vashyaOf(groom);
  kootas.push({
    name: "Vashya",
    points: VASHYA_TABLE[bva][gva],
    max: 2,
    bride: VASHYA_NAMES[bva],
    groom: VASHYA_NAMES[gva],
  });

  const toGroom = taraFrom(bride.moonNakshatra, groom.moonNakshatra);
  const toBride = taraFrom(groom.moonNakshatra, bride.moonNakshatra);
  kootas.push({
    name: "Tara",
    points: (taraGood(toGroom) ? 1.5 : 0) + (taraGood(toBride) ? 1.5 : 0),
    max: 3,
    bride: TARA_NAMES[toBride % 9],
    groom: TARA_NAMES[toGroom % 9],
  });

  const by = NAKSHATRA_YONI[bride.moonNakshatra];
  const gy = NAKSHATRA_YONI[groom.moonNakshatra];
  kootas.push({
    name: "Yoni",
    points: YONI_TABLE[by][gy],
    max: 4,
    bride: YONI_NAMES[by],
    groom: YONI_NAMES[gy],
  });

  const bl = SIGNS[bride.moonSign].lord;
  const gl = SIGNS[groom.moonSign].lord;
  kootas.push({
    name: "Graha Maitri",
    points: grahaMaitriPoints(bl, gl),
    max: 5,
    bride: bl,
    groom: gl,
  });

  const bg = NAKSHATRA_GANA[bride.moonNakshatra];
  const gg = NAKSHATRA_GANA[groom.moonNakshatra];
  kootas.push({
    name: "Gana",
    points: GANA_TABLE[gg][bg],
    max: 6,
    bride: GANA_NAMES[bg],
    groom: GANA_NAMES[gg],
  });

  const dist = ((groom.moonSign - bride.moonSign + 12) % 12) + 1;
  const pairBad = [2, 12, 5, 9, 6, 8].includes(dist);
  kootas.push({
    name: "Bhakoot",
    points: pairBad ? 0 : 7,
    max: 7,
    bride: SIGNS[bride.moonSign].english,
    groom: SIGNS[groom.moonSign].english,
    note:
      `${dist}/${((12 - dist + 1) % 12) + 1} relationship` +
      (pairBad && (bl === gl || grahaMaitriPoints(bl, gl) >= 4)
        ? "; sign lords are the same or friendly (traditional mitigation)"
        : ""),
  });

  const bn = nadiOf(bride.moonNakshatra);
  const gn = nadiOf(groom.moonNakshatra);
  kootas.push({
    name: "Nadi",
    points: bn === gn ? 0 : 8,
    max: 8,
    bride: NADI_NAMES[bn],
    groom: NADI_NAMES[gn],
    note:
      bn === gn &&
      (bride.moonSign === groom.moonSign ||
        bride.moonNakshatra === groom.moonNakshatra)
        ? "same Moon sign or nakshatra (traditional mitigation)"
        : undefined,
  });

  const doshas: Array<"nadi" | "bhakoot"> = [];
  if (bn === gn) doshas.push("nadi");
  if (pairBad) doshas.push("bhakoot");
  return {
    kootas,
    total: kootas.reduce((s, k) => s + k.points, 0),
    max: 36,
    doshas,
  };
}
