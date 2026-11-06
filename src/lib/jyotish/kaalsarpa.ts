/**
 * Kaal Sarpa pattern: all seven planets on one side of the Rahu–Ketu axis.
 * Uses exact longitudes (a planet exactly on a node counts as inside).
 * "partial" = exactly one planet outside the hemmed arc. The twelve named
 * variants follow Rahu's house from the lagna (or Moon when time is unknown).
 */
import { SAPTA_GRAHAS, normDeg } from "./types.js";
import type { CanonicalChart, SaptaGraha } from "./types.js";

export const KAAL_SARPA_NAMES = [
  "Anant",
  "Kulik",
  "Vasuki",
  "Shankhpal",
  "Padma",
  "Mahapadma",
  "Takshak",
  "Karkotak",
  "Shankhachud",
  "Ghatak",
  "Vishdhar",
  "Sheshnag",
] as const;

export interface KaalSarpaResult {
  status: "full" | "partial" | "none";
  /** Which half the planets occupy: from Rahu forward to Ketu, or from Ketu forward to Rahu. */
  side?: "rahu-to-ketu" | "ketu-to-rahu";
  /** Named variant by Rahu's house (only when status !== "none"). */
  name?: (typeof KAAL_SARPA_NAMES)[number];
  rahuHouse: number;
  /** Planets outside the hemmed arc (one for partial). */
  outside: SaptaGraha[];
}

export function kaalSarpaAnalysis(
  chart: Pick<CanonicalChart, "grahas">,
): KaalSarpaResult {
  const rahu = chart.grahas.Rahu.longitude;
  const rahuHouse = chart.grahas.Rahu.house;
  const forward: SaptaGraha[] = [];
  const backward: SaptaGraha[] = [];
  for (const g of SAPTA_GRAHAS) {
    const d = normDeg(chart.grahas[g].longitude - rahu);
    if (d <= 180) forward.push(g);
    if (d >= 180 || d === 0) backward.push(g);
  }
  const best =
    forward.length >= backward.length
      ? { side: "rahu-to-ketu" as const, inside: forward }
      : { side: "ketu-to-rahu" as const, inside: backward };
  const outside = SAPTA_GRAHAS.filter((g) => !best.inside.includes(g));
  const status =
    outside.length === 0 ? "full" : outside.length === 1 ? "partial" : "none";
  if (status === "none") return { status, rahuHouse, outside };
  return {
    status,
    side: best.side,
    name: KAAL_SARPA_NAMES[rahuHouse - 1],
    rahuHouse,
    outside,
  };
}
