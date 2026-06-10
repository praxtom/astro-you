import {
  ATMAN_SCHEMA_VERSION,
  type AtmanAdviceEntry,
  type AtmanData,
  type AtmanEmotion,
  type AtmanMemoryEvidence,
  type AtmanMemoryLedgerEntry,
  type AtmanMemorySurface,
  type UserLifeEvent,
  type WeightedPattern,
} from "../../../src/types/user.js";
import {
  createInitialAtmanData,
  normalizeAtmanData,
  validateAdviceInput,
  validateAtmanEmotionalState,
  validateLifeEventInput,
  validatePatternText,
} from "../../../src/lib/atman-schema.js";

type BrainAnalysisResult = {
  emotionalState?: unknown;
  newEvents?: Array<{
    title?: unknown;
    category?: unknown;
    confidence?: unknown;
  }>;
  newPatterns?: unknown[];
  detectedContradictions?: unknown[];
  karmicThreads?: unknown[];
};

// Hard caps so the user's atman document can never approach Firestore's 1 MB
// per-document limit (which would otherwise silently break every write).
const MAX_PATTERNS = 200;
const MAX_LIFE_EVENTS = 150;

function scorePatternForRetention(p: WeightedPattern): number {
  const recency = p.lastMentioned ? new Date(p.lastMentioned).getTime() : 0;
  return (
    (p.archived ? -1000 : 0) +
    (p.weightScore || 0) * 100 +
    (p.frequency || 0) * 10 +
    recency / 1e10
  );
}

type UserDocSnapshot = {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
};

type UserDocRef = {
  path?: string;
  get(): Promise<UserDocSnapshot>;
  set(
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): Promise<unknown>;
};

type UsersCollectionRef = {
  doc(id: string): UserDocRef;
};

export interface AtmanBrainDeps {
  db: {
    collection(name: string): UsersCollectionRef;
    // Optional: when present we read-modify-write the atman doc inside a
    // transaction so concurrent server/client writes don't clobber each other.
    runTransaction?: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
  };
  now?: () => Date;
}

export interface AtmanBrainSource {
  surface: AtmanMemorySurface;
  sessionId?: string;
  interactionId?: string;
  personaId?: string;
  userMessage?: string;
  assistantMessage?: string;
  confidence?: number;
}

export interface ApplyBrainInsightsInput {
  existingAtman?: Partial<AtmanData>;
  analysisResult?: BrainAnalysisResult | null;
  extractedAdvice?: { advice: string; context: string } | null;
  source: AtmanBrainSource;
  now?: Date;
}

export interface ApplyBrainInsightsResult {
  atman: AtmanData;
  changed: boolean;
  ledgerEntry?: AtmanMemoryLedgerEntry;
}

export interface PersistAtmanInsightsInput {
  uid: string;
  analysisResult?: BrainAnalysisResult | null;
  extractedAdvice?: { advice: string; context: string } | null;
  source: AtmanBrainSource;
}

export interface PersistAtmanInsightsResult {
  persisted: boolean;
  changed: boolean;
  ledgerEntry?: AtmanMemoryLedgerEntry;
}

export interface AtmanMaintenanceResult {
  atman: AtmanData;
  changed: boolean;
  decayedPatterns: number;
  archivedPatterns: number;
  ledgerEntry?: AtmanMemoryLedgerEntry;
}

export interface ApplyPredictionFeedbackInput {
  existingAtman?: Partial<AtmanData>;
  feedback: {
    signal: "accurate" | "partly" | "missed";
    source: string;
    period: string;
    forecastDate: string;
  };
  now?: Date;
}

