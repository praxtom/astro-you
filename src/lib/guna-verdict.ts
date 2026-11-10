/**
 * The one set of Ashtakoot (Guna Milan) verdict bands, out of 36 points.
 * Every page that labels a Guna Milan total reads it from here so the same
 * score never gets two different words.
 *
 *   < 18   Not recommended
 *   18–24  Average
 *   25–32  Good
 *   33–36  Excellent
 */
export type GunaTone = "low" | "mid" | "good" | "great";

export interface GunaVerdict {
  label: string;
  tone: GunaTone;
}

export function gunaVerdict(score: number): GunaVerdict {
  const s = Number.isFinite(score) ? score : 0;
  if (s >= 33) return { label: "Excellent", tone: "great" };
  if (s >= 25) return { label: "Good", tone: "good" };
  if (s >= 18) return { label: "Average", tone: "mid" };
  return { label: "Not recommended", tone: "low" };
}

/** Text colour per tone, matching the existing Guna Milan styling. */
export const GUNA_TONE_TEXT_CLASS: Record<GunaTone, string> = {
  great: "text-yellow-400",
  good: "text-emerald-400",
  mid: "text-yellow-500",
  low: "text-amber-300",
};

/** Plain-English meaning of each of the eight Guna Milan factors (kootas). */
const KOOTA_MEANINGS: Record<string, string> = {
  varna: "Work styles and values",
  vashya: "Mutual attraction and influence",
  vasya: "Mutual attraction and influence",
  tara: "Wellbeing and luck together",
  dina: "Wellbeing and luck together",
  yoni: "Physical and intimate fit",
  grahamaitri: "Friendship and how your minds meet",
  maitri: "Friendship and how your minds meet",
  gana: "Temperament",
  bhakoot: "Love, family and money together",
  bhakut: "Love, family and money together",
  rashi: "Love, family and money together",
  nadi: "Health and starting a family",
};

/** "Varna Koota" / "graha_maitri" → its plain meaning, if known. */
export function kootaMeaning(name: unknown): string | undefined {
  if (typeof name !== "string") return undefined;
  const key = name
    .toLowerCase()
    .replace(/[\s_-]+(koota|kuta|koot|kut)$/, "")
    .replace(/[^a-z]/g, "");
  return KOOTA_MEANINGS[key];
}
