import { SUBSCRIPTION_GRACE_DAYS } from "./entitlements.js";
import type { SubscriptionTier } from "./entitlements.js";

export { SUBSCRIPTION_GRACE_DAYS };

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
  days = SUBSCRIPTION_GRACE_DAYS,
): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Minimal shape of the `users/{uid}.subscription` map used for access checks. */
export interface SubscriptionRecordLike {
  tier?: string | null;
  status?: string | null;
  expiresAt?: unknown;
}

/**
 * Normalize the shapes `expiresAt` can arrive in (Firestore Timestamp, Date,
 * ISO string, epoch millis) to milliseconds. Returns null when unparseable.
 */
export function subscriptionTimeMs(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (
    typeof value === "object" &&
    typeof (value as { toMillis?: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === "string" || typeof value === "number") {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

// Statuses under which a paid subscription still grants paid access:
// - "active": normal paid state.
// - "cancelling": user cancelled at period end — paid through expiresAt.
// - "pending": renewal charge is retrying — the pending webhook keeps access
//   alive by setting expiresAt to the grace-period end.
// - "completed": final cycle charged — paid through expiresAt (current_end).
// Everything else (cancelled/halted/paused/expired/created) has been
// explicitly revoked or never paid.
const PAID_ACCESS_STATUSES = new Set([
  "active",
  "cancelling",
  "pending",
  "completed",
]);

/**
 * Server-authoritative "is this a paying subscriber right now?" check.
 * True when the tier is paid, the status still grants access, and the
 * paid-through date (plus the standard grace window) has not passed.
 * A missing expiresAt on an access-granting status is treated as active —
 * revocation paths (cancelled/halted/lapse sweeper) all set status/tier.
 */
export function isPaidSubscriptionActive(
  subscription: SubscriptionRecordLike | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!subscription) return false;
  if (subscription.tier !== "premium" && subscription.tier !== "pro") {
    return false;
  }
  if (!PAID_ACCESS_STATUSES.has(String(subscription.status ?? ""))) {
    return false;
  }
  const expiresMs = subscriptionTimeMs(subscription.expiresAt);
  if (expiresMs === null) return true;
  return getSubscriptionGracePeriodEnd(new Date(expiresMs)).getTime() > nowMs;
}

/**
 * Lapse decision for the daily sweeper: a paid-tier subscription whose
 * paid-through date is beyond the grace window, regardless of status — this is
 * the backstop for halted/pending/completed subscriptions that never resolve
 * and for lost webhooks. Free tiers and unparseable/missing dates never lapse.
 */
export function hasSubscriptionLapsed(
  subscription: SubscriptionRecordLike | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!subscription) return false;
  if (subscription.tier !== "premium" && subscription.tier !== "pro") {
    return false;
  }
  const expiresMs = subscriptionTimeMs(subscription.expiresAt);
  if (expiresMs === null) return false;
  return getSubscriptionGracePeriodEnd(new Date(expiresMs)).getTime() <= nowMs;
}
