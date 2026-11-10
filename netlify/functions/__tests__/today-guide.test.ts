import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTodayGuide,
  nakshatraIndex,
  signIndex,
} from "../../../src/lib/todayGuide.js";
import type { PanchangData } from "../../../src/lib/panchang.js";

const panchang: PanchangData = {
  tithi: "Dwadashi",
  nakshatra: "Hasta",
  yoga: "Vishkumbha",
  karana: "Bava",
  rahu_kaal: "10:27 - 11:50",
  moonSign: "Virgo",
};

test("guidance is read from the natal Moon: house and tara", () => {
  // Virgo is the 7th sign from Pisces; Hasta (13th) counted from Uttara
  // Bhadrapada (26th) is the 15th star → 15 mod 9 = 6th tara, Sadhana.
  const g = buildTodayGuide(undefined, panchang, null, false, {
    moonSign: "Pisces",
    moonNakshatra: "Uttara Bhadrapada",
  });
  assert.equal(g.personal, true);
  assert.match(g.why, /7th sign from your natal Moon in Pisces/);
  assert.match(g.why, /Sadhana tara/);
  assert.equal(
    g.context,
    "Today's Moon is in Hasta nakshatra, the 7th sign from your Moon sign.",
  );
  assert.match(g.energy, /relational/i);
});

test("no known emotional state never invents 'stable'", () => {
  for (const natal of [null, { moonSign: "Pisces" }]) {
    const g = buildTodayGuide(undefined, panchang, null, false, natal);
    const all = [g.energy, g.action, g.caution, g.nudge, g.why].join(" ");
    assert.doesNotMatch(all, /stable/i);
    assert.doesNotMatch(all, /refreshing/i);
  }
});

test("Rahu Kaal copy is calm, not fear-based", () => {
  const g = buildTodayGuide(undefined, panchang, null, false, null);
  assert.doesNotMatch(g.caution, /avoid|danger|bad/i);
  assert.match(g.caution, /Rahu Kaal \(10:27 - 11:50\)/);
});

test("a failed Panchang says so plainly", () => {
  const g = buildTodayGuide(undefined, null, "boom", false, null);
  assert.match(g.why, /couldn't load/);
  assert.equal(g.personal, false);
});

test("sign and nakshatra parsing tolerates spellings", () => {
  assert.equal(signIndex("Vir"), 5);
  assert.equal(signIndex("Kanya"), 5);
  assert.equal(signIndex("Meena"), 11);
  assert.equal(nakshatraIndex("Poorva Bhadrapada"), 24);
  assert.equal(nakshatraIndex("Uttara Bhadra"), 25);
  assert.equal(nakshatraIndex("Moola"), 18);
  assert.equal(nakshatraIndex("Dhanishtha"), 22);
  assert.equal(nakshatraIndex("Mrigasira"), 4);
  assert.equal(nakshatraIndex("Shatabhishak"), 23);
  assert.equal(nakshatraIndex("Aswini"), 0);
  assert.equal(nakshatraIndex("Uttarashada"), 20);
  assert.equal(nakshatraIndex("Purva Phalguni"), 10);
  assert.equal(nakshatraIndex("Jyestha"), 17);
});
