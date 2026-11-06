import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chartCacheKey,
  clampedTodayKey,
  isCalendarDateKey,
  panchangCacheDocId,
  resolveChartCacheKeySecret,
  resolvePanchangPlace,
  stripEchoedBirthInputs,
  cacheExpiresAt,
} from "../shared/chart-cache.js";
import { canonicalErrorBody, getSadeSati } from "../shared/astro-api.js";
import { classifyUpstreamErrorMessage } from "../shared/astro-error-classify.js";

const SECRET_A = { OTP_HASH_SECRET: "a".repeat(40) };
const SECRET_B = { OTP_HASH_SECRET: "b".repeat(40) };

const base = {
  chartType: "D1",
  dob: "1990-04-12",
  tob: "06:30",
  lat: 28.6139,
  lng: 77.209,
  pob: "New Delhi, India",
};

test("chart cache keys are keyed by the server secret, not a plain hash", () => {
  const a = chartCacheKey(base, SECRET_A);
  assert.match(a, /^D1_[0-9a-f]{40}$/);
  assert.equal(a, chartCacheKey({ ...base }, SECRET_A));
  // A different secret gives a different id: no brute-forcing without it.
  assert.notEqual(a, chartCacheKey(base, SECRET_B));
  // ...and it is not the old unkeyed SHA-256 of the inputs.
  const unkeyed = createHash("sha256")
    .update(
      "type=D1|dob=1990-04-12|tob=06:30|loc=28.6139,77.2090|pob=new delhi, india|mode=vedic",
    )
    .digest("hex")
    .slice(0, 40);
  assert.notEqual(a, `D1_${unkeyed}`);
  // A weak/missing secret falls back to the dev key (tests/local only).
  assert.equal(
    resolveChartCacheKeySecret({ OTP_HASH_SECRET: "short" }),
    resolveChartCacheKeySecret({}),
  );
  assert.notEqual(
    resolveChartCacheKeySecret(SECRET_A),
    resolveChartCacheKeySecret({}),
  );
});

test("a mismatched place label can never share the victim's key (M2)", () => {
  // Upstream gets city: pob AND the coordinates, and uses the city for the
  // timezone lookup — so the same coordinates under another label must key
  // separately, or a guest could plant a wrong-timezone chart.
  const victim = chartCacheKey(base, SECRET_A);
  assert.notEqual(
    victim,
    chartCacheKey({ ...base, pob: "Los Angeles, USA" }, SECRET_A),
  );
  assert.notEqual(victim, chartCacheKey({ ...base, pob: undefined }, SECRET_A));
});

test("daily dates are clamped to the server's day ±1", () => {
  const now = Date.parse("2026-11-07T10:00:00Z");
  assert.equal(clampedTodayKey("2026-11-07", now), "2026-11-07");
  assert.equal(clampedTodayKey("2026-11-06", now), "2026-11-06");
  assert.equal(clampedTodayKey("2026-11-08", now), "2026-11-08");
  // Far-off or malformed client dates cannot plant entries under other days.
  assert.equal(clampedTodayKey("2026-11-20", now), "2026-11-07");
  assert.equal(clampedTodayKey("2025-01-01", now), "2026-11-07");
  assert.equal(clampedTodayKey("2026-02-30", now), "2026-11-07");
  assert.equal(clampedTodayKey("../../etc", now), "2026-11-07");
  assert.equal(clampedTodayKey(undefined, now), "2026-11-07");
  assert.equal(isCalendarDateKey("2026-02-30"), false);
  assert.equal(isCalendarDateKey("2026-12-25"), true);
});

