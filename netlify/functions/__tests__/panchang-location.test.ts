import test from "node:test";
import assert from "node:assert/strict";
import { stripPanchangLocation } from "../shared/chart-cache.js";

test("panchang cache payloads drop the requester's place", () => {
  const raw = {
    tithi: { name: "Shukla Panchami", end: "14:02" },
    sunrise: "06:41",
    location: { city: "Pune", latitude: 18.52, longitude: 73.856 },
    datetime_location: { latitude: 18.52, longitude: 73.856 },
    nested: { rahu_kaal: { start: "09:00" }, coordinates: [18.52, 73.856], Lat: 18.52 },
    list: [{ lng: 73.856, nakshatra: "Rohini" }],
  };
  const clean = stripPanchangLocation(raw);
  assert.deepEqual(clean, {
    tithi: { name: "Shukla Panchami", end: "14:02" },
    sunrise: "06:41",
    nested: { rahu_kaal: { start: "09:00" } },
    list: [{ nakshatra: "Rohini" }],
  });
  assert.equal(stripPanchangLocation(null), null);
});
