import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyUpstreamChartError,
  classifyUpstreamErrorMessage,
} from "../shared/astro-error-classify.js";

// Real 422 body shape observed from astrology-api.io for a birth time that
// falls in the DST spring-forward gap (Denver, 2020-03-08 02:30) or the
// repeated fall-back hour (Denver, 2020-11-01 01:30).
const DST_422 = JSON.stringify({
  detail: {
    success: false,
    error: {
      error_code: "CHART_CALCULATION_ERROR",
      message: "Failed to calculate astrological chart",
      field: "birth_data",
    },
  },
});

const LOCATION_422 = JSON.stringify({
  detail: [
    {
      type: "value_error",
      loc: ["body", "subject", "birth_data"],
      msg: "Value error, Location is required. Provide either: (1) 'city' ...",
    },
  ],
});

test("classifies a chart-calculation 422 as DST-ambiguous", () => {
  assert.equal(classifyUpstreamChartError(422, DST_422), "dst_ambiguous");
});

test("classifies a missing-location 422 separately", () => {
  assert.equal(
    classifyUpstreamChartError(422, LOCATION_422),
    "location_unresolved",
  );
});

test("does not classify non-422 failures", () => {
  assert.equal(classifyUpstreamChartError(500, DST_422), "unknown");
  assert.equal(classifyUpstreamChartError(401, "nope"), "unknown");
});

test("tolerates an unparseable body", () => {
  assert.equal(classifyUpstreamChartError(422, "<html>502</html>"), "unknown");
  assert.equal(classifyUpstreamChartError(422, ""), "unknown");
});

test("does not mistake an unrelated 422 error code for a DST failure", () => {
  const other = JSON.stringify({
    detail: { error: { error_code: "RATE_LIMIT_EXCEEDED" } },
  });
  assert.equal(classifyUpstreamChartError(422, other), "unknown");
});

test("tolerates a null or shapeless detail", () => {
  assert.equal(classifyUpstreamChartError(422, JSON.stringify({})), "unknown");
  assert.equal(
    classifyUpstreamChartError(422, JSON.stringify({ detail: null })),
    "unknown",
  );
  assert.equal(classifyUpstreamChartError(422, "null"), "unknown");
});

// Upstream quota exhaustion. Observed shape when the astrology-API billing
// period allowance runs out: HTTP 429 with a RATE_LIMIT_EXCEEDED error code.
const QUOTA_429 = JSON.stringify({
  success: false,
  error: {
    error_code: "RATE_LIMIT_EXCEEDED",
    message: "Quota exceeded for this billing period",
    field: null,
  },
});

test("classifies a 429 quota body as quota_exhausted", () => {
  assert.equal(classifyUpstreamChartError(429, QUOTA_429), "quota_exhausted");
});

test("classifies a 429 whose body only says the quota is exceeded", () => {
  assert.equal(
    classifyUpstreamChartError(429, "Quota exceeded for this billing period"),
    "quota_exhausted",
  );
});

test("a 429 without a quota marker stays unknown", () => {
  assert.equal(classifyUpstreamChartError(429, "slow down"), "unknown");
  assert.equal(classifyUpstreamChartError(429, ""), "unknown");
});

test("a quota marker on a non-429 status is not quota_exhausted", () => {
  assert.equal(classifyUpstreamChartError(500, QUOTA_429), "unknown");
  assert.equal(classifyUpstreamChartError(422, QUOTA_429), "unknown");
});

test("classifies from a thrown Error message produced by astro-api", () => {
  // astro-api.ts formats upstream failures as `<Label> error: <status> - <body>`.
  assert.equal(
    classifyUpstreamErrorMessage(`Panchang error: 429 - ${QUOTA_429}`),
    "quota_exhausted",
  );
  assert.equal(
    classifyUpstreamErrorMessage(
      "Yoga analysis error: 429 - Quota exceeded for this billing period",
    ),
    "quota_exhausted",
  );
});

test("message classification ignores unrelated failures", () => {
  assert.equal(
    classifyUpstreamErrorMessage("Panchang error: 500 - upstream boom"),
    "unknown",
  );
  assert.equal(classifyUpstreamErrorMessage("fetch failed"), "unknown");
  assert.equal(classifyUpstreamErrorMessage(undefined), "unknown");
  assert.equal(classifyUpstreamErrorMessage(12345), "unknown");
});

