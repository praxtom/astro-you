import type { SubscriptionTier } from "./entitlements.js";

type PlanEnv = Record<string, string | undefined>;

export function getRazorpayPlanId(
  tier: SubscriptionTier,
  env: PlanEnv = process.env,
): string {
  if (tier === "free") {
    throw new Error("Razorpay subscription is not available for the free tier");
  }

  const envKey =
    tier === "pro" ? "RAZORPAY_PRO_PLAN_ID" : "RAZORPAY_PREMIUM_PLAN_ID";
  const planId = env[envKey];
  if (!planId) {
    throw new Error(`Missing ${envKey}`);
  }
  return planId;
}

export function resolveTierFromPlanId(
  planId?: string | null,
  env: PlanEnv = process.env,
): Exclude<SubscriptionTier, "free"> {
  if (planId && planId === env.RAZORPAY_PRO_PLAN_ID) return "pro";
  if (planId && planId === env.RAZORPAY_PREMIUM_PLAN_ID) return "premium";
  // Never silently default to a paid tier on the billing path. An unknown or
  // unconfigured plan id is a misconfiguration, not a "premium" customer.
  throw new Error(
    `Cannot resolve subscription tier: plan id "${planId ?? "(missing)"}" matches no configured RAZORPAY_PRO_PLAN_ID / RAZORPAY_PREMIUM_PLAN_ID`,
  );
}

export function getSubscriptionGracePeriodEnd(
  now = new Date(),
  days = 3,
): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}
