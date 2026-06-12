import type { WeightedPattern } from "../../../src/types/user.js";

export type PatternMemoryType =
  | "stable_trait"
  | "temporary_mood"
  | "repeated_behavior_loop"
  | "life_event"
  | "growth_change"
  | "useful_advice"
  | "unhelpful_advice";

export type PatternDecision =
  | "silent"
  | "reflect"
  | "suggest_action"
  | "ask_question"
  | "strong_intervention";

export type PatternChangeDirection =
  | "getting_stronger"
  | "fading"
  | "changed_recently";

export interface PatternSignal {
  id: string;
  memoryType: PatternMemoryType;
  relevance: number;
  confidence: number;
  recentlyUsed?: boolean;
  naturalCue: string;
  suggestedMove: string;
}

export interface PatternChangeSignal {
  direction: PatternChangeDirection;
  cue: string;
}

export interface PatternIntelligence {
  decision: PatternDecision;
  signals: PatternSignal[];
  changeSignals: PatternChangeSignal[];
}

export interface BuildPatternIntelligenceInput {
  latestMessage: string;
  atman?: PatternIntelligenceAtman;
  now?: Date;
}

interface PatternIntelligenceAtman {
  emotionalHistory?: Array<{ state: string; date: unknown }>;
  knownPatterns?: unknown[];
  activeEvents?: PatternLifeEvent[];
  lifeEvents?: PatternLifeEvent[];
  savedAdvice?: PatternAdviceEntry[];
  adviceHistory?: PatternAdviceEntry[];
  contradictedPatterns?: string[];
}

interface PatternLifeEvent {
  id?: string;
  title: string;
  status: string;
  category?: string;
  confidence?: number;
}

interface PatternAdviceEntry {
  advice: string;
  context: string;
  date?: string;
  followedUp?: boolean;
}

const CASUAL_ACKNOWLEDGEMENTS = new Set([
  "ok",
  "okay",
  "yes",
  "yeah",
  "yep",
  "hmm",
  "thanks",
  "thank you",
  "got it",
  "alright",
  "cool",
]);

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "is",
  "are",
  "am",
  "i",
  "me",
  "my",
  "you",
  "your",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "when",
  "it",
  "this",
  "that",
  "again",
]);

const CATEGORY_HINTS: Record<string, string[]> = {
  work: ["work", "workload", "deadline", "task", "career", "manager", "job"],
  pressure: ["pressure", "stress", "heavy", "too", "much", "overwhelmed", "piling"],
  capacity: [
    "responsibility",
    "responsibilities",
    "calendar",
    "packed",
    "overloaded",
    "overcommit",
    "everyone",
    "saying",
    "carry",
    "carries",
  ],
  conversation: ["conversation", "talk", "manager", "family", "argument"],
  avoidance: ["avoid", "delay", "postpone", "hard", "difficult"],
  decision: ["decision", "choose", "confused", "uncertain"],
};

const SEMANTIC_CONCEPTS: Record<string, string[]> = {
  overcommitment: [
    "responsibility",
    "responsibilities",
    "workload",
    "deadline",
    "deadlines",
    "calendar",
    "packed",
    "everyone",
    "saying",
    "yes",
    "carry",
    "carries",
    "overwhelmed",
    "piling",
    "pile",
  ],
  pressure: [
    "pressure",
    "stress",
    "heavy",
    "overwhelmed",
    "deadlines",
    "workload",
    "piling",
    "pile",
    "tasks",
  ],
  avoidance: [
    "avoid",
    "delay",
    "postpone",
    "difficult",
    "hard",
    "conversation",
    "speak",
    "spoke",
    "manager",
  ],
};

const EMOTIONAL_INTENSITY: Record<string, number> = {
  stable: 0,
  spiritual: 1,
  energetic: 1,
  anxious: 2,
  reactive: 2,
  chaotic: 3,
  depressive: 3,
};

