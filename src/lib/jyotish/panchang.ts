/**
 * Panchang (five limbs) for a civil date and place, Drik (observational)
 * convention: limbs are those prevailing at local sunrise, each with the
 * instant it ends. Sunrise/sunset come from the EphemerisProvider (the
 * astronomy-engine adapter uses the upper limb with standard refraction,
 * matching Drik Panchang).
 *
 *   tithi   = (Moon − Sun) / 12°            (30 per lunar month)
 *   karana  = (Moon − Sun) / 6°             (60 half-tithis; 7 movable + 4 fixed)
 *   nakshatra = sidereal Moon / 13°20′
 *   yoga    = (sidereal Sun + sidereal Moon) / 13°20′
 *   vara    = weekday of the sunrise
 * Rahu Kaal / Yamaganda / Gulika: the daytime (sunrise→sunset) split into 8
 * equal parts, with the weekday tables below. Abhijit: the 8th of 15 day
 * muhurtas (traditionally not observed on Wednesdays).
 */
import { NAKSHATRAS, normDeg } from "./types.js";
import type { EphemerisProvider, GeoLocation } from "./ephemeris.js";
import { siderealFrame } from "./chart.js";
import { julianDayFromCalendar, jdToIso } from "./julian.js";
import { PADA_SPAN } from "./nakshatra.js";

export const TITHI_NAMES = [
  "Pratipada",
  "Dwitiya",
  "Tritiya",
  "Chaturthi",
  "Panchami",
  "Shashthi",
  "Saptami",
  "Ashtami",
  "Navami",
  "Dashami",
  "Ekadashi",
  "Dwadashi",
  "Trayodashi",
  "Chaturdashi",
];

export const YOGA_NAMES = [
  "Vishkumbha",
  "Priti",
  "Ayushman",
  "Saubhagya",
  "Shobhana",
  "Atiganda",
  "Sukarma",
  "Dhriti",
  "Shula",
  "Ganda",
  "Vriddhi",
  "Dhruva",
  "Vyaghata",
  "Harshana",
  "Vajra",
  "Siddhi",
  "Vyatipata",
  "Variyana",
  "Parigha",
  "Shiva",
  "Siddha",
  "Sadhya",
  "Shubha",
  "Shukla",
  "Brahma",
  "Indra",
  "Vaidhriti",
];

const MOVABLE_KARANAS = [
  "Bava",
  "Balava",
  "Kaulava",
  "Taitila",
  "Garaja",
  "Vanija",
  "Vishti",
];
export const VARA_NAMES = [
  { english: "Sunday", sanskrit: "Ravivara" },
  { english: "Monday", sanskrit: "Somavara" },
  { english: "Tuesday", sanskrit: "Mangalavara" },
  { english: "Wednesday", sanskrit: "Budhavara" },
  { english: "Thursday", sanskrit: "Guruvara" },
  { english: "Friday", sanskrit: "Shukravara" },
  { english: "Saturday", sanskrit: "Shanivara" },
];

/** 1-based eighth of the day, indexed by weekday (0 = Sunday). */
export const RAHU_KAAL_PART = [8, 2, 7, 5, 6, 4, 3];
export const YAMAGANDA_PART = [5, 4, 3, 2, 1, 7, 6];
export const GULIKA_PART = [7, 6, 5, 4, 3, 2, 1];

export function tithiName(index: number): {
  name: string;
  paksha: "Shukla" | "Krishna";
} {
  const paksha = index < 15 ? "Shukla" : "Krishna";
  const n = index % 15;
  const name =
    n === 14 ? (paksha === "Shukla" ? "Purnima" : "Amavasya") : TITHI_NAMES[n];
  return { name, paksha };
}

export function karanaName(index: number): string {
  if (index === 0) return "Kimstughna";
  if (index >= 57) return ["Shakuni", "Chatushpada", "Naga"][index - 57];
  return MOVABLE_KARANAS[(index - 1) % 7];
}

