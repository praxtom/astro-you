/**
 * buildChart: assemble a CanonicalChart from a birth moment and an
 * EphemerisProvider. All astrology here is plain arithmetic on the
 * provider's tropical longitudes:
 *   sidereal = tropical − Lahiri ayanamsa (true or mean to match the provider's equinox)
 *   houses   = whole-sign from the lagna (or from the Moon when time is unknown)
 *   Ketu     = Rahu + 180°
 */
import { GRAHAS, normDeg } from "./types.js";
import type {
  CanonicalChart,
  ChartInput,
  Graha,
  GrahaPlacement,
  HouseInfo,
  SignIndex,
  VargaChart,
  VargaKey,
  VargaPosition,
} from "./types.js";
import type { EphemerisBody, EphemerisProvider } from "./ephemeris.js";
import { deltaTSeconds, decimalYear, julianDayFromStrings } from "./julian.js";
import { lahiriAyanamsa } from "./ayanamsa.js";
import {
  ascendantFromSiderealTime,
  greenwichApparentSiderealTime,
  nutation,
  trueObliquity,
} from "./astro-math.js";
import { placementOf } from "./nakshatra.js";
import { VARGA_KEYS, vargaPosition } from "./vargas.js";
import { vimshottariDasha } from "./dasha.js";
import type { VimshottariOptions } from "./dasha.js";

export interface BuildChartOptions {
  /** Lunar node model for Rahu/Ketu. Default "mean" (matches the app's astrology-api usage). */
  node?: "mean" | "true";
  /** Vargas to compute. Default: all 16. */
  vargas?: VargaKey[];
  dasha?: VimshottariOptions;
  /** Local time used when timeUnknown. Default "12:00". */
  unknownTimeDefault?: string;
}

const BODY_FOR: Record<Exclude<Graha, "Rahu" | "Ketu">, EphemerisBody> = {
  Sun: "Sun",
  Moon: "Moon",
  Mars: "Mars",
  Mercury: "Mercury",
  Jupiter: "Jupiter",
  Venus: "Venus",
  Saturn: "Saturn",
};

/** JD (UT/TT) and ayanamsa for a moment, using the provider's conventions. */
export function siderealFrame(provider: EphemerisProvider, jdUT: number) {
  const dT = provider.deltaT
    ? provider.deltaT(jdUT)
    : deltaTSeconds(decimalYear(jdUT)) / 86400;
  const jdTT = jdUT + dT;
  const mean = lahiriAyanamsa(jdTT);
  const dPsi =
    provider.equinox === "true"
      ? provider.nutationLongitude
        ? provider.nutationLongitude(jdTT)
        : nutation(jdTT).dPsi
      : 0;
  return {
    jdUT,
    jdTT,
    ayanamsaMean: mean,
    nutation: dPsi,
    ayanamsa: mean + dPsi,
  };
}

/** Sidereal ascendant (degrees) for a moment and place. */
export function siderealAscendant(
  provider: EphemerisProvider,
  jdUT: number,
  lat: number,
  lng: number,
): number {
  const f = siderealFrame(provider, jdUT);
  const gast = provider.siderealTime
    ? provider.siderealTime(jdUT)
    : greenwichApparentSiderealTime(jdUT, f.jdTT);
  const eps = provider.trueObliquity
    ? provider.trueObliquity(f.jdTT)
    : trueObliquity(f.jdTT);
  const tropical = ascendantFromSiderealTime(normDeg(gast + lng), eps, lat);
  // The ascendant is computed on the true equinox of date: always subtract the true ayanamsa.
  const trueAyanamsa =
    f.ayanamsaMean +
    (provider.nutationLongitude
      ? provider.nutationLongitude(f.jdTT)
      : nutation(f.jdTT).dPsi);
  return normDeg(tropical - trueAyanamsa);
}

function houseOf(sign: SignIndex, reference: SignIndex): number {
  return ((sign - reference + 12) % 12) + 1;
}

export function buildChart(
  input: ChartInput,
  provider: EphemerisProvider,
  options: BuildChartOptions = {},
): CanonicalChart {
  const timeUnknown = Boolean(input.timeUnknown) || !input.time;
  const time = timeUnknown
    ? (options.unknownTimeDefault ?? "12:00")
    : (input.time as string);
  const jdUT = julianDayFromStrings(input.date, time, input.utcOffsetHours);
  const frame = siderealFrame(provider, jdUT);
  const node = options.node ?? "mean";

  const raw = {} as Record<Graha, { longitude: number; speed: number }>;
  for (const g of Object.keys(BODY_FOR) as Array<keyof typeof BODY_FOR>) {
    const p = provider.position(BODY_FOR[g], jdUT);
    raw[g] = {
      longitude: normDeg(p.longitude - frame.ayanamsa),
      speed: p.speed,
    };
  }
  const rahu = provider.position(
    node === "true" ? "TrueNode" : "MeanNode",
    jdUT,
  );
  raw.Rahu = {
    longitude: normDeg(rahu.longitude - frame.ayanamsa),
    speed: rahu.speed,
  };
  raw.Ketu = {
    longitude: normDeg(raw.Rahu.longitude + 180),
    speed: rahu.speed,
  };

  const lagna = timeUnknown
    ? undefined
    : placementOf(siderealAscendant(provider, jdUT, input.lat, input.lng));
  const referenceSign = (
    lagna ? lagna.sign : Math.floor(raw.Moon.longitude / 30)
  ) as SignIndex;

  const grahas = {} as Record<Graha, GrahaPlacement>;
  for (const g of GRAHAS) {
    const core = placementOf(raw[g].longitude);
    grahas[g] = {
      ...core,
      speed: raw[g].speed,
      // Sun and Moon never retrograde; the mean node always moves backwards.
      retrograde: g === "Sun" || g === "Moon" ? false : raw[g].speed < 0,
      house: houseOf(core.sign, referenceSign),
    };
  }

  const houses: HouseInfo[] = [];
  for (let h = 1; h <= 12; h++) {
    const sign = ((referenceSign + h - 1) % 12) as SignIndex;
    houses.push({
      house: h,
      sign,
      grahas: GRAHAS.filter((g) => grahas[g].sign === sign),
    });
  }

  const vargas: Partial<Record<VargaKey, VargaChart>> = {};
  for (const key of options.vargas ?? VARGA_KEYS) {
    const gp = {} as Record<Graha, VargaPosition>;
    for (const g of GRAHAS) gp[g] = vargaPosition(grahas[g].longitude, key);
    vargas[key] = lagna
      ? { lagna: vargaPosition(lagna.longitude, key), grahas: gp }
      : { grahas: gp };
  }

  return {
    input: {
      ...input,
      time,
      tzOffsetHours: input.utcOffsetHours,
      jdUT,
      jdTT: frame.jdTT,
      timeUnknown,
    },
    ayanamsa: {
      name: "lahiri",
      value: frame.ayanamsa,
      mean: frame.ayanamsaMean,
      nutation: frame.nutation,
    },
    node,
    lagna,
    houseReference: lagna ? "lagna" : "moon",
    grahas,
    houses,
    vargas,
    dasha: vimshottariDasha(grahas.Moon.longitude, jdUT, options.dasha),
  };
}
