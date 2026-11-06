/**
 * Pure memory-management operations shared by the client (MemoryManager,
 * AtmanService) and the server (forget-chat via atman-brain). No Firestore
 * imports here so both sides — and node:test — can use it.
 */
import type {
  AtmanData,
  AtmanDerivedTextSource,
  AtmanMemoryEvidence,
} from "../types/user.js";
import { normalizeAtmanData } from "./atman-schema.js";

/**
 * Remove `undefined` values recursively (Firestore rejects them unless
 * ignoreUndefinedProperties is set, which neither SDK enables here).
 * Only plain objects and arrays are walked — Dates, Timestamps and
 * FieldValue sentinels pass through untouched.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      out[key] = stripUndefined(item);
    }
    return out as T;
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function memoryTextKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Re-sync the legacy alias buckets after an edit. */
export function syncMemoryBuckets(atman: AtmanData): AtmanData {
  const lifeEvents = atman.lifeEvents || atman.activeEvents || [];
  const savedAdvice = atman.savedAdvice || atman.adviceHistory || [];
  atman.activeEvents = lifeEvents;
  atman.lifeEvents = lifeEvents;
  atman.savedAdvice = savedAdvice;
  atman.adviceHistory = savedAdvice;
  atman.memory = {
    knownPatterns: atman.knownPatterns || [],
    lifeEvents,
    keyRelationships: atman.keyRelationships || [],
    routines: atman.routines || [],
    savedAdvice,
    nudgeHistory: atman.nudgeHistory || [],
  };
  if (atman.emotionalState) {
    atman.transient = {
      emotionalState: atman.emotionalState,
      lastEmotionalUpdate: atman.lastEmotionalUpdate,
      emotionalHistory: atman.emotionalHistory || [],
    };
  } else {
    delete (atman as Partial<AtmanData>).transient;
  }
  return atman;
}

/** Clear "how you've been feeling" (current state + history). */
export function clearEmotionalMemory(atman: AtmanData): AtmanData {
  const next = { ...atman } as Partial<AtmanData>;
  delete next.emotionalState;
  delete next.lastEmotionalUpdate;
  delete next.transient;
  next.emotionalHistory = [];
  return syncMemoryBuckets(next as AtmanData);
}

export interface ForgetChatCounts {
  patterns: number;
  events: number;
  advice: number;
  ledger: number;
  emotionalHistory: number;
  karmicThreads: number;
  contradictedPatterns: number;
  emotionalStateReset: boolean;
}

export interface ForgetChatAtmanResult {
  atman: AtmanData;
  changed: boolean;
  removed: ForgetChatCounts;
}

/**
 * Remove everything derived from one chat. Patterns/events with evidence from
 * other sources survive with that chat's evidence stripped; ones that only
 * came from this chat are removed entirely.
 */
