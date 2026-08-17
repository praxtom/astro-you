import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveTimezone,
  localDateKey,
  localHour,
  isValidTimezone,
  DATE_KEY_RE,
  FALLBACK_TIMEZONE,
} from "../../../src/lib/local-date.js";

// 2026-08-17T23:30:00Z. In UTC this is the 17th. In Los Angeles (UTC-7) it is
// 16:30 on the 17th; in Kolkata (UTC+5:30) it is 05:00 on the 18th. The
// UTC-date bug is exactly the disagreement between these three.
const AT = new Date("2026-08-17T23:30:00.000Z");

test("localDateKey returns the local calendar day, not the UTC day", () => {
  assert.equal(localDateKey("America/Los_Angeles", AT), "2026-08-17");
  assert.equal(localDateKey("Asia/Kolkata", AT), "2026-08-18");
  assert.equal(localDateKey("UTC", AT), "2026-08-17");
});

test("localDateKey crosses the US evening boundary the old code got wrong", () => {
  // 2026-08-18T00:30:00Z -> still the 17th in America/New_York (UTC-4).
  const evening = new Date("2026-08-18T00:30:00.000Z");
  assert.equal(localDateKey("America/New_York", evening), "2026-08-17");
  assert.equal(evening.toISOString().split("T")[0], "2026-08-18"); // the bug
});

test("localDateKey zero-pads single-digit months and days", () => {
  const early = new Date("2026-01-05T12:00:00.000Z");
  assert.equal(localDateKey("UTC", early), "2026-01-05");
  assert.match(localDateKey("UTC", early), DATE_KEY_RE);
});

test("localHour reports the local wall-clock hour in 0-23", () => {
  assert.equal(localHour("America/Los_Angeles", AT), 16);
  assert.equal(localHour("Asia/Kolkata", AT), 5);
});

test("localHour returns 0 for local midnight, not 24", () => {
  const midnightIst = new Date("2026-08-17T18:30:00.000Z");
  assert.equal(localHour("Asia/Kolkata", midnightIst), 0);
});

test("isValidTimezone accepts IANA names and rejects junk", () => {
  assert.equal(isValidTimezone("America/New_York"), true);
  assert.equal(isValidTimezone("Asia/Kolkata"), true);
  assert.equal(isValidTimezone("Not/AZone"), false);
  assert.equal(isValidTimezone(""), false);
  assert.equal(isValidTimezone(undefined), false);
  assert.equal(isValidTimezone(42), false);
});

test("resolveTimezone prefers a valid candidate and falls back otherwise", () => {
  assert.equal(resolveTimezone("America/Denver"), "America/Denver");
  assert.equal(resolveTimezone("Not/AZone"), FALLBACK_TIMEZONE);
  assert.equal(resolveTimezone(null), FALLBACK_TIMEZONE);
  assert.equal(resolveTimezone(undefined), FALLBACK_TIMEZONE);
});

test("fallback stays Asia/Kolkata so the Indian default is unchanged", () => {
  assert.equal(FALLBACK_TIMEZONE, "Asia/Kolkata");
});