export function buildPatternIntelligence(
  input: BuildPatternIntelligenceInput,
): PatternIntelligence {
  const now = input.now || new Date();
  const latestMessage = input.latestMessage.trim();
  if (!latestMessage || isCasualAcknowledgement(latestMessage)) {
    return emptyIntelligence();
  }

  const atman = input.atman;
  if (!atman) return emptyIntelligence();

  const signals = [
    ...signalsFromPatterns(latestMessage, atman.knownPatterns || [], atman, now),
    ...signalsFromEvents(latestMessage, atman.activeEvents || atman.lifeEvents || []),
    ...signalsFromAdvice(latestMessage, atman.savedAdvice || atman.adviceHistory || []),
  ]
    .filter((signal) => signal.relevance >= 0.28 && signal.confidence >= 0.45)
    .sort((a, b) => b.relevance * b.confidence - a.relevance * a.confidence)
    .slice(0, 2);

  if (signals.length === 0) return emptyIntelligence();

  const changeSignals = buildChangeSignals(signals, atman, now);
  const decision = chooseDecision(signals, changeSignals);
  return { decision, signals, changeSignals };
}

export function buildPatternIntelligencePrompt(
  intelligence: PatternIntelligence,
): string {
  if (intelligence.decision === "silent" || intelligence.signals.length === 0) {
    return "";
  }

  const cues = intelligence.signals
    .map((signal) => `- ${signal.naturalCue} ${signal.suggestedMove}`)
    .join("\n");
  const changes = intelligence.changeSignals.length
    ? `\nRecent shift:\n${intelligence.changeSignals.map((signal) => `- ${signal.cue}`).join("\n")}`
    : "";

  return `
### ADAPTIVE COMPANION GUIDANCE:
Decision: ${intelligence.decision}
Use this only if it helps the latest reply. Speak like someone who remembers, not like a system explaining itself. Do not name the mechanism.
${cues}${changes}
`;
}

function signalsFromPatterns(
  latestMessage: string,
  patterns: unknown[],
  atman: PatternIntelligenceAtman,
  now: Date,
): PatternSignal[] {
  return patterns
    .map(normalizePattern)
    .filter((pattern): pattern is WeightedPattern => Boolean(pattern))
    .filter((pattern) => !pattern.archived || isGrowthMessage(latestMessage))
    .map((pattern) => {
      const memoryType = classifyPattern(pattern, latestMessage, atman);
      const relevance = scoreRelevance(latestMessage, pattern.pattern);
      const confidence = normalizeConfidence(pattern);
      const recentlyUsed = wasRecentlyUsed(pattern.lastUsedAt, now);
      return {
        id: pattern.id,
        memoryType,
        relevance,
        confidence,
        recentlyUsed,
        naturalCue: toNaturalCue(pattern, memoryType),
        suggestedMove: toSuggestedMove(pattern, memoryType, recentlyUsed),
      };
    });
}

function signalsFromEvents(
  latestMessage: string,
  events: PatternLifeEvent[],
): PatternSignal[] {
  return events.map((event, index) => ({
    id: event.id || `event_${index}`,
    memoryType: "life_event" as const,
    relevance: Math.max(
      scoreRelevance(latestMessage, event.title),
      scoreRelevance(latestMessage, event.category || ""),
    ),
    confidence: event.confidence || 0.6,
    naturalCue: `There is a current ${event.category || "life"} thread in view.`,
    suggestedMove:
      event.status === "pending"
        ? "If it fits the moment, ask one gentle check-in question."
        : "If it fits the moment, acknowledge the change briefly.",
  }));
}

function signalsFromAdvice(
  latestMessage: string,
  advice: PatternAdviceEntry[],
): PatternSignal[] {
  return advice.map((entry, index) => ({
    id: `advice_${index}`,
    memoryType: entry.followedUp ? "useful_advice" : "useful_advice",
    relevance: Math.max(
      scoreRelevance(latestMessage, entry.context),
      scoreRelevance(latestMessage, entry.advice),
    ),
    confidence: 0.65,
    naturalCue: "A previous suggestion may still be relevant here.",
    suggestedMove: "If useful, continue from it instead of repeating it.",
  }));
}

function normalizePattern(value: unknown): WeightedPattern | null {
  if (typeof value === "string" && value.trim()) {
    return {
      id: `pattern_${normalizeKey(value)}`,
      pattern: value.trim(),
      frequency: 1,
      weightScore: 1,
      lastMentioned: new Date(),
      verified: false,
    };
  }
  if (!value || typeof value !== "object") return null;
  const pattern = value as Partial<WeightedPattern>;
  if (!pattern.pattern || typeof pattern.pattern !== "string") return null;
  return {
    id: pattern.id || `pattern_${normalizeKey(pattern.pattern)}`,
    pattern: pattern.pattern,
    frequency: pattern.frequency || 1,
    weightScore: pattern.weightScore || 1,
    lastMentioned: pattern.lastMentioned || new Date(),
    lastUsedAt: pattern.lastUsedAt,
    verified: Boolean(pattern.verified),
    category: pattern.category,
    confidence: pattern.confidence,
    archived: Boolean(pattern.archived),
    sourceCount: pattern.sourceCount,
    evidence: pattern.evidence,
  };
}

