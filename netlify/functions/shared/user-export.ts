/**
 * The user-document part of a data export (/api/export-data).
 *
 * Exports the WHOLE user document so every setting the user (or we) stored —
 * memoryPaused, notificationPrefs, zodiacMode, timezone, currency, … — is
 * included without having to keep a hand-written field list in sync. Only
 * internal/secret fields are withheld, listed here explicitly:
 *
 *  - `fcmToken`: a device push credential (internal delivery plumbing; the
 *    user's registered devices are exported via the pushTokens subcollection).
 *  - `activeConsultSessionId`: a transient server lock for billing.
 *  - any field whose name starts with `_`: internal markers by convention.
 *
 * Pure module so it can be unit-tested.
 */
export const EXPORT_EXCLUDED_USER_FIELDS: ReadonlySet<string> = new Set([
  "fcmToken",
  "activeConsultSessionId",
]);

export function isExcludedExportField(key: string): boolean {
  return EXPORT_EXCLUDED_USER_FIELDS.has(key) || key.startsWith("_");
}

export function buildUserDocExport(
  userData: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(userData ?? {})) {
    if (!isExcludedExportField(key)) out[key] = value;
  }
  // Stable shape for consumers of earlier exports.
  out.profile = out.profile ?? {};
  out.atman = out.atman ?? {};
  out.kundaliData = out.kundaliData ?? {};
  return out;
}
