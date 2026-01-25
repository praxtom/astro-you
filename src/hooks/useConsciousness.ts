import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types/user';
import { AtmanService } from '../lib/atman';

export function useConsciousness() {
    const { user } = useAuth();
    const [atmanState, setAtmanState] = useState<UserProfile['atman'] | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setAtmanState(undefined);
            setLoading(false);
            return;
        }

        // Initialize Atman if missing
        AtmanService.initializeAtman(user.uid);
        // Apply weight decay periodically
        AtmanService.calculatePatternDecay(user.uid);

        // Real-time listener for consciousness updates
        const unsub = onSnapshot(doc(db, "users", user.uid), (doc) => {
            if (doc.exists()) {
                const userData = doc.data() as UserProfile;
                setAtmanState(userData.atman || undefined);
            }
            setLoading(false);
        });

        return () => unsub();
    }, [user]);

    // Manual refresh function
    const refreshAtman = useCallback(async () => {
        if (!user) return;
        try {
            const docSnap = await getDoc(doc(db, "users", user.uid));
            if (docSnap.exists()) {
                const userData = docSnap.data() as UserProfile;
                setAtmanState(userData.atman || undefined);
            }
        } catch (error) {
            console.error('[useConsciousness] Failed to refresh:', error);
        }
    }, [user]);

    return {
        atmanState,
        loading,
        refreshAtman,
        isAnxious: atmanState?.emotionalState === 'anxious',
        isChaotic: atmanState?.emotionalState === 'chaotic',
        isReactive: atmanState?.emotionalState === 'reactive',
        activeEvents: atmanState?.activeEvents || []
    };
}