export function applyBrainInsights(
  input: ApplyBrainInsightsInput,
): ApplyBrainInsightsResult {
  const now = input.now || new Date();
  const atman =
    normalizeAtmanData(input.existingAtman, now) || createInitialAtmanData(now);
  const evidence = buildEvidence(input.source, now);
  const analysis = input.analysisResult || {};
  let ledgerEmotionalState: AtmanEmotion | undefined;
  let changed = false;
  let patternsAdded = 0;
  let eventsAdded = 0;
  let adviceSaved = 0;
  let contradictionsDetected = 0;
  let karmicThreadsDetected = 0;

  if (analysis.emotionalState) {
    const emotionalState = safeValidateEmotion(analysis.emotionalState);
    if (emotionalState) {
      ledgerEmotionalState = emotionalState;
      atman.emotionalState = emotionalState;
      atman.lastEmotionalUpdate = now;
      atman.transient = {
        ...(atman.transient || {
          emotionalState,
          lastEmotionalUpdate: now,
          emotionalHistory: [],
        }),
        emotionalState,
        lastEmotionalUpdate: now,
        emotionalHistory: [
          ...(atman.emotionalHistory ||
            atman.transient?.emotionalHistory ||
            []),
          { state: emotionalState, date: now },
        ].slice(-30),
      };
      atman.emotionalHistory = atman.transient.emotionalHistory;
      changed = true;
    }
  }

  if (Array.isArray(analysis.newPatterns)) {
    const merged = mergePatterns(
      atman.knownPatterns || [],
      analysis.newPatterns,
      evidence,
      now,
    );
    atman.knownPatterns = merged.patterns;
    patternsAdded = merged.added;
    changed = changed || merged.changed;
  }

  if (Array.isArray(analysis.newEvents)) {
    const merged = mergeLifeEvents(
      atman.lifeEvents || atman.activeEvents || [],
      analysis.newEvents,
      evidence,
      now,
    );
    atman.lifeEvents = merged.events;
    atman.activeEvents = merged.events;
    eventsAdded = merged.added;
    changed = changed || merged.changed;
  }

  if (input.extractedAdvice?.advice) {
    const safeAdvice = validateAdviceInput(input.extractedAdvice);
    const entry: AtmanAdviceEntry = {
      ...safeAdvice,
      date: now.toISOString(),
      followedUp: false,
    };
    const advice = [
      ...(atman.savedAdvice || atman.adviceHistory || []).slice(-19),
      entry,
    ];
    atman.savedAdvice = advice;
    atman.adviceHistory = advice;
    adviceSaved = 1;
    changed = true;
  }

  if (
    Array.isArray(analysis.detectedContradictions) &&
    analysis.detectedContradictions.length > 0
  ) {
    const contradictions = analysis.detectedContradictions
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    atman.contradictedPatterns = mergeUniqueStrings(
      atman.contradictedPatterns || [],
      contradictions,
    ).slice(-50);
    atman.knownPatterns = markContradictedPatterns(
      atman.knownPatterns || [],
      contradictions,
      now,
    );
    contradictionsDetected = contradictions.length;
    changed = changed || contradictions.length > 0;
  }

  if (
    Array.isArray(analysis.karmicThreads) &&
    analysis.karmicThreads.length > 0
  ) {
    const threads = analysis.karmicThreads
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    atman.karmicThreads = mergeUniqueStrings(
      atman.karmicThreads || [],
      threads,
    ).slice(-30);
    karmicThreadsDetected = threads.length;
    changed = changed || threads.length > 0;
  }

  syncAtmanBuckets(atman);

  if (!changed) {
    return { atman, changed: false };
  }

  const ledgerEntry: AtmanMemoryLedgerEntry = {
    ...evidence,
    emotionalState: ledgerEmotionalState,
    patternsAdded,
    eventsAdded,
    adviceSaved,
    contradictionsDetected,
    karmicThreadsDetected,
  };
  atman.memoryLedger = [...(atman.memoryLedger || []).slice(-49), ledgerEntry];

  return { atman, changed: true, ledgerEntry };
}

