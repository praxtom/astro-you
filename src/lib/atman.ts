import {
  doc,
  updateDoc,
  arrayUnion,
  Timestamp,
  runTransaction,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  writeBatch,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { devLog } from "./devLog";
import { postJson } from "./apiFetch";
import {
  ATMAN_SCHEMA_VERSION,
  UserLifeEvent,
  AtmanData,
  UserRoutine,
  KeyRelationship,
} from "../types/user";
import {
  ATMAN_ARRAY_CAPS,
  appendCapped,
  buildAtmanMigrationUpdates,
  createInitialAtmanData,
  normalizeAtmanData,
  validateAdviceInput,
  validateAtmanEmotionalState,
  validateAtmanText,
  validateLifeEventInput,
  validateNudgeInput,
  validatePatternText,
  validateRelationshipInput,
  validateRoutineInput,
} from "./atman-schema";
import { viewerDateKey } from "./viewer-timezone";
import {
  clearEmotionalMemory,
  removeDerivedText,
  stripUndefined,
  syncMemoryBuckets,
} from "./memory-ops";

export { normalizeAtmanData } from "./atman-schema";

/**
 * The "Atman" Service - Handles User Consciousness & Memory
 */

// Define the shape of a User Insight
export interface UserInsight {
  id: string;
  type: "pattern" | "event" | "preference" | "emotional_state" | "relationship";
  content: string;
  confidence: number; // 0 to 1
  detectedAt: Date;
  lastVerified?: Date;
}

/** Trimmed, non-empty strings from an AI-provided list (anything else dropped). */
function toCleanStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0 && item.length <= 300);
}

/**
 * Read-modify-write the user's Atman inside a transaction so a concurrent
 * server brain write (or another tab) is never silently clobbered. `compute`
 * gets a fresh normalized copy and returns FIELD-LEVEL updates (dotted
 * `atman.*` paths) or null for "nothing to change". Returns true if written.
 */
async function transactAtmanFields(
  userId: string,
  compute: (atman: AtmanData) => Record<string, unknown> | null,
): Promise<boolean> {
  const userRef = doc(db, "users", userId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) return false;
    const atman =
      normalizeAtmanData(snap.data().atman) || createInitialAtmanData();
    const updates = compute(atman);
    if (!updates) return false;
    tx.update(
      userRef,
      stripUndefined({
        "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
        ...updates,
      }),
    );
    return true;
  });
}

/** Strengthen an existing pattern or append a new one (capped). */
function upsertPattern(
  patterns: AtmanData["knownPatterns"],
  patternText: string,
  now: Date,
): AtmanData["knownPatterns"] {
  const existing = patterns || [];
  const index = existing.findIndex((p) => p.pattern === patternText);
  if (index > -1) {
    const updated = [...existing];
    const p = updated[index];
    updated[index] = {
      ...p,
      frequency: p.frequency + 1,
      lastMentioned: now,
      weightScore: Math.min(5.0, p.weightScore + 0.5),
    };
    return updated;
  }
  return [
    ...existing,
    {
      id: Math.random().toString(36).substring(7),
      pattern: patternText,
      frequency: 1,
      weightScore: 1.0,
      lastMentioned: now,
      verified: false,
    },
  ].slice(-ATMAN_ARRAY_CAPS.knownPatterns);
}

function patternFields(patterns: AtmanData["knownPatterns"]) {
  return {
    "atman.knownPatterns": patterns,
    "atman.memory.knownPatterns": patterns,
  };
}

function lifeEventFields(events: UserLifeEvent[]) {
  return {
    "atman.activeEvents": events,
    "atman.lifeEvents": events,
    "atman.memory.lifeEvents": events,
  };
}

function relationshipFields(relationships: KeyRelationship[]) {
  return {
    "atman.keyRelationships": relationships,
    "atman.memory.keyRelationships": relationships,
  };
}

