/**
 * Canonical Vedic chart model for the in-house Jyotish engine.
 *
 * Everything here is plain data (JSON-serialisable) so the same chart can be
 * computed on the server, cached in Firestore and rendered on the client.
 * Signs and nakshatras are stable 0-based indices; the name tables below are
 * the single source for English and Sanskrit labels.
 */

export const GRAHAS = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
] as const;
export type Graha = (typeof GRAHAS)[number];

/** The seven visible planets (no nodes). */
export const SAPTA_GRAHAS = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
] as const;
export type SaptaGraha = (typeof SAPTA_GRAHAS)[number];

export const GRAHA_SANSKRIT: Record<Graha, string> = {
  Sun: "Surya",
  Moon: "Chandra",
  Mars: "Mangala",
  Mercury: "Budha",
  Jupiter: "Guru",
  Venus: "Shukra",
  Saturn: "Shani",
  Rahu: "Rahu",
  Ketu: "Ketu",
};

/** 0 = Aries ... 11 = Pisces. */
export type SignIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type Element = "fire" | "earth" | "air" | "water";
export type Modality = "movable" | "fixed" | "dual";

export interface SignInfo {
  index: SignIndex;
  key: string;
  english: string;
  sanskrit: string;
  lord: SaptaGraha;
  element: Element;
  modality: Modality;
}

const SIGN_ROWS: Array<[string, string, string, SaptaGraha]> = [
  ["aries", "Aries", "Mesha", "Mars"],
  ["taurus", "Taurus", "Vrishabha", "Venus"],
  ["gemini", "Gemini", "Mithuna", "Mercury"],
  ["cancer", "Cancer", "Karka", "Moon"],
  ["leo", "Leo", "Simha", "Sun"],
  ["virgo", "Virgo", "Kanya", "Mercury"],
  ["libra", "Libra", "Tula", "Venus"],
  ["scorpio", "Scorpio", "Vrishchika", "Mars"],
  ["sagittarius", "Sagittarius", "Dhanu", "Jupiter"],
  ["capricorn", "Capricorn", "Makara", "Saturn"],
  ["aquarius", "Aquarius", "Kumbha", "Saturn"],
  ["pisces", "Pisces", "Meena", "Jupiter"],
];
const ELEMENTS: Element[] = ["fire", "earth", "air", "water"];
const MODALITIES: Modality[] = ["movable", "fixed", "dual"];

export const SIGNS: readonly SignInfo[] = SIGN_ROWS.map(
  ([key, english, sanskrit, lord], i) => ({
    index: i as SignIndex,
    key,
    english,
    sanskrit,
    lord,
    element: ELEMENTS[i % 4],
    modality: MODALITIES[i % 3],
  }),
);

/** 0 = Ashwini ... 26 = Revati. */
export type NakshatraIndex = number;
export type Pada = 1 | 2 | 3 | 4;

export interface NakshatraInfo {
  index: NakshatraIndex;
  key: string;
  english: string;
  sanskrit: string;
  lord: Graha;
}

/** Vimshottari lord cycle; nakshatra n is ruled by DASHA_ORDER[n % 9]. */
export const DASHA_ORDER: readonly Graha[] = [
  "Ketu",
  "Venus",
  "Sun",
  "Moon",
  "Mars",
  "Rahu",
  "Jupiter",
  "Saturn",
  "Mercury",
];

const NAKSHATRA_ROWS: Array<[string, string, string]> = [
  ["ashwini", "Ashwini", "Aśvinī"],
  ["bharani", "Bharani", "Bharaṇī"],
  ["krittika", "Krittika", "Kṛttikā"],
  ["rohini", "Rohini", "Rohiṇī"],
  ["mrigashira", "Mrigashira", "Mṛgaśirā"],
  ["ardra", "Ardra", "Ārdrā"],
  ["punarvasu", "Punarvasu", "Punarvasu"],
  ["pushya", "Pushya", "Puṣya"],
  ["ashlesha", "Ashlesha", "Āśleṣā"],
  ["magha", "Magha", "Maghā"],
  ["purva-phalguni", "Purva Phalguni", "Pūrva Phalgunī"],
  ["uttara-phalguni", "Uttara Phalguni", "Uttara Phalgunī"],
  ["hasta", "Hasta", "Hasta"],
  ["chitra", "Chitra", "Citrā"],
  ["swati", "Swati", "Svātī"],
  ["vishakha", "Vishakha", "Viśākhā"],
  ["anuradha", "Anuradha", "Anurādhā"],
  ["jyeshtha", "Jyeshtha", "Jyeṣṭhā"],
  ["mula", "Mula", "Mūla"],
  ["purva-ashadha", "Purva Ashadha", "Pūrva Āṣāḍhā"],
  ["uttara-ashadha", "Uttara Ashadha", "Uttara Āṣāḍhā"],
  ["shravana", "Shravana", "Śravaṇa"],
  ["dhanishta", "Dhanishta", "Dhaniṣṭhā"],
  ["shatabhisha", "Shatabhisha", "Śatabhiṣā"],
  ["purva-bhadrapada", "Purva Bhadrapada", "Pūrva Bhādrapadā"],
  ["uttara-bhadrapada", "Uttara Bhadrapada", "Uttara Bhādrapadā"],
  ["revati", "Revati", "Revatī"],
];

