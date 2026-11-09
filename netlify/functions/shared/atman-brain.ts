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
import {
  forgetChatInAtman,
  memoryTextKey,
  stripUndefined,
  type ForgetChatCounts,
} from "../../../src/lib/memory-ops.js";

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
  /** Chat the insights came from; tagged on every derived entry. */
  sourceChatId?: string;
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
  /**
   * When the turn these insights came from was requested (ms, Date or ISO).
   * A write is dropped when the user hit "Forget everything" (or forgot this
   * chat) after this moment. Falls back to the time this call started.
   */
  requestedAt?: number | Date | string;
}

export interface PersistAtmanInsightsResult {
  persisted: boolean;
  changed: boolean;
  /** True when the user has paused memory — nothing was written. */
  paused?: boolean;
  /** True when memory was reset after the turn was requested — dropped. */
  reset?: boolean;
  ledgerEntry?: AtmanMemoryLedgerEntry;
}

// ── Memory reset guard ────────────────────────────────────────────────
// "Forget everything" stamps users/{uid}.memoryResetAt; "forget this chat"
// stamps users/{uid}.memoryChatResets[chatId]. A background job requested
// before either stamp must not write, or it would quietly bring the
// forgotten memory back.

/** Max age of a per-chat reset marker; no job lives anywhere near this long. */
export const CHAT_RESET_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

/** Milliseconds from a Firestore Timestamp, Date, ISO string or number. */
export function toMillisLoose(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : undefined;
  }
  if (typeof value === "object") {
    const maybe = value as {
      toMillis?: () => number;
      toDate?: () => Date;
      seconds?: unknown;
      _seconds?: unknown;
    };
    if (typeof maybe.toMillis === "function") return maybe.toMillis();
    if (typeof maybe.toDate === "function") return maybe.toDate().getTime();
    const seconds =
      typeof maybe.seconds === "number"
        ? maybe.seconds
        : typeof maybe._seconds === "number"
          ? maybe._seconds
          : undefined;
    if (seconds !== undefined) return seconds * 1000;
    return undefined;
  }
  if (typeof value === "string") {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : undefined;
  }
  return undefined;
}

/**
 * True when the user's memory (or this chat's memory) was reset at or after
 * `requestedAt`, i.e. a write carrying data from that request must be dropped.
 */
export function isWriteSupersededByReset(
  userData: Record<string, unknown>,
  requestedAt: unknown,
  chatId?: string,
): boolean {
  const requestedMs = toMillisLoose(requestedAt);
  if (requestedMs === undefined) return false;
  const resetMs = toMillisLoose(userData.memoryResetAt);
  if (resetMs !== undefined && requestedMs <= resetMs) return true;
  if (chatId) {
    const chatResets = userData.memoryChatResets;
    if (chatResets && typeof chatResets === "object") {
      const chatResetMs = toMillisLoose(
        (chatResets as Record<string, unknown>)[chatId],
      );
      if (chatResetMs !== undefined && requestedMs <= chatResetMs) return true;
    }
  }
  return false;
}

/**
 * The per-chat reset map after stamping `chatId`, with stale markers pruned so
 * the map stays small.
 */
export function stampChatReset(
  existing: unknown,
  chatId: string,
  now: Date,
): Record<string, Date> {
  const cutoff = now.getTime() - CHAT_RESET_RETENTION_MS;
  const next: Record<string, Date> = {};
  if (existing && typeof existing === "object") {
    for (const [id, value] of Object.entries(existing as Record<string, unknown>)) {
      const ms = toMillisLoose(value);
      if (ms !== undefined && ms >= cutoff && id !== chatId) {
        next[id] = new Date(ms);
      }
    }
  }
  next[chatId] = now;
  return next;
}

/**
 * Whether memory is paused for this user. Callers should check this BEFORE
 * sending any transcript to the model, and fail closed (treat a rejection as
 * paused).
 */
