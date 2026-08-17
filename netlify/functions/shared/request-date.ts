import { DATE_KEY_RE } from "../../../src/lib/local-date.js";

/**
 * The caller's local calendar day, for per-day cache and charge keys.
 *
 * Server functions must not guess the user's timezone: a US Pacific user's
 * "today" ends 7 hours after the UTC day does, so a UTC-keyed cache serves
 * them tomorrow's horoscope all evening. The client computes its own local
 * date (see src/lib/local-date.ts) and sends it; this validates the shape and
 * falls back to the UTC date so older clients keep working.
 */
export function requestedDateKey(value: unknown): string {
  return typeof value === "string" && DATE_KEY_RE.test(value)
    ? value
    : new Date().toISOString().split("T")[0];
}
