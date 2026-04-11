/**
 * useUserProfile Hook - Centralized user data access
 * Prevents duplicate Firestore queries across components.
 *
 * Data priority: Firestore (authoritative) > localStorage (backup)
 */

import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { STORAGE_KEYS } from '../lib/constants';
import type { UserProfile, BirthData } from '../types';

interface UseUserProfileResult {
    profile: UserProfile | null;
    birthData: BirthData | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

/**
 * Extract a UserProfile from a Firestore document's raw data.
 * Handles both nested (data.profile.*) and flat (data.*) structures,
 * and always merges root-level credits/subscription.
 */
function extractProfile(data: Record<string, any>): UserProfile | null {
    // Primary: nested under "profile" key (standard write path)
    const nested = data.profile;
    // Fallback: flat structure at root
    const profile: UserProfile = nested && nested.dob ? { ...nested } : {
        name: data.name,
        dob: data.dob,
        tob: data.tob,
        pob: data.pob,
        gender: data.gender,
        currentLocation: data.currentLocation,
        coordinates: data.coordinates,
    };

    // If we still have no dob, profile is incomplete
    if (!profile.dob) return null;

    // Root-level credits/subscription always take priority (written by AuthContext)
    if (data.credits !== undefined) profile.credits = data.credits;
    if (data.subscription !== undefined) profile.subscription = data.subscription;

    return profile;
}

export function useUserProfile(): UseUserProfileResult {
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = async () => {
        if (!user) {
            setProfile(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const extracted = extractProfile(docSnap.data());
                setProfile(extracted);

                // Sync to localStorage as backup so pages work during offline/reload
                if (extracted) {
                    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(extracted));
                    localStorage.setItem(STORAGE_KEYS.PROFILE_COMPLETE, 'true');
                }
            } else {
                setProfile(null);
            }
        } catch (err: any) {
            console.error('Error fetching user profile:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Subscribe to real-time updates
    useEffect(() => {
        if (!user) {
            setProfile(null);
            setLoading(false);
            return;
        }

        const docRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const extracted = extractProfile(docSnap.data());
                setProfile(extracted);

                // Keep localStorage in sync as backup
                if (extracted) {
                    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(extracted));
                    localStorage.setItem(STORAGE_KEYS.PROFILE_COMPLETE, 'true');
                }
            } else {
                setProfile(null);
            }
            setLoading(false);
        }, (err) => {
            console.error('Profile subscription error:', err);
            setError(err.message);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Extract birthData from profile for convenience
    const birthData: BirthData | null = useMemo(() => profile?.dob ? {
        name: profile.name,
        dob: profile.dob,
        tob: profile.tob,
        pob: profile.pob,
        gender: profile.gender as any,
        coordinates: profile.coordinates,
    } : null, [profile]);

    return {
        profile,
        birthData,
        loading,
        error,
        refetch: fetchProfile,
    };
}
