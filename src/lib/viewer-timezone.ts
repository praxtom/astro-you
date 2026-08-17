import { STORAGE_KEYS } from "./constants";
import { localDateKey, resolveTimezone } from "./local-date";
import { parseStoredJSON } from "./safeStorage";

/**
 * The viewer's timezone, on the client.
 *
 * Prefers the zone stored on their profile at onboarding, so a traveller's
 * streaks and "today" stay anchored to the zone they signed up in rather than
 * jumping with the device. Falls back to the browser's zone for guests and
 * for SEO visitors who have no profile at all.
 *
 * This lives apart from local-date.ts so that module stays pure and testable
 * from the Node test harness; everything here touches browser globals.
 */
export function getViewerTimezone(): string {
  let stored: unknown;
  if (typeof localStorage !== "undefined") {
    const profile = parseStoredJSON<{ timezone?: unknown }>(
      localStorage,
      STORAGE_KEYS.PROFILE,
    );
    stored = profile?.timezone;
  }

  if (typeof stored === "string") return resolveTimezone(stored);

  return resolveTimezone(
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined,
  );
}

/**
 * The viewer's local calendar day as YYYY-MM-DD — the correct replacement for
 * `new Date().toISOString().split("T")[0]`, which returns the *UTC* day and so
 * rolls over mid-evening for every timezone west of Greenwich.
 */
export function viewerDateKey(at?: Date): string {
  return localDateKey(getViewerTimezone(), at);
}
