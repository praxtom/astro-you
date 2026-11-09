import { SUBSCRIPTION_GRACE_DAYS, getUsageLimit } from "./entitlements.js";
import type { SubscriptionTier } from "./entitlements.js";

export { SUBSCRIPTION_GRACE_DAYS };

type PlanEnv = Record<string, string | undefined>;

/**
 * Billing cycles requested for a monthly plan. Razorpay requires a finite
 * `total_count` and supports subscriptions of up to 100 years, i.e. 1200
 * monthly cycles. The old value (12) silently ended every subscription after a
 * year; this is "renews monthly until you cancel" in practice.
 */
export const RAZORPAY_MONTHLY_MAX_TOTAL_COUNT = 1200;

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

/**
 * What the lapse sweeper does with a user it found, decided on the record
 * re-read INSIDE its transaction: "lapse" (downgrade to free), "clear" (not a
 * paid tier — just drop the stale expiresAt), or "keep" (a renewal moved
 * expiresAt forward after the sweep query ran).
 */
export function decideLapseAction(
  subscription: SubscriptionRecordLike | null | undefined,
  nowMs = Date.now(),
): "lapse" | "clear" | "keep" {
  if (hasSubscriptionLapsed(subscription, nowMs)) return "lapse";
  if (subscription?.tier !== "premium" && subscription?.tier !== "pro") {
    return "clear";
  }
  return "keep";
}

// ─── Webhook lifecycle planning ─────────────────────────────────────────────
//
// users/{uid}.subscription holds the ONE Razorpay subscription that grants
// access (`razorpaySubscriptionId`). A checkout for a new plan (upgrade,
// downgrade, re-subscribe) is parked in `subscription.pendingSubscription`
// and only replaces the current one when its own activated/charged event
// arrives. Events for any other subscription id are "superseded": they never
// touch the tier. Keeping the pending record inside the `subscription` map
// means the existing Firestore rule (subscription must be unchanged on a
// client write) already makes it server-owned.

/** Fields of a Razorpay subscription entity the lifecycle logic reads. */
export interface RazorpaySubscriptionEntityLike {
  id?: string;
  plan_id?: string;
  status?: string;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  notes?: Record<string, unknown> | unknown[];
}

export type SubscriptionEventRole = "current" | "pending" | "superseded";

type SubscriptionMap = Record<string, any> | null | undefined;

export function currentSubscriptionId(
  subscription: SubscriptionMap,
): string | null {
  const id =
    subscription?.razorpaySubscriptionId || subscription?.razorpaySubId;
  return typeof id === "string" && id ? id : null;
}

export function pendingSubscriptionId(
  subscription: SubscriptionMap,
): string | null {
  const id = subscription?.pendingSubscription?.razorpaySubscriptionId;
  return typeof id === "string" && id ? id : null;
}

/** Which of the user's subscriptions (if any) a webhook event is about. */
export function classifySubscriptionEvent(
  subscription: SubscriptionMap,
  subId: string | null | undefined,
): SubscriptionEventRole {
  if (!subId) return "superseded";
  if (currentSubscriptionId(subscription) === subId) return "current";
  if (pendingSubscriptionId(subscription) === subId) return "pending";
  return "superseded";
}

const GRANTING_EVENTS = new Set([
  "subscription.activated",
  "subscription.charged",
]);

/** Razorpay states after which a subscription can never charge again. */
const FINISHED_RAZORPAY_STATUSES = new Set([
  "cancelled",
  "completed",
  "expired",
]);

export interface SubscriptionCreditGrant {
  tier: Exclude<SubscriptionTier, "free">;
  planId: string | null;
  amount: number;
  periodKey: string;
  /** Same scheme as before this refactor, so replays stay deduplicated. */
  ledgerId: string;
  referenceId: string;
}

