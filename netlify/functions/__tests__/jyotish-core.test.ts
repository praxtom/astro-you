import test from "node:test";
import assert from "node:assert/strict";
import {
  J2000,
  ascendantFromSiderealTime,
  calendarFromJulianDay,
  deltaTSeconds,
  greenwichApparentSiderealTime,
  greenwichMeanSiderealTime,
  julianDayFromCalendar,
  julianDayFromStrings,
  lahiriAyanamsa,
  LAHIRI_T0,
  meanObliquity,
  nakshatraOf,
  nutation,
  placementOf,
} from "../../../src/lib/jyotish/index.js";

const ARCSEC = 1 / 3600;

test("julian day: Meeus examples and IST birth moment", () => {
  assert.equal(julianDayFromCalendar(2000, 1, 1.5), J2000);
  // Meeus example 7.a: 1957 October 4.81 → JD 2436116.31
  assert.ok(
    Math.abs(julianDayFromCalendar(1957, 10, 4.81) - 2436116.31) < 1e-6,
  );
  // 1995-08-14 06:30 IST = 01:00 UT
  assert.ok(
    Math.abs(
      julianDayFromStrings("1995-08-14", "06:30", 5.5) - (2449943.5 + 1 / 24),
    ) < 1e-9,
  );
  const cal = calendarFromJulianDay(2449943.5 + 1 / 24);
  assert.deepEqual(
    [cal.year, cal.month, cal.day, cal.hour, cal.minute],
    [1995, 8, 14, 1, 0],
  );
  assert.throws(() => julianDayFromStrings("1995-13-01", "06:30", 5.5));
  assert.throws(() => julianDayFromStrings("14/08/1995", "06:30", 5.5));
});

test("delta-T polynomial is in the published range", () => {
  assert.ok(Math.abs(deltaTSeconds(2000) - 63.86) < 0.01);
  assert.ok(Math.abs(deltaTSeconds(1995.6) - 61.2) < 1); // IERS observed ≈ 61 s
  assert.ok(Math.abs(deltaTSeconds(1950) - 29.07) < 0.01);
});

test("nutation and obliquity match Meeus example 22.a (1987 Apr 10 0h TD)", () => {
  const jd = 2446895.5;
  const n = nutation(jd);
  assert.ok(Math.abs(n.dPsi / ARCSEC - -3.788) < 0.01);
  assert.ok(Math.abs(n.dEps / ARCSEC - 9.443) < 0.01);
  // ε0 = 23°26′27.407″
  assert.ok(
    Math.abs(meanObliquity(jd) - (23 + 26 / 60 + 27.407 / 3600)) <
      0.001 * ARCSEC * 10,
  );
});

test("sidereal time matches Meeus example 12.a", () => {
  // 1987 Apr 10 0h UT: GMST 13h10m46.3668s, GAST 13h10m46.1351s
  const gmst = greenwichMeanSiderealTime(2446895.5) / 15;
  const gast = greenwichApparentSiderealTime(2446895.5, 2446895.5) / 15;
  assert.ok(Math.abs(gmst - (13 + 10 / 60 + 46.3668 / 3600)) * 3600 < 0.01);
  assert.ok(Math.abs(gast - (13 + 10 / 60 + 46.1351 / 3600)) * 3600 < 0.02);
});

test("ascendant geometry", () => {
  assert.ok(Math.abs(ascendantFromSiderealTime(0, 23.44, 0) - 90) < 1e-9);
  assert.ok(Math.abs(ascendantFromSiderealTime(90, 23.44, 0) - 180) < 1e-9);
  const asc270 = ascendantFromSiderealTime(270, 23.44, 0);
  assert.ok(Math.min(asc270, 360 - asc270) < 1e-9, `asc ${asc270}`);
});

test("Lahiri ayanamsa reproduces Swiss Ephemeris SE_SIDM_LAHIRI", () => {
  // Swiss definition: mean value at t0 (1956-09-22 0h TT)
  assert.ok(
    Math.abs(lahiriAyanamsa(LAHIRI_T0) - (23.250182778 - 0.004658035)) < 1e-9,
  );
  // ...and the subtracted constant is the nutation at t0 (16.77″, Wahr 1980)
  assert.ok(Math.abs(nutation(LAHIRI_T0).dPsi - 0.004658035) < 0.05 * ARCSEC);
  // J2000: 23.857092° (pyswisseph / libephemeris reference)
  assert.ok(Math.abs(lahiriAyanamsa(J2000) - 23.857092) < 0.05 * ARCSEC);
  // 1900 Jan 0.5 (JD 2415020.0): 22°27′37.7″ = 22.46047° (Swiss docs / NOVA / IENA 1965)
  assert.ok(Math.abs(lahiriAyanamsa(2415020.0) - 22.46047) < 0.5 * ARCSEC);
  // Rate ~50.29″/yr near 2000
  const rate =
    (lahiriAyanamsa(J2000 + 365.25) - lahiriAyanamsa(J2000)) / ARCSEC;
  assert.ok(rate > 50.2 && rate < 50.4, `rate ${rate}`);
  // True ayanamsa = mean + Δψ
  const jd = 2449943.5;
  assert.ok(
    Math.abs(
      lahiriAyanamsa(jd, { true: true }) -
        lahiriAyanamsa(jd) -
        nutation(jd).dPsi,
    ) < 1e-12,
  );
});

test("nakshatra and pada from sidereal longitude", () => {
  assert.deepEqual(
    [nakshatraOf(0).info.english, nakshatraOf(0).pada, nakshatraOf(0).lord],
    ["Ashwini", 1, "Ketu"],
  );
  assert.equal(nakshatraOf(360 / 27).info.english, "Bharani");
  assert.equal(nakshatraOf(3 + 1 / 3).pada, 2);
  const moon = nakshatraOf(330 + 9.72); // reference Moon, Pisces 9.72°
  assert.deepEqual(
    [moon.info.english, moon.pada, moon.lord],
    ["Uttara Bhadrapada", 2, "Saturn"],
  );
  assert.deepEqual(
    [nakshatraOf(359.99).info.english, nakshatraOf(359.99).pada],
    ["Revati", 4],
  );
  const p = placementOf(-10);
  assert.equal(p.sign, 11);
  assert.ok(Math.abs(p.degreeInSign - 20) < 1e-9);
});
