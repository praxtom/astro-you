import test from "node:test";
import assert from "node:assert/strict";
import { normalizePanchang, expandRashi } from "../../../src/lib/panchang.js";

/**
 * Trimmed but faithful copy of a real astrology-api.io PANCHANG response
 * (New Delhi, 2026-08-17). The nesting here is the whole point of these
 * tests: rahu kalam, sunrise/sunset and the moon sign all live inside
 * container objects, and reading them flat is what silently produced "—".
 */
const REAL_RESPONSE = {
  date: { gregorian: "2026-08-17", year: 2026, month: 8, day: 17 },
  tithi: {
    number: 5,
    name: "Panchami",
    paksha: "shukla",
    progress_percentage: 54.74,
  },
  nakshatra: { number: 14, name: "Chitra", pada: 1, lord: "Mars" },
  yoga: { number: 23, name: "Shubha", nature: "auspicious" },
  karana: { number: 10, name: "Balava", nature: "movable" },
  vara: { name: "Somavara", english: "Monday", ruling_planet: "Moon" },
  sunrise_sunset: {
    sunrise: "05:51",
    sunset: "18:59",
    sunrise_hour: 5.8525,
    sunset_hour: 18.999722222222225,
  },
  inauspicious_periods: {
    rahu_kalam: { start: "07:30", end: "09:08", duration_minutes: 99 },
    yamagandam: { start: "10:46", end: "12:25", duration_minutes: 99 },
    gulika_kalam: { start: "14:04", end: "15:42", duration_minutes: 99 },
  },
  auspicious_periods: {
    abhijit_muhurta: { start: "12:01", end: "12:49", duration_minutes: 48 },
  },
  moon_sign: { rashi: "Vir", longitude: 174.4924, degree_in_sign: 24.49 },
  sun_sign: { rashi: "Can", longitude: 119.9233, degree_in_sign: 29.92 },
  location: { city: "New Delhi", timezone: "Asia/Kolkata" },
};

test("reads rahu kaal out of inauspicious_periods as a time range", () => {
  const p = normalizePanchang(REAL_RESPONSE);
  assert.equal(p.rahu_kaal, "07:30 - 09:08");
});

test("reads sunrise and sunset out of sunrise_sunset", () => {
  const p = normalizePanchang(REAL_RESPONSE);
  assert.equal(p.sunrise, "05:51");
  assert.equal(p.sunset, "18:59");
});

test("expands the abbreviated moon rashi to a full sign name", () => {
  const p = normalizePanchang(REAL_RESPONSE);
  assert.equal(p.moonSign, "Virgo");
});

test("keeps the named panchang limbs", () => {
  const p = normalizePanchang(REAL_RESPONSE);
  assert.equal(p.tithi, "Panchami");
  assert.equal(p.nakshatra, "Chitra");
  assert.equal(p.yoga, "Shubha");
  assert.equal(p.karana, "Balava");
  assert.equal(p.day, "Monday");
});

test("no field silently degrades to the em-dash placeholder", () => {
  const p = normalizePanchang(REAL_RESPONSE);
  for (const [key, value] of Object.entries(p)) {
    assert.notEqual(value, "—", `${key} fell back to the placeholder`);
  }
});

test("still reads a flat response, so an API shape change degrades softly", () => {
  const p = normalizePanchang({
    tithi: "Panchami",
    nakshatra: "Chitra",
    yoga: "Shubha",
    karana: "Balava",
    rahu_kaal: "07:30 - 09:08",
    sunrise: "05:51",
    sunset: "18:59",
    moon_sign: "Virgo",
    day: "Monday",
  });
  assert.equal(p.rahu_kaal, "07:30 - 09:08");
  assert.equal(p.sunrise, "05:51");
  assert.equal(p.moonSign, "Virgo");
  assert.equal(p.tithi, "Panchami");
});

test("falls back to the placeholder only when the field is genuinely absent", () => {
  const p = normalizePanchang({ tithi: { name: "Panchami" } });
  assert.equal(p.tithi, "Panchami");
  assert.equal(p.rahu_kaal, "—");
  assert.equal(p.nakshatra, "—");
  assert.equal(p.moonSign, undefined);
});

test("a rahu kalam missing its end time still shows the start", () => {
  const p = normalizePanchang({
    inauspicious_periods: { rahu_kalam: { start: "07:30" } },
  });
  assert.equal(p.rahu_kaal, "07:30");
});

test("expandRashi maps every abbreviation and passes through full names", () => {
  const pairs: Array<[string, string]> = [
    ["Ari", "Aries"],
    ["Tau", "Taurus"],
    ["Gem", "Gemini"],
    ["Can", "Cancer"],
    ["Leo", "Leo"],
    ["Vir", "Virgo"],
    ["Lib", "Libra"],
    ["Sco", "Scorpio"],
    ["Sag", "Sagittarius"],
    ["Cap", "Capricorn"],
    ["Aqu", "Aquarius"],
    ["Pis", "Pisces"],
  ];
  for (const [abbr, full] of pairs) {
    assert.equal(expandRashi(abbr), full, `${abbr} should expand to ${full}`);
    assert.equal(expandRashi(full), full, `${full} should pass through`);
  }
  assert.equal(expandRashi("Kanya"), "Kanya", "unknown names pass through");
  assert.equal(expandRashi(undefined), undefined);
});

/**
 * The SEO panchang/muhurat pages use a second normalizer with its own shape.
 * It read the right containers but rendered period objects through a helper
 * that only understands name/title, so it produced "-" for the same fields.
 */
test("the SEO normalizer renders the nested period objects too", async () => {
  const { normalizePanchangResponse } = await import(
    "../../../src/lib/panchang-normalize.js"
  );
  const s = normalizePanchangResponse(REAL_RESPONSE);
  assert.equal(s.rahuKaal, "07:30 - 09:08");
  assert.equal(s.abhijitMuhurat, "12:01 - 12:49");
  assert.equal(s.sunrise, "05:51");
  assert.equal(s.sunset, "18:59");
  assert.equal(s.tithi, "Panchami");
  assert.equal(s.nakshatra, "Chitra");
});
