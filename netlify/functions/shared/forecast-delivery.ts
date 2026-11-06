/**
 * Guards for paid forecast delivery.
 *
 * The weekly/monthly/yearly horoscope wrappers in astro-api.ts degrade to
 * `null` on a non-quota upstream failure. Credits are reserved BEFORE those
 * calls, so a null result must refund the reservation and surface a clear,
 * retryable error — never a 200 with an empty forecast the user paid for.
 */

/** True when an upstream forecast payload carries nothing worth showing. */
export function isEmptyForecast(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (typeof data === "string") return data.trim().length === 0;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object") return Object.keys(data as object).length === 0;
  return false;
}

export interface RefundableCharge {
  /** False for a ledger-deduped (already paid) window: nothing to refund. */
  charged?: boolean;
  refund: () => Promise<void>;
}

export const FORECAST_UNAVAILABLE_MESSAGE =
  "Your forecast couldn't be prepared right now. No credits were used — please try again in a little while.";

/**
 * Refund the reserved credits (if any) and build the 503 the client shows.
 * The refund is awaited so the balance is restored before the user retries.
 */
export async function forecastUnavailableResponse(
  charge: RefundableCharge | null | undefined,
  period: string,
): Promise<Response> {
  if (charge) await charge.refund();
  return new Response(
    JSON.stringify({
      error: FORECAST_UNAVAILABLE_MESSAGE,
      code: "forecast_unavailable",
      period,
      refunded: Boolean(charge && charge.charged !== false),
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json", "Retry-After": "300" },
    },
  );
}
