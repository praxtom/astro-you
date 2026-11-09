import type { Currency } from "./currency";
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
  /** @deprecated INR price. Read prices[currency] instead. */
  price: number;
  prices: Record<Currency, number>; // INR per month, 0 for free
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
  /** Editorial pick, not a popularity claim: no sales data backs a ranking. */
  recommended?: boolean;
}

/**
 * Daily fair-use cap on "unlimited" Jyotish chat for paid subscribers.
 * Copy only: the server enforces its own limit.
 */
export const PAID_CHAT_FAIR_USE_PER_DAY = 150;

/** Effective INR per credit when a plan's monthly credits are fully used. */
function perCreditInr(tier: SubscriptionTier): string {
  const { monthlyPriceInr, limits } = ENTITLEMENTS[tier];
  return `₹${(monthlyPriceInr / limits.monthlyCredits).toFixed(2)}`;
}

const formatCredits = (n: number) => n.toLocaleString("en-IN");

export const TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    id: "free",
    name: ENTITLEMENTS.free.displayName,
    price: ENTITLEMENTS.free.monthlyPriceInr,
    prices: ENTITLEMENTS.free.monthlyPrices,
    badge: "✦",
    // Every line here must match what the server actually does today.
    features: [
      `${ENTITLEMENTS.free.limits.monthlyCredits} credits once, when you sign up`,
      "Jyotish chat at 1 credit per message",
      "Free Kundali, Kundali matching and daily Panchang",
      "Forecasts, reports and AI guide sessions open to you for credits",
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
    prices: ENTITLEMENTS.premium.monthlyPrices,
    badge: "⭐",
    recommended: true,
    features: [
      `${formatCredits(ENTITLEMENTS.premium.limits.monthlyCredits)} credits added each month you're billed`,
      `Unlimited Jyotish chat (fair use: ${PAID_CHAT_FAIR_USE_PER_DAY} messages a day)`,
      `About ${perCreditInr("premium")} per credit`,
      "Spend credits on AI guide sessions, forecasts and PDF reports",
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
    prices: ENTITLEMENTS.pro.monthlyPrices,
    badge: "👑",
    features: [
      `${formatCredits(ENTITLEMENTS.pro.limits.monthlyCredits)} credits added each month you're billed`,
      `Unlimited Jyotish chat (fair use: ${PAID_CHAT_FAIR_USE_PER_DAY} messages a day)`,
      `About ${perCreditInr("pro")} per credit — the lowest rate`,
      "Spend credits on AI guide sessions, forecasts and PDF reports",
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
