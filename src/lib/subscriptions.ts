export type SubscriptionTier = "free" | "premium" | "pro";

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
    name: "Free",
    price: 0,
    badge: "✦",
    features: [
      "5 credits to start",
      "Daily horoscope",
      "Birth chart analysis",
      "3 free consultation minutes",
      "Basic compatibility check",
    ],
    limits: {
      credits: 5,
      consultMinutesPerMonth: 3,
      synthesisUnlimited: false,
      pdfReports: false,
      yearlyForecast: false,
      astrocartography: false,
      priorityPersonas: false,
    },
  },
  premium: {
    id: "premium",
    name: "Premium",
    price: 499,
    badge: "⭐",
    popular: true,
    features: [
      "Unlimited AI Jyotish chat",
      "Daily + Weekly + Monthly forecasts",
      "60 consultation minutes/month",
      "PDF natal reports",
      "Vedic remedies & doshas",
      "All dashboard widgets",
      "50% off consultation rates",
    ],
    limits: {
      credits: 100,
      consultMinutesPerMonth: 60,
      synthesisUnlimited: true,
      pdfReports: true,
      yearlyForecast: false,
      astrocartography: false,
      priorityPersonas: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 999,
    badge: "👑",
    features: [
      "Everything in Premium",
      "Unlimited consultation minutes",
      "Yearly forecast & predictions",
      "Astrocartography maps",
      "Priority AI personas",
      "Numerology + Tarot readings",
      "Priority support",
    ],
    limits: {
      credits: 999,
      consultMinutesPerMonth: -1, // unlimited
      synthesisUnlimited: true,
      pdfReports: true,
      yearlyForecast: true,
      astrocartography: true,
      priorityPersonas: true,
    },
  },
};

export function getTier(tierName?: string): TierConfig {
  return TIERS[(tierName as SubscriptionTier) || "free"] || TIERS.free;
}

export function canAccess(
  userTier: SubscriptionTier,
  feature: keyof TierConfig["limits"],
): boolean {
  const tier = getTier(userTier);
  const val = tier.limits[feature];
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  return false;
}
