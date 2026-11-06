/**
 * Nakshatra and pada from sidereal longitude. Each nakshatra spans 13°20′
 * (360/27); each pada 3°20′ (one navamsa).
 */
import { NAKSHATRAS, normDeg, signOf } from "./types.js";
import type { Graha, NakshatraInfo, Pada, PlacementCore } from "./types.js";

export const NAKSHATRA_SPAN = 360 / 27;
export const PADA_SPAN = NAKSHATRA_SPAN / 4;

const EPS = 1e-9;

export interface NakshatraPosition {
  index: number;
  info: NakshatraInfo;
  pada: Pada;
  lord: Graha;
  /** Degrees travelled inside the nakshatra. */
  degreeInNakshatra: number;
  /** 0–1 fraction travelled. */
  fraction: number;
}

export function nakshatraOf(siderealLongitude: number): NakshatraPosition {
  const lon = normDeg(siderealLongitude);
  const index = Math.min(26, Math.floor(lon / NAKSHATRA_SPAN + EPS));
  const degreeInNakshatra = Math.max(0, lon - index * NAKSHATRA_SPAN);
  const pada = (Math.min(3, Math.floor(degreeInNakshatra / PADA_SPAN + EPS)) +
    1) as Pada;
  return {
    index,
    info: NAKSHATRAS[index],
    pada,
    lord: NAKSHATRAS[index].lord,
    degreeInNakshatra,
    fraction: degreeInNakshatra / NAKSHATRA_SPAN,
  };
}

/** Sign, degree, nakshatra and pada for a sidereal longitude. */
export function placementOf(siderealLongitude: number): PlacementCore {
  const longitude = normDeg(siderealLongitude);
  const n = nakshatraOf(longitude);
  return {
    longitude,
    sign: signOf(longitude),
    degreeInSign: longitude % 30,
    nakshatra: n.index,
    pada: n.pada,
  };
}
