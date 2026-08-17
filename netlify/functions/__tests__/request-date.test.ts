import test from "node:test";
import assert from "node:assert/strict";
import { requestedDateKey } from "../shared/request-date.js";

test("accepts a well-formed caller-supplied local date", () => {
  assert.equal(requestedDateKey("2026-08-17"), "2026-08-17");
  assert.equal(requestedDateKey("2026-01-05"), "2026-01-05");
});

test("falls back to the UTC date when absent, so old clients still work", () => {
  const utcToday = new Date().toISOString().split("T")[0];
  assert.equal(requestedDateKey(undefined), utcToday);
  assert.equal(requestedDateKey(null), utcToday);
});

test("rejects malformed or hostile values rather than keying a cache on them", () => {
  const utcToday = new Date().toISOString().split("T")[0];
  // A cache/charge key built from unvalidated input is a cache-poisoning and
  // billing-dedupe hazard, so anything off-shape falls back.
  assert.equal(requestedDateKey("2026-8-7"), utcToday); // not zero-padded
  assert.equal(requestedDateKey("26-08-17"), utcToday); // 2-digit year
  assert.equal(requestedDateKey("2026-08-17T00:00:00Z"), utcToday); // has time
  assert.equal(requestedDateKey("../../etc/passwd"), utcToday);
  assert.equal(requestedDateKey(""), utcToday);
  assert.equal(requestedDateKey(20260817), utcToday);
  assert.equal(requestedDateKey({}), utcToday);
});