// ─── End-to-end: every wrapper surfaces a classifiable quota failure ────────
//
// Regression guard for the gap found in review: only ~8 of the ~40 astro-api
// wrappers put the response body into the thrown message; the rest threw a
// body-less `<Label> error: <status>`, which classifyUpstreamErrorMessage
// cannot classify — so a quota outage on (for example) every D9 request still
// produced a generic 500. All wrappers now route through throwChartError.

const {
  getNavamsaChart,
  getSadeSati,
  getAshtakvarga,
  getTransitChart,
  getNatalChartSVG,
  getBiorhythms,
  getDashaPeriods,
  getNatalReportPDF,
  getCurrentTransits,
  getCompatibilityDetails,
  getDailyHoroscope,
} = await import("../shared/astro-api.js");

const BIRTH = { dob: "1990-05-15", tob: "10:30", pob: "New Delhi" };

function stubQuotaFetch() {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(QUOTA_429, {
      status: 429,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

// Wrappers that already threw on !res.ok — previously with no body attached.
const THROWING_WRAPPERS: Array<[string, () => Promise<unknown>]> = [
  ["getNavamsaChart (every D9/D10 request)", () => getNavamsaChart(BIRTH)],
  ["getSadeSati", () => getSadeSati(BIRTH)],
  ["getAshtakvarga", () => getAshtakvarga(BIRTH)],
  ["getTransitChart", () => getTransitChart(BIRTH)],
  ["getNatalChartSVG", () => getNatalChartSVG(BIRTH)],
  ["getBiorhythms", () => getBiorhythms(BIRTH)],
];

// Wrappers that deliberately degrade (warn-and-return a fallback) on failure,
// which silently hid quota exhaustion. They must now escalate a 429.
const DEGRADING_WRAPPERS: Array<[string, () => Promise<unknown>]> = [
  ["getDashaPeriods", () => getDashaPeriods(BIRTH)],
  ["getNatalReportPDF", () => getNatalReportPDF(BIRTH)],
  ["getCurrentTransits", () => getCurrentTransits()],
  ["getCompatibilityDetails", () => getCompatibilityDetails(BIRTH, BIRTH)],
];

for (const [label, call] of [...THROWING_WRAPPERS, ...DEGRADING_WRAPPERS]) {
  test(`${label} surfaces upstream quota exhaustion`, async () => {
    const restore = stubQuotaFetch();
    try {
      let thrown: any;
      await call().then(
        () => {},
        (err) => {
          thrown = err;
        },
      );

      assert.ok(thrown, `${label} swallowed the 429 instead of throwing`);
      // kundali.ts reads `kind` off an AstroChartError...
      assert.equal(thrown.name, "AstroChartError");
      assert.equal(thrown.kind, "quota_exhausted");
      assert.equal(thrown.status, 429);
      // ...and falls back to parsing the message for anything else, so the
      // message must stay in the `<Label> error: <status> - <body>` format.
      assert.equal(
        classifyUpstreamErrorMessage(thrown.message),
        "quota_exhausted",
      );
    } finally {
      restore();
    }
  });
}

test("a throttling 429 (no quota marker) still degrades instead of throwing", async () => {
  // Only quota exhaustion is permanent. A bare "slow down" 429 must keep the
  // graceful-degradation fallbacks the wrappers were written with, otherwise a
  // transient rate limit takes down a whole page.
  const original = globalThis.fetch;
  // Bare 429 everywhere except the sign-based text endpoint, which answers
  // normally — so a fall-through is observable, not just a swallowed throw.
  globalThis.fetch = (async (input: any) =>
    String(input).includes("/horoscope/sign/daily/text")
      ? new Response(JSON.stringify({ data: { horoscope: "fallback text" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      : new Response("slow down", { status: 429 })) as typeof fetch;
  try {
    assert.deepEqual(await getDashaPeriods(BIRTH), []);
    assert.deepEqual(await getDailyHoroscope(BIRTH), {
      horoscope: "fallback text",
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("a non-quota failure still degrades instead of throwing", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("upstream boom", { status: 500 })) as typeof fetch;
  try {
    // The graceful-degradation contract is unchanged for every other status.
    assert.deepEqual(await getDashaPeriods(BIRTH), []);
    assert.equal(await getNatalReportPDF(BIRTH), null);
    const transits = await getCurrentTransits("2026-09-02");
    assert.deepEqual(transits.positions, []);
  } finally {
    globalThis.fetch = original;
  }
});
