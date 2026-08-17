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

test("only the newest chart request remains eligible to update UI state", () => {
  const createLatestRequestGate = (
    profileReadiness as unknown as {
      createLatestRequestGate?: () => {
        begin: () => { isCurrent: () => boolean; cancel: () => void };
      };
    }
  ).createLatestRequestGate;
  assert.ok(createLatestRequestGate, "createLatestRequestGate must be exported");

  const gate = createLatestRequestGate();
  const d1 = gate.begin();
  assert.equal(d1.isCurrent(), true);

  const d9 = gate.begin();
  assert.equal(d1.isCurrent(), false);
  assert.equal(d9.isCurrent(), true);

  d9.cancel();
  assert.equal(d9.isCurrent(), false);
});
