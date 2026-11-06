import test from "node:test";
import assert from "node:assert/strict";
import {
  CHART_CACHE_COLLECTION,
  DAILY_TTL_HOURS,
  GUEST_CHART_TYPES,
  NATAL_TTL_HOURS,
  TRANSIT_TTL_HOURS,
  chartCacheKey,
  chartCacheTtlHours,
  isGuestChartType,
  NAME_DEPENDENT_CHART_TYPES,
  normalizeSubjectName,
  refreshDashaCurrentFlags,
} from "../shared/chart-cache.js";

test("guests may request exactly the basic natal set", () => {
  assert.deepEqual([...GUEST_CHART_TYPES].sort(), [
    "D1",
    "DASHAS",
    "NAKSHATRA",
  ]);
  assert.equal(isGuestChartType("DASHAS"), true);
  assert.equal(isGuestChartType("NAKSHATRA"), true);
  assert.equal(isGuestChartType("D1"), true);
  for (const paid of [
    "YOGAS",
    "REMEDIES",
    "SADE_SATI",
    "PDF_NATAL",
    "SVG_NATAL",
    "D9",
    "VARSHAPHAL",
    "nakshatra",
    undefined,
  ]) {
    assert.equal(isGuestChartType(paid), false, String(paid));
  }
});

test("cache collection is a dedicated admin-only collection", () => {
  assert.equal(CHART_CACHE_COLLECTION, "chart_cache");
});

test("natal types cache long, transit types short, binaries never", () => {
  assert.equal(chartCacheTtlHours("D1"), NATAL_TTL_HOURS);
  assert.equal(chartCacheTtlHours("D9"), NATAL_TTL_HOURS);
  assert.equal(chartCacheTtlHours("DASHAS"), NATAL_TTL_HOURS);
  assert.equal(chartCacheTtlHours("NAKSHATRA"), NATAL_TTL_HOURS);
  assert.equal(chartCacheTtlHours("SADE_SATI"), TRANSIT_TTL_HOURS);
  assert.equal(chartCacheTtlHours("LUNAR_PHASES"), DAILY_TTL_HOURS);
  assert.ok(TRANSIT_TTL_HOURS < NATAL_TTL_HOURS);
  for (const uncached of [
    "PDF_NATAL",
    "SVG_NATAL",
    "RENDER_NATAL",
    "BODYGRAPH_SVG",
    "VOID_OF_COURSE",
    "UNKNOWN",
  ]) {
    assert.equal(chartCacheTtlHours(uncached), null, uncached);
  }
});

const base = {
  chartType: "DASHAS",
  dob: "1990-04-12",
  tob: "06:30",
  lat: 28.6139,
  lng: 77.209,
  pob: "New Delhi, India",
};

test("cache key is deterministic and hides birth data", () => {
  const a = chartCacheKey(base);
  assert.equal(a, chartCacheKey({ ...base }));
  assert.match(a, /^DASHAS_[0-9a-f]{40}$/);
  assert.ok(!a.includes("1990"));
  assert.ok(!a.includes("28.61"));
});

test("cache key covers dob, tob, location and chart type", () => {
  const a = chartCacheKey(base);
  assert.notEqual(a, chartCacheKey({ ...base, dob: "1990-04-13" }));
  assert.notEqual(a, chartCacheKey({ ...base, tob: "06:31" }));
  assert.notEqual(a, chartCacheKey({ ...base, lat: 19.076 }));
  assert.notEqual(a, chartCacheKey({ ...base, lng: 72.8777 }));
  assert.notEqual(a, chartCacheKey({ ...base, chartType: "YOGAS" }));
  assert.notEqual(a, chartCacheKey({ ...base, zodiacMode: "western" }));
  assert.notEqual(
    a,
    chartCacheKey({ ...base, variant: { remedyType: "gemstones" } }),
  );
});

test("cache key ignores cosmetic differences", () => {
  const a = chartCacheKey(base);
  // Seconds on the birth time and sub-metre coordinate noise are the same moment/place.
  assert.equal(a, chartCacheKey({ ...base, tob: "06:30:00" }));
  assert.equal(a, chartCacheKey({ ...base, lat: 28.61391 }));
  // With coordinates present, the place label does not matter.
  assert.equal(a, chartCacheKey({ ...base, pob: "Delhi" }));
  // Empty variant values are ignored.
  assert.equal(
    a,
    chartCacheKey({ ...base, variant: { remedyType: undefined } }),
  );
});

test("without coordinates the place string keys the cache", () => {
  const noCoords = { ...base, lat: undefined, lng: undefined };
  assert.notEqual(
    chartCacheKey({ ...noCoords, pob: "Mumbai" }),
    chartCacheKey({ ...noCoords, pob: "Pune" }),
  );
  assert.equal(
    chartCacheKey({ ...noCoords, pob: "  New   Delhi " }),
    chartCacheKey({ ...noCoords, pob: "new delhi" }),
  );
});

test("cached dasha periods get their current flags recomputed", () => {
  const periods = [
    {
      planet: "Venus",
      startDate: "2000-01-01",
      endDate: "2020-01-01",
      isCurrent: true,
      subPeriods: [],
    },
    {
      planet: "Sun",
      startDate: "2020-01-01",
      endDate: "2026-01-01",
      isCurrent: false,
      subPeriods: [
        {
          planet: "Sun",
          startDate: "2020-01-01",
          endDate: "2023-01-01",
          isCurrent: false,
        },
        {
          planet: "Moon",
          startDate: "2023-01-01",
          endDate: "2026-01-01",
          isCurrent: false,
        },
      ],
    },
    { planet: "Moon", startDate: "", endDate: "", isCurrent: true },
  ];
  const now = Date.parse("2024-06-01");
  const refreshed = refreshDashaCurrentFlags(periods, now);
  assert.equal(refreshed[0].isCurrent, false);
  assert.equal(refreshed[1].isCurrent, true);
  assert.equal(refreshed[1].subPeriods?.[0].isCurrent, false);
  assert.equal(refreshed[1].subPeriods?.[1].isCurrent, true);
  // Unparseable dates keep the cached flag.
  assert.equal(refreshed[2].isCurrent, true);
});

test("numerology cache keys include the subject name so readings never cross people", () => {
  const birth = { dob: "1995-08-14", tob: "06:30", lat: 26.85, lng: 80.95 };
  const key = (type: string, name: string) =>
    chartCacheKey({
      ...birth,
      chartType: type,
      variant: {
        subject: NAME_DEPENDENT_CHART_TYPES.has(type)
          ? normalizeSubjectName(name)
          : undefined,
      },
    });
  for (const type of ["NUMEROLOGY", "CORE_NUMBERS"]) {
    assert.notEqual(key(type, "Meera Test"), key(type, "Asha Rao"));
    // Case/space differences are the same person.
    assert.equal(key(type, "Meera Test"), key(type, "  meera   test "));
    // The name is hashed, never present in the doc id.
    assert.ok(!key(type, "Meera Test").toLowerCase().includes("meera"));
  }
  // Birth-moment-only charts are unaffected by the name.
  assert.equal(key("D1", "Meera Test"), key("D1", "Asha Rao"));
  assert.equal(normalizeSubjectName(""), "anonymous");
});
