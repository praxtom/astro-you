/**
 * Allow-lists for astrological names that reach AI prompts.
 *
 * `profile.moonSign` / `sunSign` / `moonNakshatra` / `ascendant` are
 * owner-writable Firestore fields interpolated into the Gemini system prompt.
 * Free text there is a prompt-injection and token-cost vector, so they are
 * mapped to a canonical name from a closed list (case-insensitive, common
 * Sanskrit/English spellings and 3-letter codes accepted) or dropped.
 *
 * Pure module (no imports) so it can be unit-tested.
 */

const SIGNS: Array<[canonical: string, aliases: string[]]> = [
  ["Aries", ["ari", "mesha", "mesh"]],
  [
    "Taurus",
    ["tau", "vrishabha", "vrishabh", "vrishabam", "rishabha", "vrisha"],
  ],
  ["Gemini", ["gem", "mithuna", "mithun"]],
  ["Cancer", ["can", "karka", "karkata", "karkataka", "kark"]],
  ["Leo", ["simha", "sinha", "singh"]],
  ["Virgo", ["vir", "kanya"]],
  ["Libra", ["lib", "tula", "thula"]],
  [
    "Scorpio",
    ["sco", "vrischika", "vrishchika", "vrischik", "vrishchik", "vrushchika"],
  ],
  ["Sagittarius", ["sag", "dhanu", "dhanus", "dhanush"]],
  ["Capricorn", ["cap", "makara", "makar"]],
  ["Aquarius", ["aqu", "aqr", "kumbha", "kumbh"]],
  ["Pisces", ["pis", "meena", "mina", "meen"]],
];

const NAKSHATRAS: Array<[canonical: string, aliases: string[]]> = [
  ["Ashwini", ["aswini", "asvini", "ashvini"]],
  ["Bharani", ["bharni"]],
  ["Krittika", ["kritika", "krithika", "kruthika", "karthigai", "kartika"]],
  ["Rohini", []],
  [
    "Mrigashira",
    [
      "mrigashirsha",
      "mrigasira",
      "mrigasirsha",
      "mrigsira",
      "mrigashirsa",
      "mrigashir",
    ],
  ],
  ["Ardra", ["arudra", "aridra", "thiruvathirai"]],
  ["Punarvasu", ["punarpoosam", "punarvasu"]],
  ["Pushya", ["pushyami", "pushyam", "poosam", "pooyam", "pusya"]],
  ["Ashlesha", ["aslesha", "ashlesa", "aslesa", "ayilyam"]],
  ["Magha", ["makha", "magam"]],
  [
    "Purva Phalguni",
    ["purvaphalguni", "poorvaphalguni", "pubba", "purvaphalgun", "pooram"],
  ],
  [
    "Uttara Phalguni",
    ["uttaraphalguni", "uthraphalguni", "uttaraphalgun", "uthiram"],
  ],
  ["Hasta", ["hastha", "hastam", "hast"]],
  ["Chitra", ["chithra", "chitta", "chithirai"]],
  ["Swati", ["svati", "swathi", "swaati"]],
  ["Vishakha", ["visakha", "vishaka", "visaka", "visakam"]],
  ["Anuradha", ["anusham", "anuraadha"]],
  ["Jyeshtha", ["jyeshta", "jyestha", "jyesta", "kettai"]],
  ["Mula", ["moola", "moolam"]],
  [
    "Purva Ashadha",
    [
      "purvashadha",
      "poorvashadha",
      "purvaashadha",
      "purvashada",
      "poorvashada",
      "pooradam",
    ],
  ],
  [
    "Uttara Ashadha",
    ["uttarashadha", "uttaraashadha", "uthrashadha", "uttarashada", "uthradam"],
  ],
  ["Shravana", ["sravana", "shravan", "sravan", "thiruvonam"]],
  ["Dhanishta", ["dhanishtha", "dhanista", "dhanistha", "avittam"]],
  [
    "Shatabhisha",
    ["satabhisha", "shatabhishak", "shatataraka", "satabhishak", "sadayam"],
  ],
  [
    "Purva Bhadrapada",
    [
      "purvabhadrapada",
      "poorvabhadrapada",
      "purvabhadra",
      "poorvabhadra",
      "poorattathi",
    ],
  ],
  [
    "Uttara Bhadrapada",
    ["uttarabhadrapada", "uttarabhadra", "uthrabhadra", "uthrattathi"],
  ],
  ["Revati", ["revathi", "revathy"]],
];

/** Lowercase letters only: "Purva-Phalguni", "purva phalguni" → "purvaphalguni". */
function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function buildLookup(table: Array<[string, string[]]>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [canonical, aliases] of table) {
    map.set(squash(canonical), canonical);
    for (const alias of aliases) map.set(squash(alias), canonical);
  }
  return map;
}

const SIGN_LOOKUP = buildLookup(SIGNS);
const NAKSHATRA_LOOKUP = buildLookup(NAKSHATRAS);
const MAX_INPUT_CHARS = 40;

function lookup(map: Map<string, string>, value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > MAX_INPUT_CHARS) {
    return undefined;
  }
  // Tolerate a trailing pada annotation: "Rohini (Pada 2)", "Rohini pada 2".
  const base = value.replace(/\(.*\)|\bpada\b.*$/i, "");
  return map.get(squash(base));
}

/** Canonical English sign name ("Taurus") or undefined when unrecognized. */
export function canonicalSignName(value: unknown): string | undefined {
  return lookup(SIGN_LOOKUP, value);
}

/** Canonical nakshatra name ("Purva Phalguni") or undefined when unrecognized. */
export function canonicalNakshatraName(value: unknown): string | undefined {
  return lookup(NAKSHATRA_LOOKUP, value);
}
