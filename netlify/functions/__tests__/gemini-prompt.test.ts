import test from "node:test";
import assert from "node:assert/strict";
import { buildJyotishPrompt } from "../shared/gemini.js";

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
