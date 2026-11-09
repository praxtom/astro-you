/**
 * useSubscription Hook - Centralized subscription/credits management
 * Handles feature gating based on subscription tier
 */

import { useState, useEffect, useCallback } from "react";
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
  SUBSCRIPTION_GRACE_DAYS,
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
 * is required for subscription date handling to work at all.
 */
export function subscriptionTimeMs(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (
    typeof value === "object" &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (
    typeof value === "object" &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }
  if (typeof value === "string" || typeof value === "number") {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/** Locale date for a subscription field (Timestamp/Date/string), or null. */
export function formatSubscriptionDate(value: unknown): string | null {
  const ms = subscriptionTimeMs(value);
  return ms === null ? null : new Date(ms).toLocaleDateString();
}

// Mirrors PAID_ACCESS_STATUSES in netlify/functions/shared/subscription-plans.ts.
const PAID_ACCESS_STATUSES = new Set([
  "active",
  "cancelling",
  "pending",
  "completed",
]);

/**
 * Client mirror of the server's isPaidSubscriptionActive: a paid tier, a
 * status that still grants access, and — when an expiry is recorded — not past
 * it plus the grace window. A missing expiresAt on an access-granting status
 * is active, exactly as the server treats it (revocation always sets
 * tier/status), so the client never paywalls someone the server serves.
 */
export function isPaidSubscriptionActive(
  subscription: Partial<SubscriptionData> | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!subscription) return false;
  if (subscription.tier !== "premium" && subscription.tier !== "pro") {
    return false;
  }
  if (!PAID_ACCESS_STATUSES.has(String(subscription.status ?? ""))) {
    return false;
  }
  const expiresAtMs = subscriptionTimeMs(subscription.expiresAt);
  if (expiresAtMs === null) return true;
  const graceMs = SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return expiresAtMs + graceMs > nowMs;
}

export function useSubscription(): UseSubscriptionResult {
  const { user, accountSyncing } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData>({
    tier: "free",
  });
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to subscription/credit data in real time so top-ups and
  // webhook-driven subscription changes reflect without a page reload.
  useEffect(() => {
    if (!user) {
      setSubscription({ tier: "free" });
      setCredits(0);
      setLoading(false);
      return;
    }

    // A new user means a new snapshot is on its way: report loading until it
    // lands so callers don't read the signed-out 0 credits as the real balance.
    setLoading(true);
    setError(null);
    const docRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSubscription(data.subscription || { tier: "free" });
          // May be negative after a refunded payment's credits are taken back.
          setCredits(typeof data.credits === "number" ? data.credits : 0);
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

  // Same rule as the server (see isPaidSubscriptionActive above).
  const isSubscriptionActive = useCallback(
    () => isPaidSubscriptionActive(subscription),
    [subscription],
  );

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
    // Credits are initialized in the background after sign-in; a 0 balance
    // while that runs is "not loaded yet", not "out of credits".
    loading: loading || (accountSyncing && credits === 0),
    error,
    canAccess,
    checkFeature,
    canUseFeature: canUseEntitledFeature,
    getUsageLimit: getEntitledUsageLimit,
  };
}
