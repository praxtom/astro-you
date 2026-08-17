import test from "node:test";
import assert from "node:assert/strict";
import {
  FESTIVAL_REGIONS,
  normalizeFestivalRegion,
  DEFAULT_FESTIVAL_REGION,
} from "../../../src/lib/festival-regions.js";

test("north stays the default, preserving shipped behaviour", () => {
  assert.equal(DEFAULT_FESTIVAL_REGION, "north");
  assert.equal(normalizeFestivalRegion(undefined), "north");
  assert.equal(normalizeFestivalRegion(null), "north");
  assert.equal(normalizeFestivalRegion("mars"), "north");
  assert.equal(normalizeFestivalRegion(3), "north");
});

test("every listed region round-trips, including off", () => {
  for (const region of FESTIVAL_REGIONS) {
    assert.equal(normalizeFestivalRegion(region.value), region.value);
  }
  assert.equal(normalizeFestivalRegion("off"), "off");
});

test("off is offered, so a user with no use for the calendar can hide it", () => {
  assert.ok(FESTIVAL_REGIONS.some((region) => region.value === "off"));
});
