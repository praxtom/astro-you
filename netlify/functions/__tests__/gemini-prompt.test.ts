import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCompatibilityNarrativePrompt,
  buildInteractionInput,
  buildJyotishPrompt,
  buildTransitSummaryPrompt,
} from "../shared/gemini.js";

test("buildJyotishPrompt uses prediction feedback to calibrate future guidance", () => {
  const prompt = buildJyotishPrompt(
    {
      name: "Asha",
      atman: {
        emotionalState: "stable",
        knownPatterns: [],
        activeEvents: [],
        routines: [],
        keyRelationships: [],
        adviceHistory: [],
        predictionFeedbackStats: {
          accurate: 1,
          partly: 1,
          missed: 4,
          lastSignal: "missed",
          lastSource: "daily_forecast",
        },
      },
    },
    "Moon in Taurus.",
  );

  assert.match(prompt, /PREDICTION FEEDBACK CALIBRATION/);
  assert.match(prompt, /missed: 4/i);
  assert.match(prompt, /avoid overconfident predictions/i);
});

test("buildJyotishPrompt forces short replies for acknowledgements", () => {
  const prompt = buildJyotishPrompt(
    {
      name: "Asha",
      atman: {
        emotionalState: "stable",
        knownPatterns: [],
        activeEvents: [{ title: "Interview", status: "pending" }],
        routines: [],
        keyRelationships: [],
        adviceHistory: [],
      },
    },
    "Saturn Mahadasha.",
  );

  assert.match(prompt, /CASUAL REPLY MODE/);
  assert.match(prompt, /ok.*okay.*thanks/i);
  assert.match(prompt, /1-2 short lines/i);
  assert.match(prompt, /Use Atman memory only when it directly relates/i);
  assert.match(prompt, /Do not restart chart analysis/i);
});

test("buildInteractionInput uses recent turns when interaction id is missing", () => {
  const input = buildInteractionInput(
    [
      { role: "user", content: "I am preparing for my 2026 launch." },
      {
        role: "assistant",
        content: "Keep the Saturn discipline steady and focused.",
      },
      { role: "user", content: "ok" },
    ],
    undefined,
  );

  assert.match(input, /Recent visible conversation context/i);
  assert.match(input, /USER: I am preparing for my 2026 launch/);
  assert.match(input, /ASSISTANT: Keep the Saturn discipline/);
  assert.match(input, /Latest user message:\nok/);
});

test("buildInteractionInput uses latest message only when interaction id exists", () => {
  const input = buildInteractionInput(
    [
      { role: "user", content: "Remember my launch plan." },
      { role: "assistant", content: "I will keep that in view." },
      { role: "user", content: "ok" },
    ],
    "interaction_123",
  );

  assert.equal(input, "ok");
});

test("buildTransitSummaryPrompt includes compact Atman context", () => {
  const prompt = buildTransitSummaryPrompt(
    {
      name: "Asha",
      moonSign: "Taurus",
      ascendant: "Leo",
      atman: {
        emotionalState: "anxious",
        knownPatterns: [
          {
            id: "work_pressure",
            pattern: "Carries too much work when deadlines rise",
            frequency: 4,
            weightScore: 4,
            lastMentioned: new Date("2026-06-12T10:00:00.000Z"),
            verified: true,
          },
        ],
        activeEvents: [{ title: "Product beta", status: "pending" }],
        routines: [],
        keyRelationships: [],
        adviceHistory: [],
      },
    },
    [{ title: "Saturn aspecting Moon" }],
  );

  assert.match(prompt, /Atman context/i);
  assert.match(prompt, /anxious/i);
  assert.match(prompt, /Carries too much work/i);
  assert.match(prompt, /Product beta/i);
});

test("buildCompatibilityNarrativePrompt includes relationship brain context", () => {
  const prompt = buildCompatibilityNarrativePrompt(
    { overall_score: 28, synastry: { emotional_connection: 80 } },
    "Asha",
    "Ravi",
    {
      name: "Asha",
      atman: {
        emotionalState: "stable",
        knownPatterns: [
          {
            id: "avoidance",
            pattern: "Avoids hard conversations",
            frequency: 3,
            weightScore: 3.5,
            lastMentioned: new Date("2026-06-12T10:00:00.000Z"),
            verified: true,
          },
        ],
        activeEvents: [],
        routines: [],
        keyRelationships: [
          {
            name: "Ravi",
            relation: "partner",
            dynamic: "conflict",
          },
        ],
        adviceHistory: [],
      },
    },
  );

  assert.match(prompt, /Relationship context/i);
  assert.match(prompt, /Avoids hard conversations/i);
  assert.match(prompt, /Ravi \(partner, conflict\)/i);
});
