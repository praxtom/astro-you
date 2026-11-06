import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChartThreeLines,
  resolveAscendant,
  resolveMoon,
} from "../../../src/lib/chart-summary.js";
import { dedupeLocationSuggestions } from "../../../src/lib/location-dedupe.js";
import { hasSavedBirthProfile } from "../../../src/lib/saved-profile.js";

test("Lagna resolves from the D1 `ascendant` field, not only planetary_positions", () => {
  const chart = {
    planetary_positions: [{ name: "Moon", sign: "Can", degree: 12, nakshatra: "Pushya" }],
    house_cusps: [],
    ascendant: { sign: "Leo", degree: 4.2 },
  };
  assert.equal(resolveAscendant(chart)?.code, "Leo");
  assert.equal(resolveAscendant(chart)?.name, "Simha");
  // Full western names and house-1 cusps also work.
  assert.equal(resolveAscendant({ ascendant: { sign: "Sagittarius", degree: 1 } })?.code, "Sag");
  assert.equal(
    resolveAscendant({ house_cusps: [{ house: 1, sign: "Pis", degree: 3 }] })?.code,
    "Pis",
  );
  assert.equal(resolveAscendant({ planetary_positions: [] }), null);
  assert.deepEqual(resolveMoon(chart), { code: "Can", nakshatra: "Pushya" });
});

test("three lines: Moon + nakshatra, Lagna, current Mahadasha", () => {
  const lines = buildChartThreeLines({
    kundali: {
      planetary_positions: [{ name: "Moon", sign: "Tau" }],
      ascendant: { sign: "Ari", degree: 10 },
    },
    nakshatra: "Rohini",
    dashaPeriods: [
      { planet: "Venus", endDate: "2020-01-01", isCurrent: false },
      { planet: "Saturn", endDate: "2031-05-01", isCurrent: true },
    ],
  });
  assert.deepEqual(
    lines.map((l) => l.label),
    ["Moon", "Lagna", "Mahadasha"],
  );
  assert.match(lines[0].value, /Taurus.*Rohini/);
  assert.match(lines[1].value, /Aries/);
  assert.match(lines[2].value, /Saturn until 2031/);
  assert.deepEqual(buildChartThreeLines({ kundali: null }), []);
});

test("city suggestions are deduped by name and rounded coordinates", () => {
  const out = dedupeLocationSuggestions([
    { display_name: "Pune, Maharashtra, India", lat: "18.5204", lon: "73.8567" },
    { display_name: "Pune, Maharashtra, India", lat: "18.53", lon: "73.85" },
    { display_name: "Pune City, Maharashtra, India", lat: "18.5211", lon: "73.8555" },
    { display_name: "Mumbai, Maharashtra, India", lat: "19.076", lon: "72.8777" },
  ]);
  assert.deepEqual(
    out.map((o) => o.display_name),
    ["Pune, Maharashtra, India", "Mumbai, Maharashtra, India"],
  );
});

test("a saved profile is detected under users/{uid}.profile", () => {
  assert.equal(
    hasSavedBirthProfile({ profile: { name: "A", dob: "1990-01-01", tob: "06:00" } }),
    true,
  );
  // Top-level `name` alone (the old check) is not a birth profile.
  assert.equal(hasSavedBirthProfile({ name: "A" }), false);
  assert.equal(hasSavedBirthProfile({ profile: { name: "A" } }), false);
  assert.equal(hasSavedBirthProfile({ dob: "1990-01-01", tob: "06:00" }), true);
  assert.equal(hasSavedBirthProfile(undefined), false);
});
