import {
    ATMAN_SCHEMA_VERSION,
    AtmanAdviceEntry,
    AtmanData,
    AtmanEmotion,
    AtmanEmotionalHistoryEntry,
    AtmanMemoryEvidence,
    AtmanMemoryLedgerEntry,
    AtmanNudgeEntry,
    KeyRelationship,
    UserLifeEvent,
    UserRoutine,
    WeightedPattern,
} from "../types/user.js";

const EMOTIONAL_STATES: AtmanEmotion[] = [
    "stable",
    "anxious",
    "chaotic",
    "depressive",
    "energetic",
    "spiritual",
    "reactive",
];

const LIFE_EVENT_STATUSES: UserLifeEvent["status"][] = ["pending", "completed", "cancelled"];
const LIFE_EVENT_CATEGORIES: UserLifeEvent["category"][] = [
    "career",
    "relationship",
    "health",
    "finance",
    "spiritual",
];
const RELATIONS: KeyRelationship["relation"][] = ["partner", "parent", "child", "boss", "friend"];
const RELATION_DYNAMICS: KeyRelationship["dynamic"][] = ["supportive", "conflict", "distant", "teacher"];
const ROUTINE_TYPES: UserRoutine["type"][] = ["morning", "evening", "habit"];
const ROUTINE_FREQUENCIES: UserRoutine["frequency"][] = ["daily", "weekly"];

