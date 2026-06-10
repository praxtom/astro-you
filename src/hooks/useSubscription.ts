/**
 * useSubscription Hook - Centralized subscription/credits management
 * Handles feature gating based on subscription tier
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import type { SubscriptionData } from "../types";
import {
  canAccess as canAccessFeature,
  type SubscriptionTier,
  type TierConfig,
} from "../lib/subscriptions";
import {
  canUseFeature,
  getUsageLimit,
  type FeatureKey,
  type UsageLimitKey,
} from "../lib/entitlements";

interface UseSubscriptionResult {
  tier: "free" | "premium" | "pro";
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
  checkFeature: (feature: keyof TierConfig["limits"]) => boolean;
  canUseFeature: (feature: FeatureKey) => boolean;
  getUsageLimit: (limit: UsageLimitKey) => number;
}

type LegacyFeatureType =
  | "unlimited_chat"
  | "daily_horoscope"
  | "weekly_horoscope"
  | "monthly_horoscope"
  | "pdf_reports"
  | "kundli_matching"
  | "transit_alerts"
  | "voice_input";

type FeatureType = FeatureKey | LegacyFeatureType;

const LEGACY_FEATURE_MAP: Record<LegacyFeatureType, FeatureKey> = {
  unlimited_chat: "synthesis_chat",
  daily_horoscope: "daily_horoscope",
  weekly_horoscope: "weekly_horoscope",
  monthly_horoscope: "monthly_horoscope",
  pdf_reports: "pdf_reports",
  kundli_matching: "kundli_matching",
  transit_alerts: "transit_alerts",
  voice_input: "voice_input",
};

/**
 * Normalize the many shapes a date can arrive in (Firestore Timestamp, Date,
 * ISO string, epoch number) to milliseconds. Firestore client reads return a
 * Timestamp, and `new Date(timestamp)` yields an Invalid Date — so this guard
 * is required for subscription expiry comparisons to work at all.
 */
function toTimeMs(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (
    typeof value === "object" &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === "string" || typeof value === "number") {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

export function useSubscription(): UseSubscriptionResult {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData>({
    tier: "free",
  });
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const creditLockRef = useRef(false);

  // Subscribe to subscription/credit data in real time so top-ups and
  // webhook-driven subscription changes reflect without a page reload.
  useEffect(() => {
    if (!user) {
      setSubscription({ tier: "free" });
      setCredits(0);
      setLoading(false);
      return;
    }

    const docRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSubscription(data.subscription || { tier: "free" });
          setCredits(data.credits || 0);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching subscription:", err);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  // Check subscription validity
  const isSubscriptionActive = useCallback(() => {
    if (subscription.tier === "free") return true;
    const expiresAtMs = toTimeMs(subscription.expiresAt);
    if (expiresAtMs === null) return false;
    return expiresAtMs > Date.now();
  }, [subscription]);

  // Use one credit
  const useCredit = async (): Promise<boolean> => {
    if (!user) return false;

    // Premium/Pro users don't use credits for chat
    if (subscription.tier !== "free" && isSubscriptionActive()) {
      return true;
    }

    // Prevent concurrent credit usage
    if (creditLockRef.current) return false;
    if (credits <= 0) return false;

    creditLockRef.current = true;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/credits/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, source: "subscription_hook" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Credit usage failed");
      if (typeof data.balanceAfter === "number") {
        setCredits(data.balanceAfter);
      } else {
        setCredits((prev) => prev - 1);
      }
      return true;
    } catch (err) {
      console.error("Credit usage error:", err);
      return false;
    } finally {
      creditLockRef.current = false;
    }
  };

  // Add credits
  const addCredits = async (amount: number): Promise<void> => {
    if (!user) return;

    try {
      if (amount <= 0) throw new Error("Credit amount must be positive");
      throw new Error("Credits can only be added after payment verification.");
    } catch (err: any) {
      console.error("Error adding credits:", err);
      setError(err.message);
    }
  };

  // Check feature access
  const canAccess = (feature: FeatureType): boolean => {
    const currentTier = isSubscriptionActive() ? subscription.tier : "free";
    const featureKey =
      feature in LEGACY_FEATURE_MAP
        ? LEGACY_FEATURE_MAP[feature as LegacyFeatureType]
        : (feature as FeatureKey);
    return canUseFeature(currentTier, featureKey);
  };

  const activeTier = isSubscriptionActive() ? subscription.tier : "free";

  // Check feature access using the centralized tier config
  const checkFeature = (feature: keyof TierConfig["limits"]): boolean => {
    return canAccessFeature(
      (activeTier as SubscriptionTier) || "free",
      feature,
    );
  };

  const canUseEntitledFeature = (feature: FeatureKey): boolean => {
    return canUseFeature(activeTier, feature);
  };

  const getEntitledUsageLimit = (limit: UsageLimitKey): number => {
    return getUsageLimit(activeTier, limit);
  };

  return {
    tier: activeTier,
    credits,
    isSubscribed: activeTier !== "free",
    isPremium: activeTier === "premium" || activeTier === "pro",
    isPro: activeTier === "pro",
    loading,
    error,
    useCredit,
    addCredits,
    canAccess,
    checkFeature,
    canUseFeature: canUseEntitledFeature,
    getUsageLimit: getEntitledUsageLimit,
  };
}