function classifyPattern(
  pattern: WeightedPattern,
  latestMessage: string,
  atman: PatternIntelligenceAtman,
): PatternMemoryType {
  if (pattern.archived || isGrowthMessage(latestMessage)) {
    return "growth_change";
  }
  if (
    atman.contradictedPatterns?.some((text) =>
      scoreRelevance(text, pattern.pattern) >= 0.25,
    )
  ) {
    return "growth_change";
  }
  if ((pattern.frequency || 0) >= 2 || (pattern.sourceCount || 0) >= 2) {
    return "repeated_behavior_loop";
  }
  if (pattern.category === "emotional") return "temporary_mood";
  return "stable_trait";
}

function buildChangeSignals(
  signals: PatternSignal[],
  atman: PatternIntelligenceAtman,
  now: Date,
): PatternChangeSignal[] {
  const primary = signals[0];
  if (!primary) return [];

  if (primary.memoryType === "growth_change") {
    return [
      {
        direction: "changed_recently",
        cue: "Something that used to be difficult may be shifting.",
      },
    ];
  }

  if (isEmotionalTrendWorsening(atman.emotionalHistory || [], now)) {
    return [
      {
        direction: "getting_stronger",
        cue: "The user's emotional tone is intensifying across recent check-ins.",
      },
    ];
  }

  if (
    primary.memoryType === "repeated_behavior_loop" &&
    primary.confidence >= 0.75 &&
    primary.relevance >= 0.45
  ) {
    return [
      {
        direction: "getting_stronger",
        cue: "The same pressure is showing up with more force right now.",
      },
    ];
  }

  if ((atman.emotionalHistory || []).length >= 2) {
    return [
      {
        direction: "changed_recently",
        cue: "The user's recent emotional tone has shifted.",
      },
    ];
  }

  return [];
}

function chooseDecision(
  signals: PatternSignal[],
  changeSignals: PatternChangeSignal[],
): PatternDecision {
  const primary = signals[0];
  if (!primary) return "silent";
  if (primary.memoryType === "growth_change") return "reflect";
  if (
    primary.memoryType === "repeated_behavior_loop" &&
    primary.confidence >= 0.85 &&
    primary.relevance >= 0.35 &&
    changeSignals.some(
      (signal) =>
        signal.direction === "getting_stronger" &&
        /emotional tone is intensifying/i.test(signal.cue),
    )
  ) {
    return "strong_intervention";
  }
  if (primary.memoryType === "life_event" && primary.relevance >= 0.4) {
    return "ask_question";
  }
  if (primary.recentlyUsed) return "reflect";
  if (
    primary.memoryType === "repeated_behavior_loop" &&
    primary.confidence >= 0.75 &&
    primary.relevance >= 0.35
  ) {
    return changeSignals.some((signal) => signal.direction === "getting_stronger")
      ? "suggest_action"
      : "reflect";
  }
  if (primary.relevance >= 0.5 && primary.confidence >= 0.8) {
    return "reflect";
  }
  return "silent";
}

function toNaturalCue(
  pattern: WeightedPattern,
  memoryType: PatternMemoryType,
): string {
  const text = pattern.pattern.toLowerCase();
  if (memoryType === "growth_change") {
    return "This may be one of those moments where the old response is changing.";
  }
  if (text.includes("work") || text.includes("deadline") || text.includes("pressure")) {
    return "When pressure rises, the user tends to carry more than one person should.";
  }
  if (text.includes("conversation") || text.includes("avoid")) {
    return "This kind of conversation has felt heavy before.";
  }
  return "Something familiar may be present in this moment.";
}

function toSuggestedMove(
  pattern: WeightedPattern,
  memoryType: PatternMemoryType,
  recentlyUsed = false,
): string {
  const text = pattern.pattern.toLowerCase();
  const restraint = recentlyUsed
    ? " Since this was used recently, do not repeat the same advice; acknowledge lightly or offer a fresher, smaller step."
    : "";
  if (memoryType === "growth_change") {
    return `Reflect the change warmly and keep it brief.${restraint}`;
  }
  if (text.includes("work") || text.includes("deadline") || text.includes("pressure")) {
    return `Suggest one concrete narrowing step instead of more effort.${restraint}`;
  }
  if (text.includes("conversation") || text.includes("avoid")) {
    return `Suggest one gentle next step without pushing too hard.${restraint}`;
  }
  return `Offer one grounded observation or one practical step.${restraint}`;
}

