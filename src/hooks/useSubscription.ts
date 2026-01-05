/**
 * useSubscription Hook - Centralized subscription/credits management
 * Handles feature gating based on subscription tier
 */

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import type { SubscriptionData } from '../types';

interface UseSubscriptionResult {
    tier: 'free' | 'premium' | 'pro';
    credits: number;
    isSubscribed: boolean;
    isPremium: boolean;
    isPro: boolean;
    loading: boolean;
    error: string | null;

    // Actions
    useCredit: () => Promise<boolean>;
    addCredits: (amount: number) => Promise<void>;
    canAccess: (feature: FeatureType) => boolean;
}

type FeatureType =
    | 'unlimited_chat'
    | 'daily_horoscope'
    | 'weekly_horoscope'
    | 'monthly_horoscope'
    | 'pdf_reports'
    | 'kundli_matching'
    | 'transit_alerts'
    | 'voice_input';

// Feature access matrix
const FEATURE_ACCESS: Record<FeatureType, ('free' | 'premium' | 'pro')[]> = {
    unlimited_chat: ['premium', 'pro'],
    daily_horoscope: ['free', 'premium', 'pro'],
    weekly_horoscope: ['premium', 'pro'],
    monthly_horoscope: ['premium', 'pro'],
    pdf_reports: ['pro'],
    kundli_matching: ['premium', 'pro'],
    transit_alerts: ['premium', 'pro'],
    voice_input: ['pro'],
};

export function useSubscription(): UseSubscriptionResult {
    const { user } = useAuth();
    const [subscription, setSubscription] = useState<SubscriptionData>({ tier: 'free' });
    const [credits, setCredits] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch subscription data
    useEffect(() => {
        if (!user) {
            setSubscription({ tier: 'free' });
            setCredits(0);
            setLoading(false);
            return;
        }

        const fetchSubscription = async () => {
            try {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setSubscription(data.subscription || { tier: 'free' });
                    setCredits(data.credits || 0);
                }
            } catch (err: any) {
                console.error('Error fetching subscription:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSubscription();
    }, [user]);

    // Check subscription validity
    const isSubscriptionActive = useCallback(() => {
        if (subscription.tier === 'free') return true;
        if (!subscription.expiresAt) return false;
        return new Date(subscription.expiresAt) > new Date();
    }, [subscription]);

    // Use one credit
    const useCredit = async (): Promise<boolean> => {
        if (!user) return false;

        // Premium/Pro users don't use credits for chat
        if (subscription.tier !== 'free' && isSubscriptionActive()) {
            return true;
        }

        // Check if user has credits
        if (credits <= 0) {
            return false;
        }

        try {
            const docRef = doc(db, 'users', user.uid);
            await updateDoc(docRef, { credits: increment(-1) });
            setCredits((prev) => prev - 1);
            return true;
        } catch (err) {
            console.error('Error using credit:', err);
            return false;
        }
    };

    // Add credits
    const addCredits = async (amount: number): Promise<void> => {
        if (!user) return;

        try {
            const docRef = doc(db, 'users', user.uid);
            await updateDoc(docRef, { credits: increment(amount) });
            setCredits((prev) => prev + amount);
        } catch (err: any) {
            console.error('Error adding credits:', err);
            setError(err.message);
        }
    };

    // Check feature access
    const canAccess = (feature: FeatureType): boolean => {
        const allowedTiers = FEATURE_ACCESS[feature];
        const currentTier = isSubscriptionActive() ? subscription.tier : 'free';
        return allowedTiers.includes(currentTier);
    };

    const activeTier = isSubscriptionActive() ? subscription.tier : 'free';

    return {
        tier: activeTier,
        credits,
        isSubscribed: activeTier !== 'free',
        isPremium: activeTier === 'premium' || activeTier === 'pro',
        isPro: activeTier === 'pro',
        loading,
        error,
        useCredit,
        addCredits,
        canAccess,
    };
}
