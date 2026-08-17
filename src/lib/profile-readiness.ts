import {
  DEFAULT_ZODIAC_MODE,
  type ZodiacMode,
} from "./zodiac-mode.js";
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

/**
 * Prevents a legacy or mislabeled cached chart from masquerading as the one
 * being asked for — wrong division (D9/D10) or wrong zodiac.
 *
 * The zodiac check matters because sidereal and tropical charts have the same
 * shape but different signs. Without it, switching to Western keeps serving
 * the cached sidereal chart, so the signs stay silently wrong and the toggle
 * looks broken. Charts cached before the mode existed carry no `_zodiacMode`
 * and were all sidereal, so they stay valid for vedic only.
 */
export function isUsableCachedKundali(
  value: unknown,
  chartType: "D1" | "D9" | "D10",
  zodiacMode?: ZodiacMode,
): boolean {
  if (!value || typeof value !== "object") return false;
  const cached = value as Record<string, unknown>;
  if (
    !Array.isArray(cached.planetary_positions) ||
    cached.planetary_positions.length === 0
  ) {
    return false;
  }

  if (zodiacMode !== undefined) {
    const cachedMode = cached._zodiacMode;
    const effectiveMode =
      typeof cachedMode === "string" ? cachedMode : DEFAULT_ZODIAC_MODE;
    if (effectiveMode !== zodiacMode) return false;
  }

  const cachedChartType = cached._chartType;
  if (typeof cachedChartType === "string") return cachedChartType === chartType;
  return chartType === "D1";
}

export interface LatestRequestToken {
  isCurrent: () => boolean;
  cancel: () => void;
}

/** Coordinates overlapping async work so stale completions cannot update UI state. */
export function createLatestRequestGate(): {
  begin: () => LatestRequestToken;
} {
  let latestId = 0;

  return {
    begin() {
      const requestId = ++latestId;
      let cancelled = false;
      return {
        isCurrent: () => !cancelled && requestId === latestId,
        cancel: () => {
          cancelled = true;
        },
      };
    },
  };
}
