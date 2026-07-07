import test from "node:test";
import assert from "node:assert/strict";
import {
  birthDataChanged,
  parseSuggestionCoordinates,
} from "../../../src/lib/birth-data.js";

const BASE = {
  dob: "1990-01-15",
  tob: "08:30",
  pob: "New Delhi, Delhi, India",
  coordinates: { lat: 28.6139, lng: 77.209 },
};

test("birthDataChanged detects dob/tob/pob changes", () => {
  assert.equal(birthDataChanged(BASE, { ...BASE, dob: "1991-01-15" }), true);
  assert.equal(birthDataChanged(BASE, { ...BASE, tob: "09:30" }), true);
  assert.equal(
    birthDataChanged(BASE, { ...BASE, pob: "Mumbai, Maharashtra, India" }),
    true,
  );
});

test("birthDataChanged is false for an identical save", () => {
  assert.equal(birthDataChanged(BASE, { ...BASE }), false);
});

test("birthDataChanged ignores surrounding whitespace", () => {
  assert.equal(
    birthDataChanged(BASE, { ...BASE, pob: `  ${BASE.pob}  ` }),
    false,
  );
});

test("birthDataChanged is false on first-time save (no previous data)", () => {
  assert.equal(birthDataChanged(null, BASE), false);
  assert.equal(birthDataChanged(undefined, BASE), false);
  assert.equal(birthDataChanged({}, BASE), false);
});

test("birthDataChanged detects coordinate changes when both sides have them", () => {
  assert.equal(
    birthDataChanged(BASE, {
      ...BASE,
      coordinates: { lat: 19.076, lng: 72.8777 },
    }),
    true,
  );
});

test("birthDataChanged tolerates float noise in coordinates", () => {
  assert.equal(
    birthDataChanged(BASE, {
      ...BASE,
      coordinates: { lat: 28.613900000001, lng: 77.209 },
    }),
    false,
  );
});

test("birthDataChanged ignores newly added coordinates for an unchanged pob", () => {
  const prev = { ...BASE, coordinates: null };
  assert.equal(birthDataChanged(prev, BASE), false);
  // ... and coordinates being dropped (manual re-type of the same string).
  assert.equal(birthDataChanged(BASE, { ...BASE, coordinates: null }), false);
});

test("parseSuggestionCoordinates parses Nominatim string coordinates", () => {
  assert.deepEqual(parseSuggestionCoordinates("28.6139", "77.2090"), {
    lat: 28.6139,
    lng: 77.209,
  });
  assert.deepEqual(parseSuggestionCoordinates(-33.8688, 151.2093), {
    lat: -33.8688,
    lng: 151.2093,
  });
});

test("parseSuggestionCoordinates rejects invalid or out-of-range values", () => {
  assert.equal(parseSuggestionCoordinates("not-a-number", "77.2"), null);
  assert.equal(parseSuggestionCoordinates(undefined, undefined), null);
  assert.equal(parseSuggestionCoordinates("91", "77.2"), null);
  assert.equal(parseSuggestionCoordinates("28.6", "181"), null);
  assert.equal(parseSuggestionCoordinates("-91", "0"), null);
  assert.equal(parseSuggestionCoordinates("0", "-181"), null);
});
