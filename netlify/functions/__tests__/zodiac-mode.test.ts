import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeZodiacMode,
  zodiacApiOptions,
  ZODIAC_MODES,
  DEFAULT_ZODIAC_MODE,
} from "../../../src/lib/zodiac-mode.js";

test("vedic is the default so the Indian market is unchanged", () => {
  assert.equal(DEFAULT_ZODIAC_MODE, "vedic");
  assert.equal(normalizeZodiacMode(undefined), "vedic");
  assert.equal(normalizeZodiacMode(null), "vedic");
  assert.equal(normalizeZodiacMode("nonsense"), "vedic");
  assert.equal(normalizeZodiacMode(7), "vedic");
  assert.equal(normalizeZodiacMode({}), "vedic");
});

test("normalizeZodiacMode accepts both modes", () => {
  assert.equal(normalizeZodiacMode("vedic"), "vedic");
  assert.equal(normalizeZodiacMode("western"), "western");
});

test("vedic maps to sidereal whole-sign, matching shipped behaviour", () => {
  assert.deepEqual(zodiacApiOptions("vedic"), {
    house_system: "W",
    zodiac_type: "Sidereal",
  });
});

test("western maps to tropical Placidus", () => {
  assert.deepEqual(zodiacApiOptions("western"), {
    house_system: "P",
    zodiac_type: "Tropic",
  });
});

test("the two modes never produce the same upstream options", () => {
  assert.notDeepEqual(zodiacApiOptions("vedic"), zodiacApiOptions("western"));
});

test("every mode has UI metadata and a distinct label", () => {
  assert.equal(ZODIAC_MODES.length, 2);
  const labels = new Set(ZODIAC_MODES.map((m) => m.label));
  assert.equal(labels.size, 2);
  for (const mode of ZODIAC_MODES) {
    assert.equal(normalizeZodiacMode(mode.mode), mode.mode);
    assert.ok(mode.label.length > 0);
    assert.ok(mode.description.length > 0);
  }
});
