import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyDigest } from "../shared/digest.js";

test("buildDailyDigest combines panchang, routines, and Atman state", () => {
  const digest = buildDailyDigest({
    name: "Asha",
    panchang: { tithi: "Ekadashi", nakshatra: "Rohini", rahu_kaal: "10:30-12:00" },
    dashaInfo: { currentMahadasha: "Saturn", currentAntardasha: "Venus" },
    transitContext: "Jupiter supports learning.",
    atman: { emotionalState: "anxious", routines: [{ title: "Breathwork", streak: 3 }] },
  });

  assert.match(digest.subject, /Asha/);
  assert.match(digest.text, /Ekadashi/);
  assert.match(digest.text, /Rohini/);
  assert.match(digest.text, /Saturn/);
  assert.match(digest.text, /Jupiter/);
  assert.match(digest.text, /Breathwork/);
  assert.match(digest.text, /anxious/);
});
