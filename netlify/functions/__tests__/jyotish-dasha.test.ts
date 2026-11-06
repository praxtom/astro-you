import test from "node:test";
import assert from "node:assert/strict";
import {
  currentPeriods,
  dateToJd,
  julianDayFromStrings,
  vimshottariDasha,
} from "../../../src/lib/jyotish/index.js";

const birthJd = julianDayFromStrings("1995-08-14", "06:30", 5.5);
const moon = 330 + 9.72; // Pisces 9.72°
const jd = (iso: string) => dateToJd(new Date(iso));
const near = (actualJd: number, iso: string, days: number) =>
  assert.ok(
    Math.abs(actualJd - jd(iso)) <= days,
    `${new Date((actualJd - 2440587.5) * 86400000).toISOString()} vs ${iso}`,
  );

test("Vimshottari: reference chart (Moon 9.7° Pisces, 1995-08-14)", () => {
  const d = vimshottariDasha(moon, birthJd);
  assert.equal(d.birthLord, "Saturn");
  assert.ok(
    d.balanceYears > 9.8 && d.balanceYears < 10.0,
    `balance ${d.balanceYears}`,
  );
  const [sat, mer, ket, ven] = d.mahadashas;
  assert.deepEqual(
    [sat.lord, mer.lord, ket.lord, ven.lord],
    ["Saturn", "Mercury", "Ketu", "Venus"],
  );
  near(mer.startJd, "2005-07-09T00:00:00Z", 30);
  near(mer.endJd, "2022-07-09T00:00:00Z", 30);
  near(ket.endJd, "2029-07-09T00:00:00Z", 30);
  assert.equal(d.mahadashas.length, 9);
  assert.ok(sat.startJd < birthJd && birthJd < sat.endJd);
  // contiguous periods
  for (let i = 1; i < 9; i++)
    assert.equal(d.mahadashas[i].startJd, d.mahadashas[i - 1].endJd);
  // antardashas fill the mahadasha exactly and start with its own lord
  assert.equal(ket.sub?.[0].lord, "Ketu");
  assert.equal(ket.sub?.[8].endJd, ket.endJd);
});

test("Vimshottari: current periods in Nov 2026 = Ketu / Jupiter", () => {
  const d = vimshottariDasha(moon, birthJd);
  const now = currentPeriods(d, jd("2026-11-07T00:00:00Z"));
  assert.ok(now);
  assert.equal(now.mahadasha.lord, "Ketu");
  assert.equal(now.antardasha.lord, "Jupiter");
  near(now.antardasha.startJd, "2026-06-27T00:00:00Z", 21);
  assert.ok(now.pratyantardasha.startJd <= jd("2026-11-07T00:00:00Z"));
  assert.equal(now.pratyantardasha.level, 3);
  // depth 1 still resolves AD/PD on the fly
  const shallow = vimshottariDasha(moon, birthJd, { depth: 1 });
  assert.equal(shallow.mahadashas[0].sub, undefined);
  assert.equal(
    currentPeriods(shallow, jd("2026-11-07T00:00:00Z"))?.antardasha.lord,
    "Jupiter",
  );
  assert.equal(currentPeriods(d, birthJd - 365.25 * 20), null);
});

test("Vimshottari: year length is a parameter", () => {
  const a = vimshottariDasha(moon, birthJd, { yearLengthDays: 365.2425 });
  const b = vimshottariDasha(moon, birthJd, { yearLengthDays: 365.25 });
  assert.equal(a.yearLengthDays, 365.2425);
  const shift = b.mahadashas[2].endJd - a.mahadashas[2].endJd;
  assert.ok(shift > 0 && shift < 1, `shift ${shift}`);
});

test("Vimshottari: nakshatra boundaries", () => {
  const start = vimshottariDasha(0, 2451545);
  assert.equal(start.birthLord, "Ketu");
  assert.ok(Math.abs(start.balanceYears - 7) < 1e-9);
  const late = vimshottariDasha(360 / 27 - 1e-6, 2451545);
  assert.equal(late.birthLord, "Ketu"); // still Ashwini, almost fully elapsed
  assert.ok(late.balanceYears < 1e-3);
});
