export type SubscriptionTier = "free" | "premium" | "pro";

export type FeatureKey =
  | "basic_profile"
  | "free_kundali"
  | "synthesis_chat"
  | "daily_horoscope"
  | "weekly_horoscope"
  | "monthly_horoscope"
  | "kundli_matching"
  | "transit_alerts"
  | "daily_path"
  | "journal_intelligence"
  | "monthly_report"
  | "pdf_reports"
  | "yearly_report"
  | "astrocartography"
  | "priority_personas"
  | "voice_input";

export type UsageLimitKey =
  | "monthlyCredits"
  | "consultMinutesPerMonth"
  | "synthesisMessagesPerDay"
  | "pdfReportsPerMonth"
  | "monthlyReportsPerMonth"
  | "yearlyReportsPerYear";

export interface TierEntitlements {
  tier: SubscriptionTier;
  displayName: string;
  monthlyPriceInr: number;
  monthlyCredits: number;
  features: Record<FeatureKey, boolean>;
  limits: Record<UsageLimitKey, number>;
}

const BASE_FEATURES: Record<FeatureKey, boolean> = {
  basic_profile: true,
  free_kundali: true,
  synthesis_chat: true,
  daily_horoscope: true,
  weekly_horoscope: false,
  monthly_horoscope: false,
  kundli_matching: false,
  transit_alerts: false,
  daily_path: false,
  journal_intelligence: false,
  monthly_report: false,
  pdf_reports: false,
  yearly_report: false,
  astrocartography: false,
  priority_personas: false,
  voice_input: false,
};

export const ENTITLEMENTS: Record<SubscriptionTier, TierEntitlements> = {
  free: {
    tier: "free",
    displayName: "Free",
    monthlyPriceInr: 0,
    monthlyCredits: 15,
    features: {
      ...BASE_FEATURES,
      kundli_matching: true,
    },
    limits: {
      monthlyCredits: 15,
      consultMinutesPerMonth: 3,
      synthesisMessagesPerDay: 5,
      pdfReportsPerMonth: 0,
      monthlyReportsPerMonth: 0,
      yearlyReportsPerYear: 0,
    },
  },
  premium: {
    tier: "premium",
    displayName: "Premium",
    monthlyPriceInr: 499,
    monthlyCredits: 900,
    features: {
      ...BASE_FEATURES,
      weekly_horoscope: true,
      monthly_horoscope: true,
      kundli_matching: true,
      transit_alerts: true,
      daily_path: true,
      journal_intelligence: true,
      monthly_report: true,
      pdf_reports: true,
    },
    limits: {
      monthlyCredits: 900,
      consultMinutesPerMonth: 180,
      synthesisMessagesPerDay: -1,
      pdfReportsPerMonth: 1,
      monthlyReportsPerMonth: 1,
      yearlyReportsPerYear: 0,
    },
  },
  pro: {
    tier: "pro",
    displayName: "Pro",
    monthlyPriceInr: 999,
    monthlyCredits: 2200,
    features: {
      ...BASE_FEATURES,
      weekly_horoscope: true,
      monthly_horoscope: true,
      kundli_matching: true,
      transit_alerts: true,
      daily_path: true,
      journal_intelligence: true,
      monthly_report: true,
      pdf_reports: true,
      yearly_report: true,
      astrocartography: true,
      priority_personas: true,
      voice_input: true,
    },
    limits: {
      monthlyCredits: 2200,
      consultMinutesPerMonth: 440,
      synthesisMessagesPerDay: -1,
      pdfReportsPerMonth: 5,
      monthlyReportsPerMonth: 1,
      yearlyReportsPerYear: 1,
    },
  },
};

export function resolveTier(tier?: string | null): SubscriptionTier {
  return tier === "premium" || tier === "pro" ? tier : "free";
}

export function getEntitlements(tier?: string | null): TierEntitlements {
  return ENTITLEMENTS[resolveTier(tier)];
}

export function canUseFeature(tier: string | null | undefined, featureKey: FeatureKey): boolean {
  return Boolean(getEntitlements(tier).features[featureKey]);
}

export function getUsageLimit(tier: string | null | undefined, limitKey: UsageLimitKey): number {
  return getEntitlements(tier).limits[limitKey] ?? 0;
}
