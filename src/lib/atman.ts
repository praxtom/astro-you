import {
  doc,
  updateDoc,
  arrayUnion,
  Timestamp,
  getDoc,
  runTransaction,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  writeBatch,
  deleteField,
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
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        const atman =
          normalizeAtmanData(docSnap.data().atman) || createInitialAtmanData();
        const existingPatterns = atman.knownPatterns || [];

        const existingIndex = existingPatterns.findIndex(
          (p) => p.pattern === safePatternText,
        );

        if (existingIndex > -1) {
          const p = existingPatterns[existingIndex];
          const updatedPatterns = [...existingPatterns];

          updatedPatterns[existingIndex] = {
            ...p,
            frequency: p.frequency + 1,
            lastMentioned: new Date(),
            weightScore: Math.min(5.0, p.weightScore + 0.5),
          };
          await updateDoc(userRef, {
            "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
            "atman.knownPatterns": updatedPatterns,
            "atman.memory.knownPatterns": updatedPatterns,
          });
        } else {
          const newPattern = {
            id: Math.random().toString(36).substring(7),
            pattern: safePatternText,
            frequency: 1,
            weightScore: 1.0,
            lastMentioned: new Date(),
            verified: false,
          };
          const updatedPatterns = [...existingPatterns, newPattern];
          await updateDoc(userRef, {
            "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
            "atman.knownPatterns": updatedPatterns,
            "atman.memory.knownPatterns": updatedPatterns,
          });
        }
        devLog(`[Atman] Updated pattern weight: ${safePatternText}`);
      }
    } catch (error) {
      console.error("[Atman] Failed to add pattern:", error);
    }
  },

  /**
   * Verify a pattern (User confirms it's accurate)
   */
  async verifyPattern(userId: string, patternId: string) {
    try {
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        const atman =
          normalizeAtmanData(docSnap.data().atman) || createInitialAtmanData();
        const updatedPatterns = (atman.knownPatterns || []).map((p) => {
          if (p.id === patternId) {
            return { ...p, verified: true, archived: false, weightScore: 5.0 }; // Max weight for verified
          }
          return p;
        });
        await updateDoc(userRef, {
          "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
          "atman.knownPatterns": updatedPatterns,
          "atman.memory.knownPatterns": updatedPatterns,
        });
      }
    } catch (error) {
      console.error("[Atman] Failed to verify pattern:", error);
    }
  },

  /**
   * Dismiss a pattern (User says it's not accurate)
   */
  async dismissPattern(userId: string, patternId: string) {
    try {
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        const atman =
          normalizeAtmanData(docSnap.data().atman) || createInitialAtmanData();
        const updatedPatterns = (atman.knownPatterns || []).filter(
          (p) => p.id !== patternId,
        );
        await updateDoc(userRef, {
          "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
          "atman.knownPatterns": updatedPatterns,
          "atman.memory.knownPatterns": updatedPatterns,
        });
      }
    } catch (error) {
      console.error("[Atman] Failed to dismiss pattern:", error);
    }
  },

  /**
   * Track a new life event (e.g., "Job Interview")
   */
  async addLifeEvent(userId: string, event: Omit<UserLifeEvent, "id">) {
    try {
      const userRef = doc(db, "users", userId);
      const safeEvent = validateLifeEventInput(event);
      const newEvent: UserLifeEvent = {
        ...safeEvent,
        id: Math.random().toString(36).substring(7),
      };

      await updateDoc(userRef, {
        "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
        "atman.activeEvents": arrayUnion(newEvent),
        "atman.lifeEvents": arrayUnion(newEvent),
        "atman.memory.lifeEvents": arrayUnion(newEvent),
      });
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
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) return;

      const atman =
        normalizeAtmanData(docSnap.data().atman) || createInitialAtmanData();
      const updatedEvents = atman.activeEvents.map((event) =>
        event.id === eventId ? { ...event, status: safeStatus } : event,
      );

      await updateDoc(userRef, {
        "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
        "atman.activeEvents": updatedEvents,
        "atman.lifeEvents": updatedEvents,
        "atman.memory.lifeEvents": updatedEvents,
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
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        const atman =
          normalizeAtmanData(docSnap.data().atman) || createInitialAtmanData();
        const updatedRels = (atman.keyRelationships || []).map((r) => {
          if (r.id === relId) {
            return {
              ...validateRelationshipInput({ ...r, ...updates }),
              id: r.id,
            };
          }
          return r;
        });
        await updateDoc(userRef, {
          "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
          "atman.keyRelationships": updatedRels,
          "atman.memory.keyRelationships": updatedRels,
        });
        devLog(`[Atman] Updated relationship: ${relId}`);
      }
    } catch (error) {
      console.error("[Atman] Failed to update relationship:", error);
    }
  },

  /**
   * Remove a relationship from the graph
   */
  async deleteRelationship(userId: string, relId: string) {
    try {
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        const atman =
          normalizeAtmanData(docSnap.data().atman) || createInitialAtmanData();
        const updatedRels = (atman.keyRelationships || []).filter(
          (r) => r.id !== relId,
        );
        await updateDoc(userRef, {
          "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
          "atman.keyRelationships": updatedRels,
          "atman.memory.keyRelationships": updatedRels,
        });
        devLog(`[Atman] Deleted relationship: ${relId}`);
      }
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
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        const atman =
          normalizeAtmanData(docSnap.data().atman) || createInitialAtmanData();
        if (!atman.routines) return;

        const updatedRoutines = atman.routines.map((r) => {
          if (r.id === routineId) {
            return {
              ...r,
              streak: (r.streak || 0) + 1,
              lastCompletedAt: new Date(),
            };
          }
          return r;
        });

        await updateDoc(userRef, {
          "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
          "atman.routines": updatedRoutines,
          "atman.memory.routines": updatedRoutines,
        });
        devLog(`[Atman] Completed routine: ${routineId}`);
      }
    } catch (error) {
      console.error("[Atman] Failed to complete routine:", error);
    }
  },

  /**
   * Process analysis results from the AI
   */
  async processAnalysisResult(userId: string, result: any) {
    if (!result) return;

    try {
      const updates: any = {};

      // 1. Update Emotional State if changed
      if (result.emotionalState) {
        const emotionalState = validateAtmanEmotionalState(
          result.emotionalState,
        );
        const updatedAt = Timestamp.now();
        updates["atman.schemaVersion"] = ATMAN_SCHEMA_VERSION;
        updates["atman.emotionalState"] = emotionalState;
        updates["atman.lastEmotionalUpdate"] = updatedAt;
        updates["atman.transient.emotionalState"] = emotionalState;
        updates["atman.transient.lastEmotionalUpdate"] = updatedAt;

        // Track Emotional History for Trend Analysis
        const userRef = doc(db, "users", userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          const atman =
            normalizeAtmanData(docSnap.data().atman) ||
            createInitialAtmanData();
          const history = atman.emotionalHistory || [];
          const newEntry = { state: emotionalState, date: new Date() };

          // Keep last 30 entries
          const updatedHistory = [...history, newEntry].slice(-30);
          updates["atman.emotionalHistory"] = updatedHistory;
          updates["atman.transient.emotionalHistory"] = updatedHistory;
        }
      }

      // 2. Add/Update Patterns (Weighted)
      if (result.newPatterns && result.newPatterns.length > 0) {
        // Process each pattern sequentially to handle updates vs adds
        for (const patternText of result.newPatterns) {
          await this.addPattern(userId, patternText);
        }
      }

      // 3. Add New Events
      if (result.newEvents && result.newEvents.length > 0) {
        const eventsToAdd = result.newEvents.map((e: any) => ({
          ...validateLifeEventInput({
            title: e.title,
            category: e.category,
            date: new Date(),
            status: "pending",
            confidence: 0.8,
          }),
          id: Math.random().toString(36).substring(7),
        }));
        updates["atman.activeEvents"] = arrayUnion(...eventsToAdd);
        updates["atman.lifeEvents"] = arrayUnion(...eventsToAdd);
        updates["atman.memory.lifeEvents"] = arrayUnion(...eventsToAdd);
      }

      // 4. Handle Contradictions
      if (
        result.detectedContradictions &&
        result.detectedContradictions.length > 0
      ) {
        updates["atman.contradictedPatterns"] = arrayUnion(
          ...result.detectedContradictions,
        );

        // Dispatch custom event for celebration toast
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("atman:growth-detected", {
              detail: { contradictions: result.detectedContradictions },
            }),
          );
        }
      }

      // 5. Handle Karmic Threads (Level 4 Brain)
      if (result.karmicThreads && result.karmicThreads.length > 0) {
        updates["atman.karmicThreads"] = arrayUnion(...result.karmicThreads);
      }

      if (Object.keys(updates).length > 0) {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, updates);
        devLog("[Atman] Processed analysis result:", updates);
      }
    } catch (error) {
      console.error("[Atman] Failed to process analysis:", error);
    }
  },

  /**
   * Periodically decay pattern weights (e.g., call during initialization or refresh)
   */
  async calculatePatternDecay(userId: string) {
    try {
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        const atman =
          normalizeAtmanData(docSnap.data().atman) || createInitialAtmanData();
        if (!atman.knownPatterns) return;

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

        if (hasChanges) {
          await updateDoc(userRef, {
            "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
            "atman.knownPatterns": updatedPatterns,
            "atman.memory.knownPatterns": updatedPatterns,
          });
          devLog("[Atman] Applied weight decay to patterns.");
        }
      }
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
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) return;

      const safeAdvice = validateAdviceInput(advice);
      const atman =
        normalizeAtmanData(docSnap.data().atman) || createInitialAtmanData();
      const history = atman?.adviceHistory || [];

      const updated = [
        ...history.slice(-19),
        { ...safeAdvice, date: new Date().toISOString(), followedUp: false },
      ];

      await updateDoc(userRef, {
        "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
        "atman.adviceHistory": updated,
        "atman.savedAdvice": updated,
        "atman.memory.savedAdvice": updated,
      });
      devLog(
        `[Atman] Saved advice: ${safeAdvice.advice.substring(0, 50)}...`,
      );
    } catch (error) {
      console.error("[Atman] Failed to save advice:", error);
    }
  },

  /**
   * Save a Guru Nudge to history (keeps last 20)
   */
  async saveNudge(
    userId: string,
    nudge: { title: string; message: string; triggerType: string },
  ) {
    try {
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) return;

      const safeNudge = validateNudgeInput(nudge);
      const atman =
        normalizeAtmanData(docSnap.data().atman) || createInitialAtmanData();
      const history = atman?.nudgeHistory || [];

      // Keep last 20 nudges
      const updated = [
        ...history.slice(-19),
        { ...safeNudge, date: new Date().toISOString() },
      ];

      await updateDoc(userRef, {
        "atman.schemaVersion": ATMAN_SCHEMA_VERSION,
        "atman.nudgeHistory": updated,
        "atman.memory.nudgeHistory": updated,
      });
    } catch (error) {
      console.error("[Atman] Failed to save nudge:", error);
    }
  },

  /**
   * Initialize Atman for a new user
   */
  async initializeAtman(userId: string) {
    try {
      const userRef = doc(db, "users", userId);
      const docSnap = await getDoc(userRef);

      if (!docSnap.exists()) return;

      const existingAtman = docSnap.data().atman as AtmanData | undefined;
      if (!existingAtman) {
        await updateDoc(userRef, {
          atman: createInitialAtmanData(),
        });
        devLog("[Atman] Initialized consciousness for user.");
        return;
      }

      if (existingAtman.schemaVersion !== ATMAN_SCHEMA_VERSION) {
        await updateDoc(userRef, {
          atman: normalizeAtmanData(existingAtman),
        });
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
    tx.update(userRef, { atman: stripUndefined(next) });
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
    });
    await AtmanMemoryControls.clearAllChatSummaries(userId);
    const res = await postJson("/api/memory/forget-all");
    if (!res.ok) {
      throw new Error(`Stored conversation data purge failed (${res.status})`);
    }
  },
};
