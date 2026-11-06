/**
 * Lahiri (Chitrapaksha) ayanamsa, reproducing Swiss Ephemeris SE_SIDM_LAHIRI.
 *
 * Definition (Swiss Ephemeris sweph.h, ayanamsa table entry 1):
 *   t0      = JD 2435553.5 TT (1956-09-22 0h)
 *   ayan_t0 = 23.250182778 − 0.004658035 degrees
 *             (23°15′00.658″ is the Indian Calendar Reform Committee /
 *             Indian Astronomical Ephemeris *true* value; the subtracted
 *             0.004658035° = 16.77″ is nutation in longitude at t0 (Wahr 1980),
 *             so ayan_t0 is the *mean* ayanamsa.)
 *   prec_offset = SEMOD_PREC_IAU_1976 — the value is tied to IAU 1976
 *             precession, which is what we use here.
 * https://github.com/aloistr/swisseph/blob/master/sweph.h
 *
 * The ayanamsa at t is ayan_t0 plus the ecliptic longitude, on the mean
 * ecliptic of date, of the t0 mean vernal point precessed to t
 * (Swiss Ephemeris swi_get_ayanamsa method).
 *
 * Mean vs true: Swiss `swe_get_ayanamsa_ut()` returns the MEAN ayanamsa.
 * Sidereal positions are tropical *apparent* longitudes (true equinox of date,
 * i.e. including nutation) minus the TRUE ayanamsa = mean + Δψ; nutation then
 * cancels, which is equivalent to subtracting the mean ayanamsa from mean-equinox
 * longitudes. `lahiriAyanamsa({ true: true })` gives the true value.
 *
 * Reference values (mean, checked in tests):
 *   JD 2415020.0 (1900 Jan 0.5 TT): 22.46047° = 22°27′37.7″ — Swiss Ephemeris
 *     documentation / NOVA (R. Hand), Indian Ephemeris & Nautical Almanac 1965 p.459;
 *     tabulated at https://saravali.github.io/astrology/aya_basics.html
 *   JD 2451545.0 (J2000 TT): 23.857092° — pyswisseph/libephemeris reference,
 *     https://kerykeion.net/libephemeris/docs/reference/ayanamsha
 */
import { nutation, precessedEquinoxLongitude } from "./astro-math.js";
import { jdUtToTt } from "./julian.js";
import { normDeg } from "./types.js";

export const LAHIRI_T0 = 2435553.5;
export const LAHIRI_AYAN_T0 = 23.250182778 - 0.004658035;

export interface AyanamsaOptions {
  /** Add nutation in longitude (true ayanamsa). Default false (mean). */
  true?: boolean;
}

/** Lahiri ayanamsa in degrees for a JD in TT. */
export function lahiriAyanamsa(
  jdTT: number,
  options: AyanamsaOptions = {},
): number {
  const mean = normDeg(
    LAHIRI_AYAN_T0 + precessedEquinoxLongitude(LAHIRI_T0, jdTT),
  );
  return options.true ? mean + nutation(jdTT).dPsi : mean;
}

/** Lahiri ayanamsa for a JD in UT (delta-T applied with the built-in polynomial). */
export function lahiriAyanamsaUT(
  jdUT: number,
  options: AyanamsaOptions = {},
): number {
  return lahiriAyanamsa(jdUtToTt(jdUT), options);
}

/** Format degrees as D°MM′SS.ss″. */
export function formatDms(deg: number, secondDecimals = 2): string {
  const sign = deg < 0 ? "-" : "";
  let x = Math.abs(deg);
  const d = Math.floor(x);
  x = (x - d) * 60;
  const m = Math.floor(x);
  const s = (x - m) * 60;
  return `${sign}${d}°${String(m).padStart(2, "0")}′${s.toFixed(secondDecimals).padStart(3 + secondDecimals, "0")}″`;
}
