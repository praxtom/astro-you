import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBrainInsights,
  applyPredictionFeedbackSignal,
  maintainAtmanMemory,
  persistAtmanInsights,
  selectBrainContext,
  type AtmanBrainDeps,
} from "../shared/atman-brain.js";
import type { AtmanData } from "../../../src/types/user.js";

const NOW = new Date("2026-05-29T10:00:00.000Z");

function baseAtman(): AtmanData {
  return {
    schemaVersion: 1,
    emotionalState: "stable",
    lastEmotionalUpdate: new Date("2026-05-28T10:00:00.000Z"),
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
      lastEmotionalUpdate: new Date("2026-05-28T10:00:00.000Z"),
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

test("applyBrainInsights merges analysis into weighted memory and ledger", () => {
  const existing = baseAtman();
  existing.knownPatterns = [
    {
      id: "pattern_existing",
      pattern: "Avoids hard conversations",
      frequency: 2,
      weightScore: 2.5,
      lastMentioned: new Date("2026-05-20T10:00:00.000Z"),
      verified: false,
    },
  ];

  const result = applyBrainInsights({
    existingAtman: existing,
    analysisResult: {
      emotionalState: "anxious",
      newPatterns: ["Avoids hard conversations", "Worries before career decisions"],
      newEvents: [{ title: "Promotion review", category: "career" }],
      detectedContradictions: ["User is starting to speak up at work"],
      karmicThreads: ["Authority figures trigger self-doubt"],
    },
    extractedAdvice: {
      advice: "Prepare the promotion conversation before reacting.",
      context: "career anxiety",
    },
    source: {
      surface: "synthesis",
      interactionId: "interaction_123",
      userMessage: "I am worried about my promotion review.",
      assistantMessage: "Prepare before reacting.",
    },
    now: NOW,
  });

  assert.equal(result.atman.emotionalState, "anxious");
  assert.equal(result.atman.knownPatterns.length, 2);

  const repeated = result.atman.knownPatterns.find(
    (pattern) => pattern.pattern === "Avoids hard conversations",
  );
  assert.ok(repeated);
  assert.equal(repeated.frequency, 3);
  assert.equal(repeated.weightScore, 3);
  assert.equal(repeated.lastMentioned.toISOString(), NOW.toISOString());
  assert.equal(repeated.evidence?.[0].surface, "synthesis");
  assert.equal(repeated.evidence?.[0].interactionId, "interaction_123");

  assert.equal(result.atman.lifeEvents?.[0].title, "Promotion review");
  assert.equal(result.atman.savedAdvice?.[0].context, "career anxiety");
  assert.equal(result.atman.contradictedPatterns?.[0], "User is starting to speak up at work");
  assert.equal(result.atman.karmicThreads?.[0], "Authority figures trigger self-doubt");
  assert.equal(result.atman.memoryLedger?.length, 1);
  assert.equal(result.atman.memoryLedger?.[0].surface, "synthesis");
  assert.equal(result.atman.memory?.knownPatterns.length, 2);
});

test("applyBrainInsights marks advised related patterns as recently used", () => {
  const existing = baseAtman();
  existing.knownPatterns = [
    {
      id: "work_pressure",
      pattern: "Carries too much work when deadlines rise",
      frequency: 5,
      weightScore: 4,
      confidence: 0.9,
      sourceCount: 5,
      lastMentioned: new Date("2026-05-20T10:00:00.000Z"),
      verified: true,
      category: "behavioral",
    },
  ];

  const result = applyBrainInsights({
    existingAtman: existing,
    analysisResult: null,
    extractedAdvice: {
      advice: "Choose one deadline and reduce everything else for today.",
      context: "workload pressure",
    },
    source: {
      surface: "synthesis",
      userMessage: "The workload is too much again and deadlines are coming.",
      assistantMessage: "Choose one deadline and reduce everything else.",
    },
    now: NOW,
  });

  assert.equal(result.changed, true);
  assert.equal(
    result.atman.knownPatterns[0].lastUsedAt?.toISOString(),
    NOW.toISOString(),
  );
  assert.equal(
    result.atman.memory?.knownPatterns[0].lastUsedAt?.toISOString(),
    NOW.toISOString(),
  );
});

test("selectBrainContext ranks and limits prompt memory", () => {
  const atman = baseAtman();
  atman.knownPatterns = [
    {
      id: "low",
      pattern: "Low value",
      frequency: 1,
      weightScore: 0.4,
      lastMentioned: new Date("2026-01-01T00:00:00.000Z"),
      verified: false,
    },
    {
      id: "verified",
      pattern: "Verified pattern",
      frequency: 1,
      weightScore: 2,
      lastMentioned: new Date("2026-04-01T00:00:00.000Z"),
      verified: true,
    },
    {
      id: "strong",
      pattern: "Strong recent pattern",
      frequency: 4,
      weightScore: 4,
      lastMentioned: new Date("2026-05-28T00:00:00.000Z"),
      verified: false,
    },
  ];

  const selected = selectBrainContext(atman, { maxPatterns: 2 });
  assert.ok(selected);

  assert.deepEqual(
    selected.knownPatterns.map((pattern) => pattern.pattern),
    ["Verified pattern", "Strong recent pattern"],
  );
});

test("selectBrainContext keeps default prompt memory compact", () => {
  const atman = baseAtman();
  atman.knownPatterns = Array.from({ length: 6 }, (_, index) => ({
    id: `pattern_${index}`,
    pattern: `Pattern ${index}`,
    frequency: index + 1,
    weightScore: index + 1,
    lastMentioned: new Date(`2026-05-2${index}T00:00:00.000Z`),
    verified: false,
  }));
  const events = Array.from({ length: 4 }, (_, index) => ({
    id: `event_${index}`,
    title: `Event ${index}`,
    category: "career" as const,
    status: "pending" as const,
    confidence: 0.8,
  }));
  atman.activeEvents = events;
  atman.lifeEvents = events;
  atman.savedAdvice = Array.from({ length: 4 }, (_, index) => ({
    advice: `Advice ${index}`,
    context: `Context ${index}`,
    date: `2026-05-2${index}T00:00:00.000Z`,
    followedUp: false,
  }));

  const selected = selectBrainContext(atman);

  assert.equal(selected?.knownPatterns.length, 3);
  assert.equal(selected?.activeEvents.length, 2);
  assert.equal(selected?.savedAdvice?.length, 2);
});

test("selectBrainContext does not let stale unverified patterns dominate recent evidence", () => {
  const atman = baseAtman();
  const now = new Date();
  atman.knownPatterns = [
    {
      id: "stale",
      pattern: "Old money anxiety",
      frequency: 8,
      weightScore: 5,
      confidence: 1,
      sourceCount: 8,
      lastMentioned: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      verified: false,
    },
    {
      id: "recent",
      pattern: "Preparing calmly before decisions",
      frequency: 2,
      weightScore: 2,
      confidence: 0.8,
      sourceCount: 2,
      lastMentioned: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      verified: false,
    },
  ];

  const selected = selectBrainContext(atman, { maxPatterns: 1 });

  assert.equal(selected?.knownPatterns[0].pattern, "Preparing calmly before decisions");
});

test("applyBrainInsights tolerates imperfect AI memory shapes", () => {
  const result = applyBrainInsights({
    existingAtman: baseAtman(),
    analysisResult: {
      emotionalState: "worried",
      newPatterns: [
        {
          pattern: "Second-guesses decisions after family arguments",
          category: "relationship",
          confidence: 85,
        },
        { text: " " },
      ],
      newEvents: [
        { title: "Annual appraisal", category: "work", confidence: 75 },
        { title: " ", category: "career" },
      ],
    },
    source: {
      surface: "synthesis",
      interactionId: "interaction_shape_test",
      userMessage: "My annual appraisal is coming up and family arguments make me doubt myself.",
    },
    now: NOW,
  });

  assert.equal(result.changed, true);
  assert.equal(result.atman.emotionalState, "stable");
  assert.equal(result.ledgerEntry?.emotionalState, undefined);
  assert.equal(result.atman.knownPatterns.length, 1);
  assert.equal(result.atman.knownPatterns[0].category, "relational");
  assert.equal(result.atman.knownPatterns[0].confidence, 0.85);
  assert.equal(result.atman.lifeEvents?.length, 1);
  assert.equal(result.atman.lifeEvents?.[0].category, "career");
  assert.equal(result.atman.lifeEvents?.[0].confidence, 0.75);
});

test("applyBrainInsights stores evidence from both user and assistant turns", () => {
  const result = applyBrainInsights({
    existingAtman: baseAtman(),
    analysisResult: {
      newPatterns: ["Needs grounding before difficult calls"],
    },
    source: {
      surface: "consult",
      interactionId: "interaction_evidence",
      userMessage: "I feel anxious before difficult calls.",
      assistantMessage: "Take one small grounding step before the call.",
    },
    now: NOW,
  });

  const excerpt = result.atman.knownPatterns[0].evidence?.[0].messageExcerpt || "";
  assert.match(excerpt, /I feel anxious before difficult calls/);
  assert.match(excerpt, /Take one small grounding step before the call/);
});

test("applyBrainInsights marks related contradicted patterns even when wording differs", () => {
  const existing = baseAtman();
  existing.knownPatterns = [
    {
      id: "pattern_avoid",
      pattern: "Avoids hard conversations",
      frequency: 3,
      weightScore: 3,
      confidence: 0.8,
      sourceCount: 3,
      lastMentioned: new Date("2026-05-20T10:00:00.000Z"),
      verified: false,
    },
  ];

  const result = applyBrainInsights({
    existingAtman: existing,
    analysisResult: {
      detectedContradictions: ["User spoke up during a difficult work conversation."],
    },
    source: {
      surface: "synthesis",
      interactionId: "interaction_contradiction",
      userMessage: "I spoke up during a difficult work conversation.",
    },
    now: NOW,
  });

  assert.equal(result.atman.knownPatterns[0].archived, true);
  assert.ok(result.atman.knownPatterns[0].weightScore < 3);
});

test("persistAtmanInsights writes server-owned brain updates", async () => {
  const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
  const deps: AtmanBrainDeps = {
    db: {
      collection(name: string) {
        assert.equal(name, "users");
        return {
          doc(id: string) {
            assert.equal(id, "user_123");
            return {
              path: `users/${id}`,
              async get() {
                return {
                  exists: true,
                  data: () => ({ atman: baseAtman() }),
                };
              },
              async set(data: Record<string, unknown>) {
                writes.push({ path: `users/${id}`, data });
              },
            };
          },
        };
      },
    },
    now: () => NOW,
  };

  const result = await persistAtmanInsights(deps, {
    uid: "user_123",
    analysisResult: {
      emotionalState: "stable",
      newPatterns: ["Needs time before major decisions"],
      newEvents: [],
    },
    source: {
      surface: "consult",
      sessionId: "session_123",
      personaId: "guru-vidyanath",
      userMessage: "Should I decide today?",
      assistantMessage: "Take one night before deciding.",
    },
  });

  assert.equal(result.persisted, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, "users/user_123");
  assert.equal((writes[0].data.atman as AtmanData).knownPatterns[0].pattern, "Needs time before major decisions");
  assert.equal((writes[0].data.atman as AtmanData).memoryLedger?.[0].surface, "consult");
});

test("maintainAtmanMemory decays and archives stale unverified patterns", () => {
  const atman = baseAtman();
  atman.knownPatterns = [
    {
      id: "old",
      pattern: "Old weak worry",
      frequency: 1,
      weightScore: 0.6,
      confidence: 0.3,
      lastMentioned: new Date("2026-01-01T00:00:00.000Z"),
      verified: false,
    },
    {
      id: "verified",
      pattern: "Confirmed long-term practice",
      frequency: 2,
      weightScore: 3,
      confidence: 1,
      lastMentioned: new Date("2026-01-01T00:00:00.000Z"),
      verified: true,
    },
  ];

  const result = maintainAtmanMemory(atman, NOW);

  assert.equal(result.changed, true);
  assert.equal(result.decayedPatterns, 1);
  assert.equal(result.archivedPatterns, 1);
  assert.equal(result.atman.knownPatterns[0].archived, true);
  assert.ok(result.atman.knownPatterns[0].weightScore < 0.6);
  assert.equal(result.atman.knownPatterns[1].archived, false);
  assert.equal(result.atman.knownPatterns[1].weightScore, 3);
  assert.equal(result.atman.memoryLedger?.at(-1)?.surface, "system");
});

test("applyPredictionFeedbackSignal stores outcome metrics in Atman", () => {
  const result = applyPredictionFeedbackSignal({
    existingAtman: baseAtman(),
    feedback: {
      signal: "missed",
      source: "daily_forecast",
      period: "daily",
      forecastDate: "2026-05-29",
    },
    now: NOW,
  });

  assert.equal(result.changed, true);
  assert.equal(result.atman.predictionFeedbackStats?.missed, 1);
  assert.equal(result.atman.predictionFeedbackStats?.lastSignal, "missed");
  assert.equal(result.atman.memoryLedger?.at(-1)?.surface, "feedback");
  assert.match(result.atman.memoryLedger?.at(-1)?.messageExcerpt || "", /daily_forecast/);
});
