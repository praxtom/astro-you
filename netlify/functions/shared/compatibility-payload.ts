import type { BirthData } from "./astro-api.js";

/**
 * Compatibility used to take `maleData`/`femaleData`, which cannot express a
 * same-sex couple and framed the whole feature as marriage vetting. The public
 * shape is now `personA`/`personB`; the gendered keys are still accepted so a
 * client mid-deploy keeps working.
 *
 * The groom/bride slots that the upstream Vedic endpoint requires are an
 * artefact of that API, not our data model: `orientVedicPair` picks them from
 * each person's gender just before the call, and `attachPairManglik` maps the
 * results back onto personA/personB.
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

export type MatchGender = "male" | "female" | "other" | undefined;

/** Read a person's gender from the payload, tolerating legacy spellings. */
export function readMatchGender(person: unknown): MatchGender {
  const raw = (person as { gender?: unknown } | null)?.gender;
  if (typeof raw !== "string") return undefined;
  const g = raw.trim().toLowerCase();
  if (g === "male" || g === "m" || g === "man") return "male";
  if (g === "female" || g === "f" || g === "woman") return "female";
  return g ? "other" : undefined;
}

/**
 * Traditional Ashtakoot (Guna Milan) is asymmetric: several kutas score the
 * boy's chart against the girl's, and the upstream /vedic/kundli-matching
 * endpoint names its slots `groom` and `bride`. Sending personA as the groom
 * regardless of gender silently swaps the kutas for half of all couples.
 *
 * Map by each person's gender: male → groom, female → bride. When both share
 * a gender, or either is missing/other, keep the entry order (A → groom) and
 * flag `orientationAssumed` so the UI can say so honestly.
 */
export function orientVedicPair<T>(
  personA: T,
  personB: T,
): {
  groom: T;
  bride: T;
  /** Which entered person sits in the groom slot. */
  groomIs: "personA" | "personB";
  orientationAssumed: boolean;
} {
  const a = readMatchGender(personA);
  const b = readMatchGender(personB);
  if (a === "male" && b === "female") {
    return { groom: personA, bride: personB, groomIs: "personA", orientationAssumed: false };
  }
  if (a === "female" && b === "male") {
    return { groom: personB, bride: personA, groomIs: "personB", orientationAssumed: false };
  }
  return { groom: personA, bride: personB, groomIs: "personA", orientationAssumed: true };
}

type ManglikValue = unknown;

/**
 * Re-key the upstream groom/bride Manglik results onto personA/personB so the
 * client never has to know which slot each person was sent in. Upstream
 * fields are left untouched; `personA_manglik`/`personB_manglik` are added.
 */
export function attachPairManglik<T extends Record<string, any>>(
  vedic: T,
  groomIs: "personA" | "personB",
): T & {
  personA_manglik?: ManglikValue;
  personB_manglik?: ManglikValue;
  groomIs: "personA" | "personB";
} {
  const analysis = (vedic?.manglik_analysis ?? {}) as Record<string, unknown>;
  const groomM =
    vedic?.groom_manglik ?? vedic?.manglik_male ?? analysis.groom_manglik;
  const brideM =
    vedic?.bride_manglik ?? vedic?.manglik_female ?? analysis.bride_manglik;
  const [aM, bM] = groomIs === "personA" ? [groomM, brideM] : [brideM, groomM];
  return {
    ...vedic,
    ...(aM !== undefined ? { personA_manglik: aM } : {}),
    ...(bM !== undefined ? { personB_manglik: bM } : {}),
    groomIs,
  };
}
