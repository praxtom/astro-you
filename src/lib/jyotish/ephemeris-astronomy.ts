/**
 * EphemerisProvider backed by astronomy-engine (pure JS, VSOP87 planets,
 * NAO Improved Lunar Ephemeris for the Moon; ~1′ accuracy, which is far below
 * the 0.1° chart precision we display).
 *
 * Frame and equinox conventions (chosen to match Swiss Ephemeris defaults and
 * Drik-style panchangs):
 * - Planets: `GeoVector(body, t, aberration=true)` gives the apparent
 *   (light-time + aberration corrected) geocentric vector in EQJ; `Ecliptic()`
 *   rotates it to ECT = true ecliptic and TRUE equinox of date (precession +
 *   nutation). So longitudes include nutation.
 * - Moon: `EclipticGeoMoon(t)` is already ECT (true equinox of date).
 * - Nodes: Meeus ch. 47 mean node (and true node with the five largest periodic
 *   terms) are referred to the MEAN equinox of date; we add Δψ so they are on
 *   the same true equinox as everything else.
 * - Hence `equinox: "true"`: buildChart subtracts the TRUE Lahiri ayanamsa
 *   (mean + Δψ, using this provider's IAU 2000B Δψ). Nutation cancels exactly,
 *   which is what Swiss Ephemeris does with SEFLG_SIDEREAL.
 * - Sidereal time is astronomy-engine's GAST, obliquity its true obliquity.
 * - Speeds: central difference over ±12 h (deg/day); negative = retrograde.
 * - Rise/set: `SearchRiseSet` finds the moment the UPPER LIMB touches the
 *   horizon with standard atmospheric refraction (~34′) — the convention of
 *   Drik Panchang and most modern Indian almanacs (as opposed to the centre
 *   of the disc, used by some traditional siddhantic panchangs).
 */
/// <reference types="node" />
import { createRequire } from "node:module";
import type * as AstronomyTypes from "astronomy-engine";
import type {
  BodyPosition,
  EphemerisBody,
  EphemerisProvider,
  GeoLocation,
  RiseSetEvent,
} from "./ephemeris.js";
import { J2000 } from "./julian.js";
import { normDeg } from "./types.js";

// astronomy-engine@2.1.19 ships its ESM build as plain `.js` without
// `"type": "module"`, so a native ESM `import` of the package makes Node load
// `esm/astronomy.js` as CommonJS and crash with "Unexpected token 'export'" —
// which took down every function that imports this file. Load the CommonJS
// build (the package's `require` export) instead. This file is server-only.
const Astronomy = createRequire(import.meta.url)(
  "astronomy-engine",
) as typeof AstronomyTypes;
const DEG = Math.PI / 180;

function timeFromJdUT(jdUT: number): AstronomyTypes.AstroTime {
  return Astronomy.MakeTime(jdUT - J2000);
}

function timeFromJdTT(jdTT: number): AstronomyTypes.AstroTime {
  return Astronomy.AstroTime.FromTerrestrialTime(jdTT - J2000);
}

function nutationDeg(time: AstronomyTypes.AstroTime): number {
  return Astronomy.e_tilt(time).dpsi / 3600;
}

const PLANET_BODY: Partial<Record<EphemerisBody, AstronomyTypes.Body>> = {
  Sun: Astronomy.Body.Sun,
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
};

/** Meeus eq. 47.7: mean ascending node of the Moon, mean equinox of date (degrees). */
export function meanLunarNode(jdTT: number): number {
  const T = (jdTT - J2000) / 36525;
  return normDeg(
    125.0445479 -
      1934.1362891 * T +
      0.0020754 * T * T +
      (T * T * T) / 467441 -
      (T * T * T * T) / 60616000,
  );
}

/** True (osculating-approximation) node: Meeus ch. 47 periodic terms, mean equinox of date. */
export function trueLunarNode(jdTT: number): number {
  const T = (jdTT - J2000) / 36525;
  const D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T * T) * DEG;
  const M = (357.5291092 + 35999.0502909 * T - 0.0001536 * T * T) * DEG;
  const Mp = (134.9633964 + 477198.8675055 * T + 0.0087414 * T * T) * DEG;
  const F = (93.272095 + 483202.0175233 * T - 0.0036539 * T * T) * DEG;
  return normDeg(
    meanLunarNode(jdTT) -
      1.4979 * Math.sin(2 * (D - F)) -
      0.15 * Math.sin(M) +
      0.1226 * Math.sin(2 * D) +
      0.1176 * Math.sin(2 * F) -
      0.0801 * Math.sin(2 * (Mp - F)),
  );
}

function longitudeAt(body: EphemerisBody, jdUT: number): number {
  const time = timeFromJdUT(jdUT);
  if (body === "Moon") return Astronomy.EclipticGeoMoon(time).lon;
  if (body === "MeanNode" || body === "TrueNode") {
    const jdTT = time.tt + J2000;
    const node =
      body === "MeanNode" ? meanLunarNode(jdTT) : trueLunarNode(jdTT);
    return normDeg(node + nutationDeg(time));
  }
  const b = PLANET_BODY[body];
  if (!b) throw new Error(`Unsupported body ${body}`);
  return Astronomy.Ecliptic(Astronomy.GeoVector(b, time, true)).elon;
}

function latitudeAt(body: EphemerisBody, jdUT: number): number | undefined {
  const time = timeFromJdUT(jdUT);
  if (body === "Moon") return Astronomy.EclipticGeoMoon(time).lat;
  const b = PLANET_BODY[body];
  return b ? Astronomy.Ecliptic(Astronomy.GeoVector(b, time, true)).elat : 0;
}

function signedDelta(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

const HALF_DAY = 0.5;

export function createAstronomyEngineProvider(): EphemerisProvider {
  return {
    name: "astronomy-engine@2.1.19",
    equinox: "true",
    position(body: EphemerisBody, jdUT: number): BodyPosition {
      const longitude = normDeg(longitudeAt(body, jdUT));
      const speed =
        signedDelta(
          longitudeAt(body, jdUT + HALF_DAY),
          longitudeAt(body, jdUT - HALF_DAY),
        ) /
        (2 * HALF_DAY);
      return { longitude, latitude: latitudeAt(body, jdUT), speed };
    },
    deltaT(jdUT: number): number {
      const t = timeFromJdUT(jdUT);
      return t.tt - t.ut;
    },
    nutationLongitude(jdTT: number): number {
      return nutationDeg(timeFromJdTT(jdTT));
    },
    siderealTime(jdUT: number): number {
      return normDeg(Astronomy.SiderealTime(timeFromJdUT(jdUT)) * 15);
    },
    trueObliquity(jdTT: number): number {
      return Astronomy.e_tilt(timeFromJdTT(jdTT)).tobl;
    },
    riseSet(
      body: "Sun" | "Moon",
      event: RiseSetEvent,
      jdStartUT: number,
      location: GeoLocation,
      limitDays = 1,
    ) {
      const observer = new Astronomy.Observer(
        location.lat,
        location.lng,
        location.height ?? 0,
      );
      const found = Astronomy.SearchRiseSet(
        body === "Sun" ? Astronomy.Body.Sun : Astronomy.Body.Moon,
        observer,
        event === "rise" ? +1 : -1,
        timeFromJdUT(jdStartUT),
        limitDays,
      );
      return found ? found.ut + J2000 : null;
    },
  };
}

/** Shared default instance. */
export const astronomyEngineProvider: EphemerisProvider =
  createAstronomyEngineProvider();