export const AtmanService = {
  /**
   * Update the user's emotional state based on chat analysis
   */
  async updateEmotionalState(
    userId: string,
    state: AtmanData["emotionalState"],
  ) {
    try {
      const nextState = validateAtmanEmotionalState(state);
      const updatedAt = Timestamp.now();
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
        "atman.emotionalState": nextState,
        "atman.lastEmotionalUpdate": updatedAt,
        "atman.transient.emotionalState": nextState,
        "atman.transient.lastEmotionalUpdate": updatedAt,
      });
      devLog(`[Atman] Updated emotional state to: ${nextState}`);
    } catch (error) {
      console.error("[Atman] Failed to update emotional state:", error);
    }
  },

  /**
   * Add or update a discovered pattern in the user's memory (weighted)
   */
  async addPattern(userId: string, patternText: string) {
    try {
      const safePatternText = validatePatternText(patternText);
      await transactAtmanFields(userId, (atman) =>
        patternFields(
          upsertPattern(atman.knownPatterns, safePatternText, new Date()),
        ),
      );
      devLog(`[Atman] Updated pattern weight: ${safePatternText}`);
    } catch (error) {
      console.error("[Atman] Failed to add pattern:", error);
    }
  },

  /**
   * Verify a pattern (User confirms it's accurate)
   */
  async verifyPattern(userId: string, patternId: string) {
    try {
      await transactAtmanFields(userId, (atman) => {
        const patterns = atman.knownPatterns || [];
        if (!patterns.some((p) => p.id === patternId)) return null;
        return patternFields(
          patterns.map((p) =>
            p.id === patternId
              ? { ...p, verified: true, archived: false, weightScore: 5.0 } // Max weight for verified
              : p,
          ),
        );
      });
    } catch (error) {
      console.error("[Atman] Failed to verify pattern:", error);
    }
  },

  /**
   * Dismiss a pattern (User says it's not accurate)
   */
  async dismissPattern(userId: string, patternId: string) {
    try {
      await transactAtmanFields(userId, (atman) => {
        const patterns = atman.knownPatterns || [];
        if (!patterns.some((p) => p.id === patternId)) return null;
        return patternFields(patterns.filter((p) => p.id !== patternId));
      });
    } catch (error) {
      console.error("[Atman] Failed to dismiss pattern:", error);
    }
  },

  /**
   * Track a new life event (e.g., "Job Interview")
   */
  async addLifeEvent(userId: string, event: Omit<UserLifeEvent, "id">) {
    try {
      const safeEvent = validateLifeEventInput(event);
      const newEvent: UserLifeEvent = {
        ...safeEvent,
        id: Math.random().toString(36).substring(7),
      };

      // Transaction (not arrayUnion) so the list is capped at write time.
      await transactAtmanFields(userId, (atman) =>
        lifeEventFields(
          appendCapped(
            atman.lifeEvents || atman.activeEvents,
            [newEvent],
            ATMAN_ARRAY_CAPS.lifeEvents,
          ),
        ),
      );
      devLog(`[Atman] Added life event: ${safeEvent.title}`);
    } catch (error) {
      console.error("[Atman] Failed to add life event:", error);
    }
  },

  async updateLifeEventStatus(
    userId: string,
    eventId: string,
    status: UserLifeEvent["status"],
  ) {
    try {
      const safeStatus = validateLifeEventInput({
        title: "status check",
        category: "spiritual",
        status,
        confidence: 1,
      }).status;
      await transactAtmanFields(userId, (atman) => {
        const events = atman.lifeEvents || atman.activeEvents || [];
        if (!events.some((event) => event.id === eventId)) return null;
        return lifeEventFields(
          events.map((event) =>
            event.id === eventId ? { ...event, status: safeStatus } : event,
          ),
        );
      });
    } catch (error) {
      console.error("[Atman] Failed to update life event:", error);
    }
  },

  /**
   * Add a key relationship to the user's graph
   */
  async addRelationship(
    userId: string,
    relationship: Omit<KeyRelationship, "id">,
  ) {
    try {
      const userRef = doc(db, "users", userId);
      const safeRelationship = validateRelationshipInput(relationship);
      const newRel = {
        ...safeRelationship,
        id: Math.random().toString(36).substring(7),
      };

      await updateDoc(userRef, {
        "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
        "atman.keyRelationships": arrayUnion(newRel),
        "atman.memory.keyRelationships": arrayUnion(newRel),
      });
      devLog(`[Atman] Added relationship: ${safeRelationship.name}`);
      return newRel;
    } catch (error) {
      console.error("[Atman] Failed to add relationship:", error);
      return null;
    }
  },

  /**
   * Update an existing relationship
   */
  async updateRelationship(
    userId: string,
    relId: string,
    updates: Partial<KeyRelationship>,
  ) {
    try {
      await transactAtmanFields(userId, (atman) => {
        const relationships = atman.keyRelationships || [];
        if (!relationships.some((r) => r.id === relId)) return null;
        return relationshipFields(
          relationships.map((r) =>
            r.id === relId
              ? { ...validateRelationshipInput({ ...r, ...updates }), id: r.id }
              : r,
          ),
        );
      });
      devLog(`[Atman] Updated relationship: ${relId}`);
    } catch (error) {
      console.error("[Atman] Failed to update relationship:", error);
    }
  },

  /**
   * Remove a relationship from the graph
   */
  async deleteRelationship(userId: string, relId: string) {
    try {
      await transactAtmanFields(userId, (atman) => {
        const relationships = atman.keyRelationships || [];
        if (!relationships.some((r) => r.id === relId)) return null;
        return relationshipFields(relationships.filter((r) => r.id !== relId));
      });
      devLog(`[Atman] Deleted relationship: ${relId}`);
    } catch (error) {
      console.error("[Atman] Failed to delete relationship:", error);
    }
  },

  /**
   * Add a new Dharma Routine
   */
  async addRoutine(
    userId: string,
    routine: Omit<UserRoutine, "id" | "createdAt" | "streak" | "status">,
  ) {
    try {
      const userRef = doc(db, "users", userId);
      const safeRoutine = validateRoutineInput(routine);
      const newRoutine: UserRoutine = {
        ...safeRoutine,
        id: Math.random().toString(36).substring(7),
        createdAt: new Date(),
        status: "active",
        streak: 0,
      };

      await updateDoc(userRef, {
        "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
        "atman.routines": arrayUnion(newRoutine),
        "atman.memory.routines": arrayUnion(newRoutine),
      });
      devLog(`[Atman] Added routine: ${safeRoutine.title}`);
      return newRoutine;
    } catch (error) {
      console.error("[Atman] Failed to add routine:", error);
      return null;
    }
  },

  /**
   * Mark a routine as completed for today
   */
  async completeRoutine(userId: string, routineId: string) {
    try {
      await transactAtmanFields(userId, (atman) => {
        const routines = atman.routines || [];
        if (!routines.some((r) => r.id === routineId)) return null;
        const now = new Date();
        const toDate = (value: unknown): Date | null => {
          if (!value) return null;
          if (value instanceof Date) return value;
          if (
            typeof value === "object" &&
            typeof (value as { toDate?: unknown }).toDate === "function"
          ) {
            return (value as { toDate: () => Date }).toDate();
          }
          const parsed = new Date(value as string | number);
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        };
        const dayStart = (d: Date) =>
          new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const target = routines.find((r) => r.id === routineId);
        const last = toDate(target?.lastCompletedAt);
        const daysSince = last
          ? Math.round((dayStart(now) - dayStart(last)) / 86_400_000)
          : null;
        // Already done today: one completion per day, no extra streak days.
        if (daysSince === 0) return null;
        const updatedRoutines = routines.map((r) =>
          r.id === routineId
            ? {
                ...r,
                // A missed day restarts the streak.
                streak:
                  daysSince !== null &&
                  daysSince <= (r.frequency === "weekly" ? 8 : 1)
                    ? (r.streak || 0) + 1
                    : 1,
                lastCompletedAt: now,
              }
            : r,
        );
        return {
          "atman.routines": updatedRoutines,
          "atman.memory.routines": updatedRoutines,
        };
      });
      devLog(`[Atman] Completed routine: ${routineId}`);
    } catch (error) {
      console.error("[Atman] Failed to complete routine:", error);
    }
  },

  /**
   * Process analysis results from the AI. Everything is applied in ONE
   * transaction with field-level writes, and every array is capped.
   */
  async processAnalysisResult(userId: string, result: any) {
    if (!result) return;

    try {
      const now = new Date();
      const emotionalState = result.emotionalState
        ? validateAtmanEmotionalState(result.emotionalState)
        : undefined;
      const patternTexts: string[] = Array.isArray(result.newPatterns)
        ? result.newPatterns.flatMap((text: unknown) => {
            try {
              return [validatePatternText(text)];
            } catch {
              return [];
            }
          })
        : [];
      const eventsToAdd: UserLifeEvent[] = Array.isArray(result.newEvents)
        ? result.newEvents.map((e: any) => ({
            ...validateLifeEventInput({
              title: e.title,
              category: e.category,
              date: now,
              status: "pending",
              confidence: 0.8,
            }),
            id: Math.random().toString(36).substring(7),
          }))
        : [];
      const contradictions = toCleanStrings(result.detectedContradictions);
      const karmicThreads = toCleanStrings(result.karmicThreads);

      const written = await transactAtmanFields(userId, (atman) => {
        const updates: Record<string, unknown> = {};

        // 1. Emotional state + capped history for trend analysis
        if (emotionalState) {
          const updatedAt = Timestamp.now();
          const history = [
            ...(atman.emotionalHistory || []),
            { state: emotionalState, date: now },
          ].slice(-ATMAN_ARRAY_CAPS.emotionalHistory);
          updates["atman.emotionalState"] = emotionalState;
          updates["atman.lastEmotionalUpdate"] = updatedAt;
          updates["atman.transient.emotionalState"] = emotionalState;
          updates["atman.transient.lastEmotionalUpdate"] = updatedAt;
          updates["atman.emotionalHistory"] = history;
          updates["atman.transient.emotionalHistory"] = history;
        }

        // 2. Patterns (weighted)
        if (patternTexts.length > 0) {
          let patterns = atman.knownPatterns || [];
          for (const text of patternTexts) {
            patterns = upsertPattern(patterns, text, now);
          }
          Object.assign(updates, patternFields(patterns));
        }

        // 3. New events (capped)
        if (eventsToAdd.length > 0) {
          Object.assign(
            updates,
            lifeEventFields(
              appendCapped(
                atman.lifeEvents || atman.activeEvents,
                eventsToAdd,
                ATMAN_ARRAY_CAPS.lifeEvents,
              ),
            ),
          );
        }

        // 4. Contradictions (capped)
        if (contradictions.length > 0) {
          updates["atman.contradictedPatterns"] = appendCapped(
            atman.contradictedPatterns,
            contradictions,
            ATMAN_ARRAY_CAPS.contradictedPatterns,
          );
        }

        // 5. Karmic threads (Level 4 Brain, capped)
        if (karmicThreads.length > 0) {
          updates["atman.karmicThreads"] = appendCapped(
            atman.karmicThreads,
            karmicThreads,
            ATMAN_ARRAY_CAPS.karmicThreads,
          );
        }

        return Object.keys(updates).length > 0 ? updates : null;
      });

      // Dispatch custom event for celebration toast
      if (
        written &&
        contradictions.length > 0 &&
        typeof window !== "undefined"
      ) {
        window.dispatchEvent(
          new CustomEvent("atman:growth-detected", {
            detail: { contradictions },
          }),
        );
      }
      if (written) devLog("[Atman] Processed analysis result.");
    } catch (error) {
      console.error("[Atman] Failed to process analysis:", error);
    }
  },

  /**
   * Periodically decay pattern weights (e.g., call during initialization or refresh)
   */
  async calculatePatternDecay(userId: string) {
    try {
      const written = await transactAtmanFields(userId, (atman) => {
        if (!atman.knownPatterns) return null;
        const now = new Date();
        let hasChanges = false;

        const updatedPatterns = atman.knownPatterns.map((p) => {
          if (p.verified) return p;

          const daysSinceLast =
            (now.getTime() - new Date(p.lastMentioned).getTime()) /
            (1000 * 60 * 60 * 24);

          // Decay weight if not mentioned for > 7 days
          if (daysSinceLast > 7) {
            hasChanges = true;
            return {
              ...p,
              weightScore: Math.max(0.1, p.weightScore - 0.1), // Linear decay for now
            };
          }
          return p;
        });

        return hasChanges ? patternFields(updatedPatterns) : null;
      });
      if (written) devLog("[Atman] Applied weight decay to patterns.");
    } catch (error) {
      console.error("[Atman] Weight decay failed:", error);
    }
  },

  /**
   * Set Daily Intention (Sankalpa)
   */
  async setDailyIntention(userId: string, intention: string) {
    try {
      const userRef = doc(db, "users", userId);
      const today = viewerDateKey();
      const safeIntention = validateAtmanText(intention, "dailyIntention", 240);

      await updateDoc(userRef, {
        "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
        "atman.dailyIntention": safeIntention,
        "atman.dailyIntentionDate": today,
      });
    } catch (error) {
      console.error("[Atman] Failed to set intention:", error);
    }
  },

  /**
   * Log Daily Gratitude
   */
  async setDailyGratitude(userId: string, gratitude: string) {
    try {
      const userRef = doc(db, "users", userId);
      const today = viewerDateKey();
      const safeGratitude = validateAtmanText(gratitude, "dailyGratitude", 240);

      await updateDoc(userRef, {
        "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
        "atman.dailyGratitude": safeGratitude,
        "atman.dailyGratitudeDate": today,
      });
    } catch (error) {
      console.error("[Atman] Failed to set gratitude:", error);
    }
  },

  /**
   * Save extracted advice to the Advice Ledger (keeps last 20)
   */
  async saveAdvice(
    userId: string,
    advice: { advice: string; context: string },
  ) {
    try {
      const safeAdvice = validateAdviceInput(advice);
      await transactAtmanFields(userId, (atman) => {
        const updated = [
          ...(atman.savedAdvice || atman.adviceHistory || []),
          { ...safeAdvice, date: new Date().toISOString(), followedUp: false },
        ].slice(-ATMAN_ARRAY_CAPS.savedAdvice);
        return {
          "atman.adviceHistory": updated,
          "atman.savedAdvice": updated,
          "atman.memory.savedAdvice": updated,
        };
      });
      devLog(
        `[Atman] Saved advice: ${safeAdvice.advice.substring(0, 50)}...`,
      );
    } catch (error) {
      console.error("[Atman] Failed to save advice:", error);
    }
  },

  /**
   * Save a Guru Nudge to history (capped; shares the server's window so its
   * per-trigger de-duplication still sees enough history).
   */
  async saveNudge(
    userId: string,
    nudge: { title: string; message: string; triggerType: string },
  ) {
    try {
      const safeNudge = validateNudgeInput(nudge);
      await transactAtmanFields(userId, (atman) => {
        const updated = [
          ...(atman.nudgeHistory || []),
          { ...safeNudge, date: new Date().toISOString() },
        ].slice(-ATMAN_ARRAY_CAPS.nudgeHistory);
        return {
          "atman.nudgeHistory": updated,
          "atman.memory.nudgeHistory": updated,
        };
      });
    } catch (error) {
      console.error("[Atman] Failed to save nudge:", error);
    }
  },

  /**
   * Initialize Atman for a new user, or migrate an old schema in place.
   * Runs in a transaction: it only creates the memory if it is still missing
   * at commit time, and a migration writes field by field, so neither can
   * overwrite memory the server brain wrote a moment earlier or drop fields
   * this client version does not know about.
   */
  async initializeAtman(userId: string) {
    try {
      const userRef = doc(db, "users", userId);
      const outcome = await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists()) return "missing_user";

        const existingAtman = snap.data().atman as
          | Partial<AtmanData>
          | undefined;
        if (!existingAtman) {
          tx.update(userRef, {
            atman: stripUndefined(createInitialAtmanData()),
          });
          return "initialized";
        }

        if (existingAtman.schemaVersion !== ATMAN_SCHEMA_VERSION) {
          tx.update(
            userRef,
            stripUndefined(buildAtmanMigrationUpdates(existingAtman)),
          );
          return "migrated";
        }
        return "current";
      });
      if (outcome === "initialized") {
        devLog("[Atman] Initialized consciousness for user.");
      } else if (outcome === "migrated") {
        devLog("[Atman] Migrated consciousness schema.");
      }
    } catch (error) {
      console.error("[Atman] Initialization failed:", error);
    }
  },
};