export interface SubscriptionEventPlan {
  role: SubscriptionEventRole;
  outcome:
    | "promoted"
    | "updated"
    | "pending_cleared"
    | "superseded"
    | "stale"
    | "ignored";
  /** Replace users/{uid}.subscription wholesale (promotion only). */
  replaceSubscription?: Record<string, unknown>;
  /** Merge into users/{uid}.subscription. */
  mergeSubscription?: Record<string, unknown>;
  /** Delete subscription.pendingSubscription. */
  clearPending?: boolean;
  /** Monthly credits paid for by this event (activated/charged only). */
  grant?: SubscriptionCreditGrant;
  /** Razorpay subscription ids to cancel immediately once the write commits. */
  cancelAtRazorpay: string[];
}

function fromUnixSeconds(value: unknown): Date | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? new Date(value * 1000)
    : null;
}

function buildGrant(
  sub: RazorpaySubscriptionEntityLike,
  env: PlanEnv,
): SubscriptionCreditGrant {
  const tier = resolveTierFromPlanId(sub.plan_id, env);
  // Nullish coalescing so a legitimate 0 timestamp isn't skipped.
  const periodKey = String(
    sub.current_start ?? sub.current_end ?? sub.charge_at ?? "current",
  );
  return {
    tier,
    planId: sub.plan_id ?? null,
    amount: getUsageLimit(tier, "monthlyCredits"),
    periodKey,
    ledgerId: `subscription_${sub.id}_${periodKey}`,
    referenceId: `${sub.id}_${periodKey}`,
  };
}

/**
 * True when this event is older than the last lifecycle event already applied
 * to the current subscription. Razorpay does not guarantee delivery order, so
 * e.g. a retried `activated` must not undo a later `cancelled`.
 */
export function isStaleSubscriptionEvent(
  subscription: SubscriptionMap,
  eventCreatedAt: number | null | undefined,
): boolean {
  const last = subscription?.lastEventAt;
  return (
    typeof eventCreatedAt === "number" &&
    typeof last === "number" &&
    eventCreatedAt < last
  );
}

/**
 * Pure decision for one Razorpay subscription webhook event against the
 * user's stored `subscription` map. The webhook applies the plan inside a
 * transaction; nothing here touches Firebase or Razorpay.
 */