export async function persistAtmanInsights(
  deps: AtmanBrainDeps,
  input: PersistAtmanInsightsInput,
): Promise<PersistAtmanInsightsResult> {
  const userRef = deps.db.collection("users").doc(input.uid);
  const now = deps.now?.() || new Date();

  // Atomic path: read + merge + write inside a transaction so a concurrent
  // client edit to the same atman doc isn't lost (last-write-wins).
  if (typeof deps.db.runTransaction === "function") {
    return deps.db.runTransaction(async (tx: any) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) return { persisted: false, changed: false };
      const userData = snap.data() || {};
      const result = applyBrainInsights({
        existingAtman: userData.atman as Partial<AtmanData> | undefined,
        analysisResult: input.analysisResult,
        extractedAdvice: input.extractedAdvice,
        source: input.source,
        now,
      });
      if (!result.changed) return { persisted: false, changed: false };
      tx.set(userRef, { atman: result.atman }, { merge: true });
      return {
        persisted: true,
        changed: true,
        ledgerEntry: result.ledgerEntry,
      };
    });
  }

  // Fallback (e.g. unit tests with a mock db lacking runTransaction).
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return { persisted: false, changed: false };
  }

  const userData = userSnap.data() || {};
  const result = applyBrainInsights({
    existingAtman: userData.atman as Partial<AtmanData> | undefined,
    analysisResult: input.analysisResult,
    extractedAdvice: input.extractedAdvice,
    source: input.source,
    now,
  });

  if (!result.changed) {
    return { persisted: false, changed: false };
  }

  await userRef.set({ atman: result.atman }, { merge: true });
  return {
    persisted: true,
    changed: true,
    ledgerEntry: result.ledgerEntry,
  };
}

export function maintainAtmanMemory(
  existingAtman?: Partial<AtmanData>,
  now = new Date(),
): AtmanMaintenanceResult {
  const atman =
    normalizeAtmanData(existingAtman, now) || createInitialAtmanData(now);
  let decayedPatterns = 0;
  let archivedPatterns = 0;

  atman.knownPatterns = (atman.knownPatterns || []).map((pattern) => {
    if (pattern.verified || pattern.archived) return pattern;

    const daysSinceLastMention = daysBetween(pattern.lastMentioned, now);
    if (daysSinceLastMention <= 7) return pattern;

    const decayDays = daysSinceLastMention - 7;
    const nextWeight = clamp(
      pattern.weightScore * Math.exp(-0.015 * decayDays),
      0.1,
      5,
    );
    const shouldArchive =
      daysSinceLastMention > 90 &&
      (nextWeight <= 0.5 ||
        (pattern.confidence !== undefined && pattern.confidence < 0.4));

    if (nextWeight !== pattern.weightScore) {
      decayedPatterns += 1;
    }
    if (shouldArchive) {
      archivedPatterns += 1;
    }

    return {
      ...pattern,
      weightScore: roundScore(nextWeight),
      archived: shouldArchive,
    };
  });

  const changed = decayedPatterns > 0 || archivedPatterns > 0;
  if (!changed) {
    return { atman, changed: false, decayedPatterns: 0, archivedPatterns: 0 };
  }

  syncAtmanBuckets(atman);
  const ledgerEntry: AtmanMemoryLedgerEntry = {
    id: createMemoryId("maintenance", "brain-maintenance", now),
    surface: "system",
    createdAt: now,
    messageExcerpt: `Brain maintenance: ${decayedPatterns} decayed, ${archivedPatterns} archived`,
    confidence: 1,
    patternsAdded: 0,
    eventsAdded: 0,
    adviceSaved: 0,
    contradictionsDetected: 0,
    karmicThreadsDetected: 0,
  };
  atman.memoryLedger = [...(atman.memoryLedger || []).slice(-49), ledgerEntry];

  return {
    atman,
    changed: true,
    decayedPatterns,
    archivedPatterns,
    ledgerEntry,
  };
}

