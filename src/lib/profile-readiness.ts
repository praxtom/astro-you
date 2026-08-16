export interface CompletedBirthProfile {
  name: string;
  gender: string;
  dob: string;
  tob: string;
  pob: string;
  currentLocation?: string;
  birthTimeUnknown?: boolean;
  coordinates?: { lat: number; lng: number };
}

const requiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/**
 * Reads a persisted onboarding profile only when the matching completion
 * marker is present and every chart-defining onboarding field is complete.
 */
export function parseCompletedBirthProfile(
  rawProfile: string | null,
  completionMarker: string | null,
): CompletedBirthProfile | null {
  if (completionMarker !== "true" || !rawProfile) return null;

  try {
    const parsed = JSON.parse(rawProfile) as Record<string, unknown>;
    const name = requiredString(parsed.name);
    const gender = requiredString(parsed.gender);
    const dob = requiredString(parsed.dob);
    const tob = requiredString(parsed.tob);
    const pob = requiredString(parsed.pob);
    if (!name || !gender || !dob || !tob || !pob) return null;

    const profile: CompletedBirthProfile = {
      name,
      gender,
      dob,
      tob,
      pob,
      birthTimeUnknown: Boolean(parsed.birthTimeUnknown),
    };

    const currentLocation = requiredString(parsed.currentLocation);
    if (currentLocation) profile.currentLocation = currentLocation;

    const coordinates = parsed.coordinates;
    if (coordinates && typeof coordinates === "object") {
      const lat = (coordinates as Record<string, unknown>).lat;
      const lng = (coordinates as Record<string, unknown>).lng;
      if (
        typeof lat === "number" &&
        Number.isFinite(lat) &&
        lat >= -90 &&
        lat <= 90 &&
        typeof lng === "number" &&
        Number.isFinite(lng) &&
        lng >= -180 &&
        lng <= 180
      ) {
        profile.coordinates = { lat, lng };
      }
    }

    return profile;
  } catch {
    return null;
  }
}
