import test from "node:test";
import assert from "node:assert/strict";
import { GLOSSARY, lookupTerm } from "../../../src/lib/glossary.js";

// Every Sanskrit term the dashboard and compatibility surfaces put in front of
// a reader with no background.
const REQUIRED_TERMS = [
  "panchang",
  "tithi",
  "nakshatra",
  "yoga",
  "karana",
  "vara",
  "rahu-kaal",
  "dasha",
  "mahadasha",
  "antardasha",
  "rashi",
  "lagna",
  "kundali",
  "jyotish",
  "atman",
  "prana",
  "dharma",
  "sadhana",
  "guna-milan",
  "manglik",
  "dosha",
  "sade-sati",
  "navamsa",
  "ayanamsa",
  "muhurat",
  "graha",
];

test("every term the UI surfaces has an entry", () => {
  for (const key of REQUIRED_TERMS) {
    assert.ok(GLOSSARY[key as keyof typeof GLOSSARY], `missing: ${key}`);
  }
});

test("short definitions fit a tooltip and long ones add real detail", () => {
  for (const [key, entry] of Object.entries(GLOSSARY)) {
    assert.ok(entry.term.length > 0, `${key} has no display term`);
    assert.ok(entry.short.length > 0, `${key} has no short definition`);
    assert.ok(
      entry.short.length <= 120,
      `${key} short definition is ${entry.short.length} chars, too long for a tooltip`,
    );
    assert.ok(
      entry.long.length > entry.short.length,
      `${key} long definition adds nothing over the short one`,
    );
  }
});

test("a short definition never leans on another untranslated term", () => {
  // Defining one Sanskrit word with another is not a definition for someone
  // with no background — it just defers the confusion.
  const jargon = REQUIRED_TERMS.filter(
    (t) => !["yoga", "dharma", "prana"].includes(t), // familiar enough in English
  );
  for (const [key, entry] of Object.entries(GLOSSARY)) {
    for (const term of jargon) {
      if (term === key) continue;
      const word = term.replace("-", "[ -]");
      assert.equal(
        new RegExp(`\\b${word}\\b`, "i").test(entry.short),
        false,
        `${key}'s short definition uses "${term}"`,
      );
    }
  }
});

test("lookupTerm is case- and whitespace-insensitive", () => {
  assert.equal(lookupTerm("Nakshatra")?.term, GLOSSARY.nakshatra.term);
  assert.equal(lookupTerm("  rahu-kaal  ")?.term, GLOSSARY["rahu-kaal"].term);
  assert.equal(lookupTerm("TITHI")?.term, GLOSSARY.tithi.term);
});

test("lookupTerm returns null for an unknown key", () => {
  assert.equal(lookupTerm("not-a-term"), null);
  assert.equal(lookupTerm(""), null);
});
