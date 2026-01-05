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
