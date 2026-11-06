import test from "node:test";
import assert from "node:assert/strict";
import {
  SIGNS,
  astronomyEngineProvider,
  buildChart,
  createFixedEphemeris,
  julianDayFromStrings,
  siderealFrame,
} from "../../../src/lib/jyotish/index.js";
import type {
  CanonicalChart,
  EphemerisBody,
  Graha,
} from "../../../src/lib/jyotish/index.js";

// Reference chart: 1995-08-14 06:30 IST, Lucknow (26.85N, 80.95E).
// Expected sidereal (Lahiri) positions from the production chart.
const INPUT = {
  date: "1995-08-14",
  time: "06:30",
  utcOffsetHours: 5.5,
  lat: 26.85,
  lng: 80.95,
};
const EXPECTED: Record<Exclude<Graha, "Ketu">, [string, number, boolean?]> = {
  Sun: ["Cancer", 27.0],
  Moon: ["Pisces", 9.7],
  Mars: ["Virgo", 20.6],
  Mercury: ["Leo", 13.3],
  Jupiter: ["Scorpio", 11.9],
  Venus: ["Cancer", 25.1],
  Saturn: ["Aquarius", 29.8, true],
  Rahu: ["Libra", 6.0, true],
};

const signIndex = (name: string) => SIGNS.findIndex((s) => s.english === name);

function assertReference(chart: CanonicalChart, tolerance: number) {
  assert.ok(chart.lagna);
  assert.equal(SIGNS[chart.lagna.sign].english, "Leo");
  assert.ok(
    Math.abs(chart.lagna.degreeInSign - 7.7) < tolerance,
    `lagna ${chart.lagna.degreeInSign}`,
  );
  for (const [g, [signName, deg, retro]] of Object.entries(EXPECTED) as Array<
    [Graha, [string, number, boolean?]]
  >) {
    const p = chart.grahas[g];
    assert.equal(SIGNS[p.sign].english, signName, g);
    assert.ok(
      Math.abs(p.degreeInSign - deg) < tolerance,
      `${g} ${p.degreeInSign} vs ${deg}`,
    );
    if (retro !== undefined)
      assert.equal(p.retrograde, retro, `${g} retrograde`);
  }
  assert.equal(SIGNS[chart.grahas.Ketu.sign].english, "Aries");
  assert.ok(
    Math.abs(
      chart.grahas.Ketu.longitude - ((chart.grahas.Rahu.longitude + 180) % 360),
    ) < 1e-9,
  );
  // whole-sign houses from Leo
  assert.equal(chart.houses[0].sign, signIndex("Leo"));
  assert.equal(chart.grahas.Mercury.house, 1);
  assert.equal(chart.grahas.Sun.house, 12);
  assert.equal(chart.grahas.Saturn.house, 7);
  assert.equal(chart.grahas.Moon.house, 8);
  assert.ok(chart.houses[0].grahas.includes("Mercury"));
  assert.equal(chart.dasha.birthLord, "Saturn");
}

test("pipeline with a fake ephemeris: tropical = reference sidereal + computed ayanamsa", () => {
  const jdUT = julianDayFromStrings(
    INPUT.date,
    INPUT.time,
    INPUT.utcOffsetHours,
  );
  const probe = createFixedEphemeris({}, { equinox: "mean" });
  const ayanamsa = siderealFrame(probe, jdUT).ayanamsa;
  const speed: Partial<Record<Graha, number>> = {
    Saturn: -0.05,
    Rahu: -0.053,
    Moon: 13.2,
    Sun: 0.96,
  };
  const positions: Partial<
    Record<EphemerisBody, { longitude: number; speed: number }>
  > = {};
  for (const [g, [signName, deg]] of Object.entries(EXPECTED) as Array<
    [Graha, [string, number]]
  >) {
    const body: EphemerisBody =
      g === "Rahu" ? "MeanNode" : (g as EphemerisBody);
    positions[body] = {
      longitude: signIndex(signName) * 30 + deg + ayanamsa,
      speed: speed[g] ?? 1,
    };
  }
  const chart = buildChart(
    INPUT,
    createFixedEphemeris(positions, { equinox: "mean" }),
  );
  // Sidereal longitudes round-trip exactly; lagna comes from our own sidereal-time maths.
  assertReference(chart, 0.1);
  assert.ok(Math.abs(chart.grahas.Moon.degreeInSign - 9.7) < 1e-9);
  assert.equal(chart.ayanamsa.name, "lahiri");
  assert.equal(chart.ayanamsa.nutation, 0);
  assert.ok(Math.abs(chart.ayanamsa.value - 23.7958) < 0.001);
  assert.equal(chart.houseReference, "lagna");
  assert.equal(Object.keys(chart.vargas).length, 16);
  assert.equal(chart.vargas.D9?.grahas.Moon.sign, signIndex("Virgo")); // Pisces 9.7° → 3rd navamsha counted from Cancer = Virgo
});

test("time unknown: no lagna, houses counted from the Moon", () => {
  const chart = buildChart(
    { ...INPUT, time: undefined, timeUnknown: true },
    createFixedEphemeris(
      Object.fromEntries(
        [
          "Sun",
          "Moon",
          "Mars",
          "Mercury",
          "Jupiter",
          "Venus",
          "Saturn",
          "MeanNode",
        ].map((b, i) => [b, { longitude: 30 * i + 40, speed: 1 }]),
      ),
    ),
  );
  assert.equal(chart.lagna, undefined);
  assert.equal(chart.houseReference, "moon");
  assert.equal(chart.input.time, "12:00");
  assert.equal(chart.grahas.Moon.house, 1);
  assert.equal(chart.houses[0].sign, chart.grahas.Moon.sign);
  assert.equal(chart.vargas.D9?.lagna, undefined);
});

test("end-to-end with astronomy-engine reproduces the reference chart within 0.1°", () => {
  const chart = buildChart(INPUT, astronomyEngineProvider);
  assertReference(chart, 0.1);
  assert.equal(chart.ayanamsa.name, "lahiri");
  assert.ok(
    chart.ayanamsa.nutation !== 0,
    "true-equinox provider must apply nutation",
  );
  assert.equal(chart.grahas.Sun.retrograde, false);
  assert.equal(chart.grahas.Jupiter.retrograde, false);
  // Coordinator sanity: tropical Sun 140.799°, Moon 3.515° at 1995-08-14T01:00Z
  const jdUT = julianDayFromStrings(
    INPUT.date,
    INPUT.time,
    INPUT.utcOffsetHours,
  );
  assert.ok(
    Math.abs(
      astronomyEngineProvider.position("Sun", jdUT).longitude - 140.799,
    ) < 0.01,
  );
  assert.ok(
    Math.abs(astronomyEngineProvider.position("Moon", jdUT).longitude - 3.515) <
      0.01,
  );
});

test("true node option uses the TrueNode body", () => {
  const chart = buildChart(INPUT, astronomyEngineProvider, {
    node: "true",
    vargas: ["D9"],
  });
  assert.equal(chart.node, "true");
  assert.equal(SIGNS[chart.grahas.Rahu.sign].english, "Libra");
  assert.deepEqual(Object.keys(chart.vargas), ["D9"]);
});