export function planSubscriptionEvent(input: {
  eventType: string;
  sub: RazorpaySubscriptionEntityLike;
  subscription: SubscriptionMap;
  /** Top-level `created_at` of the webhook body (unix seconds). */
  eventCreatedAt?: number | null;
  now?: Date;
  env?: PlanEnv;
}): SubscriptionEventPlan {
  const { eventType, sub, subscription } = input;
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const role = classifySubscriptionEvent(subscription, sub.id);
  const isGranting = GRANTING_EVENTS.has(eventType);
  const eventAt =
    typeof input.eventCreatedAt === "number" ? input.eventCreatedAt : null;
  const lastEventPatch =
    eventAt !== null
      ? {
          lastEventAt: Math.max(
            eventAt,
            typeof subscription?.lastEventAt === "number"
              ? subscription.lastEventAt
              : 0,
          ),
        }
      : {};

  const currentEnd = fromUnixSeconds(sub.current_end);
  const chargeAt = fromUnixSeconds(sub.charge_at);
  // `expiresAt` is what access checks read: the period end, falling back to
  // the next charge date so access never silently lapses while paid.
  const paidThrough = currentEnd || chargeAt || null;

  if (role === "superseded") {
    if (!isGranting) {
      return { role, outcome: "superseded", cancelAtRazorpay: [] };
    }
    // Money moved on a subscription that no longer represents the user's plan
    // (e.g. the old Premium after an upgrade charged before its cancel landed).
    // Honour what was paid for — the credits — but never the tier, and stop
    // that subscription from billing again.
    return {
      role,
      outcome: "superseded",
      grant: buildGrant(sub, env),
      cancelAtRazorpay:
        sub.id && !FINISHED_RAZORPAY_STATUSES.has(String(sub.status ?? ""))
          ? [sub.id]
          : [],
    };
  }

  if (role === "pending") {
    if (isGranting) {
      const grant = buildGrant(sub, env);
      const pending = subscription?.pendingSubscription || {};
      const oldId = currentSubscriptionId(subscription);
      const oldStatus = String(subscription?.status ?? "");
      const cancelOld =
        oldId &&
        oldId !== sub.id &&
        !["cancelled", "expired", "completed"].includes(oldStatus);
      return {
        role,
        outcome: "promoted",
        grant,
        replaceSubscription: {
          tier: grant.tier,
          status: "active",
          razorpaySubscriptionId: sub.id,
          planId: grant.planId,
          ...(typeof pending.priceInr === "number"
            ? { priceInr: pending.priceInr }
            : {}),
          createdAt: pending.createdAt ?? now,
          activatedAt: now,
          currentStart: fromUnixSeconds(sub.current_start) || now,
          currentEnd,
          chargeAt,
          expiresAt: paidThrough,
          previousSubscriptionId: oldId,
          ...lastEventPatch,
        },
        cancelAtRazorpay: cancelOld && oldId ? [oldId] : [],
      };
    }
    if (
      [
        "subscription.cancelled",
        "subscription.halted",
        "subscription.completed",
        "subscription.paused",
        "subscription.expired",
      ].includes(eventType)
    ) {
      // The checkout was abandoned or stopped before it ever paid: drop it and
      // leave the current plan untouched.
      return {
        role,
        outcome: "pending_cleared",
        clearPending: true,
        cancelAtRazorpay: [],
      };
    }
    return { role, outcome: "ignored", cancelAtRazorpay: [] };
  }

  // role === "current"
  const stale = isStaleSubscriptionEvent(subscription, eventAt);

  if (isGranting) {
    const grant = buildGrant(sub, env);
    if (stale) {
      return { role, outcome: "stale", grant, cancelAtRazorpay: [] };
    }
    return {
      role,
      outcome: "updated",
      grant,
      mergeSubscription: {
        tier: grant.tier,
        // A user who asked to cancel at period end stays "cancelling".
        status: subscription?.status === "cancelling" ? "cancelling" : "active",
        razorpaySubscriptionId: sub.id,
        planId: grant.planId,
        currentStart: fromUnixSeconds(sub.current_start) || now,
        currentEnd,
        chargeAt,
        expiresAt: paidThrough,
        ...lastEventPatch,
      },
      cancelAtRazorpay: [],
    };
  }

  if (stale) return { role, outcome: "stale", cancelAtRazorpay: [] };

  switch (eventType) {
    case "subscription.cancelled":
    case "subscription.halted":
      return {
        role,
        outcome: "updated",
        mergeSubscription: {
          tier: "free",
          status:
            eventType === "subscription.cancelled" ? "cancelled" : "halted",
          cancelledAt: now,
          // Drop access immediately — no longer a paying subscriber.
          expiresAt: null,
          ...lastEventPatch,
        },
        cancelAtRazorpay: [],
      };
    case "subscription.paused":
      return {
        role,
        outcome: "updated",
        mergeSubscription: {
          tier: "free",
          status: "paused",
          pausedAt: now,
          expiresAt: null,
          ...lastEventPatch,
        },
        cancelAtRazorpay: [],
      };
    case "subscription.pending": {
      // Anchor the grace period to the end of the already-paid period.
      const gracePeriodEnd = getSubscriptionGracePeriodEnd(currentEnd || now);
      return {
        role,
        outcome: "updated",
        mergeSubscription: {
          status: "pending",
          gracePeriodEnd,
          expiresAt: gracePeriodEnd,
          ...lastEventPatch,
        },
        cancelAtRazorpay: [],
      };
    }
    case "subscription.completed":
      return {
        role,
        outcome: "updated",
        mergeSubscription: {
          status: "completed",
          completedAt: now,
          ...(currentEnd ? { currentEnd, expiresAt: currentEnd } : {}),
          ...lastEventPatch,
        },
        cancelAtRazorpay: [],
      };
    case "subscription.resumed":
      return {
        role,
        outcome: "updated",
        mergeSubscription: {
          tier: resolveTierFromPlanId(sub.plan_id, env),
          status: "active",
          resumedAt: now,
          currentEnd,
          chargeAt,
          expiresAt: paidThrough,
          ...lastEventPatch,
        },
        cancelAtRazorpay: [],
      };
    default:
      return { role, outcome: "ignored", cancelAtRazorpay: [] };
  }
}
