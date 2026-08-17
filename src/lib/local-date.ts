/**
 * Local calendar-day helpers.
 *
 * `new Date().toISOString().split("T")[0]` is the UTC date, not the user's
 * date. In IST (UTC+5:30) the two disagree only between 00:00 and 05:30 local,
 * so the bug was invisible in the Indian market. In US Pacific (UTC-7) they
 * disagree from ~17:00 local onward — the whole evening — so "today's"
 * horoscope, tarot, panchang and streaks all rolled a day early.
 *
 * Everything here is pure and takes an explicit `at` so it is testable without
 * freezing the clock.
 */

/** India stays the default market; internationalization is additive. */
export const FALLBACK_TIMEZONE = "Asia/Kolkata";

/** Matches the YYYY-MM-DD keys used for Firestore cache documents. */
export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    // Throws RangeError on an unknown IANA zone.
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimezone(candidate?: string | null): string {
  return isValidTimezone(candidate) ? candidate : FALLBACK_TIMEZONE;
}

/**
 * The local calendar day as YYYY-MM-DD. "en-CA" is used because its short date
 * format is already ISO-ordered and zero-padded, which avoids hand-assembling
 * parts.
 */
export function localDateKey(timezone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Local wall-clock hour, 0-23. `hourCycle: "h23"` keeps midnight at 0. */
export function localHour(timezone: string, at: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimezone(timezone),
    hour: "2-digit",
    hourCycle: "h23",
  }).format(at);
  return Number(hour);
}