function normalizeConfidence(pattern: WeightedPattern): number {
  const confidence = pattern.confidence ?? 0.6;
  const frequencyBoost = Math.min((pattern.frequency || 0) * 0.08, 0.24);
  const sourceBoost = Math.min((pattern.sourceCount || 0) * 0.05, 0.2);
  const verifiedBoost = pattern.verified ? 0.15 : 0;
  return clamp(confidence + frequencyBoost + sourceBoost + verifiedBoost, 0, 1);
}

function scoreRelevance(message: string, memoryText: string): number {
  const messageTokens = tokenize(message);
  const memoryTokens = tokenize(memoryText);
  if (messageTokens.size === 0 || memoryTokens.size === 0) return 0;

  const overlap = [...messageTokens].filter((token) => memoryTokens.has(token));
  const lexicalScore = overlap.length / Math.min(messageTokens.size, memoryTokens.size);
  const hintScore = scoreCategoryHints(messageTokens, memoryTokens);
  const semanticScore = scoreSemanticConcepts(messageTokens, memoryTokens);
  return clamp(Math.max(lexicalScore, hintScore, semanticScore), 0, 1);
}

function scoreCategoryHints(
  messageTokens: Set<string>,
  memoryTokens: Set<string>,
): number {
  let score = 0;
  for (const hints of Object.values(CATEGORY_HINTS)) {
    const messageMatches = hints.filter((hint) => messageTokens.has(hint)).length;
    const memoryMatches = hints.filter((hint) => memoryTokens.has(hint)).length;
    if (messageMatches > 0 && memoryMatches > 0) {
      score = Math.max(score, 0.35 + Math.min(messageMatches + memoryMatches, 4) * 0.08);
    }
  }
  return score;
}

function scoreSemanticConcepts(
  messageTokens: Set<string>,
  memoryTokens: Set<string>,
): number {
  let score = 0;
  for (const terms of Object.values(SEMANTIC_CONCEPTS)) {
    const messageMatches = terms.filter((term) => messageTokens.has(term)).length;
    const memoryMatches = terms.filter((term) => memoryTokens.has(term)).length;
    if (messageMatches > 0 && memoryMatches > 0) {
      const depth = Math.min(messageMatches + memoryMatches, 6);
      score = Math.max(score, 0.32 + depth * 0.04);
    }
  }
  return score;
}

function isEmotionalTrendWorsening(
  history: Array<{ state: string; date: unknown }>,
  now: Date,
): boolean {
  const recent = history
    .map((entry) => ({
      intensity: EMOTIONAL_INTENSITY[entry.state] ?? 0,
      time: parseTime(entry.date),
    }))
    .filter((entry) => entry.time !== null)
    .filter((entry) => now.getTime() - entry.time! <= 1000 * 60 * 60 * 24 * 7)
    .sort((a, b) => a.time! - b.time!);

  if (recent.length < 3) return false;

  const first = recent[0].intensity;
  const last = recent[recent.length - 1].intensity;
  const hasHighRecentState = recent.slice(-2).some((entry) => entry.intensity >= 3);
  return last > first && hasHighRecentState;
}

function wasRecentlyUsed(value: unknown, now: Date): boolean {
  const time = parseTime(value);
  if (time === null) return false;
  const ageMs = now.getTime() - time;
  return ageMs >= 0 && ageMs <= 1000 * 60 * 60 * 24 * 3;
}

function parseTime(value: unknown): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const time = value.toDate().getTime();
    return Number.isFinite(time) ? time : null;
  }
  return null;
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  );
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function isCasualAcknowledgement(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[.!?,\s]+/g, " ").trim();
  return CASUAL_ACKNOWLEDGEMENTS.has(normalized);
}

function isGrowthMessage(value: string): boolean {
  const normalized = value.toLowerCase();
  return /\b(finally|changed|no longer|this time|instead|spoke up|did it|handled)\b/.test(
    normalized,
  );
}

function emptyIntelligence(): PatternIntelligence {
  return { decision: "silent", signals: [], changeSignals: [] };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
