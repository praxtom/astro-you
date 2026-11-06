/**
 * Manglik (Kuja) factor: Mars in houses 1, 2, 4, 7, 8 or 12 counted from the
 * Lagna, and (as widely practised) from the Moon and from Venus. Returns
 * neutral factors and commonly cited mitigations — never a verdict.
 *
 * Mitigations implemented (the ones most Indian software and matchmakers cite):
 *  - Mars in its own sign (Aries, Scorpio) or exalted (Capricorn)
 *  - House-specific signs: 1st in Aries; 2nd in Gemini/Virgo; 4th in Aries/Scorpio;
 *    7th in Cancer/Capricorn; 8th in Sagittarius/Pisces; 12th in Taurus/Libra
 *  - Mars conjunct Jupiter, or in Jupiter's 5th/7th/9th-house aspect
 *  - Mars conjunct the Moon (Chandra-Mangala)
 */
import type { CanonicalChart, SignIndex } from "./types.js";

export const MANGLIK_HOUSES = [1, 2, 4, 7, 8, 12] as const;

export type ManglikReference = "lagna" | "moon" | "venus";

export interface ManglikReferenceResult {
  reference: ManglikReference;
  house: number;
  inManglikHouse: boolean;
}

export interface ManglikMitigation {
  code:
    | "own-or-exalted"
    | "house-sign-exception"
    | "jupiter-conjunct-or-aspect"
    | "moon-conjunct";
  description: string;
}

export interface ManglikResult {
  references: ManglikReferenceResult[];
  /** Count of references (out of the ones available) placing Mars in a Manglik house. */
  factorCount: number;
  mitigations: ManglikMitigation[];
  status: "absent" | "present" | "present-with-mitigations";
  summary: string;
}

const HOUSE_SIGN_EXCEPTIONS: Record<number, SignIndex[]> = {
  1: [0],
  2: [2, 5],
  4: [0, 7],
  7: [3, 9],
  8: [8, 11],
  12: [1, 6],
};

const countFrom = (sign: number, ref: number) => ((sign - ref + 12) % 12) + 1;

export function manglikAnalysis(
  chart: Pick<CanonicalChart, "grahas" | "lagna">,
): ManglikResult {
  const mars = chart.grahas.Mars.sign;
  const refs: Array<[ManglikReference, number | undefined]> = [
    ["lagna", chart.lagna?.sign],
    ["moon", chart.grahas.Moon.sign],
    ["venus", chart.grahas.Venus.sign],
  ];
  const references: ManglikReferenceResult[] = [];
  for (const [reference, refSign] of refs) {
    if (refSign === undefined) continue;
    const house = countFrom(mars, refSign);
    references.push({
      reference,
      house,
      inManglikHouse: (MANGLIK_HOUSES as readonly number[]).includes(house),
    });
  }
  const factorCount = references.filter((r) => r.inManglikHouse).length;

  const mitigations: ManglikMitigation[] = [];
  if (factorCount > 0) {
    if (mars === 0 || mars === 7 || mars === 9) {
      mitigations.push({
        code: "own-or-exalted",
        description: "Mars is in its own or exaltation sign.",
      });
    }
    const primary = references[0];
    const exceptions = HOUSE_SIGN_EXCEPTIONS[primary.house];
    if (primary.inManglikHouse && exceptions?.includes(mars)) {
      mitigations.push({
        code: "house-sign-exception",
        description: `Mars in house ${primary.house} (from the ${primary.reference}) falls in a sign traditionally treated as an exception.`,
      });
    }
    const jupiter = chart.grahas.Jupiter.sign;
    const fromJupiter = countFrom(mars, jupiter);
    if ([1, 5, 7, 9].includes(fromJupiter)) {
      mitigations.push({
        code: "jupiter-conjunct-or-aspect",
        description:
          fromJupiter === 1 ? "Jupiter is with Mars." : "Jupiter aspects Mars.",
      });
    }
    if (chart.grahas.Moon.sign === mars) {
      mitigations.push({
        code: "moon-conjunct",
        description: "The Moon is with Mars (Chandra-Mangala).",
      });
    }
  }

  const status =
    factorCount === 0
      ? "absent"
      : mitigations.length
        ? "present-with-mitigations"
        : "present";
  const placed = references
    .filter((r) => r.inManglikHouse)
    .map((r) => `house ${r.house} from the ${r.reference}`)
    .join(", ");
  const summary =
    factorCount === 0
      ? "Mars does not occupy a Manglik house from the references checked."
      : `Mars sits in ${placed}. This is one factor among many, read together with the full chart` +
        (mitigations.length
          ? `; ${mitigations.length} traditional mitigation(s) apply.`
          : ".");
  return { references, factorCount, mitigations, status, summary };
}
