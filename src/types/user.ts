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
    type: 'morning' | 'evening' | 'habit';
    durationMinutes: number;
    frequency: 'daily' | 'weekly';
    status: 'active' | 'paused';
    streak: number;
    lastCompletedAt?: Date;
    createdAt: Date;
}

export interface WeightedPattern {
    id: string;
    pattern: string;
    frequency: number;
    weightScore: number;
    lastMentioned: Date;
    verified: boolean;
    category?: 'behavioral' | 'emotional' | 'spiritual' | 'relational';
}

export interface KeyRelationship {
    id: string;
    name: string;
    relation: 'partner' | 'parent' | 'child' | 'boss' | 'friend';
    dynamic: 'supportive' | 'conflict' | 'distant' | 'teacher';
    zodiacSign?: string;
    notes?: string;
}

export interface AtmanData {
    // 1. Core Emotional State (The Vibe)
    emotionalState: 'stable' | 'anxious' | 'chaotic' | 'depressive' | 'energetic' | 'spiritual' | 'reactive';
    lastEmotionalUpdate: Date;
    emotionalHistory?: Array<{ state: string; date: Date }>;

    // 2. The Life Context (The Story)
    activeEvents: UserLifeEvent[]; // "Interview on Friday"

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
    ascendant?: string;

    // Settings
    language?: 'en' | 'hi' | 'ta' | 'te' | 'bn' | 'mr';
    timezone?: string;

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
    expiresAt?: Date;
    razorpaySubId?: string;
    autoRenew?: boolean;
}

export interface NotificationPrefs {
    enabled: boolean;
    dailyInsight: boolean;
    transitAlerts: boolean;
    cosmicEvents: boolean;
    weeklyForecast: boolean;
}

export interface UserLifeEvent {
    id: string;
    title: string; // e.g., "Job Interview"
    date?: Date;
    status: 'pending' | 'completed' | 'cancelled';
    category: 'career' | 'relationship' | 'health' | 'finance' | 'spiritual';
    confidence: number; // 0-1, how sure the AI is
}