test("panchang cache key covers date, city AND coordinates, and hides the place", () => {
  const delhi = resolvePanchangPlace({
    city: "New Delhi",
    lat: 28.6139,
    lng: 77.209,
  });
  const key = panchangCacheDocId("2026-11-07", delhi, SECRET_A);
  assert.match(key, /^2026-11-07_[0-9a-f]{32}$/);
  assert.ok(!key.includes("Delhi") && !key.includes("28.6"));
  // Same city label with other coordinates (or vice versa) → other doc.
  assert.notEqual(
    key,
    panchangCacheDocId(
      "2026-11-07",
      resolvePanchangPlace({ city: "New Delhi", lat: 40.7128, lng: -74.006 }),
      SECRET_A,
    ),
  );
  assert.notEqual(
    key,
    panchangCacheDocId(
      "2026-11-07",
      resolvePanchangPlace({ city: "New York", lat: 28.6139, lng: 77.209 }),
      SECRET_A,
    ),
  );
  assert.notEqual(key, panchangCacheDocId("2026-11-08", delhi, SECRET_A));
  // No place → the exact defaults the upstream call receives.
  assert.deepEqual(resolvePanchangPlace({}), {
    city: "New Delhi",
    lat: 28.614,
    lng: 77.209,
  });
  // Garbage coordinates are ignored (defaults), not keyed as-is.
  assert.deepEqual(
    resolvePanchangPlace({ city: "Pune", lat: "18.5", lng: 999 }),
    { city: "Pune", lat: 28.614, lng: 77.209 },
  );
});

test("echoed birth inputs are stripped from cached chart payloads", () => {
  const raw = {
    subject_data: { name: "Asha", year: 1990, city: "Pune", lat: 18.52 },
    subject: { name: "AstroYou User", birth_data: { year: 1990 } },
    input: { name: "Asha Rao" },
    datetime_location: { year: 2026, city: "Pune" },
    yogas: [
      { name: "Gaja Kesari", strength: "strong", birth_data: { day: 12 } },
    ],
    score: 72,
  };
  const clean = stripEchoedBirthInputs(raw);
  assert.deepEqual(clean, {
    yogas: [{ name: "Gaja Kesari", strength: "strong" }],
    score: 72,
  });
  // Input untouched; arrays and primitives pass through.
  assert.ok("subject_data" in raw);
  assert.deepEqual(stripEchoedBirthInputs([{ planet: "Sun" }]), [
    { planet: "Sun" },
  ]);
  assert.equal(stripEchoedBirthInputs("svg"), "svg");
  assert.equal(stripEchoedBirthInputs(null), null);
});

test("cache docs carry an expiresAt for the Firestore TTL policy", () => {
  const at = new Date("2026-11-07T00:00:00Z");
  assert.equal(
    cacheExpiresAt(at, 180 * 24).toISOString(),
    "2027-05-06T00:00:00.000Z",
  );
  assert.equal(
    cacheExpiresAt(at, 20).toISOString(),
    "2026-11-07T20:00:00.000Z",
  );
});

test("upstream error bodies never reach the error message (logs)", async () => {
  const original = globalThis.fetch;
  const echo = JSON.stringify({
    detail: {
      error: {
        error_code: "CHART_CALCULATION_ERROR",
        message: "Local time 1990-04-12 02:30 is nonexistent in America/Denver",
        input: { name: "Asha Rao", city: "Denver", latitude: 39.7392 },
      },
    },
  });
  globalThis.fetch = (async () =>
    new Response(echo, { status: 422 })) as typeof fetch;
  try {
    let thrown: any;
    await getSadeSati({
      dob: "1990-04-12",
      tob: "02:30",
      pob: "Denver",
      lat: 39.7392,
      lng: -104.9903,
    }).catch((err) => {
      thrown = err;
    });
    assert.equal(thrown?.name, "AstroChartError");
    assert.equal(thrown.kind, "dst_ambiguous");
    assert.equal(thrown.status, 422);
    assert.doesNotMatch(thrown.message, /1990|Denver|Asha|39\.7/);
    // The cross-bundle message fallback still classifies it.
    assert.equal(classifyUpstreamErrorMessage(thrown.message), "dst_ambiguous");
  } finally {
    globalThis.fetch = original;
  }
  for (const kind of [
    "dst_ambiguous",
    "chart_calculation_failed",
    "location_unresolved",
  ] as const) {
    assert.equal(
      classifyUpstreamErrorMessage(
        `X error: 422 - ${canonicalErrorBody(kind)}`,
      ),
      kind,
    );
  }
  assert.equal(
    classifyUpstreamErrorMessage(
      `X error: 429 - ${canonicalErrorBody("quota_exhausted")}`,
    ),
    "quota_exhausted",
  );
});
