/**
 * User-related type definitions
 */

export interface BirthData {
    name: string;
    dob: string;       // YYYY-MM-DD
    tob: string;       // HH:MM (defaults to 12:00 if unknown)
    pob: string;       // Place of birth
    gender?: 'male' | 'female' | 'other';
    birthTimeUnknown?: boolean;  // True if user doesn't know exact birth time
    coordinates?: {
        lat: number;
        lng: number;
    };
}

export interface UserRoutine {
    id: string;
    title: string;          // "Morning Sun Salutation"
    description: string;    // Why this practice helps — 1-2 sentences
    steps: string[];        // Step-by-step instructions (3-5 steps)
    type: 'morning' | 'evening' | 'habit';
    durationMinutes: number;
    frequency: 'daily' | 'weekly';
    status: 'active' | 'paused';
    streak: number;
    lastCompletedAt?: Date;
    createdAt: Date;
}

export type AtmanMemorySurface = 'synthesis' | 'consult' | 'manual' | 'nudge' | 'digest' | 'feedback' | 'system';

export interface AtmanMemoryEvidence {
    id: string;
    surface: AtmanMemorySurface;
    createdAt: Date | string;
    sessionId?: string;
    interactionId?: string;
    personaId?: string;
    messageExcerpt?: string;
    confidence?: number;
}

export interface AtmanMemoryLedgerEntry extends AtmanMemoryEvidence {
    emotionalState?: AtmanEmotion;
    patternsAdded: number;
    eventsAdded: number;
    adviceSaved: number;
    contradictionsDetected: number;
    karmicThreadsDetected: number;
}

export interface WeightedPattern {
    id: string;
    pattern: string;
    frequency: number;
    weightScore: number;
    lastMentioned: Date;
    verified: boolean;
    category?: 'behavioral' | 'emotional' | 'spiritual' | 'relational';
    confidence?: number;
    archived?: boolean;
    firstSeen?: Date;
    lastUsedAt?: Date;
    sourceCount?: number;
    evidence?: AtmanMemoryEvidence[];
}

export interface KeyRelationship {
    id: string;
    name: string;
    relation: 'partner' | 'parent' | 'child' | 'boss' | 'friend';
    dynamic: 'supportive' | 'conflict' | 'distant' | 'teacher';
    zodiacSign?: string;
    notes?: string;
}

export const ATMAN_SCHEMA_VERSION = 1;

export type AtmanEmotion = 'stable' | 'anxious' | 'chaotic' | 'depressive' | 'energetic' | 'spiritual' | 'reactive';

export interface AtmanEmotionalHistoryEntry {
    state: AtmanEmotion;
    date: Date;
}

export interface AtmanAdviceEntry {
    advice: string;
    context: string;
    date: string;
    followedUp?: boolean;
}

export interface AtmanNudgeEntry {
    title: string;
    message: string;
    triggerType: string;
    date: string;
}

export interface AtmanTransientState {
    emotionalState: AtmanEmotion;
    lastEmotionalUpdate: Date;
    emotionalHistory: AtmanEmotionalHistoryEntry[];
}

export interface AtmanDurableMemory {
    knownPatterns: WeightedPattern[];
    lifeEvents: UserLifeEvent[];
    keyRelationships: KeyRelationship[];
    routines: UserRoutine[];
    savedAdvice: AtmanAdviceEntry[];
    nudgeHistory: AtmanNudgeEntry[];
}

export interface AtmanData {
    schemaVersion?: number;
    transient?: AtmanTransientState;
    memory?: AtmanDurableMemory;

    // 1. Core Emotional State (The Vibe)
    emotionalState: AtmanEmotion;
    lastEmotionalUpdate: Date;
    emotionalHistory?: AtmanEmotionalHistoryEntry[];

    // 2. The Life Context (The Story)
    activeEvents: UserLifeEvent[]; // Legacy alias used by current UI.
    lifeEvents?: UserLifeEvent[]; // Canonical bucket for new Atman schema.

    // 3. Psychological Profile (The Pattern)
    knownPatterns: WeightedPattern[]; // Enhanced from string[]
    contradictedPatterns?: string[]; // E.g., "Used to be anxious about money, now confident"
    karmicThreads?: string[]; // Connections across domains (Level 4 Brain)

