import test from "node:test";
import assert from "node:assert/strict";
import { gunaVerdict } from "../../../src/lib/guna-verdict.js";

test("Guna Milan bands follow the standard Ashtakoot cut-offs", () => {
  assert.deepEqual(gunaVerdict(0), { label: "Not recommended", tone: "low" });
  assert.deepEqual(gunaVerdict(17), { label: "Not recommended", tone: "low" });
  assert.deepEqual(gunaVerdict(17.5), { label: "Not recommended", tone: "low" });
  assert.deepEqual(gunaVerdict(18), { label: "Average", tone: "mid" });
  assert.deepEqual(gunaVerdict(24), { label: "Average", tone: "mid" });
  assert.deepEqual(gunaVerdict(24.5), { label: "Average", tone: "mid" });
  assert.deepEqual(gunaVerdict(25), { label: "Good", tone: "good" });
  assert.deepEqual(gunaVerdict(32), { label: "Good", tone: "good" });
  assert.deepEqual(gunaVerdict(33), { label: "Excellent", tone: "great" });
  assert.deepEqual(gunaVerdict(36), { label: "Excellent", tone: "great" });
});

test("a missing or broken score never reads as a good match", () => {
  assert.equal(gunaVerdict(Number.NaN).tone, "low");
});