export async function isAtmanMemoryPaused(
  deps: Pick<AtmanBrainDeps, "db">,
  uid: string,
): Promise<boolean> {
  const snap = await deps.db.collection("users").doc(uid).get();
  return snap.data()?.memoryPaused === true;
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
  const sourceChatId =
    typeof input.sourceChatId === "string" && input.sourceChatId.trim()
      ? input.sourceChatId.trim()
      : undefined;
  const evidence = buildEvidence(input.source, now, sourceChatId);
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
          {
            state: emotionalState,
            date: now,
            ...(sourceChatId ? { sourceChatId } : {}),
          },
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
      ...(sourceChatId ? { sourceChatId } : {}),
    };
    const advice = [
      ...(atman.savedAdvice || atman.adviceHistory || []).slice(-19),
      entry,
    ];
    atman.savedAdvice = advice;
    atman.adviceHistory = advice;
    adviceSaved = 1;
    changed = true;

    const usedPatterns = markAdvisedPatternsUsed(
      atman.knownPatterns || [],
      input.source,
      safeAdvice,
      now,
    );
    atman.knownPatterns = usedPatterns.patterns;
    changed = changed || usedPatterns.changed;
  }

  if (
    Array.isArray(analysis.detectedContradictions) &&
    analysis.detectedContradictions.length > 0
  ) {
    const contradictions = analysis.detectedContradictions
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    tagDerivedText(
      atman,
      "contradictedPatterns",
      atman.contradictedPatterns || [],
      contradictions,
      sourceChatId,
    );
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
    tagDerivedText(
      atman,
      "karmicThreads",
      atman.karmicThreads || [],
      threads,
      sourceChatId,
    );
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
  meta?: { chatId?: string },
): Promise<PersistAtmanInsightsResult> {
  const sourceChatId =
    typeof meta?.chatId === "string" && meta.chatId ? meta.chatId : undefined;
  const userRef = deps.db.collection("users").doc(input.uid);
  const now = deps.now?.() || new Date();
  // Fallback: the moment this call started (before any read).
  const requestedAt = input.requestedAt ?? now;

  // Atomic path: read + merge + write inside a transaction so a concurrent
  // client edit to the same atman doc isn't lost (last-write-wins).
  if (typeof deps.db.runTransaction === "function") {
    return deps.db.runTransaction(async (tx: any) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) return { persisted: false, changed: false };
      const userData = snap.data() || {};
      if (userData.memoryPaused === true) {
        return { persisted: false, changed: false, paused: true };
      }
      if (isWriteSupersededByReset(userData, requestedAt, sourceChatId)) {
        return { persisted: false, changed: false, reset: true };
      }
      const result = applyBrainInsights({
        existingAtman: userData.atman as Partial<AtmanData> | undefined,
        analysisResult: input.analysisResult,
        extractedAdvice: input.extractedAdvice,
        source: input.source,
        now,
        sourceChatId,
      });
      if (!result.changed) return { persisted: false, changed: false };
      tx.set(userRef, { atman: stripUndefined(result.atman) }, { merge: true });
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
  if (userData.memoryPaused === true) {
    return { persisted: false, changed: false, paused: true };
  }
  if (isWriteSupersededByReset(userData, requestedAt, sourceChatId)) {
    return { persisted: false, changed: false, reset: true };
  }
  const result = applyBrainInsights({
    existingAtman: userData.atman as Partial<AtmanData> | undefined,
    analysisResult: input.analysisResult,
    extractedAdvice: input.extractedAdvice,
    source: input.source,
    now,
    sourceChatId,
  });

  if (!result.changed) {
    return { persisted: false, changed: false };
  }

  await userRef.set({ atman: stripUndefined(result.atman) }, { merge: true });
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

/**
 * Read the user doc, compute a FIELD-LEVEL atman patch from fresh data and
 * write it with set(merge) — inside a transaction when the db offers one —
 * so the write can never resurrect memory deleted after a stale read, nor
 * clobber fields written concurrently by the post-processor or the client.
 */
async function patchAtmanFields<R>(
  deps: AtmanBrainDeps,
  uid: string,
  compute: (userData: Record<string, unknown> | null) => {
    patch: Record<string, unknown> | null;
    result: R;
  },
): Promise<R> {
  const userRef = deps.db.collection("users").doc(uid);
  if (typeof deps.db.runTransaction === "function") {
    return deps.db.runTransaction(async (tx: any) => {
      const snap = await tx.get(userRef);
      const { patch, result } = compute(
        snap.exists ? snap.data() || {} : null,
      );
      if (patch) {
        tx.set(userRef, { atman: stripUndefined(patch) }, { merge: true });
      }
      return result;
    });
  }
  const snap = await userRef.get();
  const { patch, result } = compute(snap.exists ? snap.data() || {} : null);
  if (patch) {
    await userRef.set({ atman: stripUndefined(patch) }, { merge: true });
  }
  return result;
}

export async function persistPredictionFeedbackSignal(
  deps: AtmanBrainDeps,
  input: {
    uid: string;
    feedback: ApplyPredictionFeedbackInput["feedback"];
  },
) {
  const now = deps.now?.() || new Date();
  return patchAtmanFields(deps, input.uid, (userData) => {
    if (!userData) {
      return {
        patch: null,
        result: { persisted: false, changed: false } as {
          persisted: boolean;
          changed: boolean;
          ledgerEntry?: AtmanMemoryLedgerEntry;
        },
      };
    }
    const applied = applyPredictionFeedbackSignal({
      existingAtman: userData.atman as Partial<AtmanData> | undefined,
      feedback: input.feedback,
      now,
    });
    return {
      // Only the fields this signal touches.
      patch: {
        schemaVersion: ATMAN_SCHEMA_VERSION,
        predictionFeedbackStats: applied.atman.predictionFeedbackStats,
        memoryLedger: applied.atman.memoryLedger,
      },
      result: {
        persisted: true,
        changed: true,
        ledgerEntry: applied.ledgerEntry,
      },
    };
  });
}

export async function persistAtmanMaintenance(
  deps: AtmanBrainDeps,
  uid: string,
) {
  const now = deps.now?.() || new Date();
  const unchanged = {
    persisted: false,
    changed: false,
    decayedPatterns: 0,
    archivedPatterns: 0,
  };
  return patchAtmanFields(deps, uid, (userData) => {
    // No user, or no memory yet: nothing to maintain (and never create one).
    if (!userData || !userData.atman) return { patch: null, result: unchanged };
    const maintained = maintainAtmanMemory(
      userData.atman as Partial<AtmanData>,
      now,
    );
    if (!maintained.changed) return { patch: null, result: unchanged };
    const knownPatterns = maintained.atman.knownPatterns || [];
    return {
      // Only the fields maintenance touches.
      patch: {
        schemaVersion: ATMAN_SCHEMA_VERSION,
        knownPatterns,
        memory: { knownPatterns },
        memoryLedger: maintained.atman.memoryLedger,
      },
      result: {
        persisted: true,
        changed: true,
        decayedPatterns: maintained.decayedPatterns,
        archivedPatterns: maintained.archivedPatterns,
      },
    };
  });
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
  const maxPatterns = options.maxPatterns || 3;
  const maxEvents = options.maxEvents || 2;
  const maxAdvice = options.maxAdvice || 2;

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

function markAdvisedPatternsUsed(
  patterns: WeightedPattern[],
  source: AtmanBrainSource,
  advice: Pick<AtmanAdviceEntry, "advice" | "context">,
  now: Date,
) {
  const guidanceText = [
    source.userMessage,
    source.assistantMessage,
    advice.context,
    advice.advice,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  if (!guidanceText) return { patterns, changed: false };

  let changed = false;
  const marked = patterns.map((pattern) => {
    if (!isPatternRelevantToGuidance(pattern.pattern, guidanceText)) return pattern;

    const previousTime = pattern.lastUsedAt
      ? new Date(pattern.lastUsedAt).getTime()
      : null;
    if (previousTime === now.getTime()) return pattern;

    changed = true;
    return { ...pattern, lastUsedAt: now };
  });

  return { patterns: marked, changed };
}

function isPatternRelevantToGuidance(pattern: string, guidanceText: string) {
  const patternTokens = tokenizeMemoryText(pattern);
  const guidanceTokens = tokenizeMemoryText(guidanceText);
  if (patternTokens.length === 0 || guidanceTokens.length === 0) return false;

  const guidanceSet = new Set(guidanceTokens);
  const shared = patternTokens.filter((token) => guidanceSet.has(token)).length;
  return shared >= 2 || shared / patternTokens.length >= 0.4;
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
  sourceChatId?: string,
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
    ...(sourceChatId ? { sourceChatId } : {}),
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

const MAX_DERIVED_TEXT_SOURCES = 100;

/** Remember which chat introduced each NEW karmic thread / contradiction. */
function tagDerivedText(
  atman: AtmanData,
  bucket: "karmicThreads" | "contradictedPatterns",
  existing: string[],
  incoming: string[],
  sourceChatId: string | undefined,
) {
  if (!sourceChatId) return;
  const known = new Set(existing.map(memoryTextKey));
  const added: NonNullable<AtmanData["derivedTextSources"]> = [];
  for (const text of incoming) {
    const key = memoryTextKey(text);
    if (known.has(key)) continue;
    known.add(key);
    added.push({ bucket, text, sourceChatId });
  }
  if (added.length === 0) return;
  atman.derivedTextSources = [
    ...(atman.derivedTextSources || []),
    ...added,
  ].slice(-MAX_DERIVED_TEXT_SOURCES);
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
  carrie: "carry",
  carries: "carry",
  carried: "carry",
  workload: "work",
  deadline: "deadline",
  deadlines: "deadline",
  responsibilitie: "responsibility",
  responsibilities: "responsibility",
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

// ── Forget a conversation ──────────────────────────────────────────────

type ForgetDocSnapshot = {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
};

type ForgetDocRef = {
  get(): Promise<ForgetDocSnapshot>;
  update(data: Record<string, unknown>): Promise<unknown>;
  collection(name: string): { doc(id: string): ForgetDocRef };
};

export interface ForgetChatDeps {
  db: {
    collection(name: string): { doc(id: string): ForgetDocRef };
    runTransaction?: <T>(fn: (tx: any) => Promise<T>) => Promise<T>;
  };
  /** FieldValue.delete() in production. */
  deleteField: () => unknown;
  now?: () => Date;
}

export interface ForgetChatResult {
  atmanChanged: boolean;
  summaryRemoved: boolean;
  removed: ForgetChatCounts;
}

const CHAT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function isValidChatId(chatId: unknown): chatId is string {
  return typeof chatId === "string" && CHAT_ID_PATTERN.test(chatId);
}

/**
 * Remove every memory derived from one chat (entries tagged with that
 * sourceChatId) plus the chat's stored summary. Safe to call after the chat
 * document itself has been deleted.
 */
export async function forgetChat(
  deps: ForgetChatDeps,
  uid: string,
  chatId: string,
): Promise<ForgetChatResult> {
  if (!isValidChatId(chatId)) throw new Error("Invalid chatId");
  const userRef = deps.db.collection("users").doc(uid);
  const now = deps.now?.() || new Date();

  // Besides removing the chat's memories, stamp memoryChatResets[chatId] so a
  // post-processing job for this chat that is still in flight drops its
  // write instead of re-adding what was just forgotten.
  const planForSnapshot = (snap: ForgetDocSnapshot) => {
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const result = data.atman
      ? forgetChatInAtman(data.atman as Partial<AtmanData>, chatId)
      : null;
    const patch: Record<string, unknown> = {
      memoryChatResets: stampChatReset(data.memoryChatResets, chatId, now),
    };
    // update() replaces the whole atman map, so fields we deleted
    // (e.g. an emotionalState that only this chat set) are really gone.
    if (result?.changed) patch.atman = stripUndefined(result.atman);
    return { result, patch };
  };

  let atmanResult: ReturnType<typeof forgetChatInAtman> | null;
  if (typeof deps.db.runTransaction === "function") {
    atmanResult = await deps.db.runTransaction(async (tx: any) => {
      const plan = planForSnapshot(await tx.get(userRef));
      if (plan) tx.update(userRef, plan.patch);
      return plan?.result ?? null;
    });
  } else {
    const plan = planForSnapshot(await userRef.get());
    if (plan) await userRef.update(plan.patch);
    atmanResult = plan?.result ?? null;
  }

  let summaryRemoved = false;
  const chatRef = userRef.collection("chats").doc(chatId);
  const chatSnap = await chatRef.get();
  if (chatSnap.exists && chatSnap.data()?.summary !== undefined) {
    await chatRef.update({ summary: deps.deleteField() });
    summaryRemoved = true;
  }

  return {
    atmanChanged: Boolean(atmanResult?.changed),
    summaryRemoved,
    removed: atmanResult?.removed || {
      patterns: 0,
      events: 0,
      advice: 0,
      ledger: 0,
      emotionalHistory: 0,
      karmicThreads: 0,
      contradictedPatterns: 0,
      emotionalStateReset: false,
    },
  };
}