export const NAKSHATRAS: readonly NakshatraInfo[] = NAKSHATRA_ROWS.map(
  ([key, english, sanskrit], i) => ({
    index: i,
    key,
    english,
    sanskrit,
    lord: DASHA_ORDER[i % 9],
  }),
);

/** Birth (or event) moment as the user entered it. */
export interface ChartInput {
  /** Local civil date, YYYY-MM-DD. */
  date: string;
  /** Local civil time, HH:mm or HH:mm:ss. Ignored (noon used) when timeUnknown. */
  time?: string;
  /** UTC offset in hours that was in force at that place and moment (e.g. 5.5 for IST). */
  utcOffsetHours: number;
  /** Geographic latitude, degrees north positive. */
  lat: number;
  /** Geographic longitude, degrees east positive. */
  lng: number;
  timeUnknown?: boolean;
}

export interface PlacementCore {
  /** Sidereal (Lahiri) ecliptic longitude, 0–360. */
  longitude: number;
  sign: SignIndex;
  degreeInSign: number;
  nakshatra: NakshatraIndex;
  pada: Pada;
}

export interface GrahaPlacement extends PlacementCore {
  retrograde: boolean;
  /** Degrees per day (sign of the tropical speed; the ayanamsa rate is negligible). */
  speed: number;
  /** Whole-sign house from the lagna, or from the Moon when the birth time is unknown. */
  house: number;
}

export interface HouseInfo {
  house: number;
  sign: SignIndex;
  grahas: Graha[];
}

export type VargaKey =
  | "D1"
  | "D2"
  | "D3"
  | "D4"
  | "D7"
  | "D9"
  | "D10"
  | "D12"
  | "D16"
  | "D20"
  | "D24"
  | "D27"
  | "D30"
  | "D40"
  | "D45"
  | "D60";

export interface VargaPosition {
  sign: SignIndex;
  degreeInSign: number;
}

export interface VargaChart {
  lagna?: VargaPosition;
  grahas: Record<Graha, VargaPosition>;
}

export interface DashaPeriod {
  lord: Graha;
  /** 1 = mahadasha, 2 = antardasha, 3 = pratyantardasha. */
  level: 1 | 2 | 3;
  startJd: number;
  endJd: number;
  /** ISO 8601 UTC instants. */
  start: string;
  end: string;
  /** Sub-periods (present down to the requested depth). */
  sub?: DashaPeriod[];
}

export interface VimshottariDasha {
  system: "vimshottari";
  yearLengthDays: number;
  moonNakshatra: NakshatraIndex;
  /** Lord of the mahadasha running at birth. */
  birthLord: Graha;
  /** Years of the birth mahadasha still to run at birth. */
  balanceYears: number;
  mahadashas: DashaPeriod[];
}

export interface CanonicalChart {
  input: ChartInput & {
    /** UTC offset actually used, hours. */
    tzOffsetHours: number;
    /** Julian Day (UT) of the moment. */
    jdUT: number;
    /** Julian Day (TT) of the moment. */
    jdTT: number;
    timeUnknown: boolean;
  };
  ayanamsa: { name: "lahiri"; value: number; mean: number; nutation: number };
  node: "mean" | "true";
  lagna?: PlacementCore;
  /** Sign used as house 1: lagna sign, or Moon sign when the time is unknown. */
  houseReference: "lagna" | "moon";
  grahas: Record<Graha, GrahaPlacement>;
  houses: HouseInfo[];
  vargas: Partial<Record<VargaKey, VargaChart>>;
  dasha: VimshottariDasha;
}

export function normDeg(x: number): number {
  const r = x % 360;
  return r < 0 ? r + 360 : r;
}

export function signOf(longitude: number): SignIndex {
  return Math.floor(normDeg(longitude) / 30) as SignIndex;
}