export function createInitialAtmanData(now = new Date()): AtmanData {
    return {
        schemaVersion: ATMAN_SCHEMA_VERSION,
        emotionalState: "stable",
        lastEmotionalUpdate: now,
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
        memoryLedger: [],
        transient: {
            emotionalState: "stable",
            lastEmotionalUpdate: now,
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

export function normalizeAtmanData(atman?: Partial<AtmanData>, now = new Date()): AtmanData | undefined {
    if (!atman) return undefined;

    const emotionalState = isAtmanEmotionalState(atman.emotionalState)
        ? atman.emotionalState
        : isAtmanEmotionalState(atman.transient?.emotionalState)
            ? atman.transient.emotionalState
            : "stable";
    const lastEmotionalUpdate = coerceDate(
        atman.lastEmotionalUpdate || atman.transient?.lastEmotionalUpdate,
        now,
    );
    const emotionalHistory = normalizeEmotionalHistory(
        atman.emotionalHistory || atman.transient?.emotionalHistory || [],
        now,
    );
    const knownPatterns = normalizePatterns(atman.knownPatterns || atman.memory?.knownPatterns || [], now);
    const lifeEvents = normalizeLifeEvents(
        atman.lifeEvents || atman.activeEvents || atman.memory?.lifeEvents || [],
        now,
    );
    const keyRelationships = normalizeArray(atman.keyRelationships || atman.memory?.keyRelationships || []);
    const routines = normalizeArray(atman.routines || atman.memory?.routines || []);
    const savedAdvice = normalizeAdviceHistory(
        atman.savedAdvice || atman.adviceHistory || atman.memory?.savedAdvice || [],
    );
    const nudgeHistory = normalizeNudgeHistory(atman.nudgeHistory || atman.memory?.nudgeHistory || []);
    const memoryLedger = normalizeMemoryLedger(atman.memoryLedger || [], now);

    return {
        ...atman,
        schemaVersion: ATMAN_SCHEMA_VERSION,
        emotionalState,
        lastEmotionalUpdate,
        emotionalHistory,
        knownPatterns,
        activeEvents: lifeEvents,
        lifeEvents,
        meditationStreak: atman.meditationStreak || 0,
        mantraAffinity: atman.mantraAffinity || [],
        preferredPractice: atman.preferredPractice || "breathwork",
        keyRelationships,
        routines,
        adviceHistory: savedAdvice,
        savedAdvice,
        nudgeHistory,
        memoryLedger,
        transient: {
            emotionalState,
            lastEmotionalUpdate,
            emotionalHistory,
        },
        memory: {
            knownPatterns,
            lifeEvents,
            keyRelationships,
            routines,
            savedAdvice,
            nudgeHistory,
        },
    };
}

export function validateAtmanData(atman: Partial<AtmanData>): string[] {
    const errors: string[] = [];
    if (atman.schemaVersion !== ATMAN_SCHEMA_VERSION) {
        errors.push(`schemaVersion must be ${ATMAN_SCHEMA_VERSION}`);
    }
    if (!isAtmanEmotionalState(atman.emotionalState)) {
        errors.push("emotionalState is invalid");
    }
    if (atman.transient && !isAtmanEmotionalState(atman.transient.emotionalState)) {
        errors.push("transient.emotionalState is invalid");
    }
    if (!Array.isArray(atman.knownPatterns)) {
        errors.push("knownPatterns must be an array");
    }
    if (!Array.isArray(atman.activeEvents)) {
        errors.push("activeEvents must be an array");
    }
    if (atman.lifeEvents && !Array.isArray(atman.lifeEvents)) {
        errors.push("lifeEvents must be an array");
    }
    if (atman.memory) {
        if (!Array.isArray(atman.memory.knownPatterns)) errors.push("memory.knownPatterns must be an array");
        if (!Array.isArray(atman.memory.lifeEvents)) errors.push("memory.lifeEvents must be an array");
        if (!Array.isArray(atman.memory.keyRelationships)) errors.push("memory.keyRelationships must be an array");
        if (!Array.isArray(atman.memory.routines)) errors.push("memory.routines must be an array");
        if (!Array.isArray(atman.memory.savedAdvice)) errors.push("memory.savedAdvice must be an array");
    }
    if (atman.memoryLedger && !Array.isArray(atman.memoryLedger)) {
        errors.push("memoryLedger must be an array");
    }
    return errors;
}

export function validateAtmanEmotionalState(value: unknown): AtmanEmotion {
    if (isAtmanEmotionalState(value)) return value;
    throw new Error(`Invalid emotionalState: ${String(value)}`);
}

export function validateAtmanText(value: unknown, field: string, maxLength = 300): string {
    if (typeof value !== "string") {
        throw new Error(`${field} must be text`);
    }
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} is required`);
    }
    if (trimmed.length > maxLength) {
        throw new Error(`${field} must be ${maxLength} characters or less`);
    }
    return trimmed;
}

export function validatePatternText(value: unknown): string {
    return validateAtmanText(value, "pattern", 240);
}

export function validateLifeEventInput(event: Omit<UserLifeEvent, "id">): Omit<UserLifeEvent, "id"> {
    const rawStatus = event.status as UserLifeEvent["status"] | "active";
    const status = rawStatus === "active" ? "pending" : rawStatus;
    if (!LIFE_EVENT_STATUSES.includes(status)) {
        throw new Error(`Invalid life event status: ${String(event.status)}`);
    }
    if (!LIFE_EVENT_CATEGORIES.includes(event.category)) {
        throw new Error(`Invalid life event category: ${String(event.category)}`);
    }
    const confidence = Number(event.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        throw new Error("life event confidence must be between 0 and 1");
    }
    return {
        ...event,
        title: validateAtmanText(event.title, "lifeEvent.title", 120),
        status,
        confidence,
    };
}

export function validateRelationshipInput(relationship: Omit<KeyRelationship, "id">): Omit<KeyRelationship, "id"> {
    if (!RELATIONS.includes(relationship.relation)) {
        throw new Error(`Invalid relationship relation: ${String(relationship.relation)}`);
    }
    if (!RELATION_DYNAMICS.includes(relationship.dynamic)) {
        throw new Error(`Invalid relationship dynamic: ${String(relationship.dynamic)}`);
    }
    return {
        ...relationship,
        name: validateAtmanText(relationship.name, "relationship.name", 80),
        notes: relationship.notes ? validateAtmanText(relationship.notes, "relationship.notes", 500) : undefined,
        zodiacSign: relationship.zodiacSign
            ? validateAtmanText(relationship.zodiacSign, "relationship.zodiacSign", 40)
            : undefined,
    };
}

export function validateRoutineInput(
    routine: Omit<UserRoutine, "id" | "createdAt" | "streak" | "status">,
): Omit<UserRoutine, "id" | "createdAt" | "streak" | "status"> {
    if (!ROUTINE_TYPES.includes(routine.type)) {
        throw new Error(`Invalid routine type: ${String(routine.type)}`);
    }
    if (!ROUTINE_FREQUENCIES.includes(routine.frequency)) {
        throw new Error(`Invalid routine frequency: ${String(routine.frequency)}`);
    }
    if (!Number.isFinite(routine.durationMinutes) || routine.durationMinutes < 1 || routine.durationMinutes > 180) {
        throw new Error("routine.durationMinutes must be between 1 and 180");
    }
    return {
        ...routine,
        title: validateAtmanText(routine.title, "routine.title", 120),
        description: validateAtmanText(routine.description, "routine.description", 400),
        steps: routine.steps.map((step, index) => validateAtmanText(step, `routine.steps.${index}`, 240)).slice(0, 10),
    };
}

export function validateAdviceInput(advice: { advice: string; context: string }): { advice: string; context: string } {
    return {
        advice: validateAtmanText(advice.advice, "advice", 500),
        context: validateAtmanText(advice.context, "advice.context", 160),
    };
}

export function validateNudgeInput(nudge: { title: string; message: string; triggerType: string }) {
    return {
        title: validateAtmanText(nudge.title, "nudge.title", 80),
        message: validateAtmanText(nudge.message, "nudge.message", 240),
        triggerType: validateAtmanText(nudge.triggerType, "nudge.triggerType", 80),
    };
}

function isAtmanEmotionalState(value: unknown): value is AtmanEmotion {
    return typeof value === "string" && EMOTIONAL_STATES.includes(value as AtmanEmotion);
}

function normalizePatterns(values: unknown[], now: Date): WeightedPattern[] {
    return values.map((value, index) => normalizePattern(value, index, now)).filter(Boolean) as WeightedPattern[];
}

function normalizePattern(value: unknown, index: number, now: Date): WeightedPattern | null {
    if (typeof value === "string") {
        const pattern = value.trim();
        if (!pattern) return null;
        return {
            id: `legacy_pattern_${index}`,
            pattern,
            frequency: 1,
            weightScore: 1,
            lastMentioned: now,
            verified: false,
        };
    }
    if (!value || typeof value !== "object") return null;
    const patternValue = value as Partial<WeightedPattern>;
    if (!patternValue.pattern) return null;
    return {
        id: patternValue.id || `pattern_${index}`,
        pattern: String(patternValue.pattern).trim(),
        frequency: normalizePositiveNumber(patternValue.frequency, 1),
        weightScore: clampNumber(patternValue.weightScore, 0.1, 5, 1),
        lastMentioned: coerceDate(patternValue.lastMentioned, now),
        verified: Boolean(patternValue.verified),
        category: patternValue.category,
        confidence: patternValue.confidence === undefined
            ? undefined
            : clampNumber(patternValue.confidence, 0, 1, 0.5),
        archived: Boolean(patternValue.archived),
        firstSeen: patternValue.firstSeen ? coerceDate(patternValue.firstSeen, now) : undefined,
        lastUsedAt: patternValue.lastUsedAt ? coerceDate(patternValue.lastUsedAt, now) : undefined,
        sourceCount: patternValue.sourceCount === undefined
            ? undefined
            : normalizePositiveNumber(patternValue.sourceCount, 1),
        evidence: normalizeEvidence(patternValue.evidence || [], now),
    };
}

function normalizeLifeEvents(values: unknown[], now: Date): UserLifeEvent[] {
    return values.map((value, index) => normalizeLifeEvent(value, index, now)).filter(Boolean) as UserLifeEvent[];
}

function normalizeLifeEvent(value: unknown, index: number, _now: Date): UserLifeEvent | null {
    if (!value || typeof value !== "object") return null;
    const event = value as Partial<UserLifeEvent> & { status?: string };
    if (!event.title) return null;
    const eventStatus = event.status as UserLifeEvent["status"] | "active" | undefined;
    const rawStatus = eventStatus === "active" ? "pending" : eventStatus;
    const status = LIFE_EVENT_STATUSES.includes(rawStatus as UserLifeEvent["status"])
        ? rawStatus as UserLifeEvent["status"]
        : "pending";
    const category = LIFE_EVENT_CATEGORIES.includes(event.category as UserLifeEvent["category"])
        ? event.category as UserLifeEvent["category"]
        : "spiritual";
    return {
        id: event.id || `life_event_${index}`,
        title: String(event.title).trim(),
        date: event.date ? coerceDate(event.date, new Date()) : undefined,
        status,
        category,
        confidence: clampNumber(event.confidence, 0, 1, 0.5),
        lastMentioned: event.lastMentioned ? coerceDate(event.lastMentioned, new Date()) : undefined,
        evidence: normalizeEvidence(event.evidence || [], new Date()),
    };
}

function normalizeEmotionalHistory(values: unknown[], now: Date): AtmanEmotionalHistoryEntry[] {
    return values
        .map((value) => {
            if (!value || typeof value !== "object") return null;
            const entry = value as { state?: unknown; date?: unknown };
            if (!isAtmanEmotionalState(entry.state)) return null;
            return { state: entry.state, date: coerceDate(entry.date, now) };
        })
        .filter(Boolean) as AtmanEmotionalHistoryEntry[];
}

function normalizeAdviceHistory(values: unknown[]): AtmanAdviceEntry[] {
    return values
        .map((value) => {
            if (!value || typeof value !== "object") return null;
            const advice = value as Partial<AtmanAdviceEntry>;
            if (!advice.advice || !advice.context || !advice.date) return null;
            return {
                advice: String(advice.advice).trim(),
                context: String(advice.context).trim(),
                date: String(advice.date),
                followedUp: Boolean(advice.followedUp),
            };
        })
        .filter(Boolean) as AtmanAdviceEntry[];
}

function normalizeNudgeHistory(values: unknown[]): AtmanNudgeEntry[] {
    return values
        .map((value) => {
            if (!value || typeof value !== "object") return null;
            const nudge = value as Partial<AtmanNudgeEntry>;
            if (!nudge.title || !nudge.message || !nudge.triggerType || !nudge.date) return null;
            return {
                title: String(nudge.title).trim(),
                message: String(nudge.message).trim(),
                triggerType: String(nudge.triggerType).trim(),
                date: String(nudge.date),
            };
        })
        .filter(Boolean) as AtmanNudgeEntry[];
}

function normalizeEvidence(values: unknown[], now: Date): AtmanMemoryEvidence[] {
    return values
        .map((value, index) => {
            if (!value || typeof value !== "object") return null;
            const evidence = value as Partial<AtmanMemoryEvidence>;
            if (!evidence.surface || !evidence.createdAt) return null;
            return {
                id: evidence.id || `evidence_${index}`,
                surface: evidence.surface,
                createdAt: coerceDate(evidence.createdAt, now),
                sessionId: evidence.sessionId,
                interactionId: evidence.interactionId,
                personaId: evidence.personaId,
                messageExcerpt: evidence.messageExcerpt,
                confidence: evidence.confidence === undefined
                    ? undefined
                    : clampNumber(evidence.confidence, 0, 1, 0.5),
            };
        })
        .filter(Boolean) as AtmanMemoryEvidence[];
}

function normalizeMemoryLedger(values: unknown[], now: Date): AtmanMemoryLedgerEntry[] {
    return values
        .map((value, index) => {
            if (!value || typeof value !== "object") return null;
            const entry = value as Partial<AtmanMemoryLedgerEntry>;
            if (!entry.surface || !entry.createdAt) return null;
            return {
                id: entry.id || `memory_ledger_${index}`,
                surface: entry.surface,
                createdAt: coerceDate(entry.createdAt, now),
                sessionId: entry.sessionId,
                interactionId: entry.interactionId,
                personaId: entry.personaId,
                messageExcerpt: entry.messageExcerpt,
                confidence: entry.confidence === undefined
                    ? undefined
                    : clampNumber(entry.confidence, 0, 1, 0.5),
                emotionalState: isAtmanEmotionalState(entry.emotionalState) ? entry.emotionalState : undefined,
                patternsAdded: normalizeNonNegativeNumber(entry.patternsAdded, 0),
                eventsAdded: normalizeNonNegativeNumber(entry.eventsAdded, 0),
                adviceSaved: normalizeNonNegativeNumber(entry.adviceSaved, 0),
                contradictionsDetected: normalizeNonNegativeNumber(entry.contradictionsDetected, 0),
                karmicThreadsDetected: normalizeNonNegativeNumber(entry.karmicThreadsDetected, 0),
            };
        })
        .filter(Boolean) as AtmanMemoryLedgerEntry[];
}

function normalizeArray<T>(value: T[] | undefined): T[] {
    return Array.isArray(value) ? value : [];
}

function coerceDate(value: unknown, fallback: Date): Date {
    if (value instanceof Date) return value;
    if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
        return value.toDate();
    }
    if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return fallback;
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.max(min, Math.min(max, numberValue));
}
