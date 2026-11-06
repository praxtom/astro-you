/**
 * Firebase-free input validation for metered (credit-charged) endpoints.
 *
 * Validation runs BEFORE a charge is reserved: a malformed input that is
 * guaranteed to fail upstream must be a 400 with no charge, never a
 * charge → upstream error → refund cycle (which could otherwise be repeated
 * to exhaust the refund-retry window, see feature-charge.ts).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function isValidTimeString(value: unknown): value is string {
  if (typeof value !== "string" || !TIME_RE.test(value)) return false;
  const [h, min, s = 0] = value.split(":").map(Number);
  return h <= 23 && min <= 59 && s <= 59;
}

function isAbsent(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function coordInRange(value: unknown, limit: number): boolean {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= limit;
}

/**
 * Returns a human-readable error for an invalid birth input, or null when the
 * input is usable. lat/lng are optional (the upstream geocodes from pob) but
 * when supplied must be finite and within range.
 */
export function birthInputError(
  person: unknown,
  label = "Birth data",
): string | null {
  const p = (person && typeof person === "object" ? person : {}) as Record<
    string,
    unknown
  >;
  if (!isValidDateString(p.dob))
    return `${label}: date of birth must be YYYY-MM-DD`;
  if (!isValidTimeString(p.tob)) return `${label}: time of birth must be HH:MM`;
  if (!isAbsent(p.lat) && !coordInRange(p.lat, 90)) {
    return `${label}: latitude must be between -90 and 90`;
  }
  if (!isAbsent(p.lng) && !coordInRange(p.lng, 180)) {
    return `${label}: longitude must be between -180 and 180`;
  }
  return null;
}

/** Coordinate rounded to ~1 km for use in a charge key ("" when absent). */
export function chargeKeyCoord(value: unknown): string {
  if (isAbsent(value)) return "";
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "";
}

export function badInputResponse(message: string): Response {
  return new Response(
    JSON.stringify({ error: message, code: "invalid_input" }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" },
    },
  );
}
