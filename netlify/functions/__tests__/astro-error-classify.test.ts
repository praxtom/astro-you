import test from "node:test";
import assert from "node:assert/strict";
import { classifyUpstreamChartError } from "../shared/astro-error-classify.js";

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
