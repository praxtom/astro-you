/**
 * Ephemeris boundary. The engine never computes planetary positions itself;
 * an adapter (see ephemeris-astronomy.ts) supplies them through this interface,
 * so the ephemeris library can be swapped without touching the Jyotish rules.
 */

export type EphemerisBody =
  | "Sun"
  | "Moon"
  | "Mercury"
  | "Venus"
  | "Mars"
  | "Jupiter"
  | "Saturn"
  | "MeanNode"
  | "TrueNode";

export interface BodyPosition {
  /** Tropical geocentric ecliptic longitude, degrees 0–360, equinox of date. */
  longitude: number;
  /** Ecliptic latitude, degrees (optional; unused by the rules). */
  latitude?: number;
  /** Longitude speed, degrees per day (negative = retrograde). */
  speed: number;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  /** Metres above sea level. */
  height?: number;
}

export type RiseSetEvent = "rise" | "set";

export interface EphemerisProvider {
  readonly name: string;
  /**
   * Which equinox the longitudes are referred to.
   * - "true": apparent positions on the true ecliptic/equinox of date (includes
   *   nutation) — Swiss Ephemeris default and what Drik panchangs use. The engine
   *   subtracts the TRUE Lahiri ayanamsa (mean + Δψ).
   * - "mean": mean equinox of date. The engine subtracts the MEAN ayanamsa.
   */
  readonly equinox: "true" | "mean";
  /** Position of a body at a JD in UT. */
  position(body: EphemerisBody, jdUT: number): BodyPosition;
  /** TT − UT in days. Optional; the engine falls back to its own polynomial. */
  deltaT?(jdUT: number): number;
  /** Nutation in longitude Δψ in degrees at JD (TT). Optional; built-in IAU 1980 otherwise. */
  nutationLongitude?(jdTT: number): number;
  /** Greenwich apparent sidereal time in degrees at JD (UT). Optional; built-in IAU 1982 otherwise. */
  siderealTime?(jdUT: number): number;
  /** True obliquity of the ecliptic in degrees at JD (TT). Optional; built-in otherwise. */
  trueObliquity?(jdTT: number): number;
  /**
   * Next rise/set of the Sun or Moon after `jdStartUT` (UT), searching up to
   * `limitDays` days (negative searches backwards). Returns JD (UT) or null
   * (e.g. polar day/night).
   */
  riseSet(
    body: "Sun" | "Moon",
    event: RiseSetEvent,
    jdStartUT: number,
    location: GeoLocation,
    limitDays?: number,
  ): number | null;
}

/**
 * Test fake: returns fixed tropical positions regardless of time (speeds as
 * given) and a linear sunrise/sunset. Not for production use.
 */
export function createFixedEphemeris(
  positions: Partial<Record<EphemerisBody, BodyPosition>>,
  options: {
    equinox?: "true" | "mean";
    siderealTime?: (jdUT: number) => number;
    nutationLongitude?: (jdTT: number) => number;
    sunriseHourUT?: number;
    sunsetHourUT?: number;
  } = {},
): EphemerisProvider {
  return {
    name: "fixed-test-fake",
    equinox: options.equinox ?? "mean",
    position(body) {
      const p = positions[body];
      if (!p) throw new Error(`Fixed ephemeris has no position for ${body}`);
      return p;
    },
    nutationLongitude: options.nutationLongitude,
    siderealTime: options.siderealTime,
    riseSet(_body, event, jdStartUT, _location, limitDays = 1) {
      const hour =
        event === "rise"
          ? (options.sunriseHourUT ?? 0.5)
          : (options.sunsetHourUT ?? 12.5);
      const base = Math.floor(jdStartUT - 0.5) + 0.5 + hour / 24;
      const step = limitDays >= 0 ? 1 : -1;
      let jd = base;
      if (step > 0) while (jd <= jdStartUT) jd += 1;
      else while (jd >= jdStartUT) jd -= 1;
      return Math.abs(jd - jdStartUT) <= Math.abs(limitDays) ? jd : null;
    },
  };
}
