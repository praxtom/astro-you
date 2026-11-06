/**
 * Small, dependency-free astronomical helpers: nutation, obliquity,
 * sidereal time, IAU 1976 precession and the ascendant.
 *
 * Sources:
 * - Nutation: IAU 1980 theory (Wahr), periodic terms with |coefficient| ≥
 *   0.0003″ as tabulated in Meeus, "Astronomical Algorithms" 2nd ed., table 22.A.
 *   Accuracy ~0.01″ — far below anything a chart can show.
 * - Obliquity: IAU 1976 (Lieske), Meeus eq. 22.2.
 * - Sidereal time: IAU 1982 GMST, Meeus eq. 12.4; apparent = mean + Δψ·cos ε.
 * - Precession: IAU 1976 (Lieske 1977) ζ, z, θ angles from J2000 — the model
 *   Swiss Ephemeris pins for SE_SIDM_LAHIRI (prec_offset = SEMOD_PREC_IAU_1976).
 */
import { normDeg } from "./types.js";
import { J2000 } from "./julian.js";

const DEG = Math.PI / 180;
const ARCSEC = DEG / 3600;

// [D, M, M', F, Ω, Δψ sin coeff, Δψ T coeff, Δε cos coeff, Δε T coeff] in 0.0001″
const NUTATION_TERMS: number[][] = [
  [0, 0, 0, 0, 1, -171996, -174.2, 92025, 8.9],
  [-2, 0, 0, 2, 2, -13187, -1.6, 5736, -3.1],
  [0, 0, 0, 2, 2, -2274, -0.2, 977, -0.5],
  [0, 0, 0, 0, 2, 2062, 0.2, -895, 0.5],
  [0, 1, 0, 0, 0, 1426, -3.4, 54, -0.1],
  [0, 0, 1, 0, 0, 712, 0.1, -7, 0],
  [-2, 1, 0, 2, 2, -517, 1.2, 224, -0.6],
  [0, 0, 0, 2, 1, -386, -0.4, 200, 0],
  [0, 0, 1, 2, 2, -301, 0, 129, -0.1],
  [-2, -1, 0, 2, 2, 217, -0.5, -95, 0.3],
  [-2, 0, 1, 0, 0, -158, 0, 0, 0],
  [-2, 0, 0, 2, 1, 129, 0.1, -70, 0],
  [0, 0, -1, 2, 2, 123, 0, -53, 0],
  [2, 0, 0, 0, 0, 63, 0, 0, 0],
  [0, 0, 1, 0, 1, 63, 0.1, -33, 0],
  [2, 0, -1, 2, 2, -59, 0, 26, 0],
  [0, 0, -1, 0, 1, -58, -0.1, 32, 0],
  [0, 0, 1, 2, 1, -51, 0, 27, 0],
  [-2, 0, 2, 0, 0, 48, 0, 0, 0],
  [0, 0, -2, 2, 1, 46, 0, -24, 0],
  [2, 0, 0, 2, 2, -38, 0, 16, 0],
  [0, 0, 2, 2, 2, -31, 0, 13, 0],
  [0, 0, 2, 0, 0, 29, 0, 0, 0],
  [-2, 0, 1, 2, 2, 29, 0, -12, 0],
  [0, 0, 0, 2, 0, 26, 0, 0, 0],
  [-2, 0, 0, 2, 0, -22, 0, 0, 0],
  [0, 0, -1, 2, 1, 21, 0, -10, 0],
  [0, 2, 0, 0, 0, 17, -0.1, 0, 0],
  [2, 0, -1, 0, 1, 16, 0, -8, 0],
  [-2, 2, 0, 2, 2, -16, 0.1, 7, 0],
  [0, 1, 0, 0, 1, -15, 0, 9, 0],
  [-2, 0, 1, 0, 1, -13, 0, 7, 0],
  [0, -1, 0, 0, 1, -12, 0, 6, 0],
  [0, 0, 2, -2, 0, 11, 0, 0, 0],
  [2, 0, -1, 2, 1, -10, 0, 5, 0],
  [2, 0, 1, 2, 2, -8, 0, 3, 0],
  [0, 1, 0, 2, 2, 7, 0, -3, 0],
  [-2, 1, 1, 0, 0, -7, 0, 0, 0],
  [0, -1, 0, 2, 2, -7, 0, 3, 0],
  [2, 0, 0, 2, 1, -7, 0, 3, 0],
  [2, 0, 1, 0, 0, 6, 0, 0, 0],
  [-2, 0, 2, 2, 2, 6, 0, -3, 0],
  [-2, 0, 1, 2, 1, 6, 0, -3, 0],
  [2, 0, -2, 0, 1, -6, 0, 3, 0],
  [2, 0, 0, 0, 1, -6, 0, 3, 0],
  [0, -1, 1, 0, 0, 5, 0, 0, 0],
  [-2, -1, 0, 2, 1, -5, 0, 3, 0],
  [-2, 0, 0, 0, 1, -5, 0, 3, 0],
  [0, 0, 2, 2, 1, -5, 0, 3, 0],
];

export interface Nutation {
  /** Nutation in longitude, degrees. */
  dPsi: number;
  /** Nutation in obliquity, degrees. */
  dEps: number;
}