    // 4. Spiritual Journey (The Sadhana) - NEW
    meditationStreak: number;
    mantraAffinity: string[]; // e.g., ["Om Namah Shivaya", "Gayatri"] - which ones they like
    preferredPractice: 'breathwork' | 'mantra' | 'silence' | 'movement';

    // 5. Bio-Rhythms (The Body) - NEW
    sleepPattern?: 'early_bird' | 'night_owl' | 'insomniac';
    energyLevels?: {
        morning: 'low' | 'high';
        evening: 'low' | 'high';
    };

    // 6. Relationship Graph (The Connections) - NEW
    keyRelationships?: KeyRelationship[];

    // 7. Dharma Routines (The Discipline) - NEW
    routines?: UserRoutine[];

    // 8. Daily Sadhana (The Altar) - NEW
    dailyIntention?: string; // "I will be calm today"
    dailyIntentionDate?: string; // YYYY-MM-DD

    dailyGratitude?: string; // "Thankful for the sun"
    dailyGratitudeDate?: string; // YYYY-MM-DD

    // 9. Guru Nudge History (The Whispers)
    nudgeHistory?: AtmanNudgeEntry[];

    // 10. Advice Ledger (The Counsel)
    adviceHistory?: AtmanAdviceEntry[];

    savedAdvice?: AtmanAdviceEntry[];

    // 11. Brain Audit Ledger (server-owned learning history)
    memoryLedger?: AtmanMemoryLedgerEntry[];

    // 12. Outcome Feedback
    predictionFeedbackStats?: {
        accurate: number;
        partly: number;
        missed: number;
        lastSignal?: 'accurate' | 'partly' | 'missed';
        lastSource?: string;
        updatedAt?: Date | string;
    };
}

export interface UserProfile {
    // Basic info
    name: string;
    email?: string;
    photoUrl?: string;

    // Birth data
    dob: string;
    tob: string;
    pob: string;
    gender?: string;
    birthTimeUnknown?: boolean;
    coordinates?: {
        lat: number;
        lng: number;
    };

    // Chart data
    chartUrl?: string;       // URL to stored chart PNG in Firebase Storage
    chartGeneratedAt?: Date; // When the chart was last generated

    // Computed from Kundali
    moonSign?: string;
    sunSign?: string;
    ascendant?: string | { sign?: string };

    // Settings
    language?: 'en' | 'hi' | 'ta' | 'te' | 'bn' | 'mr';
    timezone?: string;
    username?: string;
    bio?: string;
    isPublic?: boolean;

    // Subscription
    subscription?: SubscriptionData;
    credits?: number;

    // Notifications
    fcmToken?: string;
    notificationPrefs?: NotificationPrefs;

    // Atman (Consciousness) Data
    atman?: AtmanData;

    // Metadata
    createdAt?: Date;
    updatedAt?: Date;
    lastLoginAt?: Date;
}

export interface SubscriptionData {
    tier: 'free' | 'premium' | 'pro';
    status?: 'created' | 'active' | 'pending' | 'cancelling' | 'cancelled' | 'halted';
    expiresAt?: Date;
    razorpaySubId?: string;
    razorpaySubscriptionId?: string;
    planId?: string;
    priceInr?: number;
    currentStart?: Date | string;
    currentEnd?: Date | string;
    chargeAt?: Date | string | null;
    gracePeriodEnd?: Date | string;
    cancelRequestedAt?: Date | string;
    cancelledAt?: Date | string;
    cancelAtPeriodEnd?: boolean;
    autoRenew?: boolean;
}

export interface NotificationPrefs {
    enabled: boolean;
    dailyInsight: boolean;
    emailDigest?: boolean;
    pushBrainNudges?: boolean;
    transitAlerts: boolean;
    cosmicEvents: boolean;
    weeklyForecast: boolean;
    whatsappDigest?: boolean;
}

export interface UserLifeEvent {
    id: string;
    title: string; // e.g., "Job Interview"
    date?: Date;
    status: 'pending' | 'completed' | 'cancelled';
    category: 'career' | 'relationship' | 'health' | 'finance' | 'spiritual';
    confidence: number; // 0-1, how sure the AI is
    lastMentioned?: Date;
    evidence?: AtmanMemoryEvidence[];
}