export interface TimedLimb {
  index: number;
  name: string;
  /** JD (UT) and ISO instant at which this limb ends. */
  endsJd: number;
  endsAt: string;
  /** Local wall time "HH:mm" (with "+1" day suffix when after the civil date). */
  endsLocal: string;
}

export interface TimeWindow {
  startJd: number;
  endJd: number;
  start: string;
  end: string;
  startLocal: string;
  endLocal: string;
}

export interface PanchangResult {
  date: string;
  location: GeoLocation;
  utcOffsetHours: number;
  sunrise: TimeWindow["start"];
  sunset: TimeWindow["start"];
  sunriseLocal: string;
  sunsetLocal: string;
  vara: { index: number; english: string; sanskrit: string };
  tithi: TimedLimb & { paksha: "Shukla" | "Krishna" };
  nakshatra: TimedLimb & { pada: number };
  yoga: TimedLimb;
  /** Karanas from sunrise until the next sunrise (usually 2–3). */
  karanas: TimedLimb[];
  rahuKaal: TimeWindow;
  yamaganda: TimeWindow;
  gulika: TimeWindow;
  abhijit: TimeWindow & { observed: boolean };
  ayanamsa: number;
}

export interface PanchangInput {
  /** Local civil date YYYY-MM-DD. */
  date: string;
  lat: number;
  lng: number;
  /** UTC offset in force on that date (hours). */
  utcOffsetHours: number;
  height?: number;
}