export function applyPredictionFeedbackSignal(
  input: ApplyPredictionFeedbackInput,
): ApplyBrainInsightsResult {
  const now = input.now || new Date();
  const atman =
    normalizeAtmanData(input.existingAtman, now) || createInitialAtmanData(now);
  const current = atman.predictionFeedbackStats || {
    accurate: 0,
    partly: 0,
    missed: 0,
  };
  const stats = {
    accurate: current.accurate || 0,
    partly: current.partly || 0,
    missed: current.missed || 0,
    lastSignal: input.feedback.signal,
    lastSource: input.feedback.source,
    updatedAt: now,
  };
  stats[input.feedback.signal] += 1;
  atman.predictionFeedbackStats = stats;
  syncAtmanBuckets(atman);

  const ledgerEntry: AtmanMemoryLedgerEntry = {
    id: createMemoryId(
      "feedback",
      `${input.feedback.source}:${input.feedback.forecastDate}`,
      now,
    ),
    surface: "feedback",
    createdAt: now,
    messageExcerpt: `${input.feedback.period} ${input.feedback.source}: ${input.feedback.signal}`,
    confidence:
      input.feedback.signal === "accurate"
        ? 1
        : input.feedback.signal === "partly"
          ? 0.6
          : 0.2,
    patternsAdded: 0,
    eventsAdded: 0,
    adviceSaved: 0,
    contradictionsDetected: 0,
    karmicThreadsDetected: 0,
  };
  atman.memoryLedger = [...(atman.memoryLedger || []).slice(-49), ledgerEntry];

  return { atman, changed: true, ledgerEntry };
}

export async function persistPredictionFeedbackSignal(
  deps: AtmanBrainDeps,
  input: {
    uid: string;
    feedback: ApplyPredictionFeedbackInput["feedback"];
  },
) {
  const userRef = deps.db.collection("users").doc(input.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return { persisted: false, changed: false };
  }
  const userData = userSnap.data() || {};
  const result = applyPredictionFeedbackSignal({
    existingAtman: userData.atman as Partial<AtmanData> | undefined,
    feedback: input.feedback,
    now: deps.now?.() || new Date(),
  });
  await userRef.set({ atman: result.atman }, { merge: true });
  return { persisted: true, changed: true, ledgerEntry: result.ledgerEntry };
}

export async function persistAtmanMaintenance(
  deps: AtmanBrainDeps,
  uid: string,
) {
  const userRef = deps.db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return {
      persisted: false,
      changed: false,
      decayedPatterns: 0,
      archivedPatterns: 0,
    };
  }

  const userData = userSnap.data() || {};
  const result = maintainAtmanMemory(
    userData.atman as Partial<AtmanData> | undefined,
    deps.now?.() || new Date(),
  );

  if (!result.changed) {
    return {
      persisted: false,
      changed: false,
      decayedPatterns: 0,
      archivedPatterns: 0,
    };
  }

  await userRef.set({ atman: result.atman }, { merge: true });
  return {
    persisted: true,
    changed: true,
    decayedPatterns: result.decayedPatterns,
    archivedPatterns: result.archivedPatterns,
  };
}

export function selectBrainContext(
  rawAtman?: Partial<AtmanData>,
  options: {
    maxPatterns?: number;
    maxEvents?: number;
    maxAdvice?: number;
  } = {},
): AtmanData | undefined {
  const atman = normalizeAtmanData(rawAtman);
  if (!atman) return undefined;

  const now = new Date();
  const maxPatterns = options.maxPatterns || 8;
  const maxEvents = options.maxEvents || 5;
  const maxAdvice = options.maxAdvice || 5;

  const knownPatterns = [...(atman.knownPatterns || [])]
    .filter((pattern) => !pattern.archived)
    .sort((a, b) => scorePattern(b, now) - scorePattern(a, now))
    .slice(0, maxPatterns);
  const activeEvents = [...(atman.activeEvents || atman.lifeEvents || [])]
    .sort((a, b) => scoreEvent(b) - scoreEvent(a))
    .slice(0, maxEvents);
  const savedAdvice = [
    ...(atman.savedAdvice || atman.adviceHistory || []),
  ].slice(-maxAdvice);

  const selected: AtmanData = {
    ...atman,
    knownPatterns,
    activeEvents,
    lifeEvents: activeEvents,
    savedAdvice,
    adviceHistory: savedAdvice,
    memory: {
      ...(atman.memory || {
        knownPatterns: [],
        lifeEvents: [],
        keyRelationships: [],
        routines: [],
        savedAdvice: [],
        nudgeHistory: [],
      }),
      knownPatterns,
      lifeEvents: activeEvents,
      savedAdvice,
    },
  };

  return selected;
}