export function forgetChatInAtman(
  rawAtman: Partial<AtmanData> | undefined,
  chatId: string,
): ForgetChatAtmanResult {
  const removed: ForgetChatCounts = {
    patterns: 0,
    events: 0,
    advice: 0,
    ledger: 0,
    emotionalHistory: 0,
    karmicThreads: 0,
    contradictedPatterns: 0,
    emotionalStateReset: false,
  };
  const normalized = normalizeAtmanData(rawAtman);
  if (!normalized || !chatId) {
    return { atman: normalized as AtmanData, changed: false, removed };
  }
  // normalizeAtmanData defaults a missing emotionalState to "stable"; don't
  // invent one the user previously cleared.
  const atman: AtmanData = { ...normalized };
  if (
    rawAtman &&
    !rawAtman.emotionalState &&
    !rawAtman.transient?.emotionalState
  ) {
    delete (atman as Partial<AtmanData>).emotionalState;
    delete (atman as Partial<AtmanData>).lastEmotionalUpdate;
  }

  const fromChat = (entry?: { sourceChatId?: string }) =>
    entry?.sourceChatId === chatId;

  const stripEvidence = <T extends { evidence?: AtmanMemoryEvidence[] }>(
    items: T[],
    onTrim: (item: T, dropped: number) => T,
  ): { items: T[]; removedCount: number; trimmedCount: number } => {
    let removedCount = 0;
    let trimmedCount = 0;
    const kept: T[] = [];
    for (const item of items) {
      const evidence = item.evidence || [];
      const dropped = evidence.filter(fromChat).length;
      if (dropped === 0) {
        kept.push(item);
        continue;
      }
      const remaining = evidence.filter((entry) => !fromChat(entry));
      if (remaining.length === 0) {
        removedCount += 1;
        continue;
      }
      trimmedCount += 1;
      kept.push(onTrim({ ...item, evidence: remaining }, dropped));
    }
    return { items: kept, removedCount, trimmedCount };
  };

  const patterns = stripEvidence(
    atman.knownPatterns || [],
    (pattern, dropped) => ({
      ...pattern,
      frequency: Math.max(1, (pattern.frequency || 1) - dropped),
      sourceCount:
        pattern.sourceCount === undefined
          ? undefined
          : Math.max(1, pattern.sourceCount - dropped),
    }),
  );
  atman.knownPatterns = patterns.items;
  removed.patterns = patterns.removedCount;

  const events = stripEvidence(
    atman.lifeEvents || atman.activeEvents || [],
    (event) => event,
  );
  atman.lifeEvents = events.items;
  removed.events = events.removedCount;

  const advice = atman.savedAdvice || atman.adviceHistory || [];
  atman.savedAdvice = advice.filter((entry) => !fromChat(entry));
  removed.advice = advice.length - atman.savedAdvice.length;

  const ledger = atman.memoryLedger || [];
  atman.memoryLedger = ledger.filter((entry) => !fromChat(entry));
  removed.ledger = ledger.length - atman.memoryLedger.length;

  const history = atman.emotionalHistory || [];
  const remainingHistory = history.filter((entry) => !fromChat(entry));
  removed.emotionalHistory = history.length - remainingHistory.length;
  atman.emotionalHistory = remainingHistory;
  if (history.length > 0 && fromChat(history[history.length - 1])) {
    removed.emotionalStateReset = true;
    const last = remainingHistory[remainingHistory.length - 1];
    if (last) {
      atman.emotionalState = last.state;
      atman.lastEmotionalUpdate = last.date;
    } else {
      delete (atman as Partial<AtmanData>).emotionalState;
      delete (atman as Partial<AtmanData>).lastEmotionalUpdate;
    }
  }

  const sources: AtmanDerivedTextSource[] = atman.derivedTextSources || [];
  const chatSources = sources.filter(fromChat);
  if (chatSources.length > 0) {
    const dropKeys = (bucket: AtmanDerivedTextSource["bucket"]) =>
      new Set(
        chatSources
          .filter((source) => source.bucket === bucket)
          .map((source) => memoryTextKey(source.text)),
      );
    const karmicKeys = dropKeys("karmicThreads");
    const contradictionKeys = dropKeys("contradictedPatterns");
    const threads = atman.karmicThreads || [];
    atman.karmicThreads = threads.filter(
      (text) => !karmicKeys.has(memoryTextKey(text)),
    );
    removed.karmicThreads = threads.length - atman.karmicThreads.length;
    const contradictions = atman.contradictedPatterns || [];
    atman.contradictedPatterns = contradictions.filter(
      (text) => !contradictionKeys.has(memoryTextKey(text)),
    );
    removed.contradictedPatterns =
      contradictions.length - atman.contradictedPatterns.length;
    atman.derivedTextSources = sources.filter((source) => !fromChat(source));
  }

  const changed =
    removed.patterns +
      removed.events +
      removed.advice +
      removed.ledger +
      removed.emotionalHistory +
      removed.karmicThreads +
      removed.contradictedPatterns >
      0 ||
    removed.emotionalStateReset ||
    chatSources.length > 0 ||
    patterns.trimmedCount + events.trimmedCount > 0;

  return { atman: syncMemoryBuckets(atman), changed, removed };
}

/** Remove a karmic thread or contradiction by text (plus its source tag). */
export function removeDerivedText(
  atman: AtmanData,
  bucket: AtmanDerivedTextSource["bucket"],
  text: string,
): AtmanData {
  const key = memoryTextKey(text);
  const next: AtmanData = { ...atman };
  next[bucket] = (atman[bucket] || []).filter(
    (value) => memoryTextKey(value) !== key,
  );
  next.derivedTextSources = (atman.derivedTextSources || []).filter(
    (source) =>
      !(source.bucket === bucket && memoryTextKey(source.text) === key),
  );
  return next;
}
