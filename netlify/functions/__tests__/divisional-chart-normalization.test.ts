import test from "node:test";
import assert from "node:assert/strict";
import * as astroApi from "../shared/astro-api.js";

test("normalizes the requested divisional chart from the documented charts array", () => {
  const normalizeDivisionalChartResponse = (
    astroApi as unknown as {
      normalizeDivisionalChartResponse?: (
        response: unknown,
        chartType: string,
      ) => {
        planetary_positions: Array<{
          name: string;
          sign: string;
          house: number;
        }>;
        ascendant?: { sign: string; degree: number };
      };
    }
  ).normalizeDivisionalChartResponse;

  assert.ok(
    normalizeDivisionalChartResponse,
    "normalizeDivisionalChartResponse must be exported",
  );

  const result = normalizeDivisionalChartResponse(
    {
      data: {
        charts: [
          {
            chart: "D1",
            positions: [
              { planet: "Ascendant", sign: "Ari", degree: 1 },
              { planet: "Sun", sign: "Ari", degree: 2 },
            ],
          },
          {
            chart: "D9",
            positions: [
              { planet: "Ascendant", sign: "Lib", degree: 24.56 },
              { planet: "Sun", sign: "Sag", degree: 28.05 },
              { planet: "Moon", sign: "Cap", degree: 17.88 },
            ],
          },
        ],
      },
    },
    "D9",
  );

  assert.deepEqual(result.ascendant, { sign: "Lib", degree: 24.56 });
  assert.deepEqual(
    result.planetary_positions.map(({ name, sign, house }) => ({
      name,
      sign,
      house,
    })),
    [
      { name: "Ascendant", sign: "Lib", house: 1 },
      { name: "Sun", sign: "Sag", house: 3 },
      { name: "Moon", sign: "Cap", house: 4 },
    ],
  );
});

test("normalizes the alternate chart_type and planets response shape", () => {
  const normalizeDivisionalChartResponse = (
    astroApi as unknown as {
      normalizeDivisionalChartResponse?: (
        response: unknown,
        chartType: string,
      ) => { planetary_positions: Array<{ name: string; sign: string }> };
    }
  ).normalizeDivisionalChartResponse;
  assert.ok(normalizeDivisionalChartResponse);

  const result = normalizeDivisionalChartResponse(
    {
      charts: [
        {
          chart_type: "D9",
          planets: [
            { name: "Ascendant", sign: "Libra", longitude: 204.56 },
            { name: "Sun", sign: "Sagittarius", longitude: 268.05 },
          ],
        },
      ],
    },
    "D9",
  );

  assert.deepEqual(
    result.planetary_positions.map(({ name, sign }) => ({ name, sign })),
    [
      { name: "Ascendant", sign: "Lib" },
      { name: "Sun", sign: "Sag" },
    ],
  );
});