function mergePatterns(
  existing: WeightedPattern[],
  rawPatterns: unknown[],
  evidence: AtmanMemoryEvidence,
  now: Date,
) {
  const patterns = [...existing];
  let changed = false;
  let added = 0;

  for (const rawPattern of rawPatterns) {
    const candidate = normalizePatternCandidate(rawPattern);
    if (!candidate) continue;
    const patternText = candidate.text;
    const existingIndex = patterns.findIndex(
      (pattern) => normalizeKey(pattern.pattern) === normalizeKey(patternText),
    );

    if (existingIndex >= 0) {
      const pattern = patterns[existingIndex];
      patterns[existingIndex] = {
        ...pattern,
        frequency: pattern.frequency + 1,
        weightScore: clamp(pattern.weightScore + 0.5, 0.1, 5),
        confidence: Math.max(
          pattern.confidence || 0.6,
          candidate.confidence || evidence.confidence || 0.7,
        ),
        lastMentioned: now,
        category: pattern.category || candidate.category,
        sourceCount: (pattern.sourceCount || pattern.frequency || 1) + 1,
        evidence: appendEvidence(pattern.evidence, evidence),
        archived: false,
      };
      changed = true;
      continue;
    }

    patterns.push({
      id: createMemoryId("pattern", patternText, now),
      pattern: patternText,
      frequency: 1,
      weightScore: 1,
      confidence: candidate.confidence || evidence.confidence || 0.7,
      lastMentioned: now,
      firstSeen: now,
      verified: false,
      category: candidate.category,
      sourceCount: 1,
      evidence: [evidence],
      archived: false,
    });
    added += 1;
    changed = true;
  }

  // Cap retained patterns — drop the lowest-value (archived/old/weak) ones.
  let trimmed = patterns;
  if (patterns.length > MAX_PATTERNS) {
    trimmed = [...patterns]
      .sort((a, b) => scorePatternForRetention(b) - scorePatternForRetention(a))
      .slice(0, MAX_PATTERNS);
    changed = true;
  }

  return { patterns: trimmed, changed, added };
}

function mergeLifeEvents(
  existing: UserLifeEvent[],
  rawEvents: unknown[],
  evidence: AtmanMemoryEvidence,
  now: Date,
) {
  const events = [...existing];
  let changed = false;
  let added = 0;

  for (const rawEvent of rawEvents) {
    const safeEvent = normalizeLifeEventCandidate(rawEvent, now);
    if (!safeEvent) continue;
    const existingIndex = events.findIndex(
      (item) => normalizeKey(item.title) === normalizeKey(safeEvent.title),
    );

    if (existingIndex >= 0) {
      events[existingIndex] = {
        ...events[existingIndex],
        confidence: Math.max(
          events[existingIndex].confidence,
          safeEvent.confidence,
        ),
        lastMentioned: now,
        evidence: appendEvidence(events[existingIndex].evidence, evidence),
      };
      changed = true;
      continue;
    }

    events.push({
      ...safeEvent,
      id: createMemoryId("event", safeEvent.title, now),
      date: now,
      lastMentioned: now,
      evidence: [evidence],
    });
    added += 1;
    changed = true;
  }

  // Cap retained life events — keep the most recently mentioned ones.
  let trimmedEvents = events;
  if (events.length > MAX_LIFE_EVENTS) {
    trimmedEvents = [...events]
      .sort((a, b) => {
        const ta = a.lastMentioned ? new Date(a.lastMentioned).getTime() : 0;
        const tb = b.lastMentioned ? new Date(b.lastMentioned).getTime() : 0;
        return tb - ta;
      })
      .slice(0, MAX_LIFE_EVENTS);
    changed = true;
  }

  return { events: trimmedEvents, changed, added };
}