function signedDelta(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * First instant after `jd0` at which the angle `fn` (degrees, increasing
 * modulo 360) reaches `target`. Newton iteration on a numeric derivative.
 */
export function findAngleCrossing(
  fn: (jd: number) => number,
  target: number,
  jd0: number,
  approxRate: number,
): number {
  let t = jd0 + normDeg(target - fn(jd0)) / approxRate;
  for (let i = 0; i < 30; i++) {
    const d = signedDelta(target, fn(t));
    const h = 1 / 24;
    const rate = signedDelta(fn(t + h), fn(t - h)) / (2 * h) || approxRate;
    const step = d / rate;
    t += step;
    if (Math.abs(step) < 1e-6) break; // ~0.1 s
  }
  return t;
}

export function computePanchang(
  input: PanchangInput,
  provider: EphemerisProvider,
): PanchangResult {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date);
  if (!m) throw new Error(`Invalid date "${input.date}"`);
  const offsetDays = input.utcOffsetHours / 24;
  const localMidnightJd =
    julianDayFromCalendar(Number(m[1]), Number(m[2]), Number(m[3])) -
    offsetDays;
  const location: GeoLocation = {
    lat: input.lat,
    lng: input.lng,
    height: input.height,
  };

  const sunrise = provider.riseSet("Sun", "rise", localMidnightJd, location, 1);
  if (sunrise === null)
    throw new Error("No sunrise on this date at this latitude");
  const sunset = provider.riseSet("Sun", "set", sunrise, location, 1);
  const nextSunrise = provider.riseSet(
    "Sun",
    "rise",
    sunrise + 0.01,
    location,
    2,
  );
  if (sunset === null || nextSunrise === null)
    throw new Error("No sunset on this date at this latitude");

  const lon = (body: "Sun" | "Moon", jd: number) =>
    provider.position(body, jd).longitude;
  const ayanamsaAt = (jd: number) => siderealFrame(provider, jd).ayanamsa;
  const elongation = (jd: number) => normDeg(lon("Moon", jd) - lon("Sun", jd));
  const moonSidereal = (jd: number) =>
    normDeg(lon("Moon", jd) - ayanamsaAt(jd));
  const yogaAngle = (jd: number) =>
    normDeg(lon("Moon", jd) + lon("Sun", jd) - 2 * ayanamsaAt(jd));

  const local = (jd: number) => {
    const localJd = jd + offsetDays;
    const dayDiff =
      Math.floor(localJd + 0.5) -
      Math.floor(localMidnightJd + offsetDays + 0.5);
    const mins = Math.round(((localJd + 0.5) % 1) * 1440) % 1440;
    const hh = String(Math.floor(mins / 60)).padStart(2, "0");
    const mm = String(mins % 60).padStart(2, "0");
    return `${hh}:${mm}${dayDiff > 0 ? ` +${dayDiff}` : dayDiff < 0 ? ` ${dayDiff}` : ""}`;
  };
  const limb = (index: number, name: string, endsJd: number): TimedLimb => ({
    index,
    name,
    endsJd,
    endsAt: jdToIso(endsJd),
    endsLocal: local(endsJd),
  });
  const windowOf = (startJd: number, endJd: number): TimeWindow => ({
    startJd,
    endJd,
    start: jdToIso(startJd),
    end: jdToIso(endJd),
    startLocal: local(startJd),
    endLocal: local(endJd),
  });

  // Tithi
  const e0 = elongation(sunrise);
  const tithiIndex = Math.floor(e0 / 12);
  const tithiEnd = findAngleCrossing(
    elongation,
    ((tithiIndex + 1) * 12) % 360,
    sunrise,
    12.2,
  );
  const tn = tithiName(tithiIndex);

  // Nakshatra
  const ms = moonSidereal(sunrise);
  const nakIndex = Math.floor(ms / (360 / 27));
  const nakEnd = findAngleCrossing(
    moonSidereal,
    (((nakIndex + 1) * 360) / 27) % 360,
    sunrise,
    13.2,
  );

  // Yoga
  const y0 = yogaAngle(sunrise);
  const yogaIndex = Math.floor(y0 / (360 / 27));
  const yogaEnd = findAngleCrossing(
    yogaAngle,
    (((yogaIndex + 1) * 360) / 27) % 360,
    sunrise,
    14.2,
  );

  // Karanas until next sunrise
  const karanas: TimedLimb[] = [];
  let kIndex = Math.floor(e0 / 6);
  let cursor = sunrise;
  for (let i = 0; i < 5; i++) {
    const end = findAngleCrossing(
      elongation,
      ((kIndex + 1) * 6) % 360,
      cursor,
      12.2,
    );
    karanas.push(limb(kIndex, karanaName(kIndex), end));
    if (end >= nextSunrise) break;
    cursor = end + 1e-5;
    kIndex = (kIndex + 1) % 60;
  }

  // Vara: weekday of the local civil date of sunrise (JD 0 was a Monday).
  const varaIndex = (Math.floor(sunrise + offsetDays + 0.5) + 1) % 7;

  const part = (n: number) => {
    const len = (sunset - sunrise) / 8;
    return windowOf(sunrise + (n - 1) * len, sunrise + n * len);
  };
  const muhurta = (sunset - sunrise) / 15;
  const abhijit = {
    ...windowOf(sunrise + 7 * muhurta, sunrise + 8 * muhurta),
    observed: varaIndex !== 3,
  };

  return {
    date: input.date,
    location,
    utcOffsetHours: input.utcOffsetHours,
    sunrise: jdToIso(sunrise),
    sunset: jdToIso(sunset),
    sunriseLocal: local(sunrise),
    sunsetLocal: local(sunset),
    vara: { index: varaIndex, ...VARA_NAMES[varaIndex] },
    tithi: { ...limb(tithiIndex, tn.name, tithiEnd), paksha: tn.paksha },
    nakshatra: {
      ...limb(nakIndex, NAKSHATRAS[nakIndex].english, nakEnd),
      pada: Math.floor((ms - nakIndex * (360 / 27)) / PADA_SPAN) + 1,
    },
    yoga: limb(yogaIndex, YOGA_NAMES[yogaIndex], yogaEnd),
    karanas,
    rahuKaal: part(RAHU_KAAL_PART[varaIndex]),
    yamaganda: part(YAMAGANDA_PART[varaIndex]),
    gulika: part(GULIKA_PART[varaIndex]),
    abhijit,
    ayanamsa: ayanamsaAt(sunrise),
  };
}
