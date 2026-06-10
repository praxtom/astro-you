import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialAtmanData,
  normalizeAtmanData,
  validateAtmanData,
  validateAtmanEmotionalState,
  validateAtmanText,
} from "../../../src/lib/atman-schema.js";
import { ATMAN_SCHEMA_VERSION, type AtmanData } from "../../../src/types/user.js";

test("normalizeAtmanData migrates legacy memory into versioned buckets", () => {
  const lastUpdate = new Date("2026-05-01T00:00:00.000Z");
  const legacy: Partial<AtmanData> = {
    emotionalState: "anxious",
    lastEmotionalUpdate: lastUpdate,
    emotionalHistory: [{ state: "stable", date: lastUpdate }],
    knownPatterns: ["avoids hard conversations" as any],
    activeEvents: [
      {
        id: "event_1",
        title: "Job interview",
        status: "pending",
        category: "career",
        confidence: 0.8,
      },
    ],
    keyRelationships: [
      {
        id: "rel_1",
        name: "Asha",
        relation: "friend",
        dynamic: "supportive",
      },
    ],
    routines: [],
    adviceHistory: [
      {
        advice: "Sleep before midnight",
        context: "career anxiety",
        date: "2026-05-01",
      },
    ],
    dailyIntention: "Act calmly",
    dailyIntentionDate: "2026-05-29",
    dailyGratitude: "Family support",
    dailyGratitudeDate: "2026-05-29",
  };

  const normalized = normalizeAtmanData(legacy);

  assert.ok(normalized);
  assert.equal(normalized.schemaVersion, ATMAN_SCHEMA_VERSION);
  assert.equal(normalized.transient?.emotionalState, "anxious");
  assert.equal(normalized.transient?.emotionalHistory?.length, 1);
  assert.equal(normalized.knownPatterns[0].pattern, "avoids hard conversations");
  assert.equal(normalized.memory?.knownPatterns[0].pattern, "avoids hard conversations");
  assert.equal(normalized.lifeEvents?.[0].title, "Job interview");
  assert.equal(normalized.activeEvents[0].title, "Job interview");
  assert.equal(normalized.memory?.lifeEvents[0].title, "Job interview");
  assert.equal(normalized.savedAdvice?.[0].advice, "Sleep before midnight");
  assert.equal(normalized.memory?.savedAdvice?.[0].advice, "Sleep before midnight");
  assert.equal(normalized.dailyIntention, "Act calmly");
  assert.equal(normalized.dailyGratitude, "Family support");
  assert.deepEqual(validateAtmanData(normalized), []);
});

test("createInitialAtmanData creates a valid empty schema", () => {
  const now = new Date("2026-05-29T00:00:00.000Z");
  const atman = createInitialAtmanData(now);

  assert.equal(atman.schemaVersion, ATMAN_SCHEMA_VERSION);
  assert.equal(atman.emotionalState, "stable");
  assert.equal(atman.transient?.lastEmotionalUpdate, now);
  assert.deepEqual(atman.memory?.lifeEvents, []);
  assert.deepEqual(validateAtmanData(atman), []);
});

test("Atman validators reject unsafe write values", () => {
  assert.equal(validateAtmanEmotionalState("reactive"), "reactive");
  assert.throws(
    () => validateAtmanEmotionalState("terrified"),
    /Invalid emotionalState/,
  );
  assert.equal(validateAtmanText("  light practice  ", "routine.title"), "light practice");
  assert.throws(() => validateAtmanText(" ", "pattern"), /pattern is required/);
});
