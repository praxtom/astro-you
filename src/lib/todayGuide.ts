import type { PanchangData } from "./panchang.js";
import type { UserProfile } from "../types/user.js";

export interface TodayGuide {
  energy: string;
  action: string;
  caution: string;
  nudge: string;
  /** "Why this?" — the chart and Panchang facts the guidance was drawn from. */
  why: string;
  /** Short context line, e.g. "Moon in Hasta · 7th from your Moon". */
  context?: string;
  /** True when the guidance is drawn from the user's own natal Moon. */
  personal: boolean;
}

/** The natal Moon, as saved on the profile (sidereal sign, birth star). */
export interface NatalMoon {
  moonSign?: string | null;
  moonNakshatra?: string | null;
}

const SIGNS = [
  ["aries", "mesha", "mesh"],
  ["taurus", "vrishabha", "vrishabh", "vrsabha"],
  ["gemini", "mithuna", "mithun"],
  ["cancer", "karka", "karkata", "kark"],
  ["leo", "simha", "singh"],
  ["virgo", "kanya"],
  ["libra", "tula"],
  ["scorpio", "vrishchika", "vrischika", "vrishchik"],
  ["sagittarius", "dhanu", "dhanus"],
  ["capricorn", "makara", "makar"],
  ["aquarius", "kumbha", "kumbh"],
  ["pisces", "meena", "mina", "meen"],
] as const;

const SIGN_NAMES = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

const ABBR = [
  "ari",
  "tau",
  "gem",
  "can",
  "leo",
  "vir",
  "lib",
  "sco",
  "sag",
  "cap",
  "aqu",
  "pis",
];

export function signIndex(value?: string | null): number | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  const byName = SIGNS.findIndex((names) =>
    (names as readonly string[]).includes(v),
  );
  if (byName >= 0) return byName;
  const byAbbr = ABBR.indexOf(v.slice(0, 3));
  return byAbbr >= 0 && v.length <= 4 ? byAbbr : null;
}

const NAKSHATRAS = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
];

/** Spelling-tolerant key: "Poorva Bhadra", "Purvabhadrapada" → same stem. */
function nakKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/oo/g, "u")
    .replace(/ee/g, "i")
    .replace(/h/g, "")
    .replace(/w/g, "v")
    .replace(/(.)\1+/g, "$1");
}

const NAK_KEYS = NAKSHATRAS.map(nakKey);
const NAK_ALIASES: Record<string, number> = {
  [nakKey("Mrigasirsha")]: 4,
  [nakKey("Mrigashirsha")]: 4,
  [nakKey("Aridra")]: 5,
  [nakKey("Pubba")]: 10,
  [nakKey("Uttara")]: 11,
  [nakKey("Svati")]: 14,
  [nakKey("Moola")]: 18,
  [nakKey("Purvashada")]: 19,
  [nakKey("Uttarashada")]: 20,
  [nakKey("Shravan")]: 21,
  [nakKey("Dhanishtha")]: 22,
  [nakKey("Shatataraka")]: 23,
};

export function nakshatraIndex(value?: string | null): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const key = nakKey(value);
  if (key.length < 3) return null;
  const exact = NAK_KEYS.indexOf(key);
  if (exact >= 0) return exact;
  if (key in NAK_ALIASES) return NAK_ALIASES[key];
  // "Purva Bhadra" vs "Purva Bhadrapada": one is a prefix of the other.
  if (key.length >= 5) {
    const prefix = NAK_KEYS.findIndex(
      (k) => k.startsWith(key) || key.startsWith(k),
    );
    if (prefix >= 0) return prefix;
  }
  return null;
}

