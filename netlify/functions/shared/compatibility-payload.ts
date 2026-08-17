import type { BirthData } from "./astro-api.js";

/**
 * Compatibility used to take `maleData`/`femaleData`, which cannot express a
 * same-sex couple and framed the whole feature as marriage vetting. The public
 * shape is now `personA`/`personB`; the gendered keys are still accepted so a
 * client mid-deploy keeps working.
 *
 * The groom/bride mapping that the upstream Vedic endpoint requires stays at
 * the astro-api boundary — it is an artefact of that API, not our data model.
 */
export function normalizeMatchPayload(body: unknown): {
  personA: BirthData;
  personB: BirthData;
} {
  const b = (body ?? {}) as Record<string, BirthData | undefined>;
  const personA = b.personA ?? b.maleData;
  const personB = b.personB ?? b.femaleData;
  if (!personA || !personB) {
    throw new Error("Two birth charts are required for a compatibility match");
  }
  return { personA, personB };
}