// ── Memory controls ("What I remember") ──────────────────────────────────
// Users may view, delete, clear and pause everything AstroYou derives from
// their conversations. Firestore rules let the owner rewrite `atman` and
// `memoryPaused`; edits run in a transaction so a concurrent server brain
// write isn't silently clobbered.

export type MemoryGroup =
  | "feelings"
  | "patterns"
  | "events"
  | "people"
  | "routines"
  | "advice"
  | "karmicThreads"
  | "contradictions"
  | "notes";

export type MemoryItemRef =
  | { group: "feelings"; kind: "current" }
  | { group: "feelings"; kind: "history"; key: string }
  | { group: "patterns" | "events" | "people" | "routines" | "notes"; id: string }
  | { group: "advice"; key: string }
  | { group: "karmicThreads" | "contradictions"; text: string };

/** Stable key for an emotional-history entry (no id field). */
export function emotionalHistoryKey(entry: { state: string; date: unknown }) {
  return `${entry.state}|${toMillis(entry.date)}`;
}

/** Stable key for an advice entry (no id field). */
export function adviceKey(entry: { advice: string; date: string }) {
  return `${entry.date}|${entry.advice.slice(0, 60)}`;
}

function toMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === "function") return toDate.call(value).getTime();
  }
  const parsed = new Date(value as string | number).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Normalize for editing without inventing a "stable" mood that isn't stored. */
