/**
 * Pure helpers for birth-data handling shared by the onboarding flows.
 *
 * Kept free of React/Firebase imports so the logic is unit-testable from the
 * node:test function suite.
 */

export interface BirthCoordinates {
  lat: number;
  lng: number;
}

export interface BirthIdentityFields {
  dob?: string;
  tob?: string;
  pob?: string;
  coordinates?: BirthCoordinates | null;
}

/**
 * Returns true when a profile save changes any chart-defining birth field
 * (dob / tob / pob, or the resolved birth coordinates). Used to decide whether
 * cached kundali data (kundaliData / kundaliData_D9 / kundaliData_D10) must be
 * invalidated so charts and AI context are recomputed from the new data.
 *
 * Rules:
 * - No previous birth data (first-time save) → not a change: there is no
 *   stale chart to clear.
 * - dob/tob/pob are compared as trimmed strings.
 * - Coordinates only count as a change when BOTH sides have them and they
 *   differ. Adding coordinates for the first time to an unchanged pob refers
 *   to the same place (previously geocoded server-side), so the cached chart
 *   stays valid.
 */
export function birthDataChanged(
  prev: BirthIdentityFields | null | undefined,
  next: BirthIdentityFields | null | undefined,
): boolean {
  if (!prev || (!prev.dob && !prev.tob && !prev.pob)) return false;
  if (!next) return false;

  const norm = (value?: string) =>
    typeof value === "string" ? value.trim() : "";
  if (norm(prev.dob) !== norm(next.dob)) return true;
  if (norm(prev.tob) !== norm(next.tob)) return true;
  if (norm(prev.pob) !== norm(next.pob)) return true;

  const prevCoords = prev.coordinates;
  const nextCoords = next.coordinates;
  if (
    prevCoords &&
    nextCoords &&
    (!coordsEqual(prevCoords.lat, nextCoords.lat) ||
      !coordsEqual(prevCoords.lng, nextCoords.lng))
  ) {
    return true;
  }

  return false;
}

// Treat sub-meter differences as equal so float round-trips through JSON or
// Firestore never register as a birth-data change.
const COORD_EPSILON = 1e-5;

function coordsEqual(a: number, b: number): boolean {
  return (
    Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < COORD_EPSILON
  );
}

/**
 * Parse Nominatim-style string coordinates into validated numbers.
 * Returns null for anything that is not a finite, in-range lat/lng pair —
 * callers then simply omit coordinates (same behaviour as manual typing).
 */
export function parseSuggestionCoordinates(
  lat: string | number | undefined,
  lon: string | number | undefined,
): BirthCoordinates | null {
  const parsedLat =
    typeof lat === "number" ? lat : parseFloat(String(lat ?? ""));
  const parsedLng =
    typeof lon === "number" ? lon : parseFloat(String(lon ?? ""));
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;
  if (parsedLat < -90 || parsedLat > 90) return null;
  if (parsedLng < -180 || parsedLng > 180) return null;
  return { lat: parsedLat, lng: parsedLng };
}
