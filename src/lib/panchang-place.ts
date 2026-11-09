/**
 * Where the dashboard computes today's Panchang (sunrise, sunset, Rahu Kaal),
 * and the label that says so.
 *
 * Panchang timings are local: they belong to where the user is now, not where
 * they were born. The server pairs a bare city name with New Delhi's
 * coordinates (resolvePanchangPlace), so a place is only sent together with
 * real coordinates. Mirrors resolvePanchangLocation in
 * netlify/functions/shared/user-context.ts so the dashboard and the chat's
 * context share one cached Panchang per place.
 */
export interface DashboardPanchangPlace {
  city?: string;
  lat?: number;
  lng?: number;
  /** Shown to the user: "Times for {label}". */
  label: string;
  /** Which place the times are for. */
  source: "current" | "birth" | "birth-fallback" | "default";
}

export const DEFAULT_PANCHANG_LABEL = "New Delhi (default)";

function readCoords(value: unknown): { lat: number; lng: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as { lat?: unknown; lng?: unknown };
  if (v.lat == null || v.lng == null) return undefined;
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat, lng };
}

/** Onboarding stores "12.9716, 77.5946" when reverse geocoding fails. */
function coordsFromText(
  text: string,
): { lat: number; lng: number } | undefined {
  const m = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  return m ? readCoords({ lat: m[1], lng: m[2] }) : undefined;
}

/** "Pune, Maharashtra, India" → "Pune". */
export function shortPlaceName(place: string): string {
  return place.split(",")[0].trim() || place.trim();
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function resolveDashboardPanchangPlace(
  profile: Record<string, any> | null | undefined,
): DashboardPanchangPlace {
  const current = text(profile?.currentLocation);
  const pob = text(profile?.pob);
  const typedCoords = coordsFromText(current);
  const currentCoords =
    readCoords(profile?.currentCoordinates) ??
    readCoords(profile?.currentLocationCoordinates) ??
    typedCoords;
  if (current && currentCoords) {
    return {
      city: current,
      ...currentCoords,
      label: typedCoords ? "your location" : shortPlaceName(current),
      source: "current",
    };
  }

  const birthCoords = readCoords(profile?.coordinates);
  if (pob && birthCoords) {
    const livesAtBirthPlace =
      !current || current.toLowerCase() === pob.toLowerCase();
    return {
      city: pob,
      ...birthCoords,
      label: livesAtBirthPlace
        ? shortPlaceName(pob)
        : `${shortPlaceName(pob)} (birth place)`,
      source: livesAtBirthPlace ? "birth" : "birth-fallback",
    };
  }

  // Nothing with real coordinates: the server's shared default.
  return { label: DEFAULT_PANCHANG_LABEL, source: "default" };
}
