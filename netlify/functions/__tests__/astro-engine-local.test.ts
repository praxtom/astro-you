import test from "node:test";
import assert from "node:assert/strict";
import {
  astroEngineMode,
  localDashaPeriods,
  localNatalChart,
  localPanchang,
  tryLocalEngine,
} from "../shared/astro-engine.js";
import {
  nakshatraFromSidereal,
  shapeTimeUnknownChart,
} from "../shared/astro-api.js";
import { chartErrorResponse } from "../shared/kundali-errors.js";
import { normalizePanchangResponse } from "../../../src/lib/panchang-normalize.js";

// Reference chart shared with jyotish-chart.test / jyotish-dasha.test:
// 1995-08-14 06:30 IST, Lucknow (26.85N, 80.95E), production positions.
const LUCKNOW_1995 = {
  dob: "1995-08-14",
  tob: "06:30",
  pob: "Lucknow",
  lat: 26.85,
  lng: 80.95,
};
const EXPECTED: Record<string, [string, number, number, boolean?]> = {
  // name: [sign code, degree, house, retrograde?]
  Sun: ["Can", 27.0, 12],
  Moon: ["Pis", 9.7, 8],
  Mars: ["Vir", 20.6, 2],
  Mercury: ["Leo", 13.3, 1],
  Jupiter: ["Sco", 11.9, 4],
  Venus: ["Can", 25.1, 12],
  Saturn: ["Aqu", 29.8, 7, true],
  Mean_Node: ["Lib", 6.0, 3, true],
  Mean_South_Node: ["Ari", 6.0, 9, true],
};

test("ASTRO_ENGINE defaults to api; only 'local' switches", () => {
  assert.equal(astroEngineMode({}), "api");
  assert.equal(astroEngineMode({ ASTRO_ENGINE: "api" }), "api");
  assert.equal(astroEngineMode({ ASTRO_ENGINE: "something" }), "api");
  assert.equal(astroEngineMode({ ASTRO_ENGINE: " Local " }), "local");
  let ran = false;
  assert.equal(
    tryLocalEngine(
      "x",
      () => {
        ran = true;
        return 1;
      },
      {},
    ),
    null,
  );
  assert.equal(ran, false, "flag off: never computes");
});

test("local D1 matches the reference chart in the API path's KundaliData shape", () => {
  const chart = localNatalChart(LUCKNOW_1995);
  assert.ok(chart);
  assert.deepEqual(chart.ascendant?.sign, "Leo");
  assert.ok(Math.abs((chart.ascendant?.degree ?? 0) - 7.7) < 0.1);
  assert.deepEqual(
    chart.planetary_positions.map((p) => p.name),
    Object.keys(EXPECTED).sort(
      (a, b) =>
        [
          "Sun",
          "Moon",
          "Mercury",
          "Venus",
          "Mars",
          "Jupiter",
          "Saturn",
          "Mean_Node",
          "Mean_South_Node",
        ].indexOf(a) -
        [
          "Sun",
          "Moon",
          "Mercury",
          "Venus",
          "Mars",
          "Jupiter",
          "Saturn",
          "Mean_Node",
          "Mean_South_Node",
        ].indexOf(b),
    ),
  );
  for (const p of chart.planetary_positions) {
    const [sign, degree, house, retro] = EXPECTED[p.name];
    assert.equal(p.sign, sign, p.name);
    assert.equal(p.signCode, sign, p.name);
    assert.ok(
      Math.abs(p.degree - degree) < 0.1,
      `${p.name} ${p.degree} vs ${degree}`,
    );
    assert.equal(p.house, house, `${p.name} house`);
    if (retro !== undefined)
      assert.equal(p.is_retrograde, retro, `${p.name} retro`);
    // Same nakshatra the API path derives from sign + degree.
    assert.equal(p.nakshatra, nakshatraFromSidereal(p.sign, p.degree), p.name);
  }
  // Whole-sign cusps from the Lagna, like normalizeVedicD1Response.
  assert.equal(chart.house_cusps.length, 12);
  assert.deepEqual(chart.house_cusps[0], { house: 1, sign: "Leo", degree: 0 });
  assert.deepEqual(chart.house_cusps[11], {
    house: 12,
    sign: "Can",
    degree: 0,
  });
});