function safeValidateEmotion(value: unknown): AtmanEmotion | undefined {
  try {
    return validateAtmanEmotionalState(value);
  } catch {
    return undefined;
  }
}

function normalizePatternCandidate(rawPattern: unknown): {
  text: string;
  category?: WeightedPattern["category"];
  confidence?: number;
} | null {
  try {
    if (typeof rawPattern === "string") {
      return { text: validatePatternText(rawPattern) };
    }

    if (!rawPattern || typeof rawPattern !== "object") return null;
    const candidate = rawPattern as {
      pattern?: unknown;
      text?: unknown;
      title?: unknown;
      category?: unknown;
      confidence?: unknown;
    };

    return {
      text: validatePatternText(
        candidate.pattern ?? candidate.text ?? candidate.title,
      ),
      category: normalizePatternCategory(candidate.category),
      confidence: normalizeConfidence(candidate.confidence),
    };
  } catch {
    return null;
  }
}

function normalizePatternCategory(
  value: unknown,
): WeightedPattern["category"] | undefined {
  if (typeof value !== "string") return undefined;
  const key = normalizeKey(value);
  if (["behavior", "behaviour", "behavioral", "behavioural"].includes(key))
    return "behavioral";
  if (["emotion", "emotional", "mood"].includes(key)) return "emotional";
  if (["spiritual", "sadhana", "faith"].includes(key)) return "spiritual";
  if (
    [
      "relationship",
      "relationships",
      "relational",
      "family",
      "partner",
    ].includes(key)
  )
    return "relational";
  return undefined;
}

function normalizeLifeEventCandidate(
  rawEvent: unknown,
  now: Date,
): Omit<UserLifeEvent, "id"> | null {
  if (!rawEvent || typeof rawEvent !== "object") return null;
  const event = rawEvent as {
    title?: unknown;
    category?: unknown;
    confidence?: unknown;
  };
  const category = normalizeLifeEventCategory(event.category);
  if (!category) return null;

  try {
    return validateLifeEventInput({
      title: event.title,
      category,
      status: "pending",
      date: now,
      confidence: normalizeConfidence(event.confidence) ?? 0.8,
    } as Omit<UserLifeEvent, "id">);
  } catch {
    return null;
  }
}

function normalizeLifeEventCategory(
  value: unknown,
): UserLifeEvent["category"] | undefined {
  if (typeof value !== "string") return undefined;
  const key = normalizeKey(value);
  if (["career", "work", "job", "business", "profession"].includes(key))
    return "career";
  if (
    [
      "relationship",
      "relationships",
      "love",
      "marriage",
      "family",
      "partner",
    ].includes(key)
  )
    return "relationship";
  if (["health", "wellness", "body", "mental health"].includes(key))
    return "health";
  if (["finance", "money", "wealth", "income"].includes(key)) return "finance";
  if (["spiritual", "sadhana", "faith", "practice"].includes(key))
    return "spiritual";
  return undefined;
}

function normalizeConfidence(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  if (numeric > 1 && numeric <= 100) return clamp(numeric / 100, 0, 1);
  return clamp(numeric, 0, 1);
}

function markContradictedPatterns(
  patterns: WeightedPattern[],
  contradictions: string[],
  now: Date,
) {
  const contradictionText = contradictions.join(" ").toLowerCase();
  return patterns.map((pattern) => {
    if (!isPatternContradicted(pattern.pattern, contradictionText))
      return pattern;
    return {
      ...pattern,
      archived: true,
      lastMentioned: now,
      weightScore: Math.max(0.1, pattern.weightScore - 1),
    };
  });
}

