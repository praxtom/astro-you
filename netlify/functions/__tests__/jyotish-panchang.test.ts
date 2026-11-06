import test from "node:test";
import assert from "node:assert/strict";
import {
  astronomyEngineProvider,
  computePanchang,
  karanaName,
  tithiName,
} from "../../../src/lib/jyotish/index.js";

// Reference values: Drik Panchang day pages (drikpanchang.com/panchang/day-panchang.html),
// fetched 2026-11-07. Coordinates are the GeoNames points Drik uses for each city.
// Times are local (IST); "+1" marks the following civil day.
const toMinutes = (hhmm: string) => {
  const [time, plus] = hhmm.split(" ");
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m + (plus ? Number(plus) * 1440 : 0);
};
const near = (actual: string, expected: string, minutes = 2) =>
  assert.ok(
    Math.abs(toMinutes(actual) - toMinutes(expected)) <= minutes,
    `${actual} vs ${expected}`,
  );

test("Lucknow 2026-11-06 (Drik: geoname 1264733)", () => {
  const p = computePanchang(
    { date: "2026-11-06", lat: 26.83928, lng: 80.92313, utcOffsetHours: 5.5 },
    astronomyEngineProvider,
  );
  assert.equal(p.vara.english, "Friday");
  near(p.sunriseLocal, "06:19");
  near(p.sunsetLocal, "17:20");
  assert.equal(p.tithi.name, "Dwadashi");
  assert.equal(p.tithi.paksha, "Krishna");
  near(p.tithi.endsLocal, "10:30");
  assert.equal(p.nakshatra.name, "Hasta");
  near(p.nakshatra.endsLocal, "04:43 +1");
  assert.equal(p.yoga.name, "Vishkumbha");
  near(p.yoga.endsLocal, "04:10 +1");
  assert.deepEqual(
    p.karanas.slice(0, 2).map((k) => k.name),
    ["Taitila", "Garaja"],
  );
  near(p.karanas[0].endsLocal, "10:30");
  near(p.karanas[1].endsLocal, "22:36");
  // Friday Rahu Kaal is the 4th eighth of the day. (Production showed 13:12–14:34,
  // which is the Thursday slot — a bug the local engine fixes.)
  near(p.rahuKaal.startLocal, "10:27");
  near(p.rahuKaal.endLocal, "11:50");
  near(p.gulika.startLocal, "07:42");
  near(p.gulika.endLocal, "09:04");
  near(p.yamaganda.startLocal, "14:35");
  near(p.yamaganda.endLocal, "15:58");
  near(p.abhijit.startLocal, "11:28");
  near(p.abhijit.endLocal, "12:12");
  assert.equal(p.abhijit.observed, true);
});

test("New Delhi 2025-01-15 (Drik: geoname 1261481)", () => {
  const p = computePanchang(
    { date: "2025-01-15", lat: 28.63576, lng: 77.22445, utcOffsetHours: 5.5 },
    astronomyEngineProvider,
  );
  assert.equal(p.vara.english, "Wednesday");
  near(p.sunriseLocal, "07:15");
  near(p.sunsetLocal, "17:46");
  assert.equal(p.tithi.name, "Dwitiya");
  assert.equal(p.tithi.paksha, "Krishna");
  near(p.tithi.endsLocal, "03:23 +1");
  assert.equal(p.nakshatra.name, "Pushya");
  near(p.nakshatra.endsLocal, "10:28");
  assert.equal(p.yoga.name, "Priti");
  near(p.yoga.endsLocal, "01:47 +1");
  assert.equal(p.karanas[0].name, "Taitila");
  near(p.karanas[0].endsLocal, "15:17");
  near(p.rahuKaal.startLocal, "12:31");
  near(p.rahuKaal.endLocal, "13:50");
  near(p.gulika.startLocal, "11:12");
  near(p.yamaganda.startLocal, "08:34");
  assert.equal(p.abhijit.observed, false); // Drik lists no Abhijit on Wednesdays
});

test("Mumbai 2024-06-21 (Drik: geoname 1275339)", () => {
  const p = computePanchang(
    { date: "2024-06-21", lat: 19.07283, lng: 72.88261, utcOffsetHours: 5.5 },
    astronomyEngineProvider,
  );
  assert.equal(p.vara.english, "Friday");
  near(p.sunriseLocal, "06:02");
  near(p.sunsetLocal, "19:19");
  assert.equal(p.tithi.name, "Chaturdashi");
  assert.equal(p.tithi.paksha, "Shukla");
  near(p.tithi.endsLocal, "07:31");
  assert.equal(p.nakshatra.name, "Jyeshtha");
  near(p.nakshatra.endsLocal, "18:19");
  assert.equal(p.yoga.name, "Shubha");
  near(p.yoga.endsLocal, "18:42");
  assert.deepEqual(
    p.karanas.slice(0, 2).map((k) => k.name),
    ["Vanija", "Vishti"],
  );
  near(p.karanas[1].endsLocal, "19:08");
  near(p.rahuKaal.startLocal, "11:01");
  near(p.rahuKaal.endLocal, "12:40");
  near(p.abhijit.startLocal, "12:14");
  near(p.abhijit.endLocal, "13:07");
});

test("tithi and karana naming", () => {
  assert.deepEqual(tithiName(14), { name: "Purnima", paksha: "Shukla" });
  assert.deepEqual(tithiName(29), { name: "Amavasya", paksha: "Krishna" });
  assert.deepEqual(tithiName(15), { name: "Pratipada", paksha: "Krishna" });
  assert.equal(karanaName(0), "Kimstughna");
  assert.equal(karanaName(1), "Bava");
  assert.equal(karanaName(7), "Vishti");
  assert.equal(karanaName(56), "Vishti");
  assert.equal(karanaName(57), "Shakuni");
  assert.equal(karanaName(59), "Naga");
});