test("local D1 with unknown birth time shapes like the API path", () => {
  const chart = localNatalChart({
    ...LUCKNOW_1995,
    tob: "12:00",
    birthTimeUnknown: true,
  });
  assert.ok(chart);
  const shaped = shapeTimeUnknownChart(chart);
  assert.equal(shaped.timeUnknown, true);
  assert.equal(shaped.house_cusps.length, 0);
  assert.equal(
    shaped.planetary_positions.find((p) => p.name === "Moon")?.house,
    1,
  );
});

test("local dashas match the reference: Saturn at birth, Ketu/Jupiter in Nov 2026", () => {
  const periods = localDashaPeriods(
    LUCKNOW_1995,
    Date.parse("2026-11-07T00:00:00Z"),
  );
  assert.ok(periods);
  assert.equal(periods[0].planet, "Saturn");
  assert.match(periods[0].startDate, /^\d{4}-\d{2}-\d{2}$/);
  const current = periods.filter((p) => p.isCurrent);
  assert.equal(current.length, 1);
  assert.equal(current[0].planet, "Ketu");
  const sub = current[0].subPeriods?.filter((s) => s.isCurrent) ?? [];
  assert.equal(sub.length, 1);
  assert.equal(sub[0].planet, "Jupiter");
  assert.equal(current[0].subPeriods?.length, 9);
  // Every other mahadasha's sub-periods are not current.
  assert.ok(
    periods
      .filter((p) => !p.isCurrent)
      .every((p) => (p.subPeriods ?? []).every((s) => !s.isCurrent)),
  );
});

test("local engine declines without coordinates (caller falls back to the API)", () => {
  assert.equal(
    localNatalChart({ dob: "1995-08-14", tob: "06:30", pob: "Lucknow" }),
    null,
  );
  assert.equal(
    localDashaPeriods({ dob: "1995-08-14", tob: "06:30", pob: "Lucknow" }),
    null,
  );
});

test("a DST-gap birth time is the same 422 dst_ambiguous as the API path", () => {
  let err: unknown;
  try {
    // Denver, spring-forward gap.
    localNatalChart({
      dob: "2020-03-08",
      tob: "02:30",
      pob: "Denver",
      lat: 39.7392,
      lng: -104.9903,
    });
  } catch (e) {
    err = e;
  }
  assert.ok(err, "throws");
  assert.equal(chartErrorResponse(err)?.status, 422);
  assert.equal(chartErrorResponse(err)?.body.code, "dst_ambiguous");
  // tryLocalEngine lets classified chart errors through instead of falling back.
  assert.throws(
    () =>
      tryLocalEngine(
        "D1",
        () =>
          localNatalChart({
            dob: "2020-03-08",
            tob: "02:30",
            pob: "Denver",
            lat: 39.7392,
            lng: -104.9903,
          }),
        { ASTRO_ENGINE: "local" },
      ),
    { name: "AstroChartError" },
  );
});

test("local panchang (Lucknow 2026-11-06, Drik reference) reads through the client normalizer", () => {
  const raw = localPanchang("2026-11-06", { lat: 26.83928, lng: 80.92313 });
  assert.equal(raw.source, "local");
  const summary = normalizePanchangResponse(raw);
  assert.equal(summary.tithi, "Dwadashi");
  assert.equal(summary.nakshatra, "Hasta");
  assert.equal(summary.yoga, "Vishkumbha");
  assert.equal(summary.karana, "Taitila");
  const minutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  assert.ok(
    Math.abs(minutes(summary.sunrise) - minutes("06:19")) <= 2,
    summary.sunrise,
  );
  assert.ok(
    Math.abs(minutes(summary.sunset) - minutes("17:20")) <= 2,
    summary.sunset,
  );
  const [rkStart, rkEnd] = summary.rahuKaal.split(/\s*[-–]\s*/);
  assert.ok(
    Math.abs(minutes(rkStart) - minutes("10:27")) <= 2,
    summary.rahuKaal,
  );
  assert.ok(Math.abs(minutes(rkEnd) - minutes("11:50")) <= 2, summary.rahuKaal);
  assert.ok(summary.abhijitMuhurat, "abhijit present");
  // Nothing about the place is echoed back (shared-cache privacy rule).
  assert.equal("location" in raw, false);
});
