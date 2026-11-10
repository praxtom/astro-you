import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanSentences,
  fallbackDailyReading,
  parseDailyReading,
} from "../shared/daily-reading.js";

// The stock sign text the dashboard showed on 2026-11-10.
const SAMPLE =
  "Neutral planetary aspects create breathing room between fate and free choice. " +
  "Mercury in dance with Saturn brings a steady rhythm to your thoughts and words. " +
  "Saturn in the 4th house holds core lessons around family, roots, and emotional foundations. " +
  "Loving awareness transforms ordinary moments into sacred gifts. " +
  "Personal growth gets a helpful push today. " +
  "Take one concrete step toward who one is becoming. " +
  "Quantum possibilities collapse into manifestation with your focus. " +
  "Positive movement energy. " +
  "Short trips or new experiences bring joy. " +
  "Positive momentum grows from small, deliberate choices. " +
  "Take care not to let eagerness override practical wisdom.";

test("cleanup drops fragments and speaks to the reader", () => {
  const sentences = cleanSentences(SAMPLE);
  assert.ok(!sentences.includes("Positive movement energy."));
  assert.ok(sentences.some((s) => s.includes("toward who you are becoming")));
  assert.ok(!sentences.some((s) => /\bone is\b/.test(s)));
});

test("cleanup skips a second sentence in a row with the same opener", () => {
  const sentences = cleanSentences(
    "Positive energy lifts your morning plans. Positive momentum grows from small choices. Rest well tonight, friend.",
  );
  assert.deepEqual(sentences, [
    "Positive energy lifts your morning plans.",
    "Rest well tonight, friend.",
  ]);
});

test("fallback lede is the line that names a planet or house", () => {
  const reading = fallbackDailyReading(SAMPLE);
  assert.ok(reading);
  assert.match(reading.lede, /^Mercury in dance with Saturn/);
  assert.ok(reading.reading.split(/(?<=\.)\s+/).length <= 5);
});

test("fallback returns null for empty text", () => {
  assert.equal(fallbackDailyReading("   "), null);
});

test("model rewrite is accepted only in the asked-for shape", () => {
  const good = {
    lede: "Saturn in your 4th house asks for patience at home today.",
    reading:
      "Saturn in your 4th house asks for patience with family. Mercury and Saturn steady your words, so it is a good day for a careful conversation. Take one small, practical step.",
  };
  assert.deepEqual(parseDailyReading(JSON.stringify(good)), good);
  assert.deepEqual(
    parseDailyReading("```json\n" + JSON.stringify(good) + "\n```"),
    good,
  );
  assert.equal(parseDailyReading("not json"), null);
  assert.equal(
    parseDailyReading({ lede: "short", reading: good.reading }),
    null,
  );
  assert.equal(
    parseDailyReading({ lede: good.lede, reading: "x".repeat(800) }),
    null,
  );
});
