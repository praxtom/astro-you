import {
  canUseFeature,
  ENTITLEMENTS,
  getEntitlements,
  type SubscriptionTier,
} from "./entitlements";

export type { SubscriptionTier } from "./entitlements";

export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  price: number; // INR per month, 0 for free
  razorpayPlanId?: string; // Set in env or hardcode after creating plans
  features: string[];
  limits: {
    credits: number; // Initial/monthly credits
    consultMinutesPerMonth: number; // 0 = none, -1 = unlimited
    synthesisUnlimited: boolean;
    pdfReports: boolean;
    yearlyForecast: boolean;
    astrocartography: boolean;
    priorityPersonas: boolean;
  };
  badge: string; // Emoji for display
  popular?: boolean;
}

export const TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    id: "free",
    name: ENTITLEMENTS.free.displayName,
    price: ENTITLEMENTS.free.monthlyPriceInr,
    badge: "✦",
    features: [
      "15 starter credits",
      "Daily horoscope",
      "Birth chart analysis",
      "Up to 3 consultation minutes",
      "Basic compatibility check",
    ],
    limits: {
      credits: ENTITLEMENTS.free.limits.monthlyCredits,
      consultMinutesPerMonth: ENTITLEMENTS.free.limits.consultMinutesPerMonth,
      synthesisUnlimited: ENTITLEMENTS.free.limits.synthesisMessagesPerDay === -1,
      pdfReports: ENTITLEMENTS.free.features.pdf_reports,
      yearlyForecast: ENTITLEMENTS.free.features.yearly_report,
      astrocartography: ENTITLEMENTS.free.features.astrocartography,
      priorityPersonas: ENTITLEMENTS.free.features.priority_personas,
    },
  },
  premium: {
    id: "premium",
    name: ENTITLEMENTS.premium.displayName,
    price: ENTITLEMENTS.premium.monthlyPriceInr,
    badge: "⭐",
    popular: true,
    features: [
      "Unlimited AI Jyotish chat",
      "Daily + Weekly + Monthly forecasts",
      "700 monthly credits",
      "Up to 140 consultation minutes",
      "PDF natal reports",
      "Vedic remedies & doshas",
      "All dashboard widgets",
    ],
    limits: {
      credits: ENTITLEMENTS.premium.limits.monthlyCredits,
      consultMinutesPerMonth: ENTITLEMENTS.premium.limits.consultMinutesPerMonth,
      synthesisUnlimited: ENTITLEMENTS.premium.limits.synthesisMessagesPerDay === -1,
      pdfReports: ENTITLEMENTS.premium.features.pdf_reports,
      yearlyForecast: ENTITLEMENTS.premium.features.yearly_report,
      astrocartography: ENTITLEMENTS.premium.features.astrocartography,
      priorityPersonas: ENTITLEMENTS.premium.features.priority_personas,
    },
  },
  pro: {
    id: "pro",
    name: ENTITLEMENTS.pro.displayName,
    price: ENTITLEMENTS.pro.monthlyPriceInr,
    badge: "👑",
    features: [
      "Everything in Premium",
      "1,600 monthly credits",
      "Up to 320 consultation minutes",
      "Yearly forecast & predictions",
      "Astrocartography maps",
      "Priority AI personas",
      "Numerology + Tarot readings",
      "Priority support",
    ],
    limits: {
      credits: ENTITLEMENTS.pro.limits.monthlyCredits,
      consultMinutesPerMonth: ENTITLEMENTS.pro.limits.consultMinutesPerMonth,
      synthesisUnlimited: ENTITLEMENTS.pro.limits.synthesisMessagesPerDay === -1,
      pdfReports: ENTITLEMENTS.pro.features.pdf_reports,
      yearlyForecast: ENTITLEMENTS.pro.features.yearly_report,
      astrocartography: ENTITLEMENTS.pro.features.astrocartography,
      priorityPersonas: ENTITLEMENTS.pro.features.priority_personas,
    },
  },
};

export function getTier(tierName?: string): TierConfig {
  return TIERS[getEntitlements(tierName).tier];
}

export function canAccess(
  userTier: SubscriptionTier,
  feature: keyof TierConfig["limits"],
): boolean {
  const featureMap: Record<keyof TierConfig["limits"], boolean> = {
    credits: getEntitlements(userTier).limits.monthlyCredits > 0,
    consultMinutesPerMonth:
      getEntitlements(userTier).limits.consultMinutesPerMonth !== 0,
    synthesisUnlimited:
      getEntitlements(userTier).limits.synthesisMessagesPerDay === -1,
    pdfReports: canUseFeature(userTier, "pdf_reports"),
    yearlyForecast: canUseFeature(userTier, "yearly_report"),
    astrocartography: canUseFeature(userTier, "astrocartography"),
    priorityPersonas: canUseFeature(userTier, "priority_personas"),
  };
  return featureMap[feature];
}