const ordinal = (n: number) =>
  `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

/**
 * Chandra gochara: the house today's Moon occupies counted from the natal
 * Moon, with the traditional reading of each, in plain words.
 */
const MOON_HOUSE: Record<
  number,
  { theme: string; energy: string; action: string; gentle?: boolean }
> = {
  1: {
    theme: "feelings sit close to the surface",
    energy: "Tender and personal. Your own needs ask for attention.",
    action: "Give yourself one unhurried hour for something that steadies you.",
  },
  2: {
    theme: "money, family and the way you speak are in focus",
    energy: "Practical and grounded. Good for sorting what you value.",
    action: "Settle one money or family matter you've been putting off.",
  },
  3: {
    theme: "courage and initiative rise",
    energy: "Brave and quick. Small starts come easily.",
    action: "Send the message or make the call you've been rehearsing.",
  },
  4: {
    theme: "home and inner comfort are in focus; moods can dip",
    energy: "Quiet and inward. Home and rest restore you.",
    action:
      "Keep the day simple and spend time somewhere that feels like home.",
    gentle: true,
  },
  5: {
    theme: "creativity, study and affection are lit up",
    energy: "Warm and creative. Learning and play come naturally.",
    action: "Make or learn something just for the joy of it.",
  },
  6: {
    theme: "the day favours clearing tasks and health routines",
    energy: "Capable and orderly. Obstacles give way to steady effort.",
    action: "Clear one nagging task, or reset one health habit.",
  },
  7: {
    theme: "relationships are in focus",
    energy: "Open and relational. Good for one honest conversation.",
    action: "Say the one thing you've been holding back, kindly.",
  },
  8: {
    theme: "this is Chandrashtama, a sensitive day for the mind",
    energy: "Inward and sensitive. Feelings may run deeper than usual.",
    action: "Keep plans light and give reflection or journaling some time.",
    gentle: true,
  },
  9: {
    theme: "meaning, teachers and gratitude are in focus",
    energy: "Hopeful and wide. Good for perspective and learning.",
    action: "Reach out to a mentor, or note three things you're grateful for.",
  },
  10: {
    theme: "work and visibility are in focus",
    energy: "Purposeful and visible. Effort at work shows.",
    action: "Put your best hour into the one piece of work that matters most.",
  },
  11: {
    theme: "gains, friends and support come more easily",
    energy: "Social and supported. Good for asking and receiving.",
    action: "Ask a friend for help, or offer yours, on something concrete.",
  },
  12: {
    theme: "rest, retreat and letting go are favoured",
    energy: "Quiet and restorative. Less is more today.",
    action: "Rest early, and let go of one thing you don't need to carry.",
    gentle: true,
  },
};

/** Tara bala: today's nakshatra counted from the birth star, in nines. */
const TARAS: { name: string; meaning: string; gentle: boolean }[] = [
  {
    name: "Janma",
    meaning: "your own star returns, so stay close to yourself",
    gentle: true,
  },
  { name: "Sampat", meaning: "a star of wealth and support", gentle: false },
  { name: "Vipat", meaning: "a star of small obstacles", gentle: true },
  { name: "Kshema", meaning: "a star of well-being", gentle: false },
  { name: "Pratyak", meaning: "a star of friction", gentle: true },
  { name: "Sadhana", meaning: "a star of achievement", gentle: false },
  { name: "Naidhana", meaning: "the most demanding star", gentle: true },
  { name: "Mitra", meaning: "a friendly star", gentle: false },
  { name: "Parama Mitra", meaning: "the most friendly star", gentle: false },
];

const present = (v?: string | null): string | undefined =>
  typeof v === "string" && v.trim() && v.trim() !== "—" ? v.trim() : undefined;

/**
 * The day's guidance (Energy / Do / Take care) drawn from the user's natal
 * Moon and today's Panchang: the house today's Moon occupies from the natal
 * Moon (Chandra gochara) and the birth-star relationship (Tara bala). Atman's
 * memory adjusts the tone only when it actually knows something. It never
 * invents a mood.
 */
export function buildTodayGuide(
  atmanState: UserProfile["atman"] | undefined,
  panchang: PanchangData | null,
  panchangError: string | null,
  isSignedIn: boolean,
  natal?: NatalMoon | null,
): TodayGuide {
  const emotion = present(atmanState?.emotionalState);
  const hasRoutineGap =
    isSignedIn && (!atmanState?.routines || atmanState.routines.length === 0);

  const todayNak = present(panchang?.nakshatra);
  const todaySign = present(panchang?.moonSign);
  const rahu = present(panchang?.rahu_kaal);

  const natalSignIdx = signIndex(natal?.moonSign);
  const todaySignIdx = signIndex(todaySign);
  const house =
    natalSignIdx !== null && todaySignIdx !== null
      ? ((todaySignIdx - natalSignIdx + 12) % 12) + 1
      : null;
  const houseInfo = house ? MOON_HOUSE[house] : null;

  const natalNakIdx = nakshatraIndex(natal?.moonNakshatra);
  const todayNakIdx = nakshatraIndex(todayNak);
  const tara =
    natalNakIdx !== null && todayNakIdx !== null
      ? TARAS[((todayNakIdx - natalNakIdx + 27) % 27) % 9]
      : null;

  const personal = Boolean(houseInfo || tara);

  // Energy: the chart first; memory only when it knows a strained state.
  let energy: string;
  if (emotion === "anxious" || emotion === "chaotic") {
    energy = "Grounding first. Slower decisions serve you today.";
  } else if (houseInfo) {
    energy = houseInfo.energy;
  } else if (tara) {
    energy = tara.gentle
      ? "Steady and unhurried. Keep things simple."
      : "Supportive. A good day to move one thing forward.";
  } else if (todayNak) {
    energy = `The Moon is in ${todayNak}. Steady, practical movement.`;
  } else {
    energy = "Steady, practical movement.";
  }

  // Do: the chart's suggestion, softened when memory says the user is strained.
  const action =
    emotion === "anxious"
      ? "Begin with a short grounding practice at the Daily Altar before big choices."
      : houseInfo
        ? houseInfo.action
        : hasRoutineGap
          ? "Set one small daily practice so guidance has a rhythm to work with."
          : "Ask your guide one concrete question and turn the answer into one action.";

  // Take care: calm framing, never fear.
  const rahuLine = rahu
    ? `Rahu Kaal (${rahu}) is traditionally kept for routine work, so save fresh starts for another hour.`
    : null;
  const caution =
    house === 8
      ? `Go gently with big decisions today.${rahuLine ? ` ${rahuLine}` : ""}`
      : tara?.gentle
        ? `Keep plans simple and don't force outcomes.${rahuLine ? ` ${rahuLine}` : ""}`
        : (rahuLine ?? "Don't turn a passing mood into a final decision.");

  // Nudge (the hero's fallback reading): personal when we can be.
  const nudge = emotion
    ? `Lately you've seemed ${emotion.replace(/_/g, " ")}. Let today's pace match that.`
    : houseInfo && todaySign
      ? `The Moon moves through your ${ordinal(house!)} from your natal Moon today: ${houseInfo.theme}.`
      : hasRoutineGap
        ? "No daily practice is saved yet. Add one gentle anchor."
        : "Take a quiet moment to check in with yourself before the day gathers pace.";

  // Why this? The facts behind the guidance, in plain words.
  const why: string[] = [];
  if (houseInfo && todaySign && natal?.moonSign) {
    why.push(
      `Today's Moon is in ${SIGN_NAMES[todaySignIdx!]}, the ${ordinal(house!)} sign from your natal Moon in ${SIGN_NAMES[natalSignIdx!]}: ${houseInfo.theme}.`,
    );
  }
  if (tara && todayNak && natal?.moonNakshatra) {
    why.push(
      `Today's nakshatra, ${todayNak}, is ${tara.name} tara counted from your birth star ${natal.moonNakshatra}: ${tara.meaning}.`,
    );
  }
  if (!personal) {
    if (!panchang) {
      why.push(
        panchangError
          ? "Today's Panchang couldn't load, so this is general guidance."
          : "Today's Panchang is still loading.",
      );
    } else if (!natal?.moonSign && !natal?.moonNakshatra) {
      why.push(
        "This comes from today's Panchang alone. Once your chart has loaded, it is read against your natal Moon.",
      );
    } else {
      why.push(
        "Today's Panchang didn't include the Moon's position, so this is general guidance.",
      );
    }
  }
  if (rahu) why.push(`Rahu Kaal today is ${rahu}.`);
  if (emotion)
    why.push(
      `Your guide's memory notes you've seemed ${emotion.replace(/_/g, " ")} lately.`,
    );

  const contextParts = [
    todayNak ? `Moon in ${todayNak}` : null,
    house ? `${ordinal(house)} from your Moon` : null,
  ].filter(Boolean);

  return {
    energy,
    action,
    caution,
    nudge,
    why: why.join(" "),
    ...(contextParts.length ? { context: contextParts.join(" · ") } : {}),
    personal,
  };
}
