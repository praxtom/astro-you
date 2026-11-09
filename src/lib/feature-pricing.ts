/**
 * Client mirror of the server's live-feature credit prices
 * (netlify/functions/shared/feature-credits.ts → FEATURE_CREDIT_COST).
 *
 * The server is the source of truth and charges; this copy exists so the UI
 * can show the price BEFORE the request that spends it. A node:test parity
 * test (feature-pricing-parity.test.ts) fails the build if the two drift.
 *
 * No imports: this file is compiled by the functions test config too.
 */
export const FEATURE_CREDIT_COST = {
  horoscope_weekly: 2,
  horoscope_monthly: 3,
  horoscope_yearly: 5,
  transit: 3,
  compatibility: 5,
} as const;

export type MeteredFeature = keyof typeof FEATURE_CREDIT_COST;

export type ForecastPeriod = "daily" | "weekly" | "monthly" | "yearly";

/** Which metered feature a forecast period spends from (daily is free). */
export const FORECAST_PERIOD_FEATURE: Record<
  ForecastPeriod,
  MeteredFeature | null
> = {
  daily: null,
  weekly: "horoscope_weekly",
  monthly: "horoscope_monthly",
  yearly: "horoscope_yearly",
};

/** "1 credit" / "3 credits". */
export function creditLabel(n: number): string {
  return `${n} credit${n === 1 ? "" : "s"}`;
}

/** ISO week key ("2026-W28"), identical to the server's weekly billing window. */
export function isoWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * The window the server bills once per chart: a week, month or year for
 * forecasts (horoscope.ts) and a single date for transits (transit.ts).
 * Re-opening inside the same window is not charged again.
 */
export function chargeWindowKey(
  feature: MeteredFeature,
  dateKey: string,
): string {
  switch (feature) {
    case "horoscope_weekly":
      return isoWeekKey(dateKey);
    case "horoscope_monthly":
      return dateKey.slice(0, 7);
    case "horoscope_yearly":
      return dateKey.slice(0, 4);
    default:
      return dateKey;
  }
}

const CONFIRM_PREFIX = "astroyou_charge_ok:";

/** Session key for "the user agreed to this charge" — per user, chart and window. */
export function chargeConfirmationKey(
  uid: string,
  feature: MeteredFeature,
  windowKey: string,
  chart?: { dob?: string; tob?: string; pob?: string } | null,
): string {
  const chartPart = chart
    ? [
        chart.dob ?? "",
        chart.tob ?? "",
        (chart.pob ?? "").trim().toLowerCase(),
      ].join("|")
    : "";
  return `${CONFIRM_PREFIX}${uid}:${feature}:${windowKey}:${chartPart}`;
}

/** True when the user already confirmed this charge in this browser session. */
export function hasConfirmedCharge(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** Remember a confirmation for the rest of the session (best effort). */
export function rememberChargeConfirmation(key: string): void {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* storage blocked: the user is simply asked again next time */
  }
}
