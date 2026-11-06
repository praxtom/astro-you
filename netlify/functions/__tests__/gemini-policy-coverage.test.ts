import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCompatibilityNarrativePrompt,
  buildConversationSummaryPrompt,
  buildJyotishPrompt,
  buildProactiveNudgePrompt,
} from "../shared/gemini.js";
import { buildPatternIntelligencePrompt } from "../shared/pattern-intelligence.js";

const POLICY = /SHARED ASTROYOU GUIDANCE POLICY/;

test("compatibility, nudge and summary prompts inject the guidance policy", () => {
  const compat = buildCompatibilityNarrativePrompt(
    { overall_score: 24 },
    "Asha",
    "Ravi",
  );
  assert.match(compat, POLICY);
  assert.match(compat, /ONE small, concrete action/);
  assert.match(compat, /never say "guaranteed"/i);

  const nudge = buildProactiveNudgePrompt(
    { name: "Asha" },
    "relational_management",
  );
  assert.match(nudge, POLICY);

  const summary = buildConversationSummaryPrompt(
    [{ role: "user", content: "Will we marry?" }],
    "Asha",
  );
  assert.match(summary, POLICY);
});

test("buildJyotishPrompt uses an honest identity and no outcome promises", () => {
  const prompt = buildJyotishPrompt({ name: "Asha" }, "Moon in Taurus.");
  assert.doesNotMatch(prompt, /not an AI assistant/i);
  assert.doesNotMatch(prompt, /Never sound like a chatbot or AI/i);
  assert.doesNotMatch(prompt, /stars were watching/i);
  assert.match(prompt, /never deny being AI/i);
  assert.match(prompt, /not a human astrologer/i);
  assert.match(prompt, /What I remember/);
  assert.match(prompt, /No Outcome Promises/);
  assert.match(prompt, /ONE small, concrete action/);
});

test("buildJyotishPrompt includes compatibility context only when present", () => {
  const without = buildJyotishPrompt({ name: "Asha" }, "Moon in Taurus.");
  assert.doesNotMatch(without, /Recent compatibility reading/);
  const withCtx = buildJyotishPrompt(
    { name: "Asha", compatibilityContext: "Asha & Ravi: 24/36 Guna Milan" },
    "Moon in Taurus.",
  );
  assert.match(
    withCtx,
    /Recent compatibility reading the user ran:\*\* Asha & Ravi: 24\/36 Guna Milan/,
  );
});

test("memory transparency is preserved in diary and adaptive prompts", () => {
  const prompt = buildJyotishPrompt(
    {
      name: "Asha",
      recentSummaries: [
        { title: "Career", summary: "Talked career.", date: "2026-10-01" },
      ],
    },
    "Moon in Taurus.",
  );
  assert.match(prompt, /MEMORY TRANSPARENCY/);

  const adaptive = buildPatternIntelligencePrompt({
    decision: "weave",
    signals: [
      {
        naturalCue: "They tend to overwork.",
        suggestedMove: "Gently note it.",
      },
    ],
    changeSignals: [],
  } as any);
  assert.match(adaptive, /What I remember/);
});