function atmanForEdit(raw: Partial<AtmanData> | undefined): AtmanData {
  const atman = normalizeAtmanData(raw) || createInitialAtmanData();
  if (!raw?.emotionalState && !raw?.transient?.emotionalState) {
    const loose = atman as Partial<AtmanData>;
    delete loose.emotionalState;
    delete loose.lastEmotionalUpdate;
    delete loose.transient;
  }
  return atman;
}

async function editAtman(
  userId: string,
  edit: (atman: AtmanData) => AtmanData,
  /** Extra top-level fields written in the same transaction. */
  extraFields?: Record<string, unknown>,
) {
  const userRef = doc(db, "users", userId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) return;
    const raw = snap.data().atman as Partial<AtmanData> | undefined;
    if (!raw) return;
    const next = syncMemoryBuckets(edit(atmanForEdit(raw)));
    next.schemaVersion = ATMAN_SCHEMA_VERSION;
    // Replace the whole map so deleted keys are really removed.
    tx.update(userRef, { atman: stripUndefined(next), ...extraFields });
  });
}

function removeItem(atman: AtmanData, ref: MemoryItemRef): AtmanData {
  const next: AtmanData = { ...atman };
  switch (ref.group) {
    case "feelings":
      if ("kind" in ref && ref.kind === "current") {
        const loose = next as Partial<AtmanData>;
        delete loose.emotionalState;
        delete loose.lastEmotionalUpdate;
        delete loose.transient;
        return next;
      }
      next.emotionalHistory = (atman.emotionalHistory || []).filter(
        (entry) => emotionalHistoryKey(entry) !== (ref as { key: string }).key,
      );
      return next;
    case "patterns":
      next.knownPatterns = (atman.knownPatterns || []).filter((p) => p.id !== ref.id);
      return next;
    case "events":
      next.lifeEvents = (atman.lifeEvents || atman.activeEvents || []).filter(
        (e) => e.id !== ref.id,
      );
      next.activeEvents = next.lifeEvents;
      return next;
    case "people":
      next.keyRelationships = (atman.keyRelationships || []).filter((r) => r.id !== ref.id);
      return next;
    case "routines":
      next.routines = (atman.routines || []).filter((r) => r.id !== ref.id);
      return next;
    case "notes":
      next.memoryLedger = (atman.memoryLedger || []).filter((e) => e.id !== ref.id);
      return next;
    case "advice":
      next.savedAdvice = (atman.savedAdvice || atman.adviceHistory || []).filter(
        (entry) => adviceKey(entry) !== ref.key,
      );
      next.adviceHistory = next.savedAdvice;
      return next;
    case "karmicThreads":
      return removeDerivedText(atman, "karmicThreads", ref.text);
    case "contradictions":
      return removeDerivedText(atman, "contradictedPatterns", ref.text);
  }
}