/** IAU 1980 nutation for a JD in TT. */
export function nutation(jdTT: number): Nutation {
  const T = (jdTT - J2000) / 36525;
  const D =
    (297.85036 + 445267.11148 * T - 0.0019142 * T * T + (T * T * T) / 189474) *
    DEG;
  const M =
    (357.52772 + 35999.05034 * T - 0.0001603 * T * T - (T * T * T) / 300000) *
    DEG;
  const Mp =
    (134.96298 + 477198.867398 * T + 0.0086972 * T * T + (T * T * T) / 56250) *
    DEG;
  const F =
    (93.27191 + 483202.017538 * T - 0.0036825 * T * T + (T * T * T) / 327270) *
    DEG;
  const Om =
    (125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000) *
    DEG;
  let dPsi = 0;
  let dEps = 0;
  for (const [d, m, mp, f, om, s0, s1, c0, c1] of NUTATION_TERMS) {
    const arg = d * D + m * M + mp * Mp + f * F + om * Om;
    dPsi += (s0 + s1 * T) * Math.sin(arg);
    dEps += (c0 + c1 * T) * Math.cos(arg);
  }
  return { dPsi: (dPsi * 0.0001) / 3600, dEps: (dEps * 0.0001) / 3600 };
}

/** Mean obliquity of the ecliptic (IAU 1976), degrees, JD in TT. */
export function meanObliquity(jdTT: number): number {
  const T = (jdTT - J2000) / 36525;
  return (
    (84381.448 - 46.815 * T - 0.00059 * T * T + 0.001813 * T * T * T) / 3600
  );
}

/** True obliquity (mean + Δε), degrees. */
export function trueObliquity(jdTT: number): number {
  return meanObliquity(jdTT) + nutation(jdTT).dEps;
}

/** Greenwich mean sidereal time in degrees (IAU 1982), JD in UT. */
export function greenwichMeanSiderealTime(jdUT: number): number {
  const T = (jdUT - J2000) / 36525;
  return normDeg(
    280.46061837 +
      360.98564736629 * (jdUT - J2000) +
      0.000387933 * T * T -
      (T * T * T) / 38710000,
  );
}

/** Greenwich apparent sidereal time in degrees. */
export function greenwichApparentSiderealTime(
  jdUT: number,
  jdTT: number,
): number {
  const n = nutation(jdTT);
  const eps = meanObliquity(jdTT) + n.dEps;
  return normDeg(
    greenwichMeanSiderealTime(jdUT) + n.dPsi * Math.cos(eps * DEG),
  );
}

/**
 * Tropical ecliptic longitude of the ascendant (degrees).
 * @param lstDeg local apparent sidereal time (= RAMC) in degrees
 * @param obliquityDeg true obliquity of date
 * @param latDeg geographic latitude (north positive)
 */
export function ascendantFromSiderealTime(
  lstDeg: number,
  obliquityDeg: number,
  latDeg: number,
): number {
  const r = lstDeg * DEG;
  const e = obliquityDeg * DEG;
  const phi = latDeg * DEG;
  const asc = Math.atan2(
    Math.cos(r),
    -(Math.sin(r) * Math.cos(e) + Math.tan(phi) * Math.sin(e)),
  );
  return normDeg(asc / DEG);
}

/** Tropical longitude of the midheaven (MC), degrees. */
export function midheavenFromSiderealTime(
  lstDeg: number,
  obliquityDeg: number,
): number {
  const r = lstDeg * DEG;
  const e = obliquityDeg * DEG;
  return normDeg(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(e)) / DEG);
}

type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];

function rotZ(a: number): Mat3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [c, s, 0],
    [-s, c, 0],
    [0, 0, 1],
  ];
}
function rotY(a: number): Mat3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [c, 0, -s],
    [0, 1, 0],
    [s, 0, c],
  ];
}
function mul(a: Mat3, b: Mat3): Mat3 {
  const out: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      out[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
  return out;
}
function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}
function transpose(m: Mat3): Mat3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

/** IAU 1976 precession matrix: mean equator/equinox J2000 → mean of date (TT). */
export function precessionMatrixFromJ2000(jdTT: number): Mat3 {
  const t = (jdTT - J2000) / 36525;
  const zeta =
    (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) * ARCSEC;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) * ARCSEC;
  const theta =
    (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) * ARCSEC;
  // P = R3(−z) · R2(θ) · R3(−ζ)
  return mul(rotZ(-z), mul(rotY(theta), rotZ(-zeta)));
}

/**
 * Ecliptic longitude, on the mean ecliptic & equinox of `jdTT`, of the mean
 * vernal point of epoch `jdT0` (both TT). This is the accumulated general
 * precession from t0 to t, and is how Swiss Ephemeris derives an ayanamsa
 * from its (t0, ayan_t0) definition.
 */
export function precessedEquinoxLongitude(jdT0: number, jdTT: number): number {
  const v0: Vec3 = [1, 0, 0]; // equinox of t0 in mean equatorial frame of t0
  const vJ2000 = apply(transpose(precessionMatrixFromJ2000(jdT0)), v0);
  const vDate = apply(precessionMatrixFromJ2000(jdTT), vJ2000);
  const eps = meanObliquity(jdTT) * DEG;
  const x = vDate[0];
  const y = vDate[1] * Math.cos(eps) + vDate[2] * Math.sin(eps);
  const lon = Math.atan2(y, x) / DEG;
  return lon > 180 ? lon - 360 : lon < -180 ? lon + 360 : lon;
}
