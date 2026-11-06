/**
 * Credit metering for the "live" premium astrology surfaces — the on-screen
 * interactive views (weekly/monthly/yearly forecasts, transit oracle, synastry),
 * as opposed to the downloadable PDF reports priced in report-pricing.ts.
 *
 * Access is gated by credit balance, not a hard tier flag: a subscription buys a
 * monthly credit allowance (free 15, premium 700, pro 1600), and every premium
 * view spends from it. Tune the cost table here — it is the single source of truth.
 */
import { createHash } from "node:crypto";
import { CreditError } from "./credits.js";
import { reserveFeatureCharge, type FeatureCharge } from "./feature-charge.js";
import { db, FieldValue } from "./firebase-admin.js";

export const FEATURE_CREDIT_COST = {
  horoscope_weekly: 2,
  horoscope_monthly: 3,
  horoscope_yearly: 5,
  transit: 3,
  compatibility: 5,
} as const;

export type MeteredFeature = keyof typeof FEATURE_CREDIT_COST;

export { CreditError };

/**
 * Deterministic transaction key for a feature charge. Built from the inputs
 * that define "the same content" (chart + period window), so repeat views —
 * tab switches, refreshes, remounted hooks — dedupe against the ledger instead
 * of charging again. A random id here would bill a user five times for opening
 * the same weekly forecast five times.
 */
export function stableChargeKey(
  ...parts: Array<string | number | null | undefined>
): string {
  return createHash("sha256")
    .update(parts.map((p) => String(p ?? "")).join("|"))
    .digest("hex")
    .slice(0, 24);
}

export type { FeatureCharge };

/**
 * Reserve credits for a metered premium feature BEFORE the (paid) upstream call,
 * so a user cannot get free premium content by dropping the connection. Throws
 * CreditError (status 402) when the balance is insufficient. Returns a refund()
 * to call if delivery fails, so a user is never charged for a forecast they
 * didn't receive.
 *
 * Genuine duplicates of a paid window are not charged again; a window whose
 * charge was refunded IS charged again on retry (see feature-charge.ts).
 */
export async function reserveFeatureCredits(
  uid: string,
  feature: MeteredFeature,
  txnId: string,
): Promise<FeatureCharge> {
  return reserveFeatureCharge(
    { db, FieldValue },
    uid,
    feature,
    FEATURE_CREDIT_COST[feature],
    txnId,
  );
}

/**
 * Standard 402 response body for an insufficient-balance CreditError.
 */
export function insufficientCreditsResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "You're out of credits. Please top up to continue.",
      code: "insufficient_credits",
    }),
    { status: 402, headers: { "Content-Type": "application/json" } },
  );
}
