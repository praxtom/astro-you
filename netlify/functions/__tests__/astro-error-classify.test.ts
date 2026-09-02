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
