/**
 * Which regional festival calendar to show.
 *
 * The card previously hardcoded `region: "north"`, so a South Indian user saw
 * the wrong festivals and a non-Indian user saw a calendar with no bearing on
 * their year. "off" hides the card entirely rather than showing irrelevant
 * content — for a US user with no connection to the Hindu calendar, absence is
 * more honest than noise.
 */
export const FESTIVAL_REGIONS = [
  { value: "north", label: "North Indian" },
  { value: "south", label: "South Indian" },
  { value: "east", label: "East Indian" },
  { value: "west", label: "West Indian" },
  { value: "off", label: "Off", hint: "Hide the festival calendar." },
] as const;

export type FestivalRegion = (typeof FESTIVAL_REGIONS)[number]["value"];

export const DEFAULT_FESTIVAL_REGION: FestivalRegion = "north";

export function normalizeFestivalRegion(value: unknown): FestivalRegion {
  return FESTIVAL_REGIONS.some((region) => region.value === value)
    ? (value as FestivalRegion)
    : DEFAULT_FESTIVAL_REGION;
}
