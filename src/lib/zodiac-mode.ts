/**
 * Which zodiac the app calculates in.
 *
 * Jyotish uses the sidereal zodiac (Lahiri ayanamsa), which currently sits
 * ~24 degrees from the tropical zodiac used by Western astrology. The practical
 * consequence is that most people's Sun sign differs by one sign between the
 * two systems. Indian users expect the sidereal answer; Western users have
 * known their tropical sign their whole life, so showing them the sidereal one
 * without explanation reads as a bug rather than a tradition.
 */
export type ZodiacMode = "vedic" | "western";

export const DEFAULT_ZODIAC_MODE: ZodiacMode = "vedic";

export interface ZodiacModeMeta {
  mode: ZodiacMode;
  label: string;
  description: string;
}

export const ZODIAC_MODES: readonly ZodiacModeMeta[] = [
  {
    mode: "vedic",
    label: "Vedic (sidereal)",
    description:
      "Jyotish, aligned to the visible constellations using the Lahiri ayanamsa. Uses whole-sign houses, Nakshatras and Dashas.",
  },
  {
    mode: "western",
    label: "Western (tropical)",
    description:
      "Aligned to the equinoxes with Placidus houses — the system behind the Sun sign you already know.",
  },
];

export function normalizeZodiacMode(value: unknown): ZodiacMode {
  return value === "western" || value === "vedic" ? value : DEFAULT_ZODIAC_MODE;
}

/**
 * The astrology-api.io options pair for a mode. "W" is whole-sign (equal)
 * houses, "P" is Placidus.
 */
export function zodiacApiOptions(mode: ZodiacMode): {
  house_system: string;
  zodiac_type: string;
} {
  return mode === "western"
    ? { house_system: "P", zodiac_type: "Tropic" }
    : { house_system: "W", zodiac_type: "Sidereal" };
}
