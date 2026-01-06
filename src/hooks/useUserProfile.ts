/**
 * useUserProfile Hook - Centralized user data access
 * Prevents duplicate Firestore queries across components
 */

import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import type { UserProfile, BirthData } from '../types';

interface UseUserProfileResult {
    profile: UserProfile | null;
    birthData: BirthData | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
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
                const data = docSnap.data();

                // Handle both flat and nested profile structures
                const profileData: UserProfile = data.profile || {
                    name: data.name,
                    dob: data.dob,
                    tob: data.tob,
                    pob: data.pob,
                    gender: data.gender,
                    coordinates: data.coordinates,
                    credits: data.credits,
                    subscription: data.subscription,
                };

                setProfile(profileData);
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
                const data = docSnap.data();

                const profileData: UserProfile = data.profile || {
                    name: data.name,
                    dob: data.dob,
                    tob: data.tob,
                    pob: data.pob,
                    gender: data.gender,
                    coordinates: data.coordinates,
                    credits: data.credits,
                    subscription: data.subscription,
                };
                // Always prioritize root-level credits if available
                if (data.credits !== undefined) {
                    profileData.credits = data.credits;
                }
                console.log('[useUserProfile] Credits:', profileData.credits, 'from data:', data.credits);
                setProfile(profileData);
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
    const birthData: BirthData | null = useMemo(() => profile ? {
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
