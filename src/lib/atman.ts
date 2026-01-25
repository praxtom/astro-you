import {
    doc,
    updateDoc,
    arrayUnion,
    Timestamp,
    getDoc
} from "firebase/firestore";
import { db } from "./firebase";
import { UserLifeEvent, AtmanData, UserRoutine, KeyRelationship } from "../types/user";

/**
 * The "Atman" Service - Handles User Consciousness & Memory
 */

// Define the shape of a User Insight
export interface UserInsight {
    id: string;
    type: 'pattern' | 'event' | 'preference' | 'emotional_state' | 'relationship';
    content: string;
    confidence: number; // 0 to 1
    detectedAt: Date;
    lastVerified?: Date;
}

export const AtmanService = {

    /**
     * Update the user's emotional state based on chat analysis
     */
    async updateEmotionalState(userId: string, state: AtmanData['emotionalState']) {
        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
                "atman.emotionalState": state,
                "atman.lastEmotionalUpdate": Timestamp.now()
            });
            console.log(`[Atman] Updated emotional state to: ${state}`);
        } catch (error) {
            console.error("[Atman] Failed to update emotional state:", error);
        }
    },

    /**
     * Add or update a discovered pattern in the user's memory (weighted)
     */
    async addPattern(userId: string, patternText: string) {
        try {
            const userRef = doc(db, "users", userId);
            const docSnap = await getDoc(userRef);

            if (docSnap.exists()) {
                const atman = docSnap.data().atman as AtmanData;
                const existingPatterns = atman.knownPatterns || [];

                const existingIndex = existingPatterns.findIndex(p =>
                    typeof p === 'string' ? p === patternText : p.pattern === patternText
                );

                if (existingIndex > -1) {
                    // Update existing
                    const p = existingPatterns[existingIndex];
                    const updatedPatterns = [...existingPatterns];

                    if (typeof p === 'string') {
                        // Migrate legacy string pattern
                        updatedPatterns[existingIndex] = {
                            id: Math.random().toString(36).substring(7),
                            pattern: p,
                            frequency: 2,
                            weightScore: 1.0,
                            lastMentioned: new Date(),
                            verified: false
                        };
                    } else {
                        updatedPatterns[existingIndex] = {
                            ...p,
                            frequency: p.frequency + 1,
                            lastMentioned: new Date(),
                            // Weight increases with frequency but caps or scales
                            weightScore: Math.min(5.0, p.weightScore + 0.5)
                        };
                    }
                    await updateDoc(userRef, { "atman.knownPatterns": updatedPatterns });
                } else {
                    // Create new
                    const newPattern = {
                        id: Math.random().toString(36).substring(7),
                        pattern: patternText,
                        frequency: 1,
                        weightScore: 1.0,
                        lastMentioned: new Date(),
                        verified: false
                    };
                    await updateDoc(userRef, {
                        "atman.knownPatterns": arrayUnion(newPattern)
                    });
                }
                console.log(`[Atman] Updated pattern weight: ${patternText}`);
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
                const atman = docSnap.data().atman as AtmanData;
                const updatedPatterns = (atman.knownPatterns || []).map(p => {
                    if (typeof p !== 'string' && p.id === patternId) {
                        return { ...p, verified: true, weightScore: 5.0 }; // Max weight for verified
                    }
                    return p;
                });
                await updateDoc(userRef, { "atman.knownPatterns": updatedPatterns });
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
                const atman = docSnap.data().atman as AtmanData;
                const updatedPatterns = (atman.knownPatterns || []).filter(p => {
                    if (typeof p === 'string') return true; // Keep legacy for manual cleanup or migration
                    return p.id !== patternId;
                });
                await updateDoc(userRef, { "atman.knownPatterns": updatedPatterns });
            }
        } catch (error) {
            console.error("[Atman] Failed to dismiss pattern:", error);
        }
    },

    /**
     * Track a new life event (e.g., "Job Interview")
     */
    async addLifeEvent(userId: string, event: Omit<UserLifeEvent, 'id'>) {
        try {
            const userRef = doc(db, "users", userId);
            const newEvent: UserLifeEvent = {
                ...event,
                id: Math.random().toString(36).substring(7),
            };

            await updateDoc(userRef, {
                "atman.activeEvents": arrayUnion(newEvent)
            });
            console.log(`[Atman] Added life event: ${event.title}`);
        } catch (error) {
            console.error("[Atman] Failed to add life event:", error);
        }
    },

    /**
     * Add a key relationship to the user's graph
     */
    async addRelationship(userId: string, relationship: Omit<KeyRelationship, 'id'>) {
        try {
            const userRef = doc(db, "users", userId);
            const newRel = {
                ...relationship,
                id: Math.random().toString(36).substring(7)
            };

            await updateDoc(userRef, {
                "atman.keyRelationships": arrayUnion(newRel)
            });
            console.log(`[Atman] Added relationship: ${relationship.name}`);
            return newRel;
        } catch (error) {
            console.error("[Atman] Failed to add relationship:", error);
            return null;
        }
    },

    /**
     * Update an existing relationship
     */
    async updateRelationship(userId: string, relId: string, updates: Partial<KeyRelationship>) {
        try {
            const userRef = doc(db, "users", userId);
            const docSnap = await getDoc(userRef);

            if (docSnap.exists()) {
                const atman = docSnap.data().atman as AtmanData;
                const updatedRels = (atman.keyRelationships || []).map(r => {
                    if (r.id === relId) {
                        return { ...r, ...updates };
                    }
                    return r;
                });
                await updateDoc(userRef, { "atman.keyRelationships": updatedRels });
                console.log(`[Atman] Updated relationship: ${relId}`);
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
                const atman = docSnap.data().atman as AtmanData;
                const updatedRels = (atman.keyRelationships || []).filter(r => r.id !== relId);
                await updateDoc(userRef, { "atman.keyRelationships": updatedRels });
                console.log(`[Atman] Deleted relationship: ${relId}`);
            }
        } catch (error) {
            console.error("[Atman] Failed to delete relationship:", error);
        }
    },

    /**
     * Add a new Dharma Routine
     */
    async addRoutine(userId: string, routine: Omit<UserRoutine, 'id' | 'createdAt' | 'streak' | 'status'>) {
        try {
            const userRef = doc(db, "users", userId);
            const newRoutine: UserRoutine = {
                ...routine,
                id: Math.random().toString(36).substring(7),
                createdAt: new Date(),
                status: 'active',
                streak: 0
            };

            await updateDoc(userRef, {
                "atman.routines": arrayUnion(newRoutine)
            });
            console.log(`[Atman] Added routine: ${routine.title}`);
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
                const atman = docSnap.data().atman as AtmanData;
                if (!atman.routines) return;

                const updatedRoutines = atman.routines.map(r => {
                    if (r.id === routineId) {
                        return {
                            ...r,
                            streak: (r.streak || 0) + 1,
                            lastCompletedAt: new Date()
                        };
                    }
                    return r;
                });

                await updateDoc(userRef, { "atman.routines": updatedRoutines });
                console.log(`[Atman] Completed routine: ${routineId}`);
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
                updates["atman.emotionalState"] = result.emotionalState;
                updates["atman.lastEmotionalUpdate"] = Timestamp.now();

                // Track Emotional History for Trend Analysis
                const userRef = doc(db, "users", userId);
                const docSnap = await getDoc(userRef);
                if (docSnap.exists()) {
                    const atman = docSnap.data().atman as AtmanData;
                    const history = atman.emotionalHistory || [];
                    const newEntry = { state: result.emotionalState, date: new Date() };

                    // Keep last 30 entries
                    const updatedHistory = [...history, newEntry].slice(-30);
                    updates["atman.emotionalHistory"] = updatedHistory;
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
                    id: Math.random().toString(36).substring(7),
                    title: e.title,
                    category: e.category,
                    date: new Date(),
                    status: 'active',
                    confidence: 0.8
                }));
                updates["atman.activeEvents"] = arrayUnion(...eventsToAdd);
            }

            // 4. Handle Contradictions
            if (result.detectedContradictions && result.detectedContradictions.length > 0) {
                updates["atman.contradictedPatterns"] = arrayUnion(...result.detectedContradictions);

                // Dispatch custom event for celebration toast
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('atman:growth-detected', {
                        detail: { contradictions: result.detectedContradictions }
                    }));
                }
            }

            // 5. Handle Karmic Threads (Level 4 Brain)
            if (result.karmicThreads && result.karmicThreads.length > 0) {
                updates["atman.karmicThreads"] = arrayUnion(...result.karmicThreads);
            }

            if (Object.keys(updates).length > 0) {
                const userRef = doc(db, "users", userId);
                await updateDoc(userRef, updates);
                console.log("[Atman] Processed analysis result:", updates);
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
                const atman = docSnap.data().atman as AtmanData;
                if (!atman.knownPatterns) return;

                const now = new Date();
                let hasChanges = false;

                const updatedPatterns = atman.knownPatterns.map(p => {
                    if (typeof p === 'string' || p.verified) return p;

                    const daysSinceLast = (now.getTime() - new Date(p.lastMentioned).getTime()) / (1000 * 60 * 60 * 24);

                    // Decay weight if not mentioned for > 7 days
                    if (daysSinceLast > 7) {
                        hasChanges = true;
                        return {
                            ...p,
                            weightScore: Math.max(0.1, p.weightScore - 0.1) // Linear decay for now
                        };
                    }
                    return p;
                });

                if (hasChanges) {
                    await updateDoc(userRef, { "atman.knownPatterns": updatedPatterns });
                    console.log("[Atman] Applied weight decay to patterns.");
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
            const today = new Date().toISOString().split('T')[0];

            await updateDoc(userRef, {
                "atman.dailyIntention": intention,
                "atman.dailyIntentionDate": today
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
            const today = new Date().toISOString().split('T')[0];

            await updateDoc(userRef, {
                "atman.dailyGratitude": gratitude,
                "atman.dailyGratitudeDate": today
            });
        } catch (error) {
            console.error("[Atman] Failed to set gratitude:", error);
        }
    },

    /**
     * Initialize Atman for a new user
     */
    async initializeAtman(userId: string) {
        try {
            const userRef = doc(db, "users", userId);
            const docSnap = await getDoc(userRef);

            if (docSnap.exists() && !docSnap.data().atman) {
                const initialAtman: AtmanData = {
                    emotionalState: 'stable',
                    lastEmotionalUpdate: new Date(),
                    knownPatterns: [],
                    activeEvents: [],
                    meditationStreak: 0,
                    mantraAffinity: [],
                    preferredPractice: 'breathwork',
                    keyRelationships: []
                };

                await updateDoc(userRef, {
                    atman: initialAtman
                });
                console.log("[Atman] Initialized consciousness for user.");
            }
        } catch (error) {
            console.error("[Atman] Initialization failed:", error);
        }
    }
};
