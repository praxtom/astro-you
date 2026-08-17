import test from "node:test";
import assert from "node:assert/strict";
import * as profileReadiness from "../../../src/lib/profile-readiness.js";

test("legacy D9 cache is rejected unless it identifies itself as D9", () => {
  const isUsableCachedKundali = (
    profileReadiness as unknown as {
      isUsableCachedKundali?: (
        data: unknown,
        chartType: "D1" | "D9" | "D10",
      ) => boolean;
    }
  ).isUsableCachedKundali;
  assert.ok(isUsableCachedKundali, "isUsableCachedKundali must be exported");

  const legacyChart = { planetary_positions: [{ name: "Sun" }] };
  assert.equal(isUsableCachedKundali(legacyChart, "D1"), true);
  assert.equal(isUsableCachedKundali(legacyChart, "D9"), false);
  assert.equal(
    isUsableCachedKundali({ ...legacyChart, _chartType: "D9" }, "D9"),
    true,
  );
  assert.equal(
    isUsableCachedKundali({ ...legacyChart, _chartType: "D1" }, "D9"),
    false,
  );
});

test("a cached chart from the other zodiac mode is rejected", () => {
  const isUsableCachedKundali = (
    profileReadiness as unknown as {
      isUsableCachedKundali?: (
        data: unknown,
        chartType: "D1" | "D9" | "D10",
        zodiacMode?: "vedic" | "western",
      ) => boolean;
    }
  ).isUsableCachedKundali;
  assert.ok(isUsableCachedKundali, "isUsableCachedKundali must be exported");

  const vedicChart = {
    planetary_positions: [{ name: "Sun" }],
    _chartType: "D1",
    _zodiacMode: "vedic",
  };

  // Without this, switching to Western keeps serving the cached sidereal
  // chart — the signs silently stay wrong and the toggle looks broken.
  assert.equal(isUsableCachedKundali(vedicChart, "D1", "vedic"), true);
  assert.equal(isUsableCachedKundali(vedicChart, "D1", "western"), false);

  const westernChart = { ...vedicChart, _zodiacMode: "western" };
  assert.equal(isUsableCachedKundali(westernChart, "D1", "western"), true);
  assert.equal(isUsableCachedKundali(westernChart, "D1", "vedic"), false);
});

test("charts cached before the zodiac mode existed still count as vedic", () => {
  const isUsableCachedKundali = (
    profileReadiness as unknown as {
      isUsableCachedKundali?: (
        data: unknown,
        chartType: "D1" | "D9" | "D10",
        zodiacMode?: "vedic" | "western",
      ) => boolean;
    }
  ).isUsableCachedKundali;
  assert.ok(isUsableCachedKundali);

  // Every chart cached before this feature was sidereal, so an unlabelled
  // document must stay valid for vedic and only vedic. Otherwise every
  // existing user silently re-pays for a chart they already have.
  const untagged = { planetary_positions: [{ name: "Sun" }] };
  assert.equal(isUsableCachedKundali(untagged, "D1", "vedic"), true);
  assert.equal(isUsableCachedKundali(untagged, "D1", "western"), false);

  // Callers that pass no mode at all keep the old behaviour.
  assert.equal(isUsableCachedKundali(untagged, "D1"), true);
});

test("only the newest chart request remains eligible to update UI state", () => {
  const createLatestRequestGate = (
    profileReadiness as unknown as {
      createLatestRequestGate?: () => {
        begin: () => { isCurrent: () => boolean; cancel: () => void };
      };
    }
  ).createLatestRequestGate;
  assert.ok(
    createLatestRequestGate,
    "createLatestRequestGate must be exported",
  );

  const gate = createLatestRequestGate();
  const d1 = gate.begin();
  assert.equal(d1.isCurrent(), true);

  const d9 = gate.begin();
  assert.equal(d1.isCurrent(), false);
  assert.equal(d9.isCurrent(), true);

  d9.cancel();
  assert.equal(d9.isCurrent(), false);
});
