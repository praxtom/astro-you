import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPatternIntelligence,
  buildPatternIntelligencePrompt,
} from "../shared/pattern-intelligence.js";
import type { AtmanData } from "../../../src/types/user.js";

const NOW = new Date("2026-06-12T10:00:00.000Z");

function baseAtman(): AtmanData {
  return {
    schemaVersion: 1,
    emotionalState: "stable",
    lastEmotionalUpdate: NOW,
    emotionalHistory: [],
    knownPatterns: [],
    activeEvents: [],
    lifeEvents: [],
    meditationStreak: 0,
    mantraAffinity: [],
    preferredPractice: "breathwork",
    keyRelationships: [],
    routines: [],
    savedAdvice: [],
    nudgeHistory: [],
    transient: {
      emotionalState: "stable",
      lastEmotionalUpdate: NOW,
      emotionalHistory: [],
    },
    memory: {
      knownPatterns: [],
      lifeEvents: [],
      keyRelationships: [],
      routines: [],
      savedAdvice: [],
      nudgeHistory: [],
    },
  };
}

test("stays silent for casual acknowledgements", () => {
  const atman = baseAtman();
  atman.knownPatterns = [
    {
      id: "work_pressure",
      pattern: "Carries too much work when deadlines rise",
      frequency: 5,
      weightScore: 4,
      confidence: 0.9,
      sourceCount: 5,
      lastMentioned: NOW,
      verified: false,
      category: "behavioral",
    },
  ];

  const intelligence = buildPatternIntelligence({
    latestMessage: "ok",
    atman,
    now: NOW,
  });

  assert.equal(intelligence.decision, "silent");
  assert.equal(intelligence.signals.length, 0);
  assert.equal(buildPatternIntelligencePrompt(intelligence), "");
});

test("suggests an action for a relevant repeated behavior loop", () => {
  const atman = baseAtman();
  atman.knownPatterns = [
    {
      id: "work_pressure",
      pattern: "Carries too much work when deadlines rise",
      frequency: 5,
      weightScore: 4.5,
      confidence: 0.9,
      sourceCount: 5,
      lastMentioned: NOW,
      verified: true,
      category: "behavioral",
    },
  ];

  const intelligence = buildPatternIntelligence({
    latestMessage: "The workload is too much again and deadlines are coming.",
    atman,
    now: NOW,
  });

  assert.equal(intelligence.decision, "suggest_action");
  assert.equal(intelligence.signals[0].memoryType, "repeated_behavior_loop");
  assert.match(intelligence.signals[0].naturalCue, /pressure rises/i);
  assert.equal(intelligence.changeSignals[0].direction, "getting_stronger");
});

test("recognizes growth when old behavior is contradicted", () => {
  const atman = baseAtman();
  atman.contradictedPatterns = ["User is no longer avoiding hard conversations"];
  atman.knownPatterns = [
    {
      id: "avoidance",
      pattern: "Avoids hard conversations",
      frequency: 4,
      weightScore: 3,
      confidence: 0.85,
      sourceCount: 4,
      lastMentioned: NOW,
      verified: false,
      archived: true,
      category: "relational",
    },
  ];

  const intelligence = buildPatternIntelligence({
    latestMessage: "I finally had the difficult conversation with my manager.",
    atman,
    now: NOW,
  });

  assert.equal(intelligence.decision, "reflect");
  assert.equal(intelligence.signals[0].memoryType, "growth_change");
  assert.equal(intelligence.changeSignals[0].direction, "changed_recently");
});

test("prompt speaks naturally and hides memory machinery", () => {
  const atman = baseAtman();
  atman.knownPatterns = [
    {
      id: "work_pressure",
      pattern: "Carries too much work when deadlines rise",
      frequency: 5,
      weightScore: 4.5,
      confidence: 0.9,
      sourceCount: 5,
      lastMentioned: NOW,
      verified: true,
      category: "behavioral",
    },
  ];

  const prompt = buildPatternIntelligencePrompt(
    buildPatternIntelligence({
      latestMessage: "The workload is too much again and deadlines are coming.",
      atman,
      now: NOW,
    }),
  );

  assert.match(prompt, /Adaptive companion guidance/i);
  assert.match(prompt, /Speak like someone who remembers/i);
  assert.doesNotMatch(prompt, /\bpattern\b/i);
  assert.doesNotMatch(prompt, /Atman/i);
  assert.doesNotMatch(prompt, /detected/i);
});

test("matches memories by meaning even when exact words differ", () => {
  const atman = baseAtman();
  atman.knownPatterns = [
    {
      id: "overcommitment",
      pattern: "Takes on too many responsibilities when work pressure rises",
      frequency: 4,
      weightScore: 4,
      confidence: 0.85,
      sourceCount: 4,
      lastMentioned: NOW,
      verified: true,
      category: "behavioral",
    },
  ];

  const intelligence = buildPatternIntelligence({
    latestMessage: "I keep saying yes to everyone and my calendar is packed.",
    atman,
    now: NOW,
  });

  assert.equal(intelligence.decision, "suggest_action");
  assert.equal(intelligence.signals[0].id, "overcommitment");
  assert.ok(intelligence.signals[0].relevance >= 0.4);
});

test("escalates when emotional trend is worsening and memory is relevant", () => {
  const atman = baseAtman();
  atman.emotionalHistory = [
    { state: "stable", date: new Date("2026-06-08T10:00:00.000Z") },
    { state: "anxious", date: new Date("2026-06-10T10:00:00.000Z") },
    { state: "chaotic", date: new Date("2026-06-12T09:00:00.000Z") },
  ];
  atman.knownPatterns = [
    {
      id: "pressure_spiral",
      pattern: "Becomes overwhelmed when responsibilities pile up",
      frequency: 5,
      weightScore: 4.8,
      confidence: 0.9,
      sourceCount: 5,
      lastMentioned: NOW,
      verified: true,
      category: "emotional",
    },
  ];

  const intelligence = buildPatternIntelligence({
    latestMessage: "Everything is piling up and I feel completely overwhelmed.",
    atman,
    now: NOW,
  });

  assert.equal(intelligence.decision, "strong_intervention");
  assert.equal(intelligence.changeSignals[0].direction, "getting_stronger");
  assert.match(intelligence.changeSignals[0].cue, /emotional tone is intensifying/i);
});

test("reduces repeated interventions when the same memory was used recently", () => {
  const atman = baseAtman();
  atman.knownPatterns = [
    {
      id: "work_pressure",
      pattern: "Carries too much work when deadlines rise",
      frequency: 5,
      weightScore: 4.5,
      confidence: 0.9,
      sourceCount: 5,
      lastMentioned: NOW,
      lastUsedAt: new Date("2026-06-11T10:00:00.000Z"),
      verified: true,
      category: "behavioral",
    },
  ];

  const intelligence = buildPatternIntelligence({
    latestMessage: "The workload is too much again and deadlines are coming.",
    atman,
    now: NOW,
  });

  assert.equal(intelligence.decision, "reflect");
  assert.match(intelligence.signals[0].suggestedMove, /do not repeat/i);
});
