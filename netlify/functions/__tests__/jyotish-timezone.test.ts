import test from "node:test";
import assert from "node:assert/strict";
import { tzFromLatLng, utcOffsetAt } from "../../../src/lib/jyotish/index.js";

test("tzFromLatLng resolves IANA zones", () => {
  assert.equal(tzFromLatLng(26.85, 80.95), "Asia/Kolkata"); // Lucknow
  assert.equal(tzFromLatLng(40.7128, -74.006), "America/New_York");
  assert.equal(tzFromLatLng(31.5497, 74.3436), "Asia/Karachi"); // Lahore
});

test("utcOffsetAt: historic offsets and DST", () => {
  const lucknow = utcOffsetAt("Asia/Kolkata", "1995-08-14", "06:30");
  assert.equal(lucknow.status, "ok");
  assert.equal(lucknow.offsetHours, 5.5);
  assert.equal(lucknow.utc.toISOString(), "1995-08-14T01:00:00.000Z");

  const ny = utcOffsetAt("America/New_York", "1990-07-04", "12:00");
  assert.equal(ny.status, "ok");
  assert.equal(ny.offsetHours, -4); // EDT

  const nyWinter = utcOffsetAt("America/New_York", "1990-01-15", "12:00");
  assert.equal(nyWinter.offsetHours, -5);

  // India war time: +6:30 from 1942-09-01 to 1945-10-15 (IANA Asia/Kolkata)
  const india1943 = utcOffsetAt("Asia/Kolkata", "1943-06-01", "12:00");
  assert.equal(india1943.offsetHours, 6.5);

  // Pakistan kept +5:30 until 1951-09-30 (IANA Asia/Karachi)
  const lahore1950 = utcOffsetAt("Asia/Karachi", "1950-06-01", "12:00");
  assert.equal(lahore1950.offsetHours, 5.5);
});

test("utcOffsetAt flags DST gaps and overlaps", () => {
  const gap = utcOffsetAt("America/New_York", "2021-03-14", "02:30");
  assert.equal(gap.status, "nonexistent");
  if (gap.status === "nonexistent") {
    assert.equal(gap.offsetBeforeHours, -5);
    assert.equal(gap.offsetAfterHours, -4);
    assert.equal(gap.utc.toISOString(), "2021-03-14T07:30:00.000Z"); // = 03:30 EDT
  }
  const overlap = utcOffsetAt("America/New_York", "2021-11-07", "01:30");
  assert.equal(overlap.status, "ambiguous");
  if (overlap.status === "ambiguous") {
    assert.deepEqual(
      overlap.candidates.map((c) => c.offsetHours),
      [-4, -5],
    );
    assert.equal(overlap.offsetHours, -4); // earlier instant by default
  }
  assert.throws(() => utcOffsetAt("Asia/Kolkata", "1995/08/14", "06:30"));
});