function clearGroup(atman: AtmanData, group: MemoryGroup): AtmanData {
  const next: AtmanData = { ...atman };
  switch (group) {
    case "feelings":
      return clearEmotionalMemory(atman);
    case "patterns":
      next.knownPatterns = [];
      return next;
    case "events":
      next.lifeEvents = [];
      next.activeEvents = [];
      return next;
    case "people":
      next.keyRelationships = [];
      return next;
    case "routines":
      next.routines = [];
      return next;
    case "advice":
      next.savedAdvice = [];
      next.adviceHistory = [];
      return next;
    case "notes":
      next.memoryLedger = [];
      return next;
    case "karmicThreads":
      next.karmicThreads = [];
      next.derivedTextSources = (atman.derivedTextSources || []).filter(
        (s) => s.bucket !== "karmicThreads",
      );
      return next;
    case "contradictions":
      next.contradictedPatterns = [];
      next.derivedTextSources = (atman.derivedTextSources || []).filter(
        (s) => s.bucket !== "contradictedPatterns",
      );
      return next;
  }
}

const SUMMARY_SCAN_LIMIT = 200;

export const AtmanMemoryControls = {
  /** Pause/resume automatic memory. The server skips extraction while paused. */
  async setMemoryPaused(userId: string, paused: boolean) {
    await updateDoc(doc(db, "users", userId), { memoryPaused: paused });
  },

  async forgetItem(userId: string, ref: MemoryItemRef) {
    await editAtman(userId, (atman) => removeItem(atman, ref));
  },

  async clearGroup(userId: string, group: MemoryGroup) {
    await editAtman(userId, (atman) => clearGroup(atman, group));
  },

  /** Recent chats that carry an AI-written summary. */
  async listChatSummaries(userId: string) {
    const snap = await getDocs(
      query(
        collection(db, "users", userId, "chats"),
        orderBy("lastUpdatedAt", "desc"),
        limit(SUMMARY_SCAN_LIMIT),
      ),
    );
    return snap.docs
      .filter((d) => typeof d.data().summary === "string" && d.data().summary)
      .map((d) => ({
        chatId: d.id,
        title: (d.data().title as string) || "Untitled conversation",
        summary: d.data().summary as string,
        updatedAt: toMillis(d.data().lastUpdatedAt) || null,
      }));
  },

  async deleteChatSummary(userId: string, chatId: string) {
    await updateDoc(doc(db, "users", userId, "chats", chatId), {
      summary: deleteField(),
    });
  },

  async clearAllChatSummaries(userId: string) {
    // Scan every chat (not just recent ones) so no summary is left behind.
    const snap = await getDocs(collection(db, "users", userId, "chats"));
    const withSummary = snap.docs.filter((d) => d.data().summary !== undefined);
    for (let i = 0; i < withSummary.length; i += 400) {
      const batch = writeBatch(db);
      withSummary
        .slice(i, i + 400)
        .forEach((d) => batch.update(d.ref, { summary: deleteField() }));
      await batch.commit();
    }
  },

  /**
   * Forget everything learned from conversations. Keeps things the user
   * set themselves (meditation streak, practice preference, today's
   * intention/gratitude). Also asks the server to purge the stored Gemini
   * interactions behind those conversations; that step runs after the local
   * memory is cleared and its failure is surfaced (thrown) to the caller.
   */
  async forgetEverything(userId: string) {
    // memoryResetAt is stamped in the SAME transaction as the clear: any
    // post-processing job requested before this moment drops its write
    // instead of quietly bringing the forgotten memory back. The server
    // (/api/memory/forget-all) stamps it again.
    await editAtman(userId, (atman) => {
      let next = clearEmotionalMemory(atman);
      for (const group of [
        "patterns",
        "events",
        "people",
        "routines",
        "advice",
        "notes",
        "karmicThreads",
        "contradictions",
      ] as MemoryGroup[]) {
        next = clearGroup(next, group);
      }
      next.nudgeHistory = [];
      next.derivedTextSources = [];
      return next;
    }, { memoryResetAt: serverTimestamp() });
    await AtmanMemoryControls.clearAllChatSummaries(userId);
    const res = await postJson("/api/memory/forget-all");
    if (!res.ok) {
      throw new Error(`Stored conversation data purge failed (${res.status})`);
    }
  },
};
