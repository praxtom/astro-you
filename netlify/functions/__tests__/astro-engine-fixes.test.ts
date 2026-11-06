import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTransitTime,
  getCoreNumbers,
  getDailyHoroscopeText,
  getEclipseInterpretation,
  getLunarPhases,
  getNatalChart,
  getNumerologyReading,
  getRemedies,
  getTransitChart,
  getVarshaphal,
  getWeeklyHoroscopePDF,
  getDailyHoroscopePDF,
  normalizeVedicD1Response,
  parseDashaResponse,
  readingInstant,
  resolveHoroscopeSign,
  shapeTimeUnknownChart,
  type BirthData,
} from "../shared/astro-api.js";
import {
  chartCacheKey,
  markCurrentDashaPeriods,
  refreshDashaCurrentFlags,
} from "../shared/chart-cache.js";
import { chartErrorResponse } from "../shared/kundali-errors.js";

const BIRTH: BirthData = {
  name: "Asha",
  dob: "1990-05-15",
  tob: "14:30",
  pob: "New Delhi",
  lat: 28.6139,
  lng: 77.209,
};

interface Captured {
  url: string;
  body: any;
}

/** Stub fetch, run `fn`, and return every request it made. */
async function capture(
  fn: () => Promise<unknown>,
  respond: (url: string) => Response = () =>
    new Response(JSON.stringify({ data: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
): Promise<Captured[]> {
  const calls: Captured[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: any, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return respond(String(url));
  }) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
  return calls;
}

// ── #1 current dasha ─────────────────────────────────────────────────────────

const DASHA_RESPONSE = {
  mahadashas: [
    {
      planet: "Venus",
      start_date: "2010-05-11",
      end_date: "2030-05-11",
      antardashas: [
        { planet: "Venus", start_date: "2010-05-11", end_date: "2013-09-11" },
        { planet: "Sun", start_date: "2025-05-11", end_date: "2026-09-11" },
        { planet: "Moon", start_date: "2026-09-11", end_date: "2028-05-11" },
      ],
    },
    { planet: "Sun", start_date: "2030-05-11", end_date: "2036-05-11" },
  ],
};

test("dasha: current_period from the response marks the running periods", () => {
  // No is_current flags anywhere; `now` deliberately disagrees with the dates
  // (it is in the Moon antardasha) — the upstream summary wins on a fetch.
  const periods = parseDashaResponse(
    {
      ...DASHA_RESPONSE,
      current_period: {
        mahadasha: "Venus",
        mahadasha_end: "2030-05-11",
        antardasha: "Sun",
        antardasha_end: "2026-09-11",
      },
    },
    Date.parse("2026-11-07T00:00:00Z"),
  );
  assert.equal(periods[0].isCurrent, true);
  assert.equal(periods[1].isCurrent, false);
  assert.deepEqual(
    periods[0].subPeriods!.map((s) => [s.planet, s.isCurrent]),
    [
      ["Venus", false],
      ["Sun", true],
      ["Moon", false],
    ],
  );
});

test("dasha: without current_period the running periods come from the dates", () => {
  const now = Date.parse("2026-11-07T00:00:00Z");
  const periods = parseDashaResponse(DASHA_RESPONSE, now);
  assert.equal(periods[0].isCurrent, true);
  assert.equal(periods[1].isCurrent, false);
  assert.equal(periods[0].subPeriods!.find((s) => s.isCurrent)?.planet, "Moon");
  // The cache-read recompute is the same helper, so it agrees.
  assert.deepEqual(refreshDashaCurrentFlags(periods, now), periods);
  // ...and a years-later read moves the flag to the next Mahadasha.
  const later = refreshDashaCurrentFlags(periods, Date.parse("2031-01-01"));
  assert.deepEqual(
    later.map((p) => p.isCurrent),
    [false, true],
  );
});

test("dasha: a current_period naming no listed period falls back to dates", () => {
  const now = Date.parse("2026-11-07T00:00:00Z");
  const periods = markCurrentDashaPeriods(
    [
      { planet: "Venus", startDate: "2010-05-11", endDate: "2030-05-11", isCurrent: false },
      { planet: "Sun", startDate: "2030-05-11", endDate: "2036-05-11", isCurrent: false },
    ],
    { now, currentPeriod: { mahadasha: "Jupiter" } },
  );
  assert.deepEqual(
    periods.map((p) => p.isCurrent),
    [true, false],
  );
});

// ── #2 birth time unknown ────────────────────────────────────────────────────

test("time unknown: D1 drops the Lagna and counts houses from the Moon", () => {
  const shaped = shapeTimeUnknownChart({
    planetary_positions: [
      {
        name: "Ascendant",
        sign: "Leo",
        signCode: "Leo",
        degree: 5,
        house: 1,
        is_retrograde: false,
      },
      {
        name: "Moon",
        sign: "Tau",
        signCode: "Tau",
        degree: 12,
        house: 10,
        is_retrograde: false,
        nakshatra: "Rohini",
      },
      {
        name: "Sun",
        sign: "Ari",
        signCode: "Ari",
        degree: 1,
        house: 9,
        is_retrograde: false,
      },
      {
        name: "Saturn",
        sign: "Cap",
        signCode: "Cap",
        degree: 20,
        house: 6,
        is_retrograde: false,
      },
    ],
    house_cusps: [{ house: 1, sign: "Leo", degree: 5 }],
    ascendant: { sign: "Leo", degree: 5 },
  });
  assert.equal(shaped.timeUnknown, true);
  assert.equal(shaped.houseReference, "moon");
  assert.equal(shaped.ascendant, undefined);
  assert.deepEqual(shaped.house_cusps, []);
  assert.deepEqual(
    shaped.planetary_positions.map((p) => [p.name, p.sign, p.house]),
    [
      ["Moon", "Tau", 1],
      ["Sun", "Ari", 12],
      ["Saturn", "Cap", 9],
    ],
  );
  assert.equal(shaped.planetary_positions[0].nakshatra, "Rohini");
});

test("time unknown: the flag is part of the chart cache key (and only when set)", () => {
  const base = {
    chartType: "D1",
    dob: "1990-05-15",
    tob: "12:00",
    lat: 28.6139,
    lng: 77.209,
  };
  const known = chartCacheKey(base);
  assert.equal(chartCacheKey({ ...base, birthTimeUnknown: false }), known);
  assert.notEqual(chartCacheKey({ ...base, birthTimeUnknown: true }), known);
});

// ── #4 spec request bodies ───────────────────────────────────────────────────

test("numerology + core numbers send { subject: { name, birth_data } }", async () => {
  const calls = await capture(async () => {
    await getNumerologyReading(BIRTH);
    await getCoreNumbers(BIRTH);
  });
  for (const call of calls) {
    assert.deepEqual(call.body, {
      subject: { name: "Asha", birth_data: { year: 1990, month: 5, day: 15 } },
    });
  }
  assert.match(calls[0].url, /\/numerology\/comprehensive$/);
  assert.match(calls[1].url, /\/numerology\/core-numbers$/);
});

test("varshaphal sends target_year; remedies omits an unset remedy_type", async () => {
  const calls = await capture(async () => {
    await getVarshaphal(BIRTH, 2027);
    await getRemedies(BIRTH);
    await getRemedies(BIRTH, "gemstones");
    await getRemedies(BIRTH, "bogus");
  });
  assert.equal(calls[0].body.target_year, 2027);
  assert.equal("year" in calls[0].body, false);
  assert.equal("remedy_type" in calls[1].body, false);
  assert.equal(calls[2].body.remedy_type, "gemstones");
  assert.equal("remedy_type" in calls[3].body, false);
});

test("eclipse interpretation sends eclipse_id", async () => {
  const [call] = await capture(() => getEclipseInterpretation("2027-08-02T"));
  assert.equal(call.body.eclipse_id, "2027-08-02T");
  assert.equal("date" in call.body, false);
});

test("weekly PDF sends week_start and the sidereal Moon sign", async () => {
  const pdf = () =>
    new Response(new ArrayBuffer(4), {
      status: 200,
      headers: { "Content-Type": "application/pdf" },
    });
  const calls = await capture(async () => {
    await getWeeklyHoroscopePDF(
      { ...BIRTH, moonSign: "Scorpio" },
      "2026-11-04",
    );
    await getDailyHoroscopePDF({ ...BIRTH, moonSign: "Scorpio" }, "2026-11-04");
  }, pdf);
  assert.equal(calls[0].body.week_start, "2026-11-04");
  assert.equal("target_date" in calls[0].body, false);
  assert.equal(calls[0].body.sign, "Sco");
  assert.equal(calls[1].body.target_date, "2026-11-04");
  assert.equal(calls[1].body.sign, "Sco");
});

// ── #5 / #10 Lahiri D1 + whole-sign Vedic options ────────────────────────────

test("Vedic D1 requests the D1 divisional chart with Lahiri + whole-sign", async () => {
  const response = () =>
    new Response(
      JSON.stringify({
        data: {
          charts: [
            {
              chart: "D1",
              positions: [
                { planet: "Ascendant", sign: "Leo", degree: 5 },
                { planet: "Moon", sign: "Tau", degree: 12 },
                { planet: "Rahu", sign: "Cap", degree: 3 },
              ],
            },
          ],
          ayanamsa: "lahiri",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  let chart: any;
  const [call] = await capture(async () => {
    chart = await getNatalChart(BIRTH, "vedic");
  }, response);
  assert.match(call.url, /\/vedic\/divisional-chart$/);
  assert.deepEqual(call.body.charts, ["D1"]);
  assert.equal(call.body.options.ayanamsa, "lahiri");
  assert.equal(call.body.options.bhava_system, "whole_sign");
  // Shaped like the D1 the app always consumed.
  assert.deepEqual(chart.ascendant, { sign: "Leo", degree: 5 });
  assert.equal(
    chart.planetary_positions.some((p: any) => p.name === "Ascendant"),
    false,
  );
  const moon = chart.planetary_positions.find((p: any) => p.name === "Moon");
  assert.equal(moon.house, 10);
  assert.equal(moon.nakshatra, "Rohini"); // Taurus 12° → Rohini
  assert.equal(
    chart.planetary_positions.find((p: any) => p.name === "Mean_Node").house,
    6,
  );
  assert.equal(chart.house_cusps.length, 12);
  assert.deepEqual(chart.house_cusps[0], { house: 1, sign: "Leo", degree: 0 });
});

test("Western D1 still uses /charts/natal (tropical)", async () => {
  const [call] = await capture(() => getNatalChart(BIRTH, "western"));
  assert.match(call.url, /\/charts\/natal$/);
  assert.equal(call.body.options.zodiac_type, "Tropic");
});

test("normalizeVedicD1Response derives nakshatra at sign boundaries", () => {
  const chart = normalizeVedicD1Response({
    charts: [
      {
        chart_type: "D1",
        planets: [
          { name: "Ascendant", sign: "Ari", longitude: 1 },
          { name: "Moon", sign: "Pis", longitude: 359.5 },
        ],
      },
    ],
  });
  assert.equal(chart.planetary_positions[0].nakshatra, "Revati");
});

// ── #6 transit time ──────────────────────────────────────────────────────────

test("transit time is the current instant in UTC, labelled UTC", () => {
  const now = Date.parse("2026-11-07T20:45:00Z");
  // The caller's local day (India, already Nov 8) still means "now".
  const { datetime } = buildTransitTime(BIRTH, "2026-11-08", now);
  assert.deepEqual(datetime, {
    year: 2026,
    month: 11,
    day: 7,
    hour: 20,
    minute: 45,
    second: 0,
    timezone: "UTC",
    latitude: 28.6139,
    longitude: 77.209,
  });
  // A date far from today is cast at noon UTC of that day.
  assert.equal(
    readingInstant("2027-01-15", now).toISOString(),
    "2027-01-15T12:00:00.000Z",
  );
});

test("transit chart request carries the UTC transit time", async () => {
  const [call] = await capture(() => getTransitChart(BIRTH));
  assert.equal(call.body.transit_time.datetime.timezone, "UTC");
});

// ── #7 sidereal sign selection ───────────────────────────────────────────────

test("Vedic sign horoscopes use the sidereal Moon sign, then the Sun sign", () => {
  assert.equal(
    resolveHoroscopeSign({
      dob: "1990-05-15",
      moonSign: "Scorpio",
      sunSign: "Aries",
    }),
    "Scorpio",
  );
  assert.equal(
    resolveHoroscopeSign({ dob: "1990-05-15", sunSign: "Ari" }),
    "Aries",
  );
  // No saved signs: approximate *sidereal* Sun — May 10 is still Aries
  // sidereally (the tropical table would say Taurus).
  assert.equal(resolveHoroscopeSign({ dob: "1990-05-10" }), "Aries");
  assert.equal(resolveHoroscopeSign({ dob: "1990-05-20" }), "Taurus");
  // Explicit Western mode keeps the tropical date ranges.
  assert.equal(
    resolveHoroscopeSign(
      { dob: "1990-05-10", moonSign: "Scorpio" },
      { mode: "western" },
    ),
    "Taurus",
  );
  // An explicit sign (sign pages) wins.
  assert.equal(
    resolveHoroscopeSign({ dob: "2000-04-05" }, { sign: "Aries" }),
    "Aries",
  );
});

test("daily sign text is requested for the sidereal Moon sign", async () => {
  const [call] = await capture(() =>
    getDailyHoroscopeText({ ...BIRTH, moonSign: "Cancer" }, "2026-11-07"),
  );
  assert.equal(call.body.sign, "Cancer");
});

// ── #8 lunar phase is for today, not the birth moment ────────────────────────

test("lunar phases are cast for today at the given place", async () => {
  const now = Date.parse("2026-11-07T09:00:00Z");
  const [call] = await capture(() =>
    getLunarPhases({ date: "2026-11-07", city: "London" }, now),
  );
  const dtl = call.body.datetime_location;
  assert.equal(dtl.year, 2026);
  assert.equal(dtl.month, 11);
  assert.equal(dtl.day, 7);
  assert.equal(dtl.city, "London");
  assert.equal(dtl.timezone, "UTC");
});

// ── kundali error mapping ────────────────────────────────────────────────────

test("chart calculation failures map to a 422 with actionable copy", () => {
  const structured = Object.assign(new Error("x"), {
    name: "AstroChartError",
    kind: "chart_calculation_failed",
  });
  const mapped = chartErrorResponse(structured);
  assert.equal(mapped?.status, 422);
  assert.equal(mapped?.body.code, "chart_calculation_failed");
  assert.match(mapped!.body.error, /birth date, time and place/);

  // Message-only fallback (class identity lost across bundles).
  const fromMessage = chartErrorResponse(
    new Error(
      'Natal chart error: 422 - {"detail":{"error":{"error_code":"CHART_CALCULATION_ERROR","message":"Local time is nonexistent (DST gap)"}}}',
    ),
  );
  assert.equal(fromMessage?.status, 422);
  assert.equal(fromMessage?.body.code, "dst_ambiguous");

  // Quota / unknown fall through to the caller's 503 / 500 handling.
  assert.equal(
    chartErrorResponse(
      Object.assign(new Error("q"), {
        name: "AstroChartError",
        kind: "quota_exhausted",
      }),
    ),
    null,
  );
  assert.equal(chartErrorResponse(new Error("boom")), null);
});

// ── client chart summary: profile signs + time-unknown three lines ──────────

import {
  buildChartThreeLines,
  deriveProfileSigns,
} from "../../../src/lib/chart-summary.js";

test("profile signs come from the D1 Moon/Sun (never the Lagna)", () => {
  assert.deepEqual(
    deriveProfileSigns({
      planetary_positions: [
        { name: "Sun", sign: "Ari", degree: 1 },
        { name: "Moon", sign: "Tau", degree: 12 },
      ],
      ascendant: { sign: "Leo", degree: 5 },
    }),
    { moonSign: "Taurus", sunSign: "Aries", moonNakshatra: "Rohini" },
  );
  assert.equal(deriveProfileSigns({ ascendant: { sign: "Leo" } }), null);
});

test("three lines: unknown birth time says the rising sign needs a time", () => {
  const lines = buildChartThreeLines({
    kundali: {
      planetary_positions: [{ name: "Moon", sign: "Tau" }],
      timeUnknown: true,
    },
    dashaPeriods: [{ planet: "Saturn", endDate: "2031-05-01", isCurrent: true }],
  });
  assert.equal(lines[1].label, "Lagna");
  assert.equal(lines[1].value, "Rising sign needs an exact birth time");
  assert.equal(lines[2].value, "Saturn (approximate)");
});
