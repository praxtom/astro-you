export interface ZodiacSignContent {
  slug: string;
  name: string;
  symbol: string;
  element: string;
  mode: string;
  strength: string;
  watch: string;
  practice: string;
}

export interface HoroscopePeriodContent {
  slug: string;
  name: string;
  frame: string;
  action: string;
}

export interface SignHoroscopeContent {
  sign: ZodiacSignContent;
  period: HoroscopePeriodContent;
  path: string;
  title: string;
  description: string;
  forecast: string;
  focusAreas: Array<{ title: string; body: string }>;
}

export const ZODIAC_SIGNS: ZodiacSignContent[] = [
  {
    slug: "aries",
    name: "Aries",
    symbol: "\u2648",
    element: "Fire",
    mode: "cardinal",
    strength: "direct action and fast decisions",
    watch: "reacting before the full picture is clear",
    practice: "pause for one breath before committing",
  },
  {
    slug: "taurus",
    name: "Taurus",
    symbol: "\u2649",
    element: "Earth",
    mode: "fixed",
    strength: "steady building, patience, and material clarity",
    watch: "holding on after the situation has changed",
    practice: "choose one practical simplification",
  },
  {
    slug: "gemini",
    name: "Gemini",
    symbol: "\u264A",
    element: "Air",
    mode: "mutable",
    strength: "learning, conversation, and quick pattern recognition",
    watch: "scattering attention across too many threads",
    practice: "write the next three concrete steps",
  },
  {
    slug: "cancer",
    name: "Cancer",
    symbol: "\u264B",
    element: "Water",
    mode: "cardinal",
    strength: "care, memory, emotional intelligence, and protection",
    watch: "absorbing other people's moods as your own",
    practice: "separate care from over-responsibility",
  },
  {
    slug: "leo",
    name: "Leo",
    symbol: "\u264C",
    element: "Fire",
    mode: "fixed",
    strength: "visibility, confidence, creativity, and leadership",
    watch: "needing recognition before the work is complete",
    practice: "lead through consistency, not performance",
  },
  {
    slug: "virgo",
    name: "Virgo",
    symbol: "\u264D",
    element: "Earth",
    mode: "mutable",
    strength: "discernment, repair, craft, and useful detail",
    watch: "turning improvement into self-criticism",
    practice: "fix the one detail that unlocks the rest",
  },
  {
    slug: "libra",
    name: "Libra",
    symbol: "\u264E",
    element: "Air",
    mode: "cardinal",
    strength: "balance, fairness, design, and relationship intelligence",
    watch: "delaying truth to keep temporary peace",
    practice: "state the clean middle path clearly",
  },
  {
    slug: "scorpio",
    name: "Scorpio",
    symbol: "\u264F",
    element: "Water",
    mode: "fixed",
    strength: "depth, focus, privacy, and transformation",
    watch: "reading threat into silence or ambiguity",
    practice: "ask directly before protecting yourself from a guess",
  },
  {
    slug: "sagittarius",
    name: "Sagittarius",
    symbol: "\u2650",
    element: "Fire",
    mode: "mutable",
    strength: "faith, teaching, exploration, and big-picture truth",
    watch: "jumping to the lesson before checking the facts",
    practice: "ground the vision in one measurable promise",
  },
  {
    slug: "capricorn",
    name: "Capricorn",
    symbol: "\u2651",
    element: "Earth",
    mode: "cardinal",
    strength: "discipline, structure, responsibility, and long-range effort",
    watch: "carrying duties that should be renegotiated",
    practice: "protect one boundary around time or energy",
  },
  {
    slug: "aquarius",
    name: "Aquarius",
    symbol: "\u2652",
    element: "Air",
    mode: "fixed",
    strength: "systems thinking, community, innovation, and distance from drama",
    watch: "staying too detached from the human need underneath",
    practice: "connect the idea to the person affected by it",
  },
  {
    slug: "pisces",
    name: "Pisces",
    symbol: "\u2653",
    element: "Water",
    mode: "mutable",
    strength: "intuition, compassion, imagination, and surrender",
    watch: "blurring boundaries when empathy is high",
    practice: "make the compassionate choice specific and bounded",
  },
];

export const HOROSCOPE_PERIODS: HoroscopePeriodContent[] = [
  {
    slug: "daily",
    name: "Daily",
    frame: "today",
    action: "one clear choice",
  },
  {
    slug: "weekly",
    name: "Weekly",
    frame: "this week",
    action: "a realistic rhythm",
  },
  {
    slug: "monthly",
    name: "Monthly",
    frame: "this month",
    action: "a cleaner plan",
  },
  {
    slug: "yearly",
    name: "Yearly",
    frame: "this year",
    action: "a durable pattern",
  },
];

export function getSignHoroscopeContent(signSlug: string, periodSlug: string): SignHoroscopeContent {
  const sign = getZodiacSign(signSlug);
  const period = getHoroscopePeriod(periodSlug);
  const path = `/horoscope/${sign.slug}/${period.slug}`;

  return {
    sign,
    period,
    path,
    title: `${sign.name} ${period.name} Horoscope`,
    description: `Read ${sign.name} ${period.name.toLowerCase()} horoscope for ${period.frame}, then create a personal Vedic forecast from your birth chart.`,
    forecast: `${sign.name} guidance for ${period.frame}: use your ${sign.strength} carefully. The main risk is ${sign.watch}. Make ${period.action} the priority and ${sign.practice}. For a sharper reading, use your birth time and place so AstroYou can read your Moon sign, ascendant, dashas, and transits.`,
    focusAreas: [
      {
        title: "Use your strength",
        body: `${sign.name} works best through ${sign.strength}. Let that quality lead, but keep it practical.`,
      },
      {
        title: "Watch the pattern",
        body: `Be careful of ${sign.watch}. This is where the day can become heavier than it needs to be.`,
      },
      {
        title: "One useful practice",
        body: `${period.name} guidance: ${sign.practice}. Keep it simple enough to actually do.`,
      },
    ],
  };
}

export function getZodiacSign(signSlug: string): ZodiacSignContent {
  return ZODIAC_SIGNS.find((sign) => sign.slug === signSlug.toLowerCase()) ?? ZODIAC_SIGNS[0];
}

export function getHoroscopePeriod(periodSlug: string): HoroscopePeriodContent {
  return (
    HOROSCOPE_PERIODS.find((period) => period.slug === periodSlug.toLowerCase()) ??
    HOROSCOPE_PERIODS[0]
  );
}