function syncAtmanBuckets(atman: AtmanData) {
  atman.schemaVersion = ATMAN_SCHEMA_VERSION;
  atman.activeEvents = atman.lifeEvents || atman.activeEvents || [];
  atman.lifeEvents = atman.activeEvents;
  atman.adviceHistory = atman.savedAdvice || atman.adviceHistory || [];
  atman.savedAdvice = atman.adviceHistory;
  atman.memory = {
    knownPatterns: atman.knownPatterns || [],
    lifeEvents: atman.activeEvents || [],
    keyRelationships: atman.keyRelationships || [],
    routines: atman.routines || [],
    savedAdvice: atman.savedAdvice || [],
    nudgeHistory: atman.nudgeHistory || [],
  };
}

function buildEvidence(
  source: AtmanBrainSource,
  now: Date,
): AtmanMemoryEvidence {
  const message = [
    source.userMessage ? `User: ${source.userMessage}` : "",
    source.assistantMessage ? `Guide: ${source.assistantMessage}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  return {
    id: createMemoryId("evidence", `${source.surface}:${message}`, now),
    surface: source.surface,
    createdAt: now,
    sessionId: source.sessionId,
    interactionId: source.interactionId,
    personaId: source.personaId,
    messageExcerpt: truncate(message, 260),
    confidence: source.confidence || 0.7,
  };
}

function appendEvidence(
  existing: AtmanMemoryEvidence[] | undefined,
  evidence: AtmanMemoryEvidence,
) {
  return [...(existing || []).slice(-4), evidence];
}

function scorePattern(pattern: WeightedPattern, now: Date) {
  const verifiedBoost = pattern.verified ? 100 : 0;
  const confidenceBoost = (pattern.confidence || 0.5) * 10;
  const daysSinceMention = daysBetween(pattern.lastMentioned, now);
  const recencyBoost = Math.max(0, 48 - daysSinceMention * 0.6);
  const sourceBoost = Math.min(pattern.sourceCount || 0, 6);
  return (
    verifiedBoost +
    pattern.weightScore * 10 +
    confidenceBoost +
    sourceBoost +
    recencyBoost
  );
}

function scoreEvent(event: UserLifeEvent) {
  const statusBoost =
    event.status === "pending" ? 50 : event.status === "completed" ? 10 : 0;
  return statusBoost + event.confidence * 10;
}

function mergeUniqueStrings(existing: string[], incoming: string[]) {
  const seen = new Set(existing.map(normalizeKey));
  const result = [...existing];
  for (const value of incoming) {
    const key = normalizeKey(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

function isPatternContradicted(pattern: string, contradictionText: string) {
  const normalizedPattern = normalizeKey(pattern);
  if (contradictionText.includes(normalizedPattern)) return true;

  const patternTokens = tokenizeMemoryText(normalizedPattern);
  const contradictionTokens = tokenizeMemoryText(contradictionText);
  if (patternTokens.length < 2 || contradictionTokens.length < 2) return false;

  const contradictionSet = new Set(contradictionTokens);
  const shared = patternTokens.filter((token) =>
    contradictionSet.has(token),
  ).length;
  return shared >= 2 && shared / patternTokens.length >= 0.45;
}

function tokenizeMemoryText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(canonicalMemoryToken)
    .filter((token) => token.length > 2 && !MEMORY_STOP_WORDS.has(token));
}

function canonicalMemoryToken(token: string) {
  const singular =
    token.endsWith("s") && token.length > 4 ? token.slice(0, -1) : token;
  return MEMORY_TOKEN_SYNONYMS[singular] || singular;
}

const MEMORY_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "user",
  "during",
  "before",
  "after",
  "about",
]);

const MEMORY_TOKEN_SYNONYMS: Record<string, string> = {
  hard: "difficult",
  tough: "difficult",
  conversation: "conversation",
  conversations: "conversation",
  call: "conversation",
  calls: "conversation",
};

function createMemoryId(prefix: string, value: string, now: Date) {
  return `${prefix}_${now.getTime()}_${hashString(value)}`;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function truncate(value: string, maxLength: number) {
  const trimmed = value.trim();
  return trimmed.length > maxLength
    ? `${trimmed.slice(0, maxLength - 3)}...`
    : trimmed;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}
